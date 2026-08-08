import type { LivingBoard, MoveFeatures, MoveIntent } from '../chess';
import {
  insightOf,
  requireComplete,
  resolveInsightRound,
} from '../engine/barrier';
import { createEvaluationCache, type EvaluationCache } from '../engine/cache';
import { buildInsightRound } from '../engine/round';
import type { EngineEvaluation, EnginePort, Insight } from '../engine/types';
import {
  calculateEngineSearchDepth,
  ENGINE_CONFIG,
  type CandidateMoveEvaluation,
  type PieceState,
} from '../psychology';
import { CAMPAIGN_CONFIG } from './campaignConfig';
import { applyPrivateEvaluation, evalProfileFor } from './privateEvaluation';

export { evalProfileFor } from './privateEvaluation';

export const LEADER_INSIGHT_SEAT_ID = '\u0000leader';

export interface InsightRoundHandle {
  readonly cache: EvaluationCache;
  round: number;
}

export interface MoverInsights {
  readonly actor: Insight;
  readonly leader: Insight;
  /**
   * One private evaluation per living piece for this commanded move. These
   * are all derived from the same barrier round and are consumed by the
   * desertion cascade without issuing dependent queries.
   */
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
  roster: readonly PieceState[],
  features: MoveFeatures,
  leaderImpliedBias = 0,
): Promise<MoverInsights> {
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
    const desertionMoveEvals: Record<string, CandidateMoveEvaluation> = {};
    for (const piece of roster) {
      desertionMoveEvals[piece.id] = {
        moveNotation: features.san,
        deltaV_board: terminalScore / 100,
        vLeaderImplied: terminalScore / 100 + leaderImpliedBias,
        deltaV_capture: features.deltaVCapture,
        P_captured: features.captureRiskByPiece[piece.id] ?? 0,
        peerSafetyDeltas: features.peerSafetyDeltas,
      };
    }
    return {
      actor: insight,
      leader,
      desertionMoveEvals,
      declinedSacrificeOpportunity: undefined,
    };
  }
  const fen = probe.fen();
  const orderedRoster = [...roster].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  const profiles = new Map(
    orderedRoster.map((piece) => [piece.id, evalProfileFor(piece, probe)]),
  );
  const depths = [
    ...new Set(
      orderedRoster.map((piece) =>
        calculateEngineSearchDepth(piece.E_i, piece.engagementFactor),
      ),
    ),
  ].sort((left, right) => left - right);
  const preferredLinePromise =
    port.bestAt?.(board.fen(), CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH) ??
    Promise.resolve(undefined);
  const attentionResultsPromise =
    port.multiPvAt === undefined
      ? Promise.resolve([])
      : Promise.all(
          depths.map(
            (rung) => port.multiPvAt?.(fen, rung) ?? Promise.resolve([]),
          ),
        );
  const requests = buildInsightRound({
    fen,
    seats: [
      ...orderedRoster.map((piece) => ({
        pieceId: piece.id,
        depth: calculateEngineSearchDepth(piece.E_i, piece.engagementFactor),
        evalProfile: profiles.get(piece.id) ?? {},
      })),
      {
        pieceId: LEADER_INSIGHT_SEAT_ID,
        depth: CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH,
        evalProfile: {},
      },
    ],
  });
  const bundlePromise = resolveInsightRound(port, requests, {
    round: handle.round,
    cache: handle.cache,
  });
  const [preferredLine, attentionResults, rawBundle] = await Promise.all([
    preferredLinePromise,
    attentionResultsPromise,
    bundlePromise,
  ]);
  const bundle = requireComplete(rawBundle);
  const attentionByDepth = new Map<number, readonly EngineEvaluation[]>();
  if (port.multiPvAt !== undefined) {
    for (let index = 0; index < depths.length; index += 1) {
      const rung = depths[index];
      const lines = attentionResults[index] ?? [];
      if (rung !== undefined && lines !== undefined) {
        attentionByDepth.set(rung, lines);
      }
    }
  }
  handle.round += 1;
  const actorInsight = insightOf(bundle, actor.id);
  const leaderInsight = insightOf(bundle, LEADER_INSIGHT_SEAT_ID);
  if (actorInsight === undefined) {
    throw new Error(`Missing actor insight for ${actor.id}`);
  }
  if (leaderInsight === undefined) {
    throw new Error(`Missing leader insight for ${LEADER_INSIGHT_SEAT_ID}`);
  }
  const privateByPiece = new Map<string, EngineEvaluation>();
  for (const piece of orderedRoster) {
    const sharedInsight = insightOf(bundle, piece.id);
    if (sharedInsight === undefined) {
      throw new Error(`Missing insight for ${piece.id}`);
    }
    const pieceDepth = calculateEngineSearchDepth(
      piece.E_i,
      piece.engagementFactor,
    );
    const privateInsight = applyPrivateEvaluation(
      {
        ...sharedInsight,
        scoreCp: -sharedInsight.scoreCp,
      },
      probe,
      piece,
      profiles.get(piece.id) ?? {},
      attentionByDepth.get(pieceDepth) ?? [],
    );
    privateByPiece.set(piece.id, privateInsight);
  }
  const sacrificedPieceId =
    preferredLine === undefined
      ? undefined
      : declinedSacrificePiece(board, preferredLine, orderedRoster);
  const declinedSacrificeOpportunity =
    sacrificedPieceId === undefined || preferredLine === undefined
      ? undefined
      : {
          sacrificedPieceId,
          preferredMove: preferredLine.pv[0] ?? '',
          preferredScoreCp: preferredLine.scoreCp,
        };
  const privateActor = privateByPiece.get(actor.id);
  if (privateActor === undefined) {
    throw new Error(`Missing private insight for ${actor.id}`);
  }
  const moverLeader = {
    ...leaderInsight,
    scoreCp: -leaderInsight.scoreCp,
  };
  const desertionMoveEvals: Record<string, CandidateMoveEvaluation> = {};
  for (const piece of orderedRoster) {
    const privateInsightForPiece = privateByPiece.get(piece.id);
    if (privateInsightForPiece === undefined) {
      throw new Error(`Missing private insight for ${piece.id}`);
    }
    desertionMoveEvals[piece.id] = {
      moveNotation: features.san,
      deltaV_board: privateInsightForPiece.scoreCp / 100,
      vLeaderImplied: moverLeader.scoreCp / 100 + leaderImpliedBias,
      deltaV_capture: features.deltaVCapture,
      P_captured: features.captureRiskByPiece[piece.id] ?? 0,
      peerSafetyDeltas: features.peerSafetyDeltas,
    };
  }
  // Post-move FEN is opponent-to-move; private scoring is already applied from
  // the mover's perspective while the line itself remains the engine PV.
  return {
    actor: Object.freeze({
      ...privateActor,
      pieceId: actor.id,
      depth,
    }),
    leader: Object.freeze({
      ...moverLeader,
    }),
    desertionMoveEvals,
    declinedSacrificeOpportunity,
  };
}

export function declinedSacrificePiece(
  board: LivingBoard,
  line: EngineEvaluation,
  roster: readonly PieceState[],
  minimumIncomingAffinity: number = ENGINE_CONFIG.DECLINED_SACRIFICE_MIN_INCOMING_AFFINITY,
): string | undefined {
  const first = line.pv[0];
  if (first === undefined || first.length < 4) return undefined;
  const endpoint = board.clone();
  try {
    const firstApplied = endpoint.applyMove({
      from: first.slice(0, 2) as MoveIntent['from'],
      to: first.slice(2, 4) as MoveIntent['to'],
      ...(first.length > 4
        ? {
            promotion: first.slice(4, 5).toUpperCase() as 'Q' | 'R' | 'B' | 'N',
          }
        : {}),
    });
    const sacrificed = roster.find((piece) => {
      if (piece.id !== firstApplied.moverId) return false;
      const incomingAffinity = roster.reduce(
        (sum, witness) => sum + (witness.dyadicAffinity[piece.id] ?? 0),
        0,
      );
      return incomingAffinity >= minimumIncomingAffinity;
    });
    if (sacrificed === undefined) return undefined;
    for (const lan of line.pv.slice(1)) {
      if (lan.length < 4) return undefined;
      const applied = endpoint.applyMove({
        from: lan.slice(0, 2) as MoveIntent['from'],
        to: lan.slice(2, 4) as MoveIntent['to'],
        ...(lan.length > 4
          ? {
              promotion: lan.slice(4, 5).toUpperCase() as 'Q' | 'R' | 'B' | 'N',
            }
          : {}),
      });
      if (applied.capture?.pieceId === sacrificed.id) return sacrificed.id;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Audit-only true eval of the post-move position (mover-side cp).
 * Uses the piece's D_i seat when the port has no evaluateTrue; callers with a
 * SharedSearchBroker should prefer evaluateTrue and negate.
 */
export async function resolveAuditMoveScore(
  port: EnginePort & {
    evaluateTrue?: (fen: string) => Promise<{
      scoreCp: number;
      pv?: readonly string[];
    }>;
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
