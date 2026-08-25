import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
} from '../search';
import type { EngineEvaluation, EnginePort } from '../types';
import { UciEngine, type DepthLadder } from '../uci';

const LOZZA_HASH_MB = 16;
// Keep the cache unbounded by default: eviction forces re-searches on the warm
// child, and Lozza's carried state makes those results path-dependent. Whether
// bounded eviction may change campaign numbers belongs in the determinism ADR.
export const DEFAULT_LOZZA_LADDER_CACHE_CAPACITY = Number.MAX_SAFE_INTEGER;
// Lozza's warm transposition-table state affects search results. Keep
// recycling opt-in until its determinism contract is decided.
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
  /** Maximum number of FEN ladders retained by the adapter's LRU. */
  readonly ladderCacheCapacity?: number;
  /** Recycle each child after this many completed searches (opt-in). */
  readonly recycleAfterSearches?: number;
}

interface LozzaEngineState {
  sharedEngine: UciEngine;
  bestEngine: UciEngine | undefined;
  searchQueue: Promise<void>;
  bestSearchQueue: Promise<void>;
  ladderByFen: LruCache<string, DepthLadder>;
  ladderCacheCapacity: number;
  recycleAfterSearches: number;
  sharedSearches: number;
  bestSearches: number;
  restarts: number;
}

const statesByPath = new Map<string, LozzaEngineState>();
const artifactIdentityByPath = new Map<
  string,
  { readonly build: string; readonly hash: string }
>();

class LruCache<K, V> {
  private readonly values = new Map<K, V>();

  constructor(private capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('ladderCacheCapacity must be a positive integer.');
    }
  }

  setCapacity(capacity: number): void {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('ladderCacheCapacity must be a positive integer.');
    }
    this.capacity = capacity;
    this.trim();
  }

  get(key: K): V | undefined {
    const value = this.values.get(key);
    if (value !== undefined) {
      this.values.delete(key);
      this.values.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    this.values.delete(key);
    this.values.set(key, value);
    this.trim();
  }

  private trim(): void {
    while (this.values.size > this.capacity) {
      const oldest = this.values.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
  }
}

function createSharedEngine(enginePath: string): UciEngine {
  return new UciEngine({
    enginePath,
    hashMb: LOZZA_HASH_MB,
    threads: 1,
    multiPv: DEFAULT_PRIVATE_MULTIPV_WIDTH,
  });
}

function getState(
  enginePath: string,
  options: LozzaPortOptions,
): LozzaEngineState {
  const existing = statesByPath.get(enginePath);
  if (existing !== undefined) {
    if (options.ladderCacheCapacity !== undefined) {
      existing.ladderCacheCapacity = options.ladderCacheCapacity;
      existing.ladderByFen.setCapacity(options.ladderCacheCapacity);
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
    sharedEngine: createSharedEngine(enginePath),
    bestEngine: undefined,
    searchQueue: Promise.resolve(),
    bestSearchQueue: Promise.resolve(),
    ladderByFen: new LruCache(ladderCacheCapacity),
    ladderCacheCapacity,
    recycleAfterSearches,
    sharedSearches: 0,
    bestSearches: 0,
    restarts: 0,
  };
  statesByPath.set(enginePath, state);
  return state;
}

function getBestEngine(state: LozzaEngineState, enginePath: string): UciEngine {
  state.bestEngine ??= new UciEngine({
    enginePath,
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
  state.sharedEngine = createSharedEngine(enginePath);
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

function lozzaDeterminismId(enginePath: string): string {
  const { build, hash } = getArtifactIdentity(enginePath);
  // The short hash is an equality token, not a security boundary.
  return (
    `lozza-${build}/artifact-${hash}/depth-fixed/hash-${LOZZA_HASH_MB}/` +
    `threads-1/multipv-${DEFAULT_PRIVATE_MULTIPV_WIDTH}/` +
    `preferred-multipv-${DEFAULT_PREFERRED_MULTIPV_WIDTH}/` +
    `preferred-pool-${DEFAULT_PREFERRED_POOL_SIZE}`
  );
}

function bestAvailableResult(
  ladder: DepthLadder,
  requestedDepth: number,
): { readonly scoreCp: number; readonly pv: readonly string[] } | undefined {
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
  const determinismId = lozzaDeterminismId(enginePath);
  const state = getState(enginePath, options);
  const ladderFor = async (
    fen: string,
    depth: number,
  ): Promise<DepthLadder> => {
    const cached = state.ladderByFen.get(fen);
    if (cached !== undefined && cached.maxDepth >= depth) return cached;
    const search = state.searchQueue.then(async () => {
      if (state.sharedSearches >= state.recycleAfterSearches) {
        await recycleSharedEngine(state, enginePath);
      }
      state.sharedSearches += 1;
      return state.sharedEngine.searchLadder(fen, depth);
    });
    state.searchQueue = search.then(
      () => undefined,
      () => undefined,
    );
    const ladder = await search;
    state.ladderByFen.set(fen, ladder);
    return ladder;
  };
  return {
    determinismId,
    async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
      const ladder = await ladderFor(fen, depth);
      const result = bestAvailableResult(ladder, depth);
      if (result === undefined) {
        throw new Error(`Lozza produced no score at depth ${depth}`);
      }
      return Object.freeze({
        scoreCp: result.scoreCp,
        pv: result.pv,
      });
    },
    async multiPvAtMax(fen: string): Promise<readonly EngineEvaluation[]> {
      const ladder = await ladderFor(fen, 16);
      return linesAt(ladder, ladder.maxDepth);
    },
    async multiPvAt(
      fen: string,
      depth: number,
    ): Promise<readonly EngineEvaluation[]> {
      const ladder = await ladderFor(fen, depth);
      for (let rung = Math.min(depth, ladder.maxDepth); rung >= 1; rung -= 1) {
        const lines = ladder.multiPvAt.get(rung);
        if (lines !== undefined && lines.size > 0) {
          return linesAt(ladder, rung);
        }
      }
      return Object.freeze([]);
    },
    async bestAt(fen: string, depth: number): Promise<EngineEvaluation> {
      const search = state.bestSearchQueue.then(async () => {
        if (state.bestSearches >= state.recycleAfterSearches) {
          await recycleBestEngine(state, enginePath);
        }
        state.bestSearches += 1;
        return getBestEngine(state, enginePath).searchLadder(fen, depth);
      });
      state.bestSearchQueue = search.then(
        () => undefined,
        () => undefined,
      );
      const ladder = await search;
      const result = bestAvailableResult(ladder, depth);
      if (result === undefined) {
        throw new Error(`Lozza produced no best line at depth ${depth}`);
      }
      return Object.freeze({
        scoreCp: result.scoreCp,
        pv: Object.freeze([...result.pv]),
      });
    },
    getCostStats: () => ({ restarts: state.restarts }),
  };
}

function linesAt(
  ladder: DepthLadder,
  depth: number,
): readonly EngineEvaluation[] {
  const lines = ladder.multiPvAt.get(depth);
  if (lines === undefined) return Object.freeze([]);
  const evaluations: EngineEvaluation[] = [];
  for (const key of [...lines.keys()].sort((left, right) => left - right)) {
    const line = lines.get(key);
    if (line !== undefined) {
      evaluations.push(
        Object.freeze({
          scoreCp: line.scoreCp,
          pv: Object.freeze([...line.pv]),
        }),
      );
    }
  }
  return Object.freeze(evaluations);
}

/** Tear down the shared process (test cleanup). */
export async function disposeLozzaPort(): Promise<void> {
  const states = [...statesByPath.values()];
  statesByPath.clear();
  await Promise.all(
    states.flatMap((state) => [
      state.sharedEngine.dispose(),
      ...(state.bestEngine === undefined ? [] : [state.bestEngine.dispose()]),
    ]),
  );
}
