import type { LivingBoard, MoveFeatures, MoveIntent } from '../chess';
import {
  insightOf,
  requireComplete,
  resolveInsightRound,
} from '../engine/barrier';
import { createEvaluationCache, type EvaluationCache } from '../engine/cache';
import { buildInsightRound } from '../engine/round';
import { SHARED_SEARCH_D_MAX } from '../engine/search';
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
const BEFORE_INSIGHT_PREFIX = '\u0000before:';

function beforeInsightSeatId(pieceId: string): string {
  return `${BEFORE_INSIGHT_PREFIX}${pieceId}`;
}

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
    const orderedRoster = [...roster].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
    const beforeProfiles = new Map(
      orderedRoster.map((piece) => [piece.id, evalProfileFor(piece, board)]),
    );
    const depths = [
      ...new Set(
        orderedRoster.map((piece) =>
          calculateEngineSearchDepth(piece.E_i, piece.engagementFactor),
        ),
      ),
    ].sort((left, right) => left - right);
    const beforeAttentionResultsPromise =
      port.multiPvAt === undefined
        ? Promise.resolve([])
        : Promise.all(
            depths.map(
              (rung) =>
                port.multiPvAt?.(board.fen(), rung) ?? Promise.resolve([]),
            ),
          );
    const requests = buildInsightRound({
      fen: board.fen(),
      seats: orderedRoster.map((piece) => ({
        pieceId: beforeInsightSeatId(piece.id),
        depth: calculateEngineSearchDepth(piece.E_i, piece.engagementFactor),
        evalProfile: beforeProfiles.get(piece.id) ?? {},
      })),
    });
    const [beforeAttentionResults, rawBundle] = await Promise.all([
      beforeAttentionResultsPromise,
      resolveInsightRound(port, requests, {
        round: handle.round,
        cache: handle.cache,
      }),
    ]);
    const bundle = requireComplete(rawBundle);
    const beforeAttentionByDepth = new Map<
      number,
      readonly EngineEvaluation[]
    >();
    for (let index = 0; index < depths.length; index += 1) {
      const rung = depths[index];
      const lines = beforeAttentionResults[index] ?? [];
      if (rung !== undefined && lines !== undefined) {
        beforeAttentionByDepth.set(rung, lines);
      }
    }
    handle.round += 1;
    const leader = Object.freeze({
      pieceId: LEADER_INSIGHT_SEAT_ID,
      depth: CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH,
      scoreCp: terminalScore,
      pv: Object.freeze([]),
    });
    const desertionMoveEvals: Record<string, CandidateMoveEvaluation> = {};
    let actorBeforeScoreCp: number | undefined;
    for (const piece of orderedRoster) {
      const beforeSharedInsight = insightOf(
        bundle,
        beforeInsightSeatId(piece.id),
      );
      if (beforeSharedInsight === undefined) {
        throw new Error(`Missing before insight for ${piece.id}`);
      }
      const beforePrivateInsight = applyPrivateEvaluation(
        beforeSharedInsight,
        board,
        piece,
        beforeProfiles.get(piece.id) ?? {},
        beforeAttentionByDepth.get(
          calculateEngineSearchDepth(piece.E_i, piece.engagementFactor),
        ) ?? [],
      );
      if (piece.id === actor.id) {
        actorBeforeScoreCp = beforePrivateInsight.scoreCp;
      }
      desertionMoveEvals[piece.id] = {
        moveNotation: features.san,
        deltaV_board: (terminalScore - beforePrivateInsight.scoreCp) / 100,
        privateScoreCp: terminalScore,
        vLeaderImplied: terminalScore / 100 + leaderImpliedBias,
        deltaV_capture: features.deltaVCapture,
        P_captured: features.captureRiskByPiece[piece.id] ?? 0,
        peerSafetyDeltas: features.peerSafetyDeltas,
      };
    }
    if (actorBeforeScoreCp === undefined) {
      throw new Error(`Missing actor baseline score for ${actor.id}`);
    }
    return {
      actor: Object.freeze({
        pieceId: actor.id,
        depth,
        scoreCp: terminalScore - actorBeforeScoreCp,
        pv: Object.freeze([]),
      }),
      leader,
      desertionMoveEvals,
      declinedSacrificeOpportunity: undefined,
    };
  }
  const beforeFen = board.fen();
  const fen = probe.fen();
  const orderedRoster = [...roster].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  const profiles = new Map(
    orderedRoster.map((piece) => [piece.id, evalProfileFor(piece, probe)]),
  );
  const beforeProfiles = new Map(
    orderedRoster.map((piece) => [piece.id, evalProfileFor(piece, board)]),
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
  const beforeAttentionResultsPromise =
    port.multiPvAt === undefined
      ? Promise.resolve([])
      : Promise.all(
          depths.map(
            (rung) => port.multiPvAt?.(beforeFen, rung) ?? Promise.resolve([]),
          ),
        );
  const requests = [
    ...buildInsightRound({
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
    }),
    ...buildInsightRound({
      fen: beforeFen,
      seats: orderedRoster.map((piece) => ({
        pieceId: beforeInsightSeatId(piece.id),
        depth: calculateEngineSearchDepth(piece.E_i, piece.engagementFactor),
        evalProfile: beforeProfiles.get(piece.id) ?? {},
      })),
    }),
  ];
  const bundlePromise = resolveInsightRound(port, requests, {
    round: handle.round,
    cache: handle.cache,
  });
  const [preferredLine, attentionResults, beforeAttentionResults, rawBundle] =
    await Promise.all([
      preferredLinePromise,
      attentionResultsPromise,
      beforeAttentionResultsPromise,
      bundlePromise,
    ]);
  const bundle = requireComplete(rawBundle);
  const attentionByDepth = new Map<number, readonly EngineEvaluation[]>();
  const beforeAttentionByDepth = new Map<number, readonly EngineEvaluation[]>();
  if (port.multiPvAt !== undefined) {
    for (let index = 0; index < depths.length; index += 1) {
      const rung = depths[index];
      const lines = attentionResults[index] ?? [];
      if (rung !== undefined && lines !== undefined) {
        attentionByDepth.set(rung, lines);
      }
    }
    for (let index = 0; index < depths.length; index += 1) {
      const rung = depths[index];
      const lines = beforeAttentionResults[index] ?? [];
      if (rung !== undefined && lines !== undefined) {
        beforeAttentionByDepth.set(rung, lines);
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
  const privateBeforeByPiece = new Map<string, EngineEvaluation>();
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
    const beforeSharedInsight = insightOf(
      bundle,
      beforeInsightSeatId(piece.id),
    );
    if (beforeSharedInsight === undefined) {
      throw new Error(`Missing before insight for ${piece.id}`);
    }
    const beforeDepth = calculateEngineSearchDepth(
      piece.E_i,
      piece.engagementFactor,
    );
    const privateBeforeInsight = applyPrivateEvaluation(
      beforeSharedInsight,
      board,
      piece,
      beforeProfiles.get(piece.id) ?? {},
      beforeAttentionByDepth.get(beforeDepth) ?? [],
    );
    privateBeforeByPiece.set(piece.id, privateBeforeInsight);
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
  const privateBeforeActor = privateBeforeByPiece.get(actor.id);
  if (privateBeforeActor === undefined) {
    throw new Error(`Missing before private insight for ${actor.id}`);
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
    const privateBeforeInsightForPiece = privateBeforeByPiece.get(piece.id);
    if (privateBeforeInsightForPiece === undefined) {
      throw new Error(`Missing before private insight for ${piece.id}`);
    }
    desertionMoveEvals[piece.id] = {
      moveNotation: features.san,
      deltaV_board:
        (privateInsightForPiece.scoreCp -
          privateBeforeInsightForPiece.scoreCp) /
        100,
      privateScoreCp: privateInsightForPiece.scoreCp,
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
      scoreCp: privateActor.scoreCp - privateBeforeActor.scoreCp,
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

/**
 * Audit-only score of the best line from the side to move. A true evaluation
 * of the pre-move position is already from the side-to-move's perspective,
 * matching the mover-side units returned by resolveAuditMoveScore.
 */
export async function resolveBestAuditMoveScore(
  port: EnginePort & {
    evaluateTrue?: (fen: string) => Promise<{
      scoreCp: number;
      pv?: readonly string[];
    }>;
  },
  board: LivingBoard,
  handle: InsightRoundHandle,
): Promise<number> {
  if (port.evaluateTrue !== undefined) {
    const trueEval = await port.evaluateTrue(board.fen());
    return trueEval.scoreCp;
  }
  const moves = board.legalMoves();
  if (moves.length === 0) return 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const intent of moves) {
    bestScore = Math.max(
      bestScore,
      await resolveAuditMoveScore(port, board, intent, handle),
    );
  }
  return bestScore;
}

/** True score for the position before a move, kept on the audit path only. */
export async function resolveAuditPositionScore(
  port: EnginePort & {
    evaluateTrue?: (fen: string) => Promise<{ scoreCp: number }>;
  },
  board: LivingBoard,
  handle: InsightRoundHandle,
): Promise<number> {
  if (port.evaluateTrue !== undefined) {
    return (await port.evaluateTrue(board.fen())).scoreCp;
  }
  const bundle = requireComplete(
    await resolveInsightRound(
      port,
      buildInsightRound({
        fen: board.fen(),
        seats: [
          {
            pieceId: 'audit:position',
            depth: SHARED_SEARCH_D_MAX,
            evalProfile: {},
          },
        ],
      }),
      { round: handle.round, cache: handle.cache },
    ),
  );
  handle.round += 1;
  const insight = bundle.insights[0];
  if (insight === undefined) {
    throw new Error('Missing audit position insight');
  }
  return insight.scoreCp;
}
