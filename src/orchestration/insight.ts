import type { LivingBoard, MoveIntent } from '../chess';
import {
  insightOf,
  requireComplete,
  resolveInsightRound,
} from '../engine/barrier';
import { createEvaluationCache, type EvaluationCache } from '../engine/cache';
import { buildInsightRound } from '../engine/round';
import type { EnginePort, Insight } from '../engine/types';
import { calculateEngineSearchDepth, type PieceState } from '../psychology';
import { CAMPAIGN_CONFIG } from './campaignConfig';
import { applyPrivateEvaluation, evalProfileFor } from './privateEvaluation';

export { evalProfileFor } from './privateEvaluation';

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

/**
 * Score a post-move position the engine cannot search, already from the
 * mover's perspective — unlike engine scores, this needs no negation.
 * Checkmate is decisive for the mover; stalemate and draws are neutral.
 */
export function terminalMoveScore(board: LivingBoard): number | undefined {
  if (!board.isGameOver() || board.legalMoves().length > 0) return undefined;
  return board.isCheck() ? 29_999 : 0;
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
  const terminalScore = terminalMoveScore(probe);
  if (terminalScore !== undefined) {
    const insight = Object.freeze({
      pieceId: actor.id,
      depth,
      scoreCp: terminalScore,
      pv: Object.freeze([]),
    });
    const leader = Object.freeze({
      pieceId: LEADER_INSIGHT_SEAT_ID,
      depth: CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH,
      scoreCp: terminalScore,
      pv: Object.freeze([]),
    });
    handle.round += 1;
    return { actor: insight, leader };
  }
  const fen = probe.fen();
  const profile = evalProfileFor(actor, probe);
  const attentionLines =
    port.multiPvAt === undefined
      ? port.multiPvAtMax === undefined
        ? []
        : await port.multiPvAtMax(fen)
      : await port.multiPvAt(fen, depth);
  const requests = buildInsightRound({
    fen,
    seats: [
      {
        pieceId: actor.id,
        depth,
        evalProfile: profile,
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
  const privateActor = applyPrivateEvaluation(
    {
      ...actorInsight,
      scoreCp: -actorInsight.scoreCp,
    },
    probe,
    actor,
    profile,
    attentionLines,
  );
  // Post-move FEN is opponent-to-move; private scoring is already applied from
  // the mover's perspective while the line itself remains the engine PV.
  return {
    actor: Object.freeze({
      ...privateActor,
      pieceId: actorInsight.pieceId,
      depth: actorInsight.depth,
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
  const terminalScore = terminalMoveScore(probe);
  if (terminalScore !== undefined) return terminalScore;
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
