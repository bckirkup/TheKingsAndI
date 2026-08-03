import { canonicalJson } from '../core/canonicalJson';
import { comparePieceIds } from '../core/ids';
import type { InsightRequest, InsightSeat, RoundSpec } from './types';

/**
 * Round construction (ADR 0034 §2). The request set is a pure function of the
 * position and the roster, computed in full before any query is issued, so it
 * is reproducible from the replay log alone.
 */

export class DuplicateSeatError extends Error {
  constructor(pieceId: string) {
    super(`Piece ${pieceId} appears twice in one round.`);
    this.name = 'DuplicateSeatError';
  }
}

function validateDepth(seat: InsightSeat): void {
  if (!Number.isSafeInteger(seat.depth) || seat.depth < 1) {
    throw new RangeError(
      `Depth for ${seat.pieceId} must be a positive integer; wall-clock search is banned (ADR 0005).`,
    );
  }
}

/**
 * Requests sorted by `PieceId`, one seat per piece. Issue order matters as much
 * as collection order: the pool's own scheduling — which query gets the free
 * worker, which one warms a shared entry — would otherwise depend on whatever
 * iteration order the caller's roster happened to have.
 */
export function buildInsightRound(spec: RoundSpec): InsightRequest[] {
  const seen = new Set<string>();
  for (const seat of spec.seats) {
    validateDepth(seat);
    if (seen.has(seat.pieceId)) throw new DuplicateSeatError(seat.pieceId);
    seen.add(seat.pieceId);
  }
  return spec.seats
    .map((seat) => ({
      fen: spec.fen,
      pieceId: seat.pieceId,
      depth: seat.depth,
      evalProfile: seat.evalProfile,
    }))
    .sort((left, right) => comparePieceIds(left.pieceId, right.pieceId));
}

/** The key a round is cached and replayed under, independent of seat order. */
export function roundKey(spec: RoundSpec): string {
  return canonicalJson(buildInsightRound(spec));
}
