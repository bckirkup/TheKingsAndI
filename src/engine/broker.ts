import type { EngineEvaluation, EnginePort, EvalProfile } from './types';
import { DEFAULT_ENGINE_LADDER_CACHE_CAPACITY, LruCache } from './cache';
import { EnginePool, type EnginePoolOptions } from './pool';
import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
  SHARED_SEARCH_D_MAX,
  applyPrivateScoring,
} from './search';
import {
  DEFAULT_MAX_SCORE_ESCALATIONS,
  UciUnsoundScoreError,
  type DepthLadder,
  type UciSearchResult,
} from './uci';

export interface SharedSearchBrokerOptions extends EnginePoolOptions {
  readonly determinismId: string;
  /** Override D_max for tests (must stay fixed in production). */
  readonly dMax?: number;
  /** MultiPV width for the player-visible preferred-line search. */
  readonly preferredMultiPv?: number;
  /** Worker count for the player-visible preferred-line search. */
  readonly preferredPoolSize?: number;
  /** Capacity shared by the ladder and escalated-result caches. */
  readonly ladderCacheCapacity?: number;
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

function freezeEval(result: {
  readonly scoreCp: number;
  readonly pv: readonly string[];
}): EngineEvaluation {
  return Object.freeze({
    scoreCp: result.scoreCp,
    pv: Object.freeze([...result.pv]),
  });
}

function ladderAt(
  ladder: DepthLadder,
  depth: number,
): UciSearchResult | undefined {
  for (let d = depth; d >= 1; d -= 1) {
    const hit = ladder.at.get(d);
    if (hit !== undefined) return hit;
  }
  return ladder.multiPvAtMax.get(1);
}

function multiPvAt(
  ladder: DepthLadder,
  depth: number,
): readonly UciSearchResult[] {
  for (let d = depth; d >= 1; d -= 1) {
    const lines = ladder.multiPvAt.get(d);
    if (lines !== undefined && lines.size > 0) {
      return Object.freeze(
        [...lines.keys()]
          .sort((left, right) => left - right)
          .flatMap((key) => {
            const line = lines.get(key);
            return line === undefined ? [] : [line];
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
  const ladderCacheCapacity =
    options.ladderCacheCapacity ?? DEFAULT_ENGINE_LADDER_CACHE_CAPACITY;
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
  const escalatedResultsByFenDepth = new LruCache<string, UciSearchResult>(
    ladderCacheCapacity,
  );
  const escalatedLinesByFenDepth = new LruCache<
    string,
    readonly UciSearchResult[]
  >(ladderCacheCapacity);

  function ensureBestPool(): Promise<EnginePool> {
    bestPoolPromise ??= EnginePool.create({
      enginePath: options.enginePath,
      hashMb: options.hashMb ?? 16,
      threads: 1,
      multiPv: preferredMultiPv,
      size: preferredPoolSize,
    });
    return bestPoolPromise;
  }

  async function ensureShared(
    fen: string,
    depth: number = dMax,
    cache = true,
  ): Promise<DepthLadder> {
    if (cache) {
      const cached = sharedByFen.get(fen);
      if (cached !== undefined && cached.maxDepth >= depth) return cached;
    }
    const key = `${fen}\u0000${depth}`;
    const pending = inflight.get(key);
    const promise =
      pending?.promise ??
      pool.searchLadder(fen, depth).finally(() => {
        inflight.delete(key);
      });
    if (pending === undefined) inflight.set(key, { promise });
    try {
      const ladder = await promise;
      if (cache) sharedByFen.set(fen, ladder);
      return ladder;
    } catch (cause) {
      inflight.delete(key);
      throw cause;
    }
  }

  async function soundSharedResult(
    fen: string,
    depth: number,
  ): Promise<UciSearchResult> {
    const key = `${fen}\u0000${depth}`;
    const memoized = escalatedResultsByFenDepth.get(key);
    if (memoized !== undefined) return memoized;
    for (
      let escalation = 0;
      escalation <= DEFAULT_MAX_SCORE_ESCALATIONS;
      escalation += 1
    ) {
      const searchDepth = depth + escalation;
      const ladder = await ensureShared(fen, searchDepth, escalation === 0);
      const result = ladderAt(ladder, searchDepth);
      if (result === undefined) {
        throw new Error(`Shared search produced no score for depth ${depth}`);
      }
      if (result.sound) {
        if (escalation > 0) escalatedResultsByFenDepth.set(key, result);
        return result;
      }
      if (escalation === DEFAULT_MAX_SCORE_ESCALATIONS) {
        throw new UciUnsoundScoreError(fen, depth, result.rawScore, escalation);
      }
    }
    throw new Error(`Shared search produced no score for depth ${depth}`);
  }

  async function soundSharedLines(
    fen: string,
    depth: number,
  ): Promise<readonly UciSearchResult[]> {
    const key = `${fen}\u0000${depth}`;
    const memoized = escalatedLinesByFenDepth.get(key);
    if (memoized !== undefined) return memoized;
    for (
      let escalation = 0;
      escalation <= DEFAULT_MAX_SCORE_ESCALATIONS;
      escalation += 1
    ) {
      const searchDepth = depth + escalation;
      const ladder = await ensureShared(fen, searchDepth, escalation === 0);
      const lines = multiPvAt(ladder, searchDepth);
      if (lines.length > 0 && lines.every((line) => line.sound)) {
        if (escalation > 0) escalatedLinesByFenDepth.set(key, lines);
        return lines;
      }
      if (escalation === DEFAULT_MAX_SCORE_ESCALATIONS) {
        const reported = lines.find((line) => !line.sound);
        throw new UciUnsoundScoreError(
          fen,
          depth,
          reported?.rawScore ?? 'missing',
          escalation,
        );
      }
    }
    return Object.freeze([]);
  }

  async function soundBestResult(
    fen: string,
    depth: number,
  ): Promise<UciSearchResult> {
    for (
      let escalation = 0;
      escalation <= DEFAULT_MAX_SCORE_ESCALATIONS;
      escalation += 1
    ) {
      const ladder = await (
        await ensureBestPool()
      ).searchLadder(fen, depth + escalation);
      const result = ladderAt(ladder, depth + escalation);
      if (result === undefined) {
        throw new Error(`Best search produced no score for depth ${depth}`);
      }
      if (result.sound) return result;
      if (escalation === DEFAULT_MAX_SCORE_ESCALATIONS) {
        throw new UciUnsoundScoreError(fen, depth, result.rawScore, escalation);
      }
    }
    throw new Error(`Best search produced no score for depth ${depth}`);
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
      return applyPrivateScoring(
        freezeEval(await soundSharedResult(fen, capped)),
        evalProfile,
      );
    },
    async evaluateTrue(fen: string): Promise<EngineEvaluation> {
      return freezeEval(await soundSharedResult(fen, dMax));
    },
    async multiPvAtMax(fen: string): Promise<readonly EngineEvaluation[]> {
      return Object.freeze((await soundSharedLines(fen, dMax)).map(freezeEval));
    },
    async multiPvAt(
      fen: string,
      depth: number,
    ): Promise<readonly EngineEvaluation[]> {
      return Object.freeze(
        (await soundSharedLines(fen, Math.min(depth, dMax))).map(freezeEval),
      );
    },
    async bestAt(fen: string, depth: number): Promise<EngineEvaluation> {
      if (!Number.isSafeInteger(depth) || depth < 1) {
        throw new RangeError('Depth must be a positive integer.');
      }
      const capped = Math.min(depth, dMax);
      const key = `${fen}\u0000${capped}`;
      const cached = bestByFenDepth.get(key);
      if (cached !== undefined) return cached;
      const result = await soundBestResult(fen, capped);
      const frozen = freezeEval(result);
      bestByFenDepth.set(key, frozen);
      return frozen;
    },
    async dispose(): Promise<void> {
      sharedByFen.clear();
      inflight.clear();
      bestByFenDepth.clear();
      escalatedResultsByFenDepth.clear();
      escalatedLinesByFenDepth.clear();
      await pool.dispose();
      if (bestPoolPromise !== undefined) {
        await (await bestPoolPromise).dispose();
      }
    },
  };
}
