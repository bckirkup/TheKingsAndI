import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
} from './search';
import { DEFAULT_ENGINE_LADDER_CACHE_CAPACITY, LruCache } from './cache';
import type { EngineEvaluation, EnginePort } from './types';
import {
  DEFAULT_MAX_INFO_LINES_PER_SEARCH,
  DEFAULT_MAX_SCORE_ESCALATIONS,
  UciEngine,
  UciInfoLineLimitError,
  UciUnsoundScoreError,
  type DepthLadder,
  type UciSearchResult,
} from './uci';

/**
 * The Lozza `EnginePort` logic, host-neutral: the same ladder/escalation
 * policy runs over a spawned Node child (`adapters/lozza.ts`, harness) or a
 * Web Worker (`workerLozza.ts`, browser) so `determinismId` means the same
 * artifact plus policy in both places (ADR 0079).
 */

export const LOZZA_HASH_MB = 16;
// Cold searches make eviction a latency choice: a re-search cannot change the
// result, so bound the ladder cache for long campaigns.
export const DEFAULT_LOZZA_LADDER_CACHE_CAPACITY =
  DEFAULT_ENGINE_LADDER_CACHE_CAPACITY;
// Engine recycling remains an opt-in fallback for engines whose search state
// is not cleared by ucinewgame.
export const DEFAULT_LOZZA_RECYCLE_AFTER_SEARCHES = Number.MAX_SAFE_INTEGER;
export const LOZZA_ARTIFACT_HASH_PREFIX_LENGTH = 12;

export interface LozzaPortOptions {
  /** Clear carried engine state before every search; defaults to cold. */
  readonly coldSearch?: boolean;
  /** Maximum number of FEN ladders retained by the adapter's LRU. */
  readonly ladderCacheCapacity?: number;
  /** Recycle each engine host after this many completed searches (opt-in). */
  readonly recycleAfterSearches?: number;
  /** Maximum deterministic one-ply re-searches for unsound scores. */
  readonly maxScoreEscalations?: number;
  /** Hard ceiling on info lines emitted by one search. */
  readonly maxInfoLinesPerSearch?: number;
}

/** What `determinismId` records about the artifact (build label + hash). */
export interface LozzaArtifactIdentity {
  readonly build: string;
  readonly hash: string;
}

/** Per-engine settings the port supplies when it (re)creates a host engine. */
export interface LozzaEngineSpec {
  readonly multiPv: number;
  readonly coldSearch: boolean;
  readonly maxScoreEscalations: number;
  readonly maxInfoLinesPerSearch: number;
}

/**
 * How the port reaches an engine process/worker. One host instance per
 * environment; the port may create several engines (shared tree, best line,
 * recycling) from it.
 */
export interface LozzaEngineHost {
  /** State-map key distinguishing hosts (artifact path or worker identity). */
  readonly stateKey: string;
  readonly createEngine: (spec: LozzaEngineSpec) => UciEngine;
  readonly artifactIdentity: () => LozzaArtifactIdentity;
}

interface LozzaEngineState {
  sharedEngine: UciEngine;
  bestEngine: UciEngine | undefined;
  searchQueue: Promise<void>;
  bestSearchQueue: Promise<void>;
  ladderByFen: LruCache<string, DepthLadder>;
  escalatedResultsByFenDepth: LruCache<string, UciSearchResult>;
  escalatedBestResultsByFenDepth: LruCache<string, UciSearchResult>;
  escalatedLinesByFenDepth: LruCache<string, readonly UciSearchResult[]>;
  ladderCacheCapacity: number;
  recycleAfterSearches: number;
  coldSearch: boolean;
  maxScoreEscalations: number;
  maxInfoLinesPerSearch: number;
  sharedSearches: number;
  bestSearches: number;
  restarts: number;
  scoreEscalations: number;
  maxInfoLines: number;
  lastInfoLines: number;
}

const statesByKey = new Map<string, LozzaEngineState>();

function createEngine(
  host: LozzaEngineHost,
  multiPv: number,
  coldSearch: boolean,
  maxScoreEscalations: number,
  maxInfoLinesPerSearch: number,
): UciEngine {
  return host.createEngine({
    multiPv,
    coldSearch,
    maxScoreEscalations,
    maxInfoLinesPerSearch,
  });
}

function getState(
  host: LozzaEngineHost,
  options: LozzaPortOptions,
  coldSearch: boolean,
): LozzaEngineState {
  const maxScoreEscalations =
    options.maxScoreEscalations ?? DEFAULT_MAX_SCORE_ESCALATIONS;
  const maxInfoLinesPerSearch =
    options.maxInfoLinesPerSearch ?? DEFAULT_MAX_INFO_LINES_PER_SEARCH;
  const stateKey =
    `${host.stateKey}/search-${coldSearch ? 'cold' : 'warm'}` +
    `/score-escalate-${maxScoreEscalations}/runaway-${maxInfoLinesPerSearch}`;
  const existing = statesByKey.get(stateKey);
  if (existing !== undefined) {
    if (options.ladderCacheCapacity !== undefined) {
      existing.ladderCacheCapacity = options.ladderCacheCapacity;
      existing.ladderByFen.setCapacity(options.ladderCacheCapacity);
      existing.escalatedResultsByFenDepth.setCapacity(
        options.ladderCacheCapacity,
      );
      existing.escalatedBestResultsByFenDepth.setCapacity(
        options.ladderCacheCapacity,
      );
      existing.escalatedLinesByFenDepth.setCapacity(
        options.ladderCacheCapacity,
      );
    }
    if (options.recycleAfterSearches !== undefined) {
      existing.recycleAfterSearches = options.recycleAfterSearches;
    }
    return existing;
  }
  const ladderCacheCapacity =
    options.ladderCacheCapacity ?? DEFAULT_LOZZA_LADDER_CACHE_CAPACITY;
  const recycleAfterSearches =
    options.recycleAfterSearches ?? DEFAULT_LOZZA_RECYCLE_AFTER_SEARCHES;
  const state: LozzaEngineState = {
    sharedEngine: createEngine(
      host,
      DEFAULT_PRIVATE_MULTIPV_WIDTH,
      coldSearch,
      maxScoreEscalations,
      maxInfoLinesPerSearch,
    ),
    bestEngine: undefined,
    searchQueue: Promise.resolve(),
    bestSearchQueue: Promise.resolve(),
    ladderByFen: new LruCache(ladderCacheCapacity),
    escalatedResultsByFenDepth: new LruCache(ladderCacheCapacity),
    escalatedBestResultsByFenDepth: new LruCache(ladderCacheCapacity),
    escalatedLinesByFenDepth: new LruCache(ladderCacheCapacity),
    ladderCacheCapacity,
    recycleAfterSearches,
    coldSearch,
    maxScoreEscalations,
    maxInfoLinesPerSearch,
    sharedSearches: 0,
    bestSearches: 0,
    restarts: 0,
    scoreEscalations: 0,
    maxInfoLines: 0,
    lastInfoLines: 0,
  };
  statesByKey.set(stateKey, state);
  return state;
}

function getBestEngine(state: LozzaEngineState, host: LozzaEngineHost): UciEngine {
  state.bestEngine ??= createEngine(
    host,
    1,
    state.coldSearch,
    state.maxScoreEscalations,
    state.maxInfoLinesPerSearch,
  );
  return state.bestEngine;
}

async function recycleSharedEngine(
  state: LozzaEngineState,
  host: LozzaEngineHost,
): Promise<void> {
  await state.sharedEngine.dispose();
  state.sharedEngine = createEngine(
    host,
    DEFAULT_PRIVATE_MULTIPV_WIDTH,
    state.coldSearch,
    state.maxScoreEscalations,
    state.maxInfoLinesPerSearch,
  );
  state.sharedSearches = 0;
  state.restarts += 1;
}

async function recycleBestEngine(
  state: LozzaEngineState,
  host: LozzaEngineHost,
): Promise<void> {
  if (state.bestEngine !== undefined) await state.bestEngine.dispose();
  state.bestEngine = createEngine(
    host,
    1,
    state.coldSearch,
    state.maxScoreEscalations,
    state.maxInfoLinesPerSearch,
  );
  state.bestSearches = 0;
  state.restarts += 1;
}

export function lozzaDeterminismIdCore(
  identity: LozzaArtifactIdentity,
  coldSearch: boolean,
  maxScoreEscalations = DEFAULT_MAX_SCORE_ESCALATIONS,
  maxInfoLinesPerSearch = DEFAULT_MAX_INFO_LINES_PER_SEARCH,
): string {
  const { build, hash } = identity;
  // The short hash is an equality token, not a security boundary.
  return (
    `lozza-${build}/artifact-${hash}/depth-fixed/hash-${LOZZA_HASH_MB}/` +
    `threads-1/multipv-${DEFAULT_PRIVATE_MULTIPV_WIDTH}/` +
    `preferred-multipv-${DEFAULT_PREFERRED_MULTIPV_WIDTH}/` +
    `preferred-pool-${DEFAULT_PREFERRED_POOL_SIZE}/` +
    `search-${coldSearch ? 'cold' : 'warm'}/ladder-rung-canonical/` +
    `score-escalate-${maxScoreEscalations}/runaway-${maxInfoLinesPerSearch}`
  );
}

function bestAvailableResult(
  ladder: DepthLadder,
  requestedDepth: number,
): UciSearchResult | undefined {
  // Lozza can terminate early when only one legal move is forced; that
  // deterministic ladder rung is valid even when it is shallower than asked.
  for (let depth = requestedDepth; depth >= 1; depth -= 1) {
    const result = ladder.at.get(depth);
    if (result !== undefined) return result;
  }
  return ladder.multiPvAtMax.get(1);
}

/**
 * Permissive MIT adapter proving `EnginePort` is real (ADR 0020 §4).
 * A single shared engine serialises searches; the evaluation cache
 * handles deduplication across pieces at the barrier.
 */
export function createLozzaPortCore(
  host: LozzaEngineHost,
  options: LozzaPortOptions = {},
): EnginePort {
  const coldSearch = options.coldSearch ?? true;
  const maxScoreEscalations =
    options.maxScoreEscalations ?? DEFAULT_MAX_SCORE_ESCALATIONS;
  const maxInfoLinesPerSearch =
    options.maxInfoLinesPerSearch ?? DEFAULT_MAX_INFO_LINES_PER_SEARCH;
  const determinismId = lozzaDeterminismIdCore(
    host.artifactIdentity(),
    coldSearch,
    maxScoreEscalations,
    maxInfoLinesPerSearch,
  );
  const state = getState(host, options, coldSearch);
  const ladderFor = async (
    fen: string,
    depth: number,
    cache = true,
  ): Promise<DepthLadder> => {
    if (cache) {
      const cached = state.ladderByFen.get(fen);
      if (cached !== undefined && cached.maxDepth >= depth) return cached;
    }
    const search = state.searchQueue.then(async () => {
      if (state.sharedSearches >= state.recycleAfterSearches) {
        await recycleSharedEngine(state, host);
      }
      state.sharedSearches += 1;
      try {
        const ladder = await state.sharedEngine.searchLadder(fen, depth);
        state.maxInfoLines = Math.max(
          state.maxInfoLines,
          state.sharedEngine.lastInfoLineCount,
        );
        state.lastInfoLines = state.sharedEngine.lastInfoLineCount;
        return ladder;
      } catch (cause: unknown) {
        if (cause instanceof UciInfoLineLimitError) {
          await recycleSharedEngine(state, host);
        }
        throw cause;
      }
    });
    state.searchQueue = search.then(
      () => undefined,
      () => undefined,
    );
    const ladder = await search;
    if (cache) state.ladderByFen.set(fen, ladder);
    return ladder;
  };
  const soundResult = async (
    fen: string,
    depth: number,
    search: (searchDepth: number, cache: boolean) => Promise<DepthLadder>,
    resultCache = state.escalatedResultsByFenDepth,
  ): Promise<UciSearchResult> => {
    const key = `${fen} ${depth}`;
    const memoized = resultCache.get(key);
    if (memoized !== undefined) return memoized;
    for (
      let escalation = 0;
      escalation <= maxScoreEscalations;
      escalation += 1
    ) {
      const ladder = await search(depth + escalation, escalation === 0);
      const result = bestAvailableResult(ladder, depth + escalation);
      if (result === undefined) {
        throw new Error(`Lozza produced no score at depth ${depth}`);
      }
      if (result.sound) {
        state.scoreEscalations += escalation;
        if (escalation > 0) {
          resultCache.set(key, result);
        }
        return result;
      }
      if (escalation === maxScoreEscalations) {
        throw new UciUnsoundScoreError(fen, depth, result.rawScore, escalation);
      }
    }
    throw new Error(`Lozza produced no score at depth ${depth}`);
  };
  const soundLines = async (
    fen: string,
    depth: number,
    search: (searchDepth: number, cache: boolean) => Promise<DepthLadder>,
    at: (
      ladder: DepthLadder,
      searchDepth: number,
    ) => readonly UciSearchResult[],
  ): Promise<readonly UciSearchResult[]> => {
    const key = `${fen} ${depth}`;
    const memoized = state.escalatedLinesByFenDepth.get(key);
    if (memoized !== undefined) return memoized;
    for (
      let escalation = 0;
      escalation <= maxScoreEscalations;
      escalation += 1
    ) {
      const searchDepth = depth + escalation;
      const ladder = await search(searchDepth, escalation === 0);
      const lines = at(ladder, searchDepth);
      if (lines.length > 0 && lines.every((line) => line.sound)) {
        state.scoreEscalations += escalation;
        if (escalation > 0) {
          state.escalatedLinesByFenDepth.set(key, lines);
        }
        return lines;
      }
      if (escalation === maxScoreEscalations) {
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
  };
  return {
    determinismId,
    async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
      const result = await soundResult(fen, depth, (searchDepth, cache) =>
        ladderFor(fen, searchDepth, cache),
      );
      return Object.freeze({
        scoreCp: result.scoreCp,
        pv: result.pv,
      });
    },
    async multiPvAtMax(fen: string): Promise<readonly EngineEvaluation[]> {
      const lines = await soundLines(
        fen,
        16,
        (searchDepth, cache) => ladderFor(fen, searchDepth, cache),
        (ladder, searchDepth) => linesAtResults(ladder, searchDepth),
      );
      return evaluationsAt(lines);
    },
    async multiPvAt(
      fen: string,
      depth: number,
    ): Promise<readonly EngineEvaluation[]> {
      const lines = await soundLines(
        fen,
        depth,
        (searchDepth, cache) => ladderFor(fen, searchDepth, cache),
        (ladder, searchDepth) => linesAtResults(ladder, searchDepth),
      );
      return evaluationsAt(lines);
    },
    async bestAt(fen: string, depth: number): Promise<EngineEvaluation> {
      const result = await soundResult(
        fen,
        depth,
        async (searchDepth) => {
          const pending = state.bestSearchQueue.then(async () => {
            if (state.bestSearches >= state.recycleAfterSearches) {
              await recycleBestEngine(state, host);
            }
            state.bestSearches += 1;
            const engine = getBestEngine(state, host);
            try {
              const ladder = await engine.searchLadder(fen, searchDepth);
              state.maxInfoLines = Math.max(
                state.maxInfoLines,
                engine.lastInfoLineCount,
              );
              state.lastInfoLines = engine.lastInfoLineCount;
              return ladder;
            } catch (cause: unknown) {
              if (cause instanceof UciInfoLineLimitError) {
                await recycleBestEngine(state, host);
              }
              throw cause;
            }
          });
          state.bestSearchQueue = pending.then(
            () => undefined,
            () => undefined,
          );
          return pending;
        },
        state.escalatedBestResultsByFenDepth,
      );
      return Object.freeze({
        scoreCp: result.scoreCp,
        pv: Object.freeze([...result.pv]),
      });
    },
    getCostStats: () => ({
      restarts: state.restarts,
      scoreEscalations: state.scoreEscalations,
      maxInfoLines: state.maxInfoLines,
      lastInfoLines: state.lastInfoLines,
    }),
  };
}

function linesAtResults(
  ladder: DepthLadder,
  depth: number,
): readonly UciSearchResult[] {
  let lines: ReadonlyMap<number, UciSearchResult> | undefined;
  for (let rung = depth; rung >= 1; rung -= 1) {
    const candidate = ladder.multiPvAt.get(rung);
    if (candidate !== undefined && candidate.size > 0) {
      lines = candidate;
      break;
    }
  }
  if (lines === undefined) return Object.freeze([]);
  const evaluations: UciSearchResult[] = [];
  for (const key of [...lines.keys()].sort((left, right) => left - right)) {
    const line = lines.get(key);
    if (line !== undefined) {
      evaluations.push(line);
    }
  }
  return Object.freeze(evaluations);
}

function evaluationsAt(
  lines: readonly UciSearchResult[],
): readonly EngineEvaluation[] {
  return Object.freeze(
    lines.map((line) =>
      Object.freeze({
        scoreCp: line.scoreCp,
        pv: Object.freeze([...line.pv]),
      }),
    ),
  );
}

/** Tear down every Lozza host engine (test cleanup). */
export async function disposeLozzaPorts(): Promise<void> {
  const states = [...statesByKey.values()];
  statesByKey.clear();
  for (const state of states) {
    state.ladderByFen.clear();
    state.escalatedResultsByFenDepth.clear();
    state.escalatedBestResultsByFenDepth.clear();
    state.escalatedLinesByFenDepth.clear();
  }
  await Promise.all(
    states.flatMap((state) => [
      state.sharedEngine.dispose(),
      ...(state.bestEngine === undefined ? [] : [state.bestEngine.dispose()]),
    ]),
  );
}
