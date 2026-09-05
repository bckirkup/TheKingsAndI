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
import type { MoveAskContext, OverrideAskContext } from './headlessMatch';
import {
  applyFatalisticComplianceCosts,
  applyPanicCollapse,
  courageForMove,
  isRegardEligible,
  ENGINE_CONFIG,
  evaluateMoveResponse,
  normalizePieceState,
  panicOnsetForPly,
  reliefEventsForPly,
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
  applyHeededAbilityGrade,
  applyPostMoveCredence,
  applyRegardToPiece,
  applyRosterAbilityObservations,
  expectedVindicationDelta,
  desertionContextFor,
} from './psychologyHooks';
import { objectionStrengthWord } from '../core/qualitativeBands';
import { applyMoveTrauma, type DreadExposureByPiece } from './trauma';
import { kingExposureAfterWithdrawals } from './kingExposure';
import { applyPromotion } from './promotion';

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
  readonly regardStreakByPiece: Readonly<Record<string, number>>;
  readonly engineAudit?: readonly EngineAuditEntry[];
}

export type EnemyMoveChooser = (
  board: LivingBoard,
  side: Side,
  random: SeededRandom,
  ply: number,
  refusedSans: ReadonlySet<string>,
  context?: MoveAskContext,
) => string | undefined | Promise<string | undefined>;

function resolveIntent(
  board: LivingBoard,
  san: string,
): ReturnType<LivingBoard['legalMoves']>[number] | undefined {
  return board.legalMoves().find((move) => {
    const features = extractMoveFeatures(board, move);
    return features.san === san;
  });
}

export function finishUntrackedMove(
  board: LivingBoard,
  enemyRoster: PieceState[],
  enemySide: Side,
  san: string,
  ply: number,
  regardStreakByPiece: Readonly<Record<string, number>> = {},
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
  if (applied.promotion !== undefined) {
    const promotion = applyPromotion(enemyRoster, applied.promotion, ply);
    enemyRoster = promotion.roster;
    events.push(promotion.event);
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
    regardStreakByPiece,
  };
}

function enemyMoralRefusalTurn(input: {
  readonly enemyRoster: PieceState[];
  readonly actor: PieceState;
  readonly outcome: ReturnType<typeof evaluateMoveResponse>;
  readonly moveEval: CandidateMoveEvaluation;
  readonly orderQualityCp: number;
  readonly ply: number;
  readonly dreadExposureByPiece?: DreadExposureByPiece | undefined;
  readonly audit: EngineAuditEntry;
  readonly regardStreakByPiece: Readonly<Record<string, number>>;
}): EnemyTurnResult {
  const events: MatchEvent[] = [
    {
      t: 'REFUSAL',
      ply: input.ply,
      pieceId: input.actor.id,
      utility: input.outcome.utilityScore,
      threshold: input.outcome.refusalThreshold,
      perceivedValue: input.outcome.perceivedValue,
    },
  ];
  const heeded = applyHeededAbilityGrade(
    input.enemyRoster,
    input.actor.id,
    input.moveEval.deltaV_board < 0 && input.orderQualityCp < 0,
    input.ply,
  );
  return {
    enemyRoster: heeded.roster,
    departedRoster: [],
    dreadExposureByPiece: input.dreadExposureByPiece ?? {},
    events: [...events, ...heeded.events],
    engineAudit: [input.audit],
    ply: input.ply,
    enemyRout: false,
    lastMove: null,
    observableBehaviours: ['refusal'],
    regardStreakByPiece: input.regardStreakByPiece,
  };
}

function enemyDesertionTurn(input: {
  readonly board: LivingBoard;
  readonly enemyRoster: PieceState[];
  readonly enemySide: Side;
  readonly actor: PieceState;
  readonly san: string;
  readonly moveEval: CandidateMoveEvaluation;
  readonly desertionMoveEvals: Readonly<
    Record<string, CandidateMoveEvaluation>
  >;
  readonly desertionDecision: ReturnType<typeof shouldDesert>;
  readonly ply: number;
  readonly dreadExposureByPiece?: DreadExposureByPiece | undefined;
  readonly audit: EngineAuditEntry;
  readonly regardStreakByPiece: Readonly<Record<string, number>>;
}): EnemyTurnResult {
  const cascade = applyDesertionWithCascade(
    input.enemyRoster,
    {
      actor: input.actor,
      refusedMove: input.san,
      refusedMoveEval: input.moveEval,
      moveEvalByPiece: {
        ...input.desertionMoveEvals,
        [input.actor.id]: input.moveEval,
      },
      uStay: input.desertionDecision.uStay,
      uDesert: input.desertionDecision.uDesert,
      terms: input.desertionDecision.terms,
    },
    input.ply,
  );
  const events: MatchEvent[] = [...cascade.events];
  const behaviours: EnemyTurnResult['observableBehaviours'][number][] = [];
  for (const event of cascade.events) {
    if (event.t === 'DESERTION') {
      input.board.withdrawPiece(event.pieceId);
      behaviours.push('desertion');
    }
  }
  const exposure = kingExposureAfterWithdrawals(input.board, input.enemySide);
  if (exposure !== undefined) {
    events.push({
      t: 'KING_EXPOSED_TURN_CEDED',
      ply: input.ply,
      exposedKingId: exposure.kingId,
      attackerSide: exposure.attackerSide,
    });
    input.board.cedeTurn();
  }
  return {
    enemyRoster: syncSideRoster(input.board, cascade.roster, input.enemySide),
    departedRoster: cascade.departed,
    dreadExposureByPiece: input.dreadExposureByPiece ?? {},
    events,
    engineAudit: [input.audit],
    ply: input.ply + 1,
    enemyRout: cascade.rout,
    lastMove: null,
    observableBehaviours: behaviours,
    regardStreakByPiece: input.regardStreakByPiece,
  };
}

function enemyCompliantTurn(input: {
  readonly board: LivingBoard;
  readonly enemyRoster: PieceState[];
  readonly enemySide: Side;
  readonly actor: PieceState;
  readonly san: string;
  readonly moveEval: CandidateMoveEvaluation;
  readonly desertionMoveEvals: Readonly<
    Record<string, CandidateMoveEvaluation>
  >;
  readonly outcome: ReturnType<typeof evaluateMoveResponse>;
  readonly ply: number;
  readonly overrideRefusals: boolean;
  readonly objectivelyGood: boolean;
  readonly orderQualityCp: number;
  readonly bestAuditScore: number;
  readonly dreadExposureByPiece?: DreadExposureByPiece | undefined;
  readonly audit: EngineAuditEntry;
  readonly regardStreakByPiece: Readonly<Record<string, number>>;
}): EnemyTurnResult {
  const {
    board,
    enemySide,
    actor,
    san,
    moveEval,
    desertionMoveEvals,
    outcome,
    ply,
    overrideRefusals,
    objectivelyGood,
    orderQualityCp,
    bestAuditScore,
  } = input;
  let enemyRoster = input.enemyRoster;
  const events: MatchEvent[] = [];
  const behaviours: EnemyTurnResult['observableBehaviours'][number][] = [];
  const applied = board.applySan(san);
  events.push({
    t: 'MOVE',
    ply,
    san,
    pieceId: actor.id,
    verdict: outcome.verdict,
    orderQualityCp,
    ...(actor.role === 'King'
      ? {}
      : (() => {
          const courage = courageForMove(outcome, moveEval);
          return courage === undefined ? {} : { courage };
        })()),
  });
  if (applied.promotion !== undefined) {
    const promotion = applyPromotion(enemyRoster, applied.promotion, ply);
    enemyRoster = promotion.roster;
    events.push(promotion.event);
  }
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
  const regardStreak = isRegardEligible(
    moveEval.P_captured,
    moveEval.deltaV_board,
  )
    ? (input.regardStreakByPiece[actor.id] ?? 0) + 1
    : 0;
  const regardApplied = regardStreak >= ENGINE_CONFIG.BENEV_REGARD_STREAK_PLIES;
  enemyRoster = abilityObservations.roster.map((piece) => {
    if (piece.id !== actor.id) return piece;
    const postMove = applyPostMoveCredence(
      { ...piece, engagementFactor: outcome.engagementFactor },
      moveEval,
      objectivelyGood,
    );
    const regarded = applyRegardToPiece(postMove, regardStreak, ply);
    if (regarded.event !== undefined) events.push(regarded.event);
    return regarded.piece;
  });
  if (outcome.verdict === 'FATALISTIC_COMPLIANCE') {
    const fatalistic = applyFatalisticComplianceCosts(
      enemyRoster,
      actor.id,
      ply,
    );
    enemyRoster = fatalistic.roster;
    events.push(...fatalistic.events);
  }
  const captureRiskByPiece = Object.fromEntries(
    Object.entries(desertionMoveEvals).map(([id, evaluation]) => [
      id,
      evaluation.P_captured,
    ]),
  );
  const previousExposure = input.dreadExposureByPiece ?? {};
  const trauma = applyMoveTrauma(
    enemyRoster,
    previousExposure,
    captureRiskByPiece,
    applied.capture?.pieceId,
    ply,
  );
  enemyRoster = trauma.roster;
  events.push(...trauma.events);
  const panic = panicOnsetForPly({
    ply,
    side: enemySide,
    captureRiskByPiece,
    kingDanger: false,
  });
  if (panic !== undefined) {
    events.push(panic);
    enemyRoster = applyPanicCollapse(enemyRoster);
  }
  events.push(
    ...reliefEventsForPly({
      ply,
      previousExposure,
      captureRiskByPiece,
    }),
  );
  return {
    enemyRoster: syncSideRoster(board, enemyRoster, enemySide),
    departedRoster: [],
    dreadExposureByPiece: trauma.exposure,
    ...(applied.capture === undefined
      ? {}
      : { capturedPieceId: applied.capture.pieceId }),
    events,
    engineAudit: [input.audit],
    ply: ply + 1,
    enemyRout: false,
    lastMove: [applied.from, applied.to],
    observableBehaviours: behaviours,
    regardStreakByPiece: {
      ...input.regardStreakByPiece,
      [actor.id]: regardApplied ? 0 : regardStreak,
    },
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
  readonly regardStreakByPiece?: Readonly<Record<string, number>>;
  readonly departedPeerIds?: readonly string[];
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
    regardStreakByPiece = {},
  } = input;
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
  const desertionContext = desertionContextFor(
    actor,
    moveEval,
    input.enemyRoster,
    input.departedPeerIds,
  );
  const desertionDecision = shouldDesert(
    actor,
    desertionContext,
    input.enemyRoster,
  );
  let outcome = evaluateMoveResponse(
    actor,
    moveEval,
    input.enemyRoster,
    desertionContext,
  );

  if (outcome.verdict === 'MORAL_REFUSAL') {
    if (overrideRefusals) {
      outcome = { ...outcome, verdict: 'COMPLIANT_EXECUTION' };
    } else {
      return enemyMoralRefusalTurn({
        enemyRoster: input.enemyRoster,
        actor,
        outcome,
        moveEval,
        orderQualityCp,
        ply,
        dreadExposureByPiece: input.dreadExposureByPiece,
        audit,
        regardStreakByPiece,
      });
    }
  }

  if (outcome.verdict === 'DESERTION_MUTINY') {
    return enemyDesertionTurn({
      board,
      enemyRoster: input.enemyRoster,
      enemySide,
      actor,
      san,
      moveEval,
      desertionMoveEvals,
      desertionDecision,
      ply,
      dreadExposureByPiece: input.dreadExposureByPiece,
      audit,
      regardStreakByPiece,
    });
  }

  return enemyCompliantTurn({
    board,
    enemyRoster: input.enemyRoster,
    enemySide,
    actor,
    san,
    moveEval,
    desertionMoveEvals,
    outcome,
    ply,
    overrideRefusals,
    objectivelyGood,
    orderQualityCp,
    bestAuditScore,
    dreadExposureByPiece: input.dreadExposureByPiece,
    audit,
    regardStreakByPiece,
  });
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
  readonly regardStreakByPiece?: Readonly<Record<string, number>>;
  readonly departedPeerIds?: readonly string[];
}): EnemyTurnResult {
  const enemyRoster = syncSideRoster(
    input.board,
    trackEnemyIdentities(input.enemyRoster),
    input.enemySide,
  );
  const regardStreakByPiece = input.regardStreakByPiece ?? {};

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
      regardStreakByPiece,
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
          regardStreakByPiece,
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
          regardStreakByPiece,
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
      regardStreakByPiece,
      ...(input.departedPeerIds === undefined
        ? {}
        : { departedPeerIds: input.departedPeerIds }),
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
  readonly regardStreakByPiece?: Readonly<Record<string, number>>;
  readonly departedPeerIds?: readonly string[];
  readonly chooseMove?: EnemyMoveChooser;
  readonly shouldOverride?: (
    random: SeededRandom,
    ply: number,
    context?: OverrideAskContext,
  ) => boolean;
}): Promise<EnemyTurnResult> {
  const insight = input.insight ?? createInsightRoundHandle();
  const enemyRoster = syncSideRoster(
    input.board,
    trackEnemyIdentities(input.enemyRoster),
    input.enemySide,
  );
  const regardStreakByPiece = input.regardStreakByPiece ?? {};

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
      regardStreakByPiece,
    };
  }

  const refusedSans = new Set<string>();
  const priorEvents: MatchEvent[] = [];
  const priorBehaviours: EnemyTurnResult['observableBehaviours'][number][] = [];
  let currentEnemyRoster = enemyRoster;
  const maxCandidates = input.board.legalMoves().length;
  for (let attempt = 0; attempt < maxCandidates; attempt += 1) {
    const san =
      input.chooseMove === undefined
        ? chooseOpponentMove(
            input.board,
            input.random,
            input.archetype,
            refusedSans,
          )
        : await input.chooseMove(
            input.board,
            input.enemySide,
            input.random,
            input.ply,
            refusedSans,
            {
              roster: currentEnemyRoster,
              ply: input.ply,
              side: input.enemySide,
            },
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
          regardStreakByPiece,
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
          regardStreakByPiece,
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
    let overrideContext: OverrideAskContext | undefined;
    if (input.shouldOverride !== undefined) {
      const candidateOutcome = evaluateMoveResponse(
        actor,
        moveEval,
        currentEnemyRoster,
        desertionContextFor(
          actor,
          moveEval,
          currentEnemyRoster,
          input.departedPeerIds,
        ),
      );
      if (candidateOutcome.verdict === 'MORAL_REFUSAL') {
        overrideContext = {
          pieceId: actor.id,
          san,
          objectionStrength: objectionStrengthWord(
            candidateOutcome.refusalThreshold - candidateOutcome.utilityScore,
          ),
          board: input.board,
          roster: currentEnemyRoster,
          side: input.enemySide,
        };
      }
    }
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
        (input.overrideRefusals ??
          // Keep this call unconditional per candidate to preserve the seeded stream.
          input.shouldOverride?.(input.random, input.ply, overrideContext) ??
          input.archetype === 'tyrannical') ||
        attempt === maxCandidates - 1,
      orderQualityCp,
      objectivelyGood,
      regardStreakByPiece,
      ...(input.departedPeerIds === undefined
        ? {}
        : { departedPeerIds: input.departedPeerIds }),
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
