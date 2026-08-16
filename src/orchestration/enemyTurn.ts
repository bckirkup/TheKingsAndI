import {
  extractMoveFeatures,
  type LivingBoard,
  type Side,
  type Square,
} from '../chess';
import type { SeededRandom } from '../core/random';
import { SHARED_SEARCH_D_MAX } from '../engine';
import type { EnginePort } from '../engine/types';
import type { EngineAuditEntry } from '../engine';
import {
  applyFatalisticComplianceCosts,
  evaluateMoveResponse,
  normalizePieceState,
  shouldDesert,
  type CandidateMoveEvaluation,
  type MatchEvent,
  type PieceState,
} from '../psychology';

import { CAMPAIGN_CONFIG } from './campaignConfig';
import { featuresToEvaluation, isVindicatedMove } from './evaluation';
import {
  createInsightRoundHandle,
  resolveAuditPositionScore,
  resolveBestAuditMoveScore,
  resolveAuditMoveScore,
  resolveMoverInsights,
  type InsightRoundHandle,
} from './insight';
import { engineAuditEntry } from './heroism';
import { chooseOpponentMove, type OpponentArchetype } from './leaderPolicy';
import {
  applyDesertionWithCascade,
  applyPostMoveCredence,
  applyRosterAbilityObservations,
  expectedVindicationDelta,
  desertionContextFor,
} from './psychologyHooks';
import { applyMoveTrauma, type DreadExposureByPiece } from './trauma';
import { kingExposureAfterWithdrawals } from './kingExposure';

export function trackEnemyIdentities(
  roster: readonly PieceState[],
  cap: number = CAMPAIGN_CONFIG.ENEMY_TRACKED_IDENTITIES,
): PieceState[] {
  if (roster.length <= cap) return roster.map(normalizePieceState);
  return [...roster]
    .sort((a, b) => b.E_i - a.E_i || a.id.localeCompare(b.id))
    .slice(0, cap)
    .map(normalizePieceState);
}

function syncSideRoster(
  board: LivingBoard,
  roster: readonly PieceState[],
  side: Side,
): PieceState[] {
  const activeIds = new Set(board.piecesOf(side).map((piece) => piece.id));
  return roster.filter((piece) => activeIds.has(piece.id));
}

export interface EnemyTurnResult {
  readonly enemyRoster: PieceState[];
  readonly departedRoster: readonly PieceState[];
  readonly dreadExposureByPiece: DreadExposureByPiece;
  readonly capturedPieceId?: string;
  readonly events: readonly MatchEvent[];
  readonly ply: number;
  readonly enemyRout: boolean;
  readonly lastMove: readonly [Square, Square] | null;
  readonly observableBehaviours: readonly (
    | 'move'
    | 'refusal'
    | 'desertion'
    | 'quiet_quit'
    | 'fatalistic'
  )[];
  readonly engineAudit?: readonly EngineAuditEntry[];
}

function resolveIntent(
  board: LivingBoard,
  san: string,
): ReturnType<LivingBoard['legalMoves']>[number] | undefined {
  return board.legalMoves().find((move) => {
    const features = extractMoveFeatures(board, move);
    return features.san === san;
  });
}

function finishUntrackedMove(
  board: LivingBoard,
  enemyRoster: PieceState[],
  enemySide: Side,
  san: string,
  ply: number,
): EnemyTurnResult {
  const applied = board.applySan(san);
  const events: MatchEvent[] = [];
  events.push({
    t: 'MOVE',
    ply,
    san,
    pieceId: applied.moverId,
    verdict: 'COMPLIANT_EXECUTION',
    orderQualityCp: 0,
  });
  if (applied.capture !== undefined) {
    events.push({
      t: 'CAPTURE',
      ply,
      victim: applied.capture.pieceId,
      by: applied.moverId,
    });
  }
  return {
    enemyRoster: syncSideRoster(board, enemyRoster, enemySide),
    departedRoster: [],
    dreadExposureByPiece: {},
    events,
    ply: ply + 1,
    enemyRout: false,
    lastMove: [applied.from, applied.to],
    observableBehaviours: ['move'],
  };
}

function applyTrackedEnemyDecision(input: {
  readonly board: LivingBoard;
  readonly enemyRoster: PieceState[];
  readonly enemySide: Side;
  readonly actor: PieceState;
  readonly san: string;
  readonly moveEval: CandidateMoveEvaluation;
  readonly desertionMoveEvals: Readonly<
    Record<string, CandidateMoveEvaluation>
  >;
  readonly ply: number;
  readonly overrideRefusals: boolean;
  readonly dreadExposureByPiece?: DreadExposureByPiece;
  readonly orderQualityCp?: number;
  readonly objectivelyGood?: boolean;
  readonly bestAuditScore?: number;
  readonly preMoveAuditScore?: number;
}): EnemyTurnResult {
  const {
    board,
    enemySide,
    actor,
    san,
    moveEval,
    desertionMoveEvals,
    ply,
    overrideRefusals,
    objectivelyGood = false,
    orderQualityCp = 0,
    bestAuditScore = orderQualityCp,
    preMoveAuditScore = bestAuditScore,
  } = input;
  let enemyRoster = input.enemyRoster;
  const events: MatchEvent[] = [];
  const behaviours: EnemyTurnResult['observableBehaviours'][number][] = [];
  const audit = engineAuditEntry({
    ply,
    pieceId: actor.id,
    san,
    preMoveScoreCp: preMoveAuditScore,
    scoreCp: orderQualityCp,
    bestScoreCp: bestAuditScore,
    preMoveDepth: SHARED_SEARCH_D_MAX,
    scoreDepth: 8,
    bestScoreDepth: SHARED_SEARCH_D_MAX,
  });
  const desertionContext = desertionContextFor(actor, moveEval, enemyRoster);
  const desertionDecision = shouldDesert(actor, desertionContext, enemyRoster);
  let outcome = evaluateMoveResponse(
    actor,
    moveEval,
    enemyRoster,
    desertionContext,
  );

  if (outcome.verdict === 'MORAL_REFUSAL') {
    if (overrideRefusals) {
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
      return {
        enemyRoster,
        departedRoster: [],
        dreadExposureByPiece: input.dreadExposureByPiece ?? {},
        events,
        engineAudit: [audit],
        ply,
        enemyRout: false,
        lastMove: null,
        observableBehaviours: ['refusal'],
      };
    }
  }

  if (outcome.verdict === 'DESERTION_MUTINY') {
    const cascade = applyDesertionWithCascade(
      enemyRoster,
      {
        actor,
        refusedMove: san,
        refusedMoveEval: moveEval,
        moveEvalByPiece: {
          ...desertionMoveEvals,
          [actor.id]: moveEval,
        },
        uStay: desertionDecision.uStay,
        uDesert: desertionDecision.uDesert,
        terms: desertionDecision.terms,
      },
      ply,
    );
    events.push(...cascade.events);
    for (const event of cascade.events) {
      if (event.t === 'DESERTION') {
        board.withdrawPiece(event.pieceId);
        behaviours.push('desertion');
      }
    }
    const exposure = kingExposureAfterWithdrawals(board, enemySide);
    if (exposure !== undefined) {
      events.push({
        t: 'KING_EXPOSED_TURN_CEDED',
        ply,
        exposedKingId: exposure.kingId,
        attackerSide: exposure.attackerSide,
      });
      board.cedeTurn();
    }
    return {
      enemyRoster: syncSideRoster(board, cascade.roster, enemySide),
      departedRoster: cascade.departed,
      dreadExposureByPiece: input.dreadExposureByPiece ?? {},
      events,
      engineAudit: [audit],
      ply: ply + 1,
      enemyRout: cascade.rout,
      lastMove: null,
      observableBehaviours: behaviours,
    };
  }

  const applied = board.applySan(san);
  events.push({
    t: 'MOVE',
    ply,
    san,
    pieceId: actor.id,
    verdict: outcome.verdict,
    orderQualityCp,
  });
  if (applied.capture !== undefined) {
    events.push({
      t: 'CAPTURE',
      ply,
      victim: applied.capture.pieceId,
      by: applied.moverId,
    });
  }
  behaviours.push('move');
  if (outcome.verdict === 'QUIET_QUITTING') behaviours.push('quiet_quit');
  if (outcome.verdict === 'FATALISTIC_COMPLIANCE') {
    behaviours.push('fatalistic');
  }

  const abilityObservations = applyRosterAbilityObservations(
    enemyRoster,
    desertionMoveEvals,
    orderQualityCp,
    bestAuditScore,
    bestAuditScore,
    ply,
    actor.id,
    overrideRefusals,
    moveEval.deltaV_board >= 0,
    { [actor.id]: ply % 3 },
  );
  events.push(...abilityObservations.events);
  enemyRoster = abilityObservations.roster.map((piece) =>
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
      enemyRoster,
      actor.id,
      ply,
    );
    enemyRoster = fatalistic.roster;
    events.push(...fatalistic.events);
  }
  const trauma = applyMoveTrauma(
    enemyRoster,
    input.dreadExposureByPiece ?? {},
    Object.fromEntries(
      Object.entries(desertionMoveEvals).map(([id, evaluation]) => [
        id,
        evaluation.P_captured,
      ]),
    ),
    applied.capture?.pieceId,
    ply,
  );
  enemyRoster = trauma.roster;
  events.push(...trauma.events);

  return {
    enemyRoster: syncSideRoster(board, enemyRoster, enemySide),
    departedRoster: [],
    dreadExposureByPiece: trauma.exposure,
    ...(applied.capture === undefined
      ? {}
      : { capturedPieceId: applied.capture.pieceId }),
    events,
    engineAudit: [audit],
    ply: ply + 1,
    enemyRout: false,
    lastMove: [applied.from, applied.to],
    observableBehaviours: behaviours,
  };
}

function mergeRefusalHistory(
  priorEvents: MatchEvent[],
  priorBehaviours: EnemyTurnResult['observableBehaviours'][number][],
  result: EnemyTurnResult,
): EnemyTurnResult {
  return {
    ...result,
    events: [...priorEvents, ...result.events],
    observableBehaviours: [...priorBehaviours, ...result.observableBehaviours],
  };
}

/**
 * Synchronous opposing ply using board features (interactive path).
 * Observable behaviours only — never exposes private gauges (ADR 0025).
 */
export function applyEnemyTurnSync(input: {
  readonly board: LivingBoard;
  readonly enemyRoster: readonly PieceState[];
  readonly enemySide: Side;
  readonly random: SeededRandom;
  readonly archetype: OpponentArchetype;
  readonly ply: number;
  readonly overrideRefusals?: boolean;
}): EnemyTurnResult {
  const enemyRoster = syncSideRoster(
    input.board,
    trackEnemyIdentities(input.enemyRoster),
    input.enemySide,
  );

  if (enemyRoster.filter((piece) => piece.role !== 'King').length === 0) {
    return {
      enemyRoster,
      departedRoster: [],
      dreadExposureByPiece: {},
      events: [],
      ply: input.ply,
      enemyRout: true,
      lastMove: null,
      observableBehaviours: [],
    };
  }

  const refusedSans = new Set<string>();
  const priorEvents: MatchEvent[] = [];
  const priorBehaviours: EnemyTurnResult['observableBehaviours'][number][] = [];
  let currentEnemyRoster = enemyRoster;
  const maxCandidates = input.board.legalMoves().length;
  for (let attempt = 0; attempt < maxCandidates; attempt += 1) {
    const san = chooseOpponentMove(
      input.board,
      input.random,
      input.archetype,
      refusedSans,
    );
    if (san === undefined) break;

    const intent = resolveIntent(input.board, san);
    if (intent === undefined) {
      return mergeRefusalHistory(
        priorEvents,
        priorBehaviours,
        finishUntrackedMove(
          input.board,
          currentEnemyRoster,
          input.enemySide,
          san,
          input.ply,
        ),
      );
    }

    const mover = input.board.pieceAt(intent.from);
    const actor =
      mover === undefined
        ? undefined
        : currentEnemyRoster.find((piece) => piece.id === mover.id);
    if (actor === undefined) {
      return mergeRefusalHistory(
        priorEvents,
        priorBehaviours,
        finishUntrackedMove(
          input.board,
          currentEnemyRoster,
          input.enemySide,
          san,
          input.ply,
        ),
      );
    }

    const features = extractMoveFeatures(input.board, intent);
    const moveEval = featuresToEvaluation(features, 0);
    const result = applyTrackedEnemyDecision({
      board: input.board,
      enemyRoster: currentEnemyRoster,
      enemySide: input.enemySide,
      actor,
      san,
      moveEval,
      desertionMoveEvals: { [actor.id]: moveEval },
      ply: input.ply,
      overrideRefusals:
        (input.overrideRefusals ?? input.archetype === 'tyrannical') ||
        attempt === maxCandidates - 1,
    });
    if (!result.events.some((event) => event.t === 'REFUSAL')) {
      return mergeRefusalHistory(priorEvents, priorBehaviours, result);
    }
    refusedSans.add(san);
    currentEnemyRoster = result.enemyRoster;
    priorEvents.push(...result.events);
    priorBehaviours.push(...result.observableBehaviours);
  }
  throw new Error(
    `Enemy turn could not produce a move at ply ${input.ply} after refusing ${refusedSans.size} candidates.`,
  );
}

/** Async opposing ply with engine insights (headless path). */
export async function applyEnemyTurn(input: {
  readonly board: LivingBoard;
  readonly enemyRoster: readonly PieceState[];
  readonly enemySide: Side;
  readonly random: SeededRandom;
  readonly archetype: OpponentArchetype;
  readonly ply: number;
  readonly engine: EnginePort;
  readonly insight?: InsightRoundHandle;
  readonly overrideRefusals?: boolean;
  readonly dreadExposureByPiece?: DreadExposureByPiece;
}): Promise<EnemyTurnResult> {
  const insight = input.insight ?? createInsightRoundHandle();
  const enemyRoster = syncSideRoster(
    input.board,
    trackEnemyIdentities(input.enemyRoster),
    input.enemySide,
  );

  if (enemyRoster.filter((piece) => piece.role !== 'King').length === 0) {
    return {
      enemyRoster,
      departedRoster: [],
      dreadExposureByPiece: input.dreadExposureByPiece ?? {},
      events: [],
      ply: input.ply,
      enemyRout: true,
      lastMove: null,
      observableBehaviours: [],
    };
  }

  const refusedSans = new Set<string>();
  const priorEvents: MatchEvent[] = [];
  const priorBehaviours: EnemyTurnResult['observableBehaviours'][number][] = [];
  let currentEnemyRoster = enemyRoster;
  const maxCandidates = input.board.legalMoves().length;
  for (let attempt = 0; attempt < maxCandidates; attempt += 1) {
    const san = chooseOpponentMove(
      input.board,
      input.random,
      input.archetype,
      refusedSans,
    );
    if (san === undefined) break;

    const intent = resolveIntent(input.board, san);
    if (intent === undefined) {
      return mergeRefusalHistory(
        priorEvents,
        priorBehaviours,
        finishUntrackedMove(
          input.board,
          currentEnemyRoster,
          input.enemySide,
          san,
          input.ply,
        ),
      );
    }

    const mover = input.board.pieceAt(intent.from);
    const actor =
      mover === undefined
        ? undefined
        : currentEnemyRoster.find((piece) => piece.id === mover.id);
    if (actor === undefined) {
      return mergeRefusalHistory(
        priorEvents,
        priorBehaviours,
        finishUntrackedMove(
          input.board,
          currentEnemyRoster,
          input.enemySide,
          san,
          input.ply,
        ),
      );
    }

    const features = extractMoveFeatures(input.board, intent);
    const moverInsights = await resolveMoverInsights(
      input.engine,
      input.board,
      intent,
      actor,
      insight,
      currentEnemyRoster,
      features,
    );
    const moveEval = featuresToEvaluation(features, 0);
    const orderQualityCp = await resolveAuditMoveScore(
      input.engine,
      input.board,
      intent,
      insight,
    );
    const bestAuditScore = await resolveBestAuditMoveScore(
      input.engine,
      input.board,
      insight,
    );
    const preMoveAuditScore = await resolveAuditPositionScore(
      input.engine,
      input.board,
      insight,
    );
    const objectivelyGood = isVindicatedMove(
      orderQualityCp,
      bestAuditScore,
      bestAuditScore,
      expectedVindicationDelta(actor, moveEval),
    );
    const result = applyTrackedEnemyDecision({
      board: input.board,
      enemyRoster: currentEnemyRoster,
      enemySide: input.enemySide,
      actor,
      san,
      moveEval,
      desertionMoveEvals: {
        ...moverInsights.desertionMoveEvals,
        [actor.id]: moveEval,
      },
      ply: input.ply,
      overrideRefusals:
        (input.overrideRefusals ?? input.archetype === 'tyrannical') ||
        attempt === maxCandidates - 1,
      orderQualityCp,
      objectivelyGood,
      bestAuditScore,
      preMoveAuditScore,
    });
    if (!result.events.some((event) => event.t === 'REFUSAL')) {
      return mergeRefusalHistory(priorEvents, priorBehaviours, result);
    }
    refusedSans.add(san);
    currentEnemyRoster = result.enemyRoster;
    priorEvents.push(...result.events);
    priorBehaviours.push(...result.observableBehaviours);
  }
  throw new Error(
    `Enemy turn could not produce a move at ply ${input.ply} after refusing ${refusedSans.size} candidates.`,
  );
}

/** Difficulty must select leader policy, never engine depth (ADR 0025 / D67). */
export function assertDifficultyIsLeaderPolicy(depthByDifficulty: {
  readonly easy: number;
  readonly hard: number;
}): void {
  if (depthByDifficulty.easy !== depthByDifficulty.hard) {
    throw new Error(
      'difficulty-by-depth: opposing difficulty must not change engine depth',
    );
  }
}
