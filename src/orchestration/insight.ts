import type { LivingBoard, MoveIntent } from '../chess';
import {
  insightOf,
  requireComplete,
  resolveInsightRound,
} from '../engine/barrier';
import { createEvaluationCache, type EvaluationCache } from '../engine/cache';
import { buildInsightRound } from '../engine/round';
import type { EnginePort, EvalProfile, Insight } from '../engine/types';
import { calculateEngineSearchDepth, type PieceState } from '../psychology';
import { CAMPAIGN_CONFIG } from './campaignConfig';

export const LEADER_INSIGHT_SEAT_ID = '\u0000leader';

export interface InsightRoundHandle {
  readonly cache: EvaluationCache;
  round: number;
}

export function createInsightRoundHandle(
  cache: EvaluationCache = createEvaluationCache(),
): InsightRoundHandle {
  return { cache, round: 0 };
}

/** Opaque profile placeholder until D43 settles weight schema. */
export function evalProfileFor(piece: PieceState): EvalProfile {
  void piece;
  return {};
}

/**
 * Evaluate the position after `intent` from the mover's side at depth D_i.
 * Score is negated because the post-move FEN is opponent to move.
 */
export async function resolveMoverInsights(
  port: EnginePort,
  board: LivingBoard,
  intent: MoveIntent,
  actor: PieceState,
  handle: InsightRoundHandle,
): Promise<{
  readonly actor: Insight;
  readonly leader: Insight;
}> {
  if (actor.id === LEADER_INSIGHT_SEAT_ID) {
    throw new Error(`PieceId is reserved: ${LEADER_INSIGHT_SEAT_ID}`);
  }
  const depth = calculateEngineSearchDepth(actor.E_i, actor.engagementFactor);
  const probe = board.clone();
  probe.applyMove(intent);
  const fen = probe.fen();
  const requests = buildInsightRound({
    fen,
    seats: [
      {
        pieceId: actor.id,
        depth,
        evalProfile: evalProfileFor(actor),
      },
      {
        pieceId: LEADER_INSIGHT_SEAT_ID,
        depth: CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH,
        evalProfile: {},
      },
    ],
  });
  const bundle = requireComplete(
    await resolveInsightRound(port, requests, {
      round: handle.round,
      cache: handle.cache,
    }),
  );
  handle.round += 1;
  const actorInsight = insightOf(bundle, actor.id);
  const leaderInsight = insightOf(bundle, LEADER_INSIGHT_SEAT_ID);
  if (actorInsight === undefined) {
    throw new Error(`Missing actor insight for ${actor.id}`);
  }
  if (leaderInsight === undefined) {
    throw new Error(`Missing leader insight for ${LEADER_INSIGHT_SEAT_ID}`);
  }
  // Post-move FEN is opponent-to-move; flip to mover's perspective.
  return {
    actor: Object.freeze({
      ...actorInsight,
      scoreCp: -actorInsight.scoreCp,
    }),
    leader: Object.freeze({
      ...leaderInsight,
      scoreCp: -leaderInsight.scoreCp,
    }),
  };
}

/**
 * Audit-only true eval of the post-move position (mover-side cp).
 * Uses the piece's D_i seat when the port has no evaluateTrue; callers with a
 * SharedSearchBroker should prefer evaluateTrue and negate.
 */
export async function resolveAuditMoveScore(
  port: EnginePort & {
    evaluateTrue?: (fen: string) => Promise<{ scoreCp: number }>;
  },
  board: LivingBoard,
  intent: MoveIntent,
  handle: InsightRoundHandle,
): Promise<number> {
  const probe = board.clone();
  probe.applyMove(intent);
  const fen = probe.fen();
  if (port.evaluateTrue !== undefined) {
    const trueEval = await port.evaluateTrue(fen);
    return -trueEval.scoreCp;
  }
  const requests = buildInsightRound({
    fen,
    seats: [
      {
        pieceId: 'audit:true',
        depth: 8,
        evalProfile: {},
      },
    ],
  });
  const bundle = requireComplete(
    await resolveInsightRound(port, requests, {
      round: handle.round,
      cache: handle.cache,
    }),
  );
  handle.round += 1;
  const insight = bundle.insights[0];
  if (insight === undefined) {
    throw new Error('Missing audit insight');
  }
  return -insight.scoreCp;
}
