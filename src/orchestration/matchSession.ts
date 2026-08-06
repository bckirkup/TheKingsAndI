import {
  extractMoveFeatures,
  LivingBoard,
  type MoveFeatures,
  type MoveIntent,
  type Side,
  type Square,
} from '../chess';
import { createSeededRandom, type SeededRandom } from '../core/random';
import {
  applyNeglectSignal,
  evaluateMoveResponse,
  normalizePieceState,
  raiseLossEstimatesAfterDesertion,
  applyOverride,
  type CandidateMoveEvaluation,
  type DesertionContext,
  type MatchEvent,
  type MoveDecisionOutcome,
  type MoveResponseVerdict,
  type PieceState,
} from '../psychology';

import { featuresToEvaluation } from './evaluation';
import { shouldDismiss } from './campaignPolicy';
import { chooseKingCommandMove } from './kingCommand';
import { chooseRandomOpponentMove } from './opponent';
import { createStartingRoster } from './roster';

export type MatchPhase =
  | 'playing'
  | 'awaiting_player'
  | 'game_over'
  | 'rout'
  | 'succession_spectate';

export interface PendingVerdict {
  readonly intent: MoveIntent;
  readonly san: string;
  readonly actor: PieceState;
  readonly features: MoveFeatures;
  readonly moveEval: CandidateMoveEvaluation;
  readonly outcome: MoveDecisionOutcome;
  readonly verdict: 'MORAL_REFUSAL' | 'DESERTION_MUTINY';
}

export interface DialogueCue {
  readonly eventKind:
    | 'refusal'
    | 'override'
    | 'desertion'
    | 'quiet_quit'
    | 'compliant'
    | 'heroic'
    | 'rout';
  readonly pieceId: string;
  readonly san: string;
  readonly verdict?: MoveResponseVerdict;
}

export interface MatchSessionSnapshot {
  readonly board: LivingBoard;
  readonly roster: readonly PieceState[];
  readonly events: readonly MatchEvent[];
  readonly ply: number;
  readonly phase: MatchPhase;
  readonly pending: PendingVerdict | null;
  readonly dialogueCue: DialogueCue | null;
  readonly playerSide: Side;
  readonly seed: number;
  readonly selectedPieceId: string | null;
  readonly rout: boolean;
  readonly winScore: number;
  readonly lastMove: readonly [Square, Square] | null;
  readonly dismissed: boolean;
}

export interface MatchSessionConfig {
  readonly seed?: number;
  readonly playerSide?: Side;
  readonly initialTrust?: number;
  readonly initialRoster?: readonly PieceState[];
}

function desertionContextFor(
  piece: PieceState,
  moveEval: CandidateMoveEvaluation,
): DesertionContext {
  const pLossBase = piece.rumor.pLossTeam / 1000;
  const captureStress =
    moveEval.P_captured > 0.35 ? moveEval.P_captured * 0.3 : 0;
  return {
    P_captured: moveEval.P_captured,
    P_lossIfStay: Math.min(1, pLossBase + captureStress),
    P_lossIfLeave: Math.min(1, pLossBase + 0.5),
  };
}

function updatePiece(
  roster: PieceState[],
  pieceId: string,
  updater: (piece: PieceState) => PieceState,
): PieceState[] {
  return roster.map((piece) =>
    piece.id === pieceId ? normalizePieceState(updater(piece)) : piece,
  );
}

function syncRoster(
  board: LivingBoard,
  roster: PieceState[],
  side: Side,
): PieceState[] {
  const activeIds = new Set(board.piecesOf(side).map((piece) => piece.id));
  return roster.filter((piece) => activeIds.has(piece.id));
}

export class MatchSession {
  private board: LivingBoard;
  private roster: PieceState[];
  private events: MatchEvent[] = [];
  private ply = 1;
  private phase: MatchPhase = 'playing';
  private pending: PendingVerdict | null = null;
  private dialogueCue: DialogueCue | null = null;
  private readonly random: SeededRandom;
  private readonly matchSeed: number;
  private readonly playerSide: Side;
  private selectedPieceId: string | null = null;
  private rout = false;
  private lastMove: readonly [Square, Square] | null = null;
  private dismissed = false;

  constructor(config: MatchSessionConfig = {}) {
    const seed = config.seed ?? 1;
    this.matchSeed = seed;
    this.random = createSeededRandom(seed);
    this.playerSide = config.playerSide ?? 'w';
    this.board = LivingBoard.standard();
    this.roster =
      config.initialRoster !== undefined
        ? config.initialRoster.map(normalizePieceState)
        : createStartingRoster(
            this.board,
            this.playerSide,
            config.initialTrust ?? 20,
            this.random.nextInt(10_000) / 10_000,
          );
  }

  snapshot(): MatchSessionSnapshot {
    return {
      board: this.board,
      roster: this.roster.map(normalizePieceState),
      events: [...this.events],
      ply: this.ply,
      phase: this.phase,
      pending: this.pending,
      dialogueCue: this.dialogueCue,
      playerSide: this.playerSide,
      seed: this.matchSeed,
      selectedPieceId: this.selectedPieceId,
      rout: this.rout,
      winScore: this.winScore(),
      lastMove: this.lastMove,
      dismissed: this.dismissed,
    };
  }

  winScore(): number {
    if (!this.board.isGameOver() && !this.rout) return 50;
    if (this.rout) return 0;
    return this.board.turn() === this.playerSide ? 0 : 100;
  }

  selectPiece(pieceId: string | null): void {
    this.selectedPieceId = pieceId;
    this.dialogueCue = null;
  }

  clearDialogue(): void {
    this.dialogueCue = null;
  }

  submitPlayerIntent(intent: MoveIntent): boolean {
    if (this.phase !== 'playing' || this.board.turn() !== this.playerSide) {
      return false;
    }
    if (!this.board.isLegal(intent)) return false;

    const mover = this.board.pieceAt(intent.from);
    if (mover === undefined || mover.side !== this.playerSide) return false;

    const actor = this.roster.find((piece) => piece.id === mover.id);
    if (actor === undefined) return false;

    const features = extractMoveFeatures(this.board, intent);
    const moveEval = featuresToEvaluation(features, 0);
    const outcome = evaluateMoveResponse(
      actor,
      moveEval,
      this.roster,
      desertionContextFor(actor, moveEval),
    );

    if (outcome.verdict === 'MORAL_REFUSAL') {
      this.pending = {
        intent,
        san: features.san,
        actor,
        features,
        moveEval,
        outcome,
        verdict: 'MORAL_REFUSAL',
      };
      this.phase = 'awaiting_player';
      this.dialogueCue = {
        eventKind: 'refusal',
        pieceId: actor.id,
        san: features.san,
        verdict: outcome.verdict,
      };
      return true;
    }

    if (outcome.verdict === 'DESERTION_MUTINY') {
      this.pending = {
        intent,
        san: features.san,
        actor,
        features,
        moveEval,
        outcome,
        verdict: 'DESERTION_MUTINY',
      };
      this.phase = 'awaiting_player';
      this.dialogueCue = {
        eventKind: 'desertion',
        pieceId: actor.id,
        san: features.san,
        verdict: outcome.verdict,
      };
      return true;
    }

    this.commitPlayerMove(intent, features.san, actor, outcome, moveEval);
    this.runOpponentTurn();
    this.maybeTriggerDismissal();
    return true;
  }

  replanAfterRefusal(): void {
    const pending = this.pending;
    if (pending === null || pending.verdict !== 'MORAL_REFUSAL') return;

    this.events.push({
      t: 'REFUSAL',
      ply: this.ply,
      pieceId: pending.actor.id,
      utility: pending.outcome.utilityScore,
      threshold: pending.outcome.refusalThreshold,
      perceivedValue: pending.outcome.perceivedValue,
    });
    this.roster = updatePiece(this.roster, pending.actor.id, (piece) => ({
      ...piece,
      credence: applyNeglectSignal(piece.credence),
    }));
    this.pending = null;
    this.phase = 'playing';
    this.ply += 1;
  }

  confirmOverride(): void {
    const pending = this.pending;
    if (pending === null || pending.verdict !== 'MORAL_REFUSAL') return;

    const witnesses = this.roster.filter(
      (piece) => piece.id !== pending.actor.id,
    );
    const override = applyOverride(
      pending.actor,
      witnesses,
      this.ply,
      pending.san,
    );
    this.events.push(override.event, ...override.witnessEvents);
    this.roster = this.roster.map((piece) => {
      if (piece.id === override.overriddenPiece.id) {
        return normalizePieceState(override.overriddenPiece);
      }
      const witness = override.witnesses.find((w) => w.id === piece.id);
      return witness === undefined ? piece : normalizePieceState(witness);
    });

    this.commitPlayerMove(
      pending.intent,
      pending.san,
      override.overriddenPiece,
      { ...pending.outcome, verdict: 'COMPLIANT_EXECUTION' },
      pending.moveEval,
    );
    this.pending = null;
    this.phase = 'playing';
    this.dialogueCue = {
      eventKind: 'override',
      pieceId: pending.actor.id,
      san: pending.san,
      verdict: 'COMPLIANT_EXECUTION',
    };
    this.runOpponentTurn();
    this.maybeTriggerDismissal();
  }

  acknowledgeDesertion(): void {
    const pending = this.pending;
    if (pending === null || pending.verdict !== 'DESERTION_MUTINY') return;

    this.events.push({
      t: 'DESERTION',
      ply: this.ply,
      pieceId: pending.actor.id,
      refusedMove: pending.san,
      uStay: 0,
      uDesert: 0,
    });
    this.board.withdrawPiece(pending.actor.id);
    this.roster = this.roster.filter((piece) => piece.id !== pending.actor.id);
    this.roster = raiseLossEstimatesAfterDesertion(
      this.roster,
      pending.actor.id,
    ).map(normalizePieceState);
    this.pending = null;
    this.phase = 'playing';
    this.ply += 1;

    if (this.roster.length <= 1) {
      this.rout = true;
      this.phase = 'rout';
      this.dialogueCue = {
        eventKind: 'rout',
        pieceId: pending.actor.id,
        san: pending.san,
      };
      return;
    }

    this.dialogueCue = {
      eventKind: 'desertion',
      pieceId: pending.actor.id,
      san: pending.san,
      verdict: 'DESERTION_MUTINY',
    };
    this.runOpponentTurn();
    this.maybeTriggerDismissal();
  }

  /** Fast-forward remainder under the King after dismissal (ADR 0022). */
  fastForwardSuccession(): void {
    if (
      !this.dismissed ||
      this.phase === 'rout' ||
      this.phase === 'game_over'
    ) {
      return;
    }
    this.playUnderKingCommand();
  }

  private maybeTriggerDismissal(): void {
    if (this.dismissed || this.rout || this.phase === 'game_over') return;
    if (!shouldDismiss(this.roster)) return;
    this.dismissed = true;
    this.phase = 'succession_spectate';
    this.dialogueCue = {
      eventKind: 'rout',
      pieceId: this.roster[0]?.id ?? 'w:K:e1',
      san: '—',
    };
    this.playUnderKingCommand();
  }

  private playUnderKingCommand(): void {
    while (
      this.phase === 'succession_spectate' &&
      !this.board.isGameOver() &&
      !this.rout
    ) {
      if (this.board.turn() === this.playerSide) {
        const san = chooseKingCommandMove(this.board, this.random);
        if (san === undefined) {
          this.phase = 'game_over';
          return;
        }
        const applied = this.board.applySan(san);
        this.lastMove = [applied.from, applied.to];
        this.events.push({
          t: 'MOVE',
          ply: this.ply,
          san,
          pieceId: applied.moverId,
          verdict: 'COMPLIANT_EXECUTION',
          orderQualityCp: 40,
        });
        this.roster = syncRoster(this.board, this.roster, this.playerSide);
        this.ply += 1;
      } else {
        this.runOpponentTurn();
      }
      if (this.board.isGameOver()) {
        this.phase = 'game_over';
      }
    }
  }

  private commitPlayerMove(
    intent: MoveIntent,
    san: string,
    actor: PieceState,
    outcome: MoveDecisionOutcome,
    moveEval: CandidateMoveEvaluation,
  ): void {
    const applied = this.board.applyMove(intent);
    this.lastMove = [applied.from, applied.to];
    this.events.push({
      t: 'MOVE',
      ply: this.ply,
      san,
      pieceId: actor.id,
      verdict: outcome.verdict,
      orderQualityCp: Math.round(moveEval.deltaV_board * 100),
    });
    this.roster = updatePiece(this.roster, actor.id, (piece) => ({
      ...piece,
      engagementFactor: outcome.engagementFactor,
    }));
    this.roster = syncRoster(this.board, this.roster, this.playerSide);
    this.ply += 1;
    this.selectedPieceId = null;

    if (outcome.verdict === 'QUIET_QUITTING') {
      this.dialogueCue = {
        eventKind: 'quiet_quit',
        pieceId: actor.id,
        san,
        verdict: outcome.verdict,
      };
    } else if (outcome.verdict === 'HEROIC_EXECUTION') {
      this.dialogueCue = {
        eventKind: 'heroic',
        pieceId: actor.id,
        san,
        verdict: outcome.verdict,
      };
    } else {
      this.dialogueCue = {
        eventKind: 'compliant',
        pieceId: actor.id,
        san,
        verdict: outcome.verdict,
      };
    }

    if (this.board.isGameOver()) {
      this.phase = 'game_over';
    }
  }

  private runOpponentTurn(): void {
    if (this.phase === 'rout' || this.phase === 'game_over') return;
    if (this.board.turn() === this.playerSide) return;

    const san = chooseRandomOpponentMove(this.board, this.random);
    if (san === undefined) {
      this.phase = 'game_over';
      return;
    }
    const applied = this.board.applySan(san);
    this.lastMove = [applied.from, applied.to];
    this.roster = syncRoster(this.board, this.roster, this.playerSide);
    this.ply += 1;
    if (this.board.isGameOver()) {
      this.phase = 'game_over';
    }
  }
}

export function squareKey(square: Square): string {
  return square;
}
