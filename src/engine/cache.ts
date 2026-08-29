import { canonicalJson } from '../core/canonicalJson';
import type { EngineEvaluation, EvalProfile, InsightRequest } from './types';

/**
 * Evaluation cache (ADR 0017, ADR 0034 §6). The cache may change latency and
 * nothing else: a warm entry must produce a bundle byte-identical to a cold one,
 * which is why stored evaluations are frozen and shared rather than copied on
 * read — a caller that could mutate one would silently rewrite a later replay.
 */

export interface CacheConfig {
  /** Entries retained; the oldest use is evicted first. */
  readonly maxEntries: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = { maxEntries: 4096 };
export const DEFAULT_ENGINE_LADDER_CACHE_CAPACITY =
  DEFAULT_CACHE_CONFIG.maxEntries;

/**
 * Bounded insertion-ordered cache for engine ladders and escalated results.
 * Eviction can only cause a deterministic re-search; it cannot change a result.
 */
export class LruCache<K, V> {
  private readonly values = new Map<K, V>();

  constructor(private capacity: number) {
    this.validateCapacity(capacity);
  }

  setCapacity(capacity: number): void {
    this.validateCapacity(capacity);
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

  clear(): void {
    this.values.clear();
  }

  private validateCapacity(capacity: number): void {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('ladderCacheCapacity must be a positive integer.');
    }
  }

  private trim(): void {
    while (this.values.size > this.capacity) {
      const oldest = this.values.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
  }
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
}

export interface EvaluationCache {
  get(key: string): EngineEvaluation | undefined;
  set(key: string, evaluation: EngineEvaluation): EngineEvaluation;
  stats(): CacheStats;
}

/**
 * `(position, D_i, evalProfile_i, determinismId)` — every component is
 * load-bearing. Dropping `evalProfile_i` is the likeliest silent determinism
 * bug in the design (ADR 0017), and dropping `determinismId` would let a warm
 * cache serve values from the previous engine build.
 */
export function evaluationKey(
  determinismId: string,
  fen: string,
  depth: number,
  evalProfile: EvalProfile,
): string {
  return canonicalJson([determinismId, fen, depth, evalProfile]);
}

export function requestKey(
  determinismId: string,
  request: InsightRequest,
): string {
  return evaluationKey(
    determinismId,
    request.fen,
    request.depth,
    request.evalProfile,
  );
}

function freezeEvaluation(evaluation: EngineEvaluation): EngineEvaluation {
  return Object.freeze({
    scoreCp: evaluation.scoreCp,
    pv: Object.freeze([...evaluation.pv]),
  });
}

export function createEvaluationCache(
  config: CacheConfig = DEFAULT_CACHE_CONFIG,
): EvaluationCache {
  if (!Number.isSafeInteger(config.maxEntries) || config.maxEntries < 1) {
    throw new RangeError('maxEntries must be a positive integer.');
  }
  // Insertion-ordered Map as an LRU: re-inserting on hit moves an entry to the
  // end, so the first key is always the least recently used.
  const entries = new Map<string, EngineEvaluation>();
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  return {
    get(key: string): EngineEvaluation | undefined {
      const cached = entries.get(key);
      if (cached === undefined) {
        misses += 1;
        return undefined;
      }
      hits += 1;
      entries.delete(key);
      entries.set(key, cached);
      return cached;
    },
    set(key: string, evaluation: EngineEvaluation): EngineEvaluation {
      const frozen = freezeEvaluation(evaluation);
      entries.delete(key);
      entries.set(key, frozen);
      while (entries.size > config.maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done === true) break;
        entries.delete(oldest.value);
        evictions += 1;
      }
      return frozen;
    },
    stats(): CacheStats {
      return { hits, misses, evictions, size: entries.size };
    },
  };
}
