import { extractMoveFeatures, LivingBoard, type MoveIntent } from '../chess';
import type { Side } from '../chess';
import type { SeededRandom } from '../core/random';
import type { EnginePort } from '../engine/types';
import {
  applyMatchOutcomeTrust,
  applyNeglectSignal,
  evaluateMoveResponse,
  normalizePieceState,
  type CandidateMoveEvaluation,
  type MatchEvent,
  type PieceState,
} from '../psychology';

import { insightToEvaluation, isObjectivelyGoodMove } from './evaluation';
import {
  createInsightRoundHandle,
  resolveAuditMoveScore,
  resolveMoverInsight,
} from './insight';
import {
  applyCostlySignalsToRoster,
  applyDesertionWithCascade,
  applyPostMoveCredence,
  applySacrificeWitnesses,
  attributeSacrifice,
  desertionContextFor,
  detectKingEndangermentCostlySignal,
  isAvengedCapture,
} from './psychologyHooks';

export interface HeadlessMoveChoice {
  readonly moverId: string;
  readonly intent: MoveIntent;
  readonly san: string;
  /** When omitted, orchestration resolves engine insight for the mover. */
  readonly moveEval?: CandidateMoveEvaluation;
  readonly objectivelyGood?: boolean;
}

export interface HeadlessLeaderPort {
  chooseMove(
    board: LivingBoard,
    side: Side,
    random: SeededRandom,
    ply: number,
  ): HeadlessMoveChoice | undefined | Promise<HeadlessMoveChoice | undefined>;
  shouldOverride(random: SeededRandom, ply: number): boolean;
  onMatchEnd?(roster: readonly PieceState[], winScore: number): PieceState[];
}

export interface HeadlessMatchConfig {
  readonly random: SeededRandom;
  readonly maxPlies: number;
  readonly playerSide: Side;
  readonly leader: HeadlessLeaderPort;
  readonly opponent: HeadlessLeaderPort;
  readonly initialRoster: readonly PieceState[];
  readonly engine: EnginePort;
}

export interface HeadlessMatchResult {
  readonly events: readonly MatchEvent[];
  readonly roster: readonly PieceState[];
  readonly plies: number;
  readonly winScore: number;
  readonly rout: boolean;
  readonly refusedGoodMoves: number;
  readonly determinismId: string;
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

function activePlayerPieceIds(board: LivingBoard, playerSide: Side): string[] {
  return board.piecesOf(playerSide).map((piece) => piece.id);
}

function winScoreFor(board: LivingBoard, playerSide: Side): number {
  if (!board.isGameOver()) return 50;
  return board.turn() === playerSide ? 0 : 100;
}

export async function runHeadlessMatch(
  config: HeadlessMatchConfig,
): Promise<HeadlessMatchResult> {
  const board = LivingBoard.standard();
  let roster = config.initialRoster.map(normalizePieceState);
  const events: MatchEvent[] = [];
  let ply = 1;
  let rout = false;
  let refusedGoodMoves = 0;
  const insight = createInsightRoundHandle();
  let lastFriendlyCapturePly: number | undefined;
  let abilityObservations = 0;

  while (ply <= config.maxPlies) {
    if (board.isGameOver()) break;
    const side = board.turn();
    const leader = side === config.playerSide ? config.leader : config.opponent;
    const playerActiveIds = activePlayerPieceIds(board, config.playerSide);
    roster = roster.filter((piece) => playerActiveIds.includes(piece.id));

    if (playerActiveIds.length <= 1) {
      rout = true;
      break;
    }

    const choice = await leader.chooseMove(board, side, config.random, ply);
    if (choice === undefined) break;

    if (side !== config.playerSide) {
      const beforeIds = new Set(playerActiveIds);
      board.applySan(choice.san);
      const afterIds = new Set(activePlayerPieceIds(board, config.playerSide));
      for (const id of beforeIds) {
        if (!afterIds.has(id)) {
          lastFriendlyCapturePly = ply;
          break;
        }
      }
      ply += 1;
      continue;
    }

    const actor = roster.find((piece) => piece.id === choice.moverId);
    if (actor === undefined) {
      ply += 1;
      continue;
    }

    const features = extractMoveFeatures(board, choice.intent);
    const moverInsight = await resolveMoverInsight(
      config.engine,
      board,
      choice.intent,
      actor,
      insight,
    );
    const moveEval =
      choice.moveEval ?? insightToEvaluation(features, moverInsight, actor);
    const auditScore = await resolveAuditMoveScore(
      config.engine,
      board,
      choice.intent,
      insight,
    );
    const bestAudit = Math.max(auditScore, moverInsight.scoreCp);
    const objectivelyGood =
      choice.objectivelyGood ??
      isObjectivelyGoodMove(moverInsight.scoreCp, bestAudit);

    const desertionContext = desertionContextFor(actor, moveEval);
    let outcome = evaluateMoveResponse(
      actor,
      moveEval,
      roster,
      desertionContext,
    );

    if (outcome.verdict === 'MORAL_REFUSAL') {
      if (leader.shouldOverride(config.random, ply)) {
        events.push({
          t: 'OVERRIDE',
          ply,
          pieceId: actor.id,
          san: choice.san,
          pieceTrustDelta: -35,
          traumaGain: 20,
        });
        roster = updatePiece(roster, actor.id, (piece) => ({
          ...piece,
          T_i: piece.T_i - 35,
          B_i: Math.min(100, piece.B_i + 20),
          credence: applyNeglectSignal(piece.credence),
        }));
        outcome = { ...outcome, verdict: 'COMPLIANT_EXECUTION' };
      } else {
        events.push({
          t: 'REFUSAL',
          ply,
          pieceId: actor.id,
          utility: outcome.utilityScore,
          threshold: outcome.refusalThreshold,
          perceivedValue: outcome.perceivedValue,
        });
        if (objectivelyGood) {
          refusedGoodMoves += 1;
          roster = updatePiece(roster, actor.id, (piece) => ({
            ...piece,
            credence: applyNeglectSignal(piece.credence),
          }));
        }
        ply += 1;
        continue;
      }
    }

    if (outcome.verdict === 'DESERTION_MUTINY') {
      const cascade = applyDesertionWithCascade(
        roster,
        {
          actor,
          refusedMove: choice.san,
          refusedMoveEval: moveEval,
          uStay: 0,
          uDesert: 0,
        },
        ply,
      );
      events.push(...cascade.events);
      for (const event of cascade.events) {
        if (event.t === 'DESERTION') {
          board.withdrawPiece(event.pieceId);
        }
      }
      roster = cascade.roster;
      if (cascade.rout) {
        rout = true;
        break;
      }
      ply += 1;
      continue;
    }

    const applied = board.applySan(choice.san);
    events.push({
      t: 'MOVE',
      ply,
      san: choice.san,
      pieceId: actor.id,
      verdict: outcome.verdict,
    });
    abilityObservations += 1;
    roster = updatePiece(roster, actor.id, (piece) =>
      applyPostMoveCredence(
        { ...piece, engagementFactor: outcome.engagementFactor },
        moveEval,
        objectivelyGood,
        abilityObservations,
      ),
    );

    const attribution = attributeSacrifice(features, auditScore);
    const hero = roster.find((piece) => piece.id === actor.id) ?? actor;
    const sacrifice = applySacrificeWitnesses(roster, hero, attribution, ply);
    roster = sacrifice.roster;
    events.push(...sacrifice.events);

    const kinds: Array<
      'king_endangerment' | 'declined_sacrifice' | 'avenged_capture'
    > = [];
    if (detectKingEndangermentCostlySignal(features)) {
      kinds.push('king_endangerment');
    }
    if (
      applied.capture !== undefined &&
      isAvengedCapture(lastFriendlyCapturePly, ply)
    ) {
      kinds.push('avenged_capture');
      lastFriendlyCapturePly = undefined;
    }
    const costly = applyCostlySignalsToRoster(roster, kinds, ply);
    roster = costly.roster;
    events.push(...costly.events);

    ply += 1;
  }

  const winScore = winScoreFor(board, config.playerSide);
  roster =
    config.leader.onMatchEnd?.(roster, winScore) ??
    applyMatchOutcomeTrust(roster, winScore);

  return {
    events: Object.freeze(events),
    roster: roster.map(normalizePieceState),
    plies: ply - 1,
    winScore,
    rout,
    refusedGoodMoves,
    determinismId: config.engine.determinismId,
  };
}
