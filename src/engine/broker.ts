import type { EngineEvaluation, EnginePort, EvalProfile } from './types';
import { EnginePool, type EnginePoolOptions } from './pool';
import type { DepthLadder } from './uci';

/** Shared-search depth ceiling (architecture §5, ADR 0017). */
export const SHARED_SEARCH_D_MAX = 16;
/** Default private-attention width; calibrated against engine runtime budget. */
export const DEFAULT_PRIVATE_MULTIPV_WIDTH = 8;
/** Width of the player-visible preferred-line search. */
export const DEFAULT_PREFERRED_MULTIPV_WIDTH = 1;
/** One serialized worker is sufficient for the preferred-line search. */
export const DEFAULT_PREFERRED_POOL_SIZE = 1;

export interface SharedSearchBrokerOptions extends EnginePoolOptions {
  readonly determinismId: string;
  /** Override D_max for tests (must stay fixed in production). */
  readonly dMax?: number;
  /** MultiPV width for the player-visible preferred-line search. */
  readonly preferredMultiPv?: number;
  /** Worker count for the player-visible preferred-line search. */
  readonly preferredPoolSize?: number;
}

export interface SharedSearchBroker extends EnginePort {
  /**
   * True evaluation at D_max for the orchestration audit path only.
   * Must never reach psychology (ADR 0013). Ephemeral — not persisted (D50 open).
   */
  evaluateTrue(fen: string): Promise<EngineEvaluation>;
  /** MultiPV lines at D_max from the shared tree (sacrifice / declined-sac facts). */
  multiPvAtMax(fen: string): Promise<readonly EngineEvaluation[]>;
  /** MultiPV lines at a seat's rung, falling back to the nearest lower rung. */
  multiPvAt(fen: string, depth: number): Promise<readonly EngineEvaluation[]>;
  /** Width-1 top line at a seat's rung for pre-move opportunity signals. */
  bestAt(fen: string, depth: number): Promise<EngineEvaluation>;
  dispose(): Promise<void>;
  readonly poolSize: number;
}

interface InflightShared {
  readonly promise: Promise<DepthLadder>;
}

/** Engine transport is profile-agnostic; private scoring belongs to orchestration. */
export function applyPrivateScoring(
  base: EngineEvaluation,
  evalProfile: EvalProfile,
): EngineEvaluation {
  void evalProfile;
  return Object.freeze({
    scoreCp: base.scoreCp,
    pv: Object.freeze([...base.pv]),
  });
}

function freezeEval(result: {
  readonly scoreCp: number;
  readonly pv: readonly string[];
}): EngineEvaluation {
  return Object.freeze({
    scoreCp: result.scoreCp,
    pv: Object.freeze([...result.pv]),
  });
}

function ladderAt(ladder: DepthLadder, depth: number): EngineEvaluation {
  for (let d = depth; d >= 1; d -= 1) {
    const hit = ladder.at.get(d);
    if (hit !== undefined) return freezeEval(hit);
  }
  const fallback = ladder.multiPvAtMax.get(1);
  if (fallback === undefined) {
    throw new Error(`Shared search produced no score for depth ${depth}`);
  }
  return freezeEval(fallback);
}

function multiPvAt(
  ladder: DepthLadder,
  depth: number,
): readonly EngineEvaluation[] {
  for (let d = depth; d >= 1; d -= 1) {
    const lines = ladder.multiPvAt.get(d);
    if (lines !== undefined && lines.size > 0) {
      return Object.freeze(
        [...lines.keys()]
          .sort((left, right) => left - right)
          .flatMap((key) => {
            const line = lines.get(key);
            return line === undefined ? [] : [freezeEval(line)];
          }),
      );
    }
  }
  return Object.freeze([]);
}

/**
 * Shared search + private per-piece scoring broker (ADR 0017).
 *
 * One canonical MultiPV search at D_max per FEN; seats at D_i receive a
 * truncation of that tree. Private scoring is applied in orchestration.
 */
export async function createSharedSearchBroker(
  options: SharedSearchBrokerOptions,
): Promise<SharedSearchBroker> {
  const dMax = options.dMax ?? SHARED_SEARCH_D_MAX;
  const preferredMultiPv =
    options.preferredMultiPv ?? DEFAULT_PREFERRED_MULTIPV_WIDTH;
  const preferredPoolSize =
    options.preferredPoolSize ?? DEFAULT_PREFERRED_POOL_SIZE;
  if (!Number.isSafeInteger(dMax) || dMax < 1) {
    throw new RangeError('dMax must be a positive integer.');
  }
  if (!Number.isSafeInteger(preferredMultiPv) || preferredMultiPv < 1) {
    throw new RangeError('preferredMultiPv must be a positive integer.');
  }
  if (!Number.isSafeInteger(preferredPoolSize) || preferredPoolSize < 1) {
    throw new RangeError('preferredPoolSize must be a positive integer.');
  }
  const pool = await EnginePool.create({
    enginePath: options.enginePath,
    hashMb: options.hashMb ?? 16,
    threads: 1,
    multiPv: options.multiPv ?? DEFAULT_PRIVATE_MULTIPV_WIDTH,
    ...(options.size !== undefined ? { size: options.size } : {}),
  });
  let bestPoolPromise: Promise<EnginePool> | undefined;

  const sharedByFen = new Map<string, DepthLadder>();
  const inflight = new Map<string, InflightShared>();
  const bestByFenDepth = new Map<string, EngineEvaluation>();

  function ensureBestPool(): Promise<EnginePool> {
    if (bestPoolPromise === undefined) {
      bestPoolPromise = EnginePool.create({
        enginePath: options.enginePath,
        hashMb: options.hashMb ?? 16,
        threads: 1,
        multiPv: preferredMultiPv,
        size: preferredPoolSize,
      });
    }
    return bestPoolPromise;
  }

  async function ensureShared(fen: string): Promise<DepthLadder> {
    const cached = sharedByFen.get(fen);
    if (cached !== undefined) return cached;
    const pending = inflight.get(fen);
    if (pending !== undefined) return pending.promise;
    const promise = pool.searchLadder(fen, dMax).then((ladder) => {
      sharedByFen.set(fen, ladder);
      inflight.delete(fen);
      return ladder;
    });
    inflight.set(fen, { promise });
    try {
      return await promise;
    } catch (cause) {
      inflight.delete(fen);
      throw cause;
    }
  }

  return {
    determinismId: options.determinismId,
    poolSize: pool.size,
    async evaluate(
      fen: string,
      depth: number,
      evalProfile: EvalProfile = {},
    ): Promise<EngineEvaluation> {
      if (!Number.isSafeInteger(depth) || depth < 1) {
        throw new RangeError('Depth must be a positive integer.');
      }
      const capped = Math.min(depth, dMax);
      const ladder = await ensureShared(fen);
      return applyPrivateScoring(ladderAt(ladder, capped), evalProfile);
    },
    async evaluateTrue(fen: string): Promise<EngineEvaluation> {
      const ladder = await ensureShared(fen);
      return ladderAt(ladder, dMax);
    },
    async multiPvAtMax(fen: string): Promise<readonly EngineEvaluation[]> {
      const ladder = await ensureShared(fen);
      const lines: EngineEvaluation[] = [];
      const keys = [...ladder.multiPvAtMax.keys()].sort((a, b) => a - b);
      for (const key of keys) {
        const line = ladder.multiPvAtMax.get(key);
        if (line !== undefined) lines.push(freezeEval(line));
      }
      return Object.freeze(lines);
    },
    async multiPvAt(
      fen: string,
      depth: number,
    ): Promise<readonly EngineEvaluation[]> {
      const ladder = await ensureShared(fen);
      return multiPvAt(ladder, Math.min(depth, dMax));
    },
    async bestAt(fen: string, depth: number): Promise<EngineEvaluation> {
      if (!Number.isSafeInteger(depth) || depth < 1) {
        throw new RangeError('Depth must be a positive integer.');
      }
      const capped = Math.min(depth, dMax);
      const key = `${fen}\u0000${capped}`;
      const cached = bestByFenDepth.get(key);
      if (cached !== undefined) return cached;
      const result = await (await ensureBestPool()).evaluate(fen, capped);
      const frozen = freezeEval(result);
      bestByFenDepth.set(key, frozen);
      return frozen;
    },
    async dispose(): Promise<void> {
      sharedByFen.clear();
      inflight.clear();
      bestByFenDepth.clear();
      await pool.dispose();
      if (bestPoolPromise !== undefined) {
        await (await bestPoolPromise).dispose();
      }
    },
  };
}
