import {
  extractMoveFeatures,
  LivingBoard,
  type MoveFeatures,
  type MoveIntent,
  type Side,
  type Square,
} from '../chess';
import { createSeededRandom, type SeededRandom } from '../core/random';
import { SHARED_SEARCH_D_MAX } from '../engine';
import type { EngineAuditEntry, EnginePort } from '../engine/types';
import {
  applyNeglectSignal,
  applyCaptureInjury,
  applyFatalisticComplianceCosts,
  evaluateMoveResponse,
  normalizePieceState,
  applyOverride,
  justifiedRefusalObviousness,
  shouldDesert,
  type CandidateMoveEvaluation,
  type DesertionDecisionTerms,
  type MatchEvent,
  type MoveDecisionOutcome,
  type MoveResponseVerdict,
  type PieceState,
} from '../psychology';

import { insightToEvaluation, isVindicatedMove } from './evaluation';
import { engineAuditEntry, heroismNomination } from './heroism';
import {
  evaluateDismissal,
  selectSuccessorLeader,
  type DismissalCause,
} from './campaignPolicy';
import {
  createInsightRoundHandle,
  resolveAuditPositionScore,
  resolveBestAuditMoveScore,
  resolveAuditMoveScore,
  resolveMoverInsights,
  type InsightRoundHandle,
} from './insight';
import { chooseKingCommandMove } from './kingCommand';
import { type OpponentArchetype } from './leaderPolicy';
import { applyEnemyTurn } from './enemyTurn';
import { applyMoveTrauma, type DreadExposureByPiece } from './trauma';
import { scoreMatchOutcome } from './outcomeScore';
import {
  applyDesertionWithCascade,
  applyPostMoveCredence,
  applyPosthumousClassCredit,
  applyRosterAbilityObservations,
  applyRefusalAuthorityCost,
  applySacrificeWitnesses,
  applyDeclinedSacrificeSignal,
  applyCostlySignalsToRoster,
  attributeSacrifice,
  desertionContextFor,
  detectDeclinedSacrificeCostlySignal,
  detectKingEndangermentCostlySignal,
  isAvengedCapture,
} from './psychologyHooks';
import { createStartingRoster } from './roster';
import { kingExposureAfterWithdrawals } from './kingExposure';

export type MatchPhase =
  | 'playing'
  | 'thinking'
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
  readonly orderQualityCp: number;
  readonly audit: EngineAuditEntry;
  readonly objectivelyGood: boolean;
  readonly justified: boolean;
  readonly outcome: MoveDecisionOutcome;
  readonly verdict: 'MORAL_REFUSAL' | 'DESERTION_MUTINY';
  readonly desertionTerms: DesertionDecisionTerms;
  readonly desertionUStay: number;
  readonly desertionUDesert: number;
  readonly desertionMoveEvals: Readonly<
    Record<string, CandidateMoveEvaluation>
  >;
  readonly declinedSacrificeOpportunity:
    | {
        readonly sacrificedPieceId: string;
        readonly preferredMove: string;
        readonly preferredScoreCp: number;
      }
    | undefined;
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
  /** Enemy psych state — never expose via gauges (ADR 0025); tests only. */
  readonly enemyRoster: readonly PieceState[];
  readonly events: readonly MatchEvent[];
  readonly ply: number;
  readonly phase: MatchPhase;
  readonly pending: PendingVerdict | null;
  readonly dialogueCue: DialogueCue | null;
  readonly playerSide: Side;
  readonly seed: number;
  readonly selectedPieceId: string | null;
  readonly rout: boolean;
  readonly enemyRout: boolean;
  readonly winScore: number;
  readonly lastMove: readonly [Square, Square] | null;
  readonly dismissed: boolean;
  readonly dismissalCause: DismissalCause | null;
  readonly successorLeaderId: string | null;
  readonly kingTauAbil: number;
  readonly determinismId: string;
  readonly engineAudit: readonly EngineAuditEntry[];
}

export interface MatchSessionConfig {
  readonly engine: EnginePort;
  readonly seed?: number;
  readonly playerSide?: Side;
  readonly initialTrust?: number;
  readonly initialRoster?: readonly PieceState[];
  readonly initialEnemyRoster?: readonly PieceState[];
  readonly opponentArchetype?: OpponentArchetype;
  readonly rosterPreamble?: readonly MatchEvent[];
  readonly kingTauAbil?: number;
  readonly rivalLeaderId?: string;
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
  private enemyRoster: PieceState[];
  private readonly events: MatchEvent[] = [];
  private ply = 1;
  private phase: MatchPhase = 'playing';
  private pending: PendingVerdict | null = null;
  private dialogueCue: DialogueCue | null = null;
  private readonly random: SeededRandom;
  private readonly matchSeed: number;
  private readonly playerSide: Side;
  private selectedPieceId: string | null = null;
  private rout = false;
  private enemyRout = false;
  private lastMove: readonly [Square, Square] | null = null;
  private dismissed = false;
  private dismissalCause: DismissalCause | null = null;
  private successorLeaderId: string | null = null;
  private kingTauAbil: number;
  private readonly rivalLeaderId: string;
  private readonly opponentArchetype: OpponentArchetype;
  private readonly engine: EnginePort;
  private readonly insight: InsightRoundHandle;
  private lastFriendlyCapturePly: number | undefined;
  private abilityDripStreakByPiece: Readonly<Record<string, number>> = {};
  private dreadExposureByPiece: DreadExposureByPiece = {};
  private enemyDreadExposureByPiece: DreadExposureByPiece = {};
  private readonly engineAudit: EngineAuditEntry[] = [];

  constructor(config: MatchSessionConfig) {
    const seed = config.seed ?? 1;
    this.matchSeed = seed;
    this.random = createSeededRandom(seed);
    this.playerSide = config.playerSide ?? 'w';
    this.opponentArchetype = config.opponentArchetype ?? 'random';
    this.engine = config.engine;
    this.insight = createInsightRoundHandle();
    this.kingTauAbil = config.kingTauAbil ?? 50;
    this.rivalLeaderId =
      config.rivalLeaderId ?? `opponent:${this.opponentArchetype}`;
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
    const enemySide = this.playerSide === 'w' ? 'b' : 'w';
    this.enemyRoster =
      config.initialEnemyRoster !== undefined
        ? config.initialEnemyRoster.map(normalizePieceState)
        : createStartingRoster(
            this.board,
            enemySide,
            config.initialTrust ?? 20,
            this.random.nextInt(10_000) / 10_000,
          );
    if (config.rosterPreamble !== undefined) {
      this.events.push(...config.rosterPreamble);
    }
  }

  snapshot(): MatchSessionSnapshot {
    return {
      board: this.board,
      roster: this.roster.map(normalizePieceState),
      enemyRoster: this.enemyRoster.map(normalizePieceState),
      events: [...this.events],
      ply: this.ply,
      phase: this.phase,
      pending: this.pending,
      dialogueCue: this.dialogueCue,
      playerSide: this.playerSide,
      seed: this.matchSeed,
      selectedPieceId: this.selectedPieceId,
      rout: this.rout,
      enemyRout: this.enemyRout,
      winScore: this.winScore(),
      lastMove: this.lastMove,
      dismissed: this.dismissed,
      dismissalCause: this.dismissalCause,
      successorLeaderId: this.successorLeaderId,
      kingTauAbil: this.kingTauAbil,
      determinismId: this.engine.determinismId,
      engineAudit: [...this.engineAudit],
    };
  }

  winScore(): number {
    return scoreMatchOutcome(
      this.board,
      this.playerSide,
      this.rout,
      this.enemyRout,
    );
  }

  selectPiece(pieceId: string | null): void {
    this.selectedPieceId = pieceId;
    this.dialogueCue = null;
  }

  clearDialogue(): void {
    this.dialogueCue = null;
  }

  async submitPlayerIntent(intent: MoveIntent): Promise<boolean> {
    if (this.phase !== 'playing' || this.board.turn() !== this.playerSide) {
      return false;
    }
    if (!this.board.isLegal(intent)) return false;

    const mover = this.board.pieceAt(intent.from);
    if (mover?.side !== this.playerSide) return false;

    const actor = this.roster.find((piece) => piece.id === mover.id);
    if (actor === undefined) return false;

    this.phase = 'thinking';
    const features = extractMoveFeatures(this.board, intent);
    const insights = await resolveMoverInsights(
      this.engine,
      this.board,
      intent,
      actor,
      this.insight,
      this.roster,
      features,
    );
    const moveEval = insightToEvaluation(
      features,
      insights.actor,
      insights.leader,
      0,
      insights.actorPrivateScoreCp,
    );
    const desertionMoveEvals = {
      ...insights.desertionMoveEvals,
      [actor.id]: moveEval,
    };
    const orderQualityCp = await resolveAuditMoveScore(
      this.engine,
      this.board,
      intent,
      this.insight,
    );
    const bestAuditScore = await resolveBestAuditMoveScore(
      this.engine,
      this.board,
      this.insight,
    );
    const audit = engineAuditEntry({
      ply: this.ply,
      pieceId: actor.id,
      san: features.san,
      preMoveScoreCp: await resolveAuditPositionScore(
        this.engine,
        this.board,
        this.insight,
      ),
      scoreCp: orderQualityCp,
      bestScoreCp: bestAuditScore,
      preMoveDepth: SHARED_SEARCH_D_MAX,
      scoreDepth: 8,
      bestScoreDepth: SHARED_SEARCH_D_MAX,
    });
    this.engineAudit.push(audit);
    const justified = moveEval.deltaV_board < 0 && orderQualityCp < 0;
    const desertionContext = desertionContextFor(actor, moveEval, this.roster);
    const outcome = evaluateMoveResponse(
      actor,
      moveEval,
      this.roster,
      desertionContext,
    );
    const objectivelyGood = isVindicatedMove(
      orderQualityCp,
      bestAuditScore,
      bestAuditScore,
      outcome.perceivedValue,
    );
    if (outcome.verdict === 'MORAL_REFUSAL') {
      const desertionDecision = shouldDesert(
        actor,
        desertionContext,
        this.roster,
      );
      this.pending = {
        intent,
        san: features.san,
        actor,
        features,
        moveEval,
        orderQualityCp,
        audit,
        objectivelyGood,
        justified,
        outcome,
        verdict: 'MORAL_REFUSAL',
        desertionTerms: desertionDecision.terms,
        desertionUStay: desertionDecision.uStay,
        desertionUDesert: desertionDecision.uDesert,
        desertionMoveEvals,
        declinedSacrificeOpportunity: insights.declinedSacrificeOpportunity,
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
      const desertionDecision = shouldDesert(
        actor,
        desertionContext,
        this.roster,
      );
      this.pending = {
        intent,
        san: features.san,
        actor,
        features,
        moveEval,
        orderQualityCp,
        audit,
        objectivelyGood,
        justified,
        outcome,
        verdict: 'DESERTION_MUTINY',
        desertionTerms: desertionDecision.terms,
        desertionUStay: desertionDecision.uStay,
        desertionUDesert: desertionDecision.uDesert,
        desertionMoveEvals,
        declinedSacrificeOpportunity: insights.declinedSacrificeOpportunity,
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

    this.commitPlayerMove(
      intent,
      features.san,
      actor,
      outcome,
      moveEval,
      orderQualityCp,
      audit,
      objectivelyGood,
      features,
      insights.declinedSacrificeOpportunity,
      desertionMoveEvals,
      bestAuditScore,
    );
    await this.runOpponentTurn();
    this.maybeTriggerDismissal();
    if (this.phase === 'thinking') {
      this.phase = 'playing';
    }
    return true;
  }

  replanAfterRefusal(): void {
    const pending = this.pending;
    if (pending?.verdict !== 'MORAL_REFUSAL') return;
    const justified = pending.justified;

    const refusalEvent: Extract<MatchEvent, { t: 'REFUSAL' }> = {
      t: 'REFUSAL',
      ply: this.ply,
      pieceId: pending.actor.id,
      utility: pending.outcome.utilityScore,
      threshold: pending.outcome.refusalThreshold,
      perceivedValue: pending.outcome.perceivedValue,
      privateViewLoss: justified ? -pending.moveEval.deltaV_board : 0,
      obviousness: justified
        ? justifiedRefusalObviousness(pending.moveEval.deltaV_board, true)
        : 0,
      authorityLoss: 0,
      justified,
    };
    this.events.push(refusalEvent);
    const authority = applyRefusalAuthorityCost(
      this.roster,
      pending.actor.id,
      pending.moveEval.deltaV_board,
      justified,
    );
    this.events[this.events.length - 1] = {
      ...refusalEvent,
      authorityLoss: authority.authorityLoss,
    };
    this.roster = authority.roster;
    this.roster = updatePiece(this.roster, pending.actor.id, (piece) => ({
      ...piece,
      credence: applyNeglectSignal(piece.credence),
    }));
    this.pending = null;
    this.phase = 'playing';
  }

  async confirmOverride(): Promise<void> {
    const pending = this.pending;
    if (pending?.verdict !== 'MORAL_REFUSAL') return;

    const witnesses = this.roster.filter(
      (piece) => piece.id !== pending.actor.id,
    );
    const override = applyOverride(
      pending.actor,
      witnesses,
      this.ply,
      pending.san,
      pending.objectivelyGood,
    );
    this.events.push(
      {
        ...override.event,
        authorityGain: 0,
      } as Extract<MatchEvent, { t: 'OVERRIDE' }>,
      ...override.witnessEvents,
    );
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
      pending.orderQualityCp,
      pending.audit,
      pending.objectivelyGood,
      pending.features,
      pending.declinedSacrificeOpportunity,
      pending.desertionMoveEvals,
      pending.orderQualityCp,
    );
    this.pending = null;
    this.phase = 'playing';
    this.dialogueCue = {
      eventKind: 'override',
      pieceId: pending.actor.id,
      san: pending.san,
      verdict: 'COMPLIANT_EXECUTION',
    };
    await this.runOpponentTurn();
    this.maybeTriggerDismissal();
  }

  async acknowledgeDesertion(): Promise<void> {
    const pending = this.pending;
    if (pending?.verdict !== 'DESERTION_MUTINY') return;

    const cascade = applyDesertionWithCascade(
      this.roster,
      {
        actor: pending.actor,
        refusedMove: pending.san,
        refusedMoveEval: pending.moveEval,
        moveEvalByPiece: pending.desertionMoveEvals,
        uStay: pending.desertionUStay,
        uDesert: pending.desertionUDesert,
        terms: pending.desertionTerms,
      },
      this.ply,
    );
    this.events.push(...cascade.events);
    for (const event of cascade.events) {
      if (event.t === 'DESERTION') {
        this.board.withdrawPiece(event.pieceId);
      }
    }
    const exposure = kingExposureAfterWithdrawals(
      this.board,
      this.board.turn(),
    );
    if (exposure !== undefined) {
      this.events.push({
        t: 'KING_EXPOSED_TURN_CEDED',
        ply: this.ply,
        exposedKingId: exposure.kingId,
        attackerSide: exposure.attackerSide,
      });
      this.board.cedeTurn();
    }
    this.roster = cascade.roster;
    this.pending = null;
    this.phase = 'playing';
    this.ply += 1;

    if (cascade.rout) {
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
    await this.runOpponentTurn();
    this.maybeTriggerDismissal();
  }

  /** Advance one King command ply under succession (ADR 0022 spectate). */
  async stepSuccession(): Promise<void> {
    if (this.phase !== 'succession_spectate' || this.board.isGameOver()) {
      return;
    }
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
      if (applied.capture !== undefined) {
        this.events.push({
          t: 'CAPTURE',
          ply: this.ply,
          victim: applied.capture.pieceId,
          by: applied.moverId,
        });
      }
      this.roster = syncRoster(this.board, this.roster, this.playerSide);
      this.ply += 1;
    } else {
      await this.runOpponentTurn();
    }
    if (this.board.isGameOver()) {
      this.phase = 'game_over';
    }
  }

  /** Fast-forward remainder under the King after dismissal (ADR 0022). */
  async fastForwardSuccession(): Promise<void> {
    if (
      !this.dismissed ||
      this.phase === 'rout' ||
      this.phase === 'game_over'
    ) {
      return;
    }
    await this.playUnderKingCommand();
  }

  private maybeTriggerDismissal(): void {
    if (this.dismissed || this.rout || this.phase === 'game_over') return;
    const decision = evaluateDismissal(this.roster, this.kingTauAbil);
    if (!decision.dismiss) return;
    this.dismissed = true;
    this.dismissalCause = decision.cause;
    this.successorLeaderId = selectSuccessorLeader({
      rivalLeaderId: this.rivalLeaderId,
      kingLeaderId: 'king:field-command',
      rivalAvailable: decision.cause === 'dismissed_by_king',
    });
    this.phase = 'succession_spectate';
    this.dialogueCue = {
      eventKind: 'rout',
      pieceId: this.roster[0]?.id ?? 'w:K:e1',
      san: '—',
    };
  }

  private async playUnderKingCommand(): Promise<void> {
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
        if (applied.capture !== undefined) {
          this.events.push({
            t: 'CAPTURE',
            ply: this.ply,
            victim: applied.capture.pieceId,
            by: applied.moverId,
          });
        }
        this.roster = syncRoster(this.board, this.roster, this.playerSide);
        this.ply += 1;
      } else {
        await this.runOpponentTurn();
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
    orderQualityCp: number,
    audit: EngineAuditEntry,
    objectivelyGood: boolean,
    features?: MoveFeatures,
    declinedSacrificeOpportunity?: PendingVerdict['declinedSacrificeOpportunity'],
    desertionMoveEvals: Readonly<Record<string, CandidateMoveEvaluation>> = {},
    bestAuditScore = orderQualityCp,
  ): void {
    const applied = this.board.applyMove(intent);
    this.lastMove = [applied.from, applied.to];
    this.events.push({
      t: 'MOVE',
      ply: this.ply,
      san,
      pieceId: actor.id,
      verdict: outcome.verdict,
      orderQualityCp,
    });
    if (applied.capture !== undefined) {
      this.events.push({
        t: 'CAPTURE',
        ply: this.ply,
        victim: applied.capture.pieceId,
        by: applied.moverId,
      });
      const captured = this.enemyRoster.find(
        (piece) => piece.id === applied.capture?.pieceId,
      );
      if (captured !== undefined) {
        const credit = applyPosthumousClassCredit(
          this.enemyRoster,
          captured,
          this.events,
          this.ply,
        );
        this.enemyRoster = credit.roster;
        this.events.push(...credit.events);
      }
    }
    const nomination = heroismNomination(this.events, moveEval, audit);
    if (nomination !== undefined) this.events.push(nomination);
    if (applied.capture !== undefined) {
      this.enemyRoster = this.enemyRoster.map((piece) => {
        if (piece.id !== applied.capture?.pieceId) return piece;
        const injured = applyCaptureInjury(piece);
        this.events.push({
          t: 'PSYCH_DELTA',
          ply: this.ply,
          pieceId: piece.id,
          field: 'B_i',
          delta: injured.B_i - piece.B_i,
        });
        return injured;
      });
    }

    const moveFeatures = features;
    this.applyPostCommitPsychology(
      actor,
      outcome,
      moveEval,
      moveFeatures,
      applied.capture !== undefined,
      declinedSacrificeOpportunity,
      orderQualityCp,
      objectivelyGood,
      desertionMoveEvals,
      bestAuditScore,
    );

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
    } else if (outcome.verdict === 'FATALISTIC_COMPLIANCE') {
      // Full effort with no faith — presented as compliance, cost is off-move.
      this.dialogueCue = {
        eventKind: 'compliant',
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
    } else if (this.phase === 'thinking') {
      this.phase = 'playing';
    }
  }

  private applyPostCommitPsychology(
    actor: PieceState,
    outcome: MoveDecisionOutcome,
    moveEval: CandidateMoveEvaluation,
    features: MoveFeatures | undefined,
    captured: boolean,
    declinedSacrificeOpportunity: PendingVerdict['declinedSacrificeOpportunity'],
    orderQualityCp: number,
    objectivelyGood: boolean,
    desertionMoveEvals: Readonly<Record<string, CandidateMoveEvaluation>>,
    bestAuditScore: number,
  ): void {
    const abilityObservations = applyRosterAbilityObservations(
      this.roster,
      desertionMoveEvals,
      orderQualityCp,
      bestAuditScore,
      bestAuditScore,
      this.ply,
      actor.id,
      false,
      moveEval.deltaV_board >= 0,
      this.abilityDripStreakByPiece,
    );
    this.events.push(...abilityObservations.events);
    this.abilityDripStreakByPiece = abilityObservations.dripStreakByPiece;
    this.roster = abilityObservations.roster.map((piece) =>
      piece.id === actor.id
        ? applyPostMoveCredence(
            { ...piece, engagementFactor: outcome.engagementFactor },
            moveEval,
            objectivelyGood,
          )
        : piece,
    );

    if (outcome.verdict === 'FATALISTIC_COMPLIANCE') {
      const fatalistic = applyFatalisticComplianceCosts(
        this.roster,
        actor.id,
        this.ply,
      );
      this.roster = fatalistic.roster;
      this.events.push(...fatalistic.events);
    }

    if (features !== undefined) {
      const attribution = attributeSacrifice(
        features,
        moveEval.deltaV_board * 100,
      );
      const hero = this.roster.find((piece) => piece.id === actor.id) ?? actor;
      const sacrifice = applySacrificeWitnesses(
        this.roster,
        hero,
        attribution,
        this.ply,
      );
      this.roster = sacrifice.roster;
      this.events.push(...sacrifice.events);
      if (
        detectDeclinedSacrificeCostlySignal(
          declinedSacrificeOpportunity,
          features.san,
          orderQualityCp,
        )
      ) {
        const costly = applyDeclinedSacrificeSignal(
          this.roster,
          declinedSacrificeOpportunity?.sacrificedPieceId ?? '',
          this.ply,
        );
        this.roster = costly.roster;
        this.events.push(...costly.events);
      }

      const kinds: Array<
        'king_endangerment' | 'declined_sacrifice' | 'avenged_capture'
      > = [];
      if (detectKingEndangermentCostlySignal(features)) {
        kinds.push('king_endangerment');
      }
      if (captured && isAvengedCapture(this.lastFriendlyCapturePly, this.ply)) {
        kinds.push('avenged_capture');
      }
      const costly = applyCostlySignalsToRoster(this.roster, kinds, this.ply);
      this.roster = costly.roster;
      this.events.push(...costly.events);
    }

    const trauma = applyMoveTrauma(
      this.roster,
      this.dreadExposureByPiece,
      Object.fromEntries(
        Object.entries(desertionMoveEvals).map(([id, evaluation]) => [
          id,
          evaluation.P_captured,
        ]),
      ),
      undefined,
      this.ply,
    );
    this.roster = trauma.roster;
    this.dreadExposureByPiece = trauma.exposure;
    this.events.push(...trauma.events);

    if (captured) {
      // Opponent captured on prior ply is tracked when we lose a piece; here
      // a player capture may avenge. Friendly loss is recorded on opponent turn.
      this.lastFriendlyCapturePly = undefined;
    }
  }

  private async runOpponentTurn(): Promise<void> {
    if (this.phase === 'rout' || this.phase === 'game_over') return;
    if (this.board.turn() === this.playerSide) return;

    const enemySide = this.playerSide === 'w' ? 'b' : 'w';
    const beforeFriendly = new Set(
      this.board.piecesOf(this.playerSide).map((piece) => piece.id),
    );
    const result = await applyEnemyTurn({
      board: this.board,
      enemyRoster: this.enemyRoster,
      enemySide,
      random: this.random,
      archetype: this.opponentArchetype,
      ply: this.ply,
      engine: this.engine,
      insight: this.insight,
      overrideRefusals: this.opponentArchetype === 'tyrannical',
      dreadExposureByPiece: this.enemyDreadExposureByPiece,
    });
    this.enemyRoster = result.enemyRoster;
    this.enemyDreadExposureByPiece = result.dreadExposureByPiece;
    this.engineAudit.push(...(result.engineAudit ?? []));
    this.events.push(...result.events);
    if (result.capturedPieceId !== undefined) {
      const captured = this.roster.find(
        (piece) => piece.id === result.capturedPieceId,
      );
      if (captured !== undefined) {
        const credit = applyPosthumousClassCredit(
          this.roster,
          captured,
          this.events,
          result.ply - 1,
        );
        this.roster = credit.roster;
        this.events.push(...credit.events);
      }
      this.roster = this.roster.map((piece) => {
        if (piece.id !== result.capturedPieceId) return piece;
        const injured = applyCaptureInjury(piece);
        this.events.push({
          t: 'PSYCH_DELTA',
          ply: result.ply - 1,
          pieceId: piece.id,
          field: 'B_i',
          delta: injured.B_i - piece.B_i,
        });
        return injured;
      });
    }
    this.ply = result.ply;
    this.enemyRout ||= result.enemyRout;
    if (result.lastMove !== null) {
      this.lastMove = result.lastMove;
    }
    const afterFriendly = new Set(
      this.board.piecesOf(this.playerSide).map((piece) => piece.id),
    );
    for (const id of beforeFriendly) {
      if (!afterFriendly.has(id)) {
        this.lastFriendlyCapturePly = this.ply - 1;
        break;
      }
    }
    this.roster = syncRoster(this.board, this.roster, this.playerSide);
    if (result.enemyRout) {
      this.phase = 'game_over';
      return;
    }
    if (this.board.isGameOver()) {
      this.phase = 'game_over';
    }
  }
}

export function squareKey(square: Square): string {
  return square;
}
