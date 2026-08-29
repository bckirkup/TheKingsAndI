import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
} from '../search';
import { DEFAULT_ENGINE_LADDER_CACHE_CAPACITY, LruCache } from '../cache';
import type { EngineEvaluation, EnginePort } from '../types';
import {
  DEFAULT_MAX_INFO_LINES_PER_SEARCH,
  DEFAULT_MAX_SCORE_ESCALATIONS,
  UciEngine,
  UciInfoLineLimitError,
  UciUnsoundScoreError,
  type DepthLadder,
  type UciSearchResult,
} from '../uci';

const LOZZA_HASH_MB = 16;
// Cold searches make eviction a latency choice: a re-search cannot change the
// result, so bound the ladder cache for long campaigns.
export const DEFAULT_LOZZA_LADDER_CACHE_CAPACITY =
  DEFAULT_ENGINE_LADDER_CACHE_CAPACITY;
// Process recycling remains an opt-in fallback for engines whose search state
// is not cleared by ucinewgame.
export const DEFAULT_LOZZA_RECYCLE_AFTER_SEARCHES = Number.MAX_SAFE_INTEGER;
const LOZZA_BUILD_PATTERN = /\bconst BUILD = ['"]([^'"]+)['"];/;
const LOZZA_ARTIFACT_HASH_PREFIX_LENGTH = 12;

const defaultEnginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../vendor/lozza/lozza.cjs',
);

export interface LozzaPortOptions {
  /** Override the vendored lozza.cjs path (tests only). */
  readonly enginePath?: string;
  /** Clear carried engine state before every search; defaults to cold. */
  readonly coldSearch?: boolean;
  /** Maximum number of FEN ladders retained by the adapter's LRU. */
  readonly ladderCacheCapacity?: number;
  /** Recycle each child after this many completed searches (opt-in). */
  readonly recycleAfterSearches?: number;
  /** Maximum deterministic one-ply re-searches for unsound scores. */
  readonly maxScoreEscalations?: number;
  /** Hard ceiling on info lines emitted by one search. */
  readonly maxInfoLinesPerSearch?: number;
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

const statesByPath = new Map<string, LozzaEngineState>();
const artifactIdentityByPath = new Map<
  string,
  { readonly build: string; readonly hash: string }
>();

function createSharedEngine(
  enginePath: string,
  coldSearch: boolean,
  maxScoreEscalations: number,
  maxInfoLinesPerSearch: number,
): UciEngine {
  return new UciEngine({
    enginePath,
    coldSearch,
    maxScoreEscalations,
    maxInfoLinesPerSearch,
    hashMb: LOZZA_HASH_MB,
    threads: 1,
    multiPv: DEFAULT_PRIVATE_MULTIPV_WIDTH,
  });
}

function getState(
  enginePath: string,
  options: LozzaPortOptions,
  coldSearch: boolean,
): LozzaEngineState {
  const maxScoreEscalations =
    options.maxScoreEscalations ?? DEFAULT_MAX_SCORE_ESCALATIONS;
  const maxInfoLinesPerSearch =
    options.maxInfoLinesPerSearch ?? DEFAULT_MAX_INFO_LINES_PER_SEARCH;
  const stateKey =
    `${enginePath}/search-${coldSearch ? 'cold' : 'warm'}` +
    `/score-escalate-${maxScoreEscalations}/runaway-${maxInfoLinesPerSearch}`;
  const existing = statesByPath.get(stateKey);
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
    sharedEngine: createSharedEngine(
      enginePath,
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
  statesByPath.set(stateKey, state);
  return state;
}

function getBestEngine(state: LozzaEngineState, enginePath: string): UciEngine {
  state.bestEngine ??= new UciEngine({
    enginePath,
    coldSearch: state.coldSearch,
    maxScoreEscalations: state.maxScoreEscalations,
    maxInfoLinesPerSearch: state.maxInfoLinesPerSearch,
    hashMb: LOZZA_HASH_MB,
    threads: 1,
    multiPv: 1,
  });
  return state.bestEngine;
}

async function recycleSharedEngine(
  state: LozzaEngineState,
  enginePath: string,
): Promise<void> {
  await state.sharedEngine.dispose();
  state.sharedEngine = createSharedEngine(
    enginePath,
    state.coldSearch,
    state.maxScoreEscalations,
    state.maxInfoLinesPerSearch,
  );
  state.sharedSearches = 0;
  state.restarts += 1;
}

async function recycleBestEngine(
  state: LozzaEngineState,
  enginePath: string,
): Promise<void> {
  if (state.bestEngine !== undefined) await state.bestEngine.dispose();
  state.bestEngine = new UciEngine({
    enginePath,
    coldSearch: state.coldSearch,
    maxScoreEscalations: state.maxScoreEscalations,
    maxInfoLinesPerSearch: state.maxInfoLinesPerSearch,
    hashMb: LOZZA_HASH_MB,
    threads: 1,
    multiPv: 1,
  });
  state.bestSearches = 0;
  state.restarts += 1;
}

function getArtifactIdentity(enginePath: string): {
  readonly build: string;
  readonly hash: string;
} {
  const cached = artifactIdentityByPath.get(enginePath);
  if (cached !== undefined) return cached;
  const artifact = readFileSync(enginePath);
  const source = artifact.toString('utf8');
  const build = LOZZA_BUILD_PATTERN.exec(source)?.[1];
  if (build === undefined) {
    throw new Error(
      `Lozza artifact does not declare a readable BUILD label: ${enginePath}`,
    );
  }
  const hash = createHash('sha256')
    .update(artifact)
    .digest('hex')
    .slice(0, LOZZA_ARTIFACT_HASH_PREFIX_LENGTH);
  const identity = { build, hash };
  artifactIdentityByPath.set(enginePath, identity);
  return identity;
}

export function lozzaDeterminismId(
  enginePath: string,
  coldSearch: boolean,
  maxScoreEscalations = DEFAULT_MAX_SCORE_ESCALATIONS,
  maxInfoLinesPerSearch = DEFAULT_MAX_INFO_LINES_PER_SEARCH,
): string {
  const { build, hash } = getArtifactIdentity(enginePath);
  // The short hash is an equality token, not a security boundary.
  return (
    `lozza-${build}/artifact-${hash}/depth-fixed/hash-${LOZZA_HASH_MB}/` +
    `threads-1/multipv-${DEFAULT_PRIVATE_MULTIPV_WIDTH}/` +
    `preferred-multipv-${DEFAULT_PREFERRED_MULTIPV_WIDTH}/` +
    `preferred-pool-${DEFAULT_PREFERRED_POOL_SIZE}/` +
    `search-${coldSearch ? 'cold' : 'warm'}/` +
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
 * A single shared UCI process serialises searches; the evaluation cache
 * handles deduplication across pieces at the barrier.
 */
export function createLozzaPort(options: LozzaPortOptions = {}): EnginePort {
  const enginePath = resolve(options.enginePath ?? defaultEnginePath);
  const coldSearch = options.coldSearch ?? true;
  const maxScoreEscalations =
    options.maxScoreEscalations ?? DEFAULT_MAX_SCORE_ESCALATIONS;
  const maxInfoLinesPerSearch =
    options.maxInfoLinesPerSearch ?? DEFAULT_MAX_INFO_LINES_PER_SEARCH;
  const determinismId = lozzaDeterminismId(
    enginePath,
    coldSearch,
    maxScoreEscalations,
    maxInfoLinesPerSearch,
  );
  const state = getState(enginePath, options, coldSearch);
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
        await recycleSharedEngine(state, enginePath);
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
          await recycleSharedEngine(state, enginePath);
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
    const key = `${fen}\u0000${depth}`;
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
    const key = `${fen}\u0000${depth}`;
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
              await recycleBestEngine(state, enginePath);
            }
            state.bestSearches += 1;
            const engine = getBestEngine(state, enginePath);
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
                await recycleBestEngine(state, enginePath);
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

/** Tear down the shared process (test cleanup). */
export async function disposeLozzaPort(): Promise<void> {
  const states = [...statesByPath.values()];
  statesByPath.clear();
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
