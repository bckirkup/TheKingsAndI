import {
  extractMoveFeatures,
  type LivingBoard,
  type Side,
  type Square,
} from '../chess';
import type { SeededRandom } from '../core/random';
import type { EnginePort } from '../engine/types';
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
import { featuresToEvaluation, insightToEvaluation } from './evaluation';
import {
  createInsightRoundHandle,
  resolveMoverInsights,
  type InsightRoundHandle,
} from './insight';
import { chooseOpponentMove, type OpponentArchetype } from './leaderPolicy';
import {
  applyDesertionWithCascade,
  applyPostMoveCredence,
  desertionContextFor,
} from './psychologyHooks';

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
  readonly events: readonly MatchEvent[];
  readonly ply: number;
  readonly enemyRout: boolean;
  readonly lastMove: readonly [Square, Square] | null;
  readonly observableBehaviours: readonly (
    | 'move'
    | 'refusal_tempo'
    | 'desertion'
    | 'quiet_quit'
    | 'fatalistic'
  )[];
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
  return {
    enemyRoster: syncSideRoster(board, enemyRoster, enemySide),
    events: [
      {
        t: 'MOVE',
        ply,
        san,
        pieceId: applied.moverId,
        verdict: 'COMPLIANT_EXECUTION',
        orderQualityCp: 40,
      },
    ],
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
  readonly abilityObservations: number;
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
    abilityObservations,
  } = input;
  let enemyRoster = input.enemyRoster;
  const events: MatchEvent[] = [];
  const behaviours: EnemyTurnResult['observableBehaviours'][number][] = [];
  const desertionContext = desertionContextFor(actor, moveEval);
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
        events,
        ply,
        enemyRout: false,
        lastMove: null,
        observableBehaviours: ['refusal_tempo'],
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
    return {
      enemyRoster: syncSideRoster(board, cascade.roster, enemySide),
      events,
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
    orderQualityCp: 50,
  });
  behaviours.push('move');
  if (outcome.verdict === 'QUIET_QUITTING') behaviours.push('quiet_quit');
  if (outcome.verdict === 'FATALISTIC_COMPLIANCE') {
    behaviours.push('fatalistic');
  }

  enemyRoster = enemyRoster.map((piece) =>
    piece.id === actor.id
      ? applyPostMoveCredence(
          { ...piece, engagementFactor: outcome.engagementFactor },
          moveEval,
          true,
          abilityObservations + 1,
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

  return {
    enemyRoster: syncSideRoster(board, enemyRoster, enemySide),
    events,
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
  readonly abilityObservations?: number;
}): EnemyTurnResult {
  const enemyRoster = syncSideRoster(
    input.board,
    trackEnemyIdentities(input.enemyRoster),
    input.enemySide,
  );

  if (enemyRoster.filter((piece) => piece.role !== 'King').length === 0) {
    return {
      enemyRoster,
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
          enemyRoster,
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
        : enemyRoster.find((piece) => piece.id === mover.id);
    if (actor === undefined) {
      return mergeRefusalHistory(
        priorEvents,
        priorBehaviours,
        finishUntrackedMove(
          input.board,
          enemyRoster,
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
      enemyRoster,
      enemySide: input.enemySide,
      actor,
      san,
      moveEval,
      desertionMoveEvals: { [actor.id]: moveEval },
      ply: input.ply,
      overrideRefusals:
        (input.overrideRefusals ?? input.archetype === 'tyrannical') ||
        attempt === maxCandidates - 1,
      abilityObservations: input.abilityObservations ?? 0,
    });
    if (!result.events.some((event) => event.t === 'REFUSAL')) {
      return mergeRefusalHistory(priorEvents, priorBehaviours, result);
    }
    refusedSans.add(san);
    priorEvents.push(...result.events);
    priorBehaviours.push(...result.observableBehaviours);
  }
  return {
    enemyRoster,
    events: priorEvents,
    ply: input.ply,
    enemyRout: false,
    lastMove: null,
    observableBehaviours: priorBehaviours,
  };
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
  readonly abilityObservations?: number;
  readonly overrideRefusals?: boolean;
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
          enemyRoster,
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
        : enemyRoster.find((piece) => piece.id === mover.id);
    if (actor === undefined) {
      return mergeRefusalHistory(
        priorEvents,
        priorBehaviours,
        finishUntrackedMove(
          input.board,
          enemyRoster,
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
      enemyRoster,
      features,
      0,
    );
    const moveEval = insightToEvaluation(
      features,
      moverInsights.actor,
      moverInsights.leader,
      0,
    );
    const result = applyTrackedEnemyDecision({
      board: input.board,
      enemyRoster,
      enemySide: input.enemySide,
      actor,
      san,
      moveEval,
      desertionMoveEvals: moverInsights.desertionMoveEvals,
      ply: input.ply,
      overrideRefusals:
        (input.overrideRefusals ?? input.archetype === 'tyrannical') ||
        attempt === maxCandidates - 1,
      abilityObservations: input.abilityObservations ?? 0,
    });
    if (!result.events.some((event) => event.t === 'REFUSAL')) {
      return mergeRefusalHistory(priorEvents, priorBehaviours, result);
    }
    refusedSans.add(san);
    priorEvents.push(...result.events);
    priorBehaviours.push(...result.observableBehaviours);
  }
  return {
    enemyRoster,
    events: priorEvents,
    ply: input.ply,
    enemyRout: false,
    lastMove: null,
    observableBehaviours: priorBehaviours,
  };
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
