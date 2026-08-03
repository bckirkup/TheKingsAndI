import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/core/canonicalJson';
import { createSeededRandom } from '../src/core/random';
import {
  DEFAULT_CACHE_CONFIG,
  DuplicateSeatError,
  InsightRoundFailedError,
  buildInsightRound,
  createEvaluationCache,
  evaluationKey,
  insightOf,
  requireComplete,
  resolveInsightRound,
  roundKey,
} from '../src/engine';
import type {
  EngineEvaluation,
  EnginePort,
  InsightBundle,
  InsightRequest,
  RoundSpec,
} from '../src/engine';

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

const spec: RoundSpec = {
  fen: FEN,
  seats: [
    { pieceId: 'w:N:g1', depth: 4, evalProfile: { safety: 2 } },
    { pieceId: 'w:P:e2', depth: 6, evalProfile: { safety: 1 } },
    { pieceId: 'w:K:e1', depth: 8, evalProfile: { safety: 3 } },
    { pieceId: 'w:B:f1', depth: 4, evalProfile: { safety: 1 } },
  ],
};

/**
 * A port whose answers are a pure function of its inputs, so the only thing a
 * test varies is *when* each answer arrives.
 */
function createFakePort(
  options: {
    readonly determinismId?: string;
    readonly order?: 'natural' | 'reverse';
    readonly failFor?: readonly string[];
    readonly onEvaluate?: (fen: string, depth: number) => void;
  } = {},
): EnginePort {
  const determinismId = options.determinismId ?? 'fake-1.0/depth-fixed';
  let issued = 0;
  return {
    determinismId,
    async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
      options.onEvaluate?.(fen, depth);
      const position = issued;
      issued += 1;
      // Resolve out of issue order without any wall-clock dependency: awaiting
      // a chain of already-resolved promises defers by microtask turns only.
      const turns =
        options.order === 'reverse' ? 8 - Math.min(position, 7) : position;
      for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
      if (options.failFor?.includes(fen) === true) {
        throw new Error(`engine unavailable at depth ${depth}`);
      }
      return {
        scoreCp: depth * 10 + fen.length,
        pv: [`d${depth}a1`, `d${depth}b2`],
      };
    },
  };
}

/** A port that resolves in a seeded shuffle of issue order. */
function createShuffledPort(seed: number): EnginePort {
  const random = createSeededRandom(seed);
  return {
    determinismId: 'fake-1.0/depth-fixed',
    async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
      const turns = random.nextInt(12);
      for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
      return {
        scoreCp: depth * 10 + fen.length,
        pv: [`d${depth}a1`, `d${depth}b2`],
      };
    },
  };
}

/**
 * Stands in for step 4 of the move pipeline: a reducer that consumes the bundle
 * and the seeded PRNG. It draws in `PieceId` order *after* the barrier closes
 * (ADR 0034 §7) — the stream position is shared state, so drawing as results
 * arrived would diverge even though every piece saw the correct insight.
 */
function fakePsychologyLog(bundle: InsightBundle, seed: number): string {
  const random = createSeededRandom(seed);
  return canonicalJson(
    bundle.insights.map((insight) => ({
      pieceId: insight.pieceId,
      scoreCp: insight.scoreCp,
      roll: random.nextInt(1000),
    })),
  );
}

describe('round construction golden values', () => {
  it('orders requests by PieceId regardless of seat order', () => {
    const requests = buildInsightRound(spec);
    expect(requests.map((request) => request.pieceId)).toEqual([
      'w:B:f1',
      'w:K:e1',
      'w:N:g1',
      'w:P:e2',
    ]);
    expect(requests.every((request) => request.fen === FEN)).toBe(true);

    const shuffled: RoundSpec = { fen: FEN, seats: [...spec.seats].reverse() };
    expect(roundKey(shuffled)).toBe(roundKey(spec));
  });

  it('rejects a duplicated piece and a non-fixed depth', () => {
    expect(() =>
      buildInsightRound({
        fen: FEN,
        seats: [spec.seats[0], spec.seats[0]] as RoundSpec['seats'],
      }),
    ).toThrow(DuplicateSeatError);
    expect(() =>
      buildInsightRound({
        fen: FEN,
        seats: [{ pieceId: 'w:P:e2', depth: 0, evalProfile: {} }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildInsightRound({
        fen: FEN,
        seats: [{ pieceId: 'w:P:e2', depth: 1.5, evalProfile: {} }],
      }),
    ).toThrow(RangeError);
  });
});

describe('barrier golden values', () => {
  it('returns a frozen, ordered, digested bundle', async () => {
    const bundle = await resolveInsightRound(
      createFakePort(),
      buildInsightRound(spec),
    );
    expect(bundle.round).toBe(0);
    expect(bundle.determinismId).toBe('fake-1.0/depth-fixed');
    expect(bundle.failures).toEqual([]);
    expect(bundle.insights).toEqual([
      { pieceId: 'w:B:f1', depth: 4, scoreCp: 99, pv: ['d4a1', 'd4b2'] },
      { pieceId: 'w:K:e1', depth: 8, scoreCp: 139, pv: ['d8a1', 'd8b2'] },
      { pieceId: 'w:N:g1', depth: 4, scoreCp: 99, pv: ['d4a1', 'd4b2'] },
      { pieceId: 'w:P:e2', depth: 6, scoreCp: 119, pv: ['d6a1', 'd6b2'] },
    ]);
    expect(bundle.digest).toBe('5084d30631c2f74a');
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.insights)).toBe(true);
    expect(() => {
      (bundle.insights as { length: number }).length = 0;
    }).toThrow(TypeError);
    expect(insightOf(bundle, 'w:K:e1')?.scoreCp).toBe(139);
    expect(insightOf(bundle, 'w:Q:d1')).toBeUndefined();
  });

  it('numbers rounds so a dependent query is a second barrier, not a callback', async () => {
    const port = createFakePort();
    const first = await resolveInsightRound(port, buildInsightRound(spec), {
      round: 0,
    });
    const second = await resolveInsightRound(port, buildInsightRound(spec), {
      round: 1,
    });
    expect(second.round).toBe(1);
    expect(second.insights).toEqual(first.insights);
    // Same answers, different round: the digest must distinguish them, or a
    // replay could not say which barrier diverged.
    expect(second.digest).not.toBe(first.digest);
  });
});

describe('barrier determinism under adversarial resolution order', () => {
  it('produces a byte-identical event log for every arrival order', async () => {
    const requests = buildInsightRound(spec);
    const ports: EnginePort[] = [
      createFakePort(),
      createFakePort({ order: 'reverse' }),
      createShuffledPort(1),
      createShuffledPort(20260803),
      createShuffledPort(7919),
    ];
    const logs: string[] = [];
    const digests: string[] = [];
    for (const port of ports) {
      const bundle = requireComplete(await resolveInsightRound(port, requests));
      digests.push(bundle.digest);
      logs.push(fakePsychologyLog(bundle, 4242));
    }
    expect(new Set(digests).size).toBe(1);
    expect(new Set(logs).size).toBe(1);
    // Sanity: the log actually depends on the insights it is meant to protect.
    expect(logs[0]).toContain('"scoreCp":139');
  });

  it('is unchanged by a warm cache, and the request order is canonical', async () => {
    const requests = buildInsightRound(spec);
    const seenDepths: number[] = [];
    const port = createFakePort({
      onEvaluate: (_fen, depth) => seenDepths.push(depth),
    });
    const cache = createEvaluationCache();

    const cold = await resolveInsightRound(port, requests, { cache });
    expect(seenDepths).toEqual([4, 8, 4, 6]);
    expect(cache.stats()).toEqual({
      hits: 0,
      misses: 4,
      evictions: 0,
      // Four entries, not three: the two depth-4 seats differ only in their
      // eval profiles, and profiles are part of the key (ADR 0017).
      size: 4,
    });

    const warm = await resolveInsightRound(port, requests, { cache });
    expect(warm.digest).toBe(cold.digest);
    expect(warm.insights).toEqual(cold.insights);
    // No further engine work at all on the warm pass.
    expect(seenDepths).toEqual([4, 8, 4, 6]);
    expect(cache.stats().hits).toBe(4);
  });

  it('keys the cache on the eval profile and the determinismId', () => {
    const base = evaluationKey('sf-16', FEN, 6, { safety: 1 });
    expect(evaluationKey('sf-16', FEN, 6, { safety: 1 })).toBe(base);
    expect(evaluationKey('sf-16', FEN, 6, { safety: 2 })).not.toBe(base);
    expect(evaluationKey('sf-16', FEN, 7, { safety: 1 })).not.toBe(base);
    expect(evaluationKey('lozza-3', FEN, 6, { safety: 1 })).not.toBe(base);
    // Key order in the profile literal must not matter.
    expect(evaluationKey('sf-16', FEN, 6, { a: 1, b: 2 })).toBe(
      evaluationKey('sf-16', FEN, 6, { b: 2, a: 1 }),
    );
  });

  it('shares frozen evaluations, so a caller cannot rewrite a later replay', async () => {
    const cache = createEvaluationCache();
    const requests = buildInsightRound(spec);
    const bundle = await resolveInsightRound(createFakePort(), requests, {
      cache,
    });
    expect(() => {
      (bundle.insights[0] as { scoreCp: number }).scoreCp = 0;
    }).toThrow(TypeError);
    expect(() => {
      (bundle.insights[0]?.pv as string[]).push('e2e4');
    }).toThrow(TypeError);
  });
});

describe('cache configuration sensitivity', () => {
  it('evicts the least recently used entry once maxEntries is exceeded', () => {
    const cache = createEvaluationCache({ maxEntries: 2 });
    const evaluation: EngineEvaluation = { scoreCp: 1, pv: [] };
    cache.set('a', evaluation);
    cache.set('b', evaluation);
    expect(cache.get('a')).toBeDefined();
    cache.set('c', evaluation);
    expect(cache.stats().evictions).toBe(1);
    // 'a' was used most recently of the two, so 'b' is the one that went.
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
  });

  it('retains everything at the default size and rejects a nonsense size', () => {
    expect(DEFAULT_CACHE_CONFIG.maxEntries).toBe(4096);
    const cache = createEvaluationCache();
    for (let index = 0; index < 100; index += 1) {
      cache.set(`k${index}`, { scoreCp: index, pv: [] });
    }
    expect(cache.stats()).toEqual({
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 100,
    });
    expect(() => createEvaluationCache({ maxEntries: 0 })).toThrow(RangeError);
  });
});

describe('failure handling', () => {
  it('reports failures in PieceId order and never drops a piece', async () => {
    const port = createFakePort({ failFor: [FEN] });
    const bundle = await resolveInsightRound(port, buildInsightRound(spec));
    expect(bundle.insights).toEqual([]);
    expect(bundle.failures.map((failure) => failure.pieceId)).toEqual([
      'w:B:f1',
      'w:K:e1',
      'w:N:g1',
      'w:P:e2',
    ]);
    expect(bundle.failures[0]?.reason).toBe(
      'Error: engine unavailable at depth 4',
    );
    expect(() => requireComplete(bundle)).toThrow(InsightRoundFailedError);
    // The same failure on replay produces the same bundle, hence the same abort.
    const replay = await resolveInsightRound(
      createFakePort({ failFor: [FEN] }),
      buildInsightRound(spec),
    );
    expect(replay.digest).toBe(bundle.digest);
  });

  it('treats a non-integer score as a failure rather than a silent rounding', async () => {
    const port: EnginePort = {
      determinismId: 'fake-1.0/depth-fixed',
      evaluate: (_fen: string, depth: number) =>
        Promise.resolve({ scoreCp: depth + 0.5, pv: [] }),
    };
    const bundle = await resolveInsightRound(port, buildInsightRound(spec));
    expect(bundle.insights).toEqual([]);
    expect(bundle.failures[0]?.reason).toContain('centipawns must be integers');
  });

  it('records a thrown non-Error without losing the piece', async () => {
    const port: EnginePort = {
      determinismId: 'fake-1.0/depth-fixed',
      evaluate: () => Promise.reject('worker terminated'),
    };
    const bundle = await resolveInsightRound(port, buildInsightRound(spec));
    expect(bundle.failures).toHaveLength(4);
    expect(bundle.failures[0]?.reason).toBe('NonError: worker terminated');
  });

  it('partially fails without reordering or losing the survivors', async () => {
    const requests: InsightRequest[] = buildInsightRound(spec);
    const port: EnginePort = {
      determinismId: 'fake-1.0/depth-fixed',
      async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
        for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
        if (depth === 8) throw new Error('pool exhausted');
        return { scoreCp: depth, pv: [] };
      },
    };
    const bundle = await resolveInsightRound(port, requests);
    expect(bundle.insights.map((insight) => insight.pieceId)).toEqual([
      'w:B:f1',
      'w:N:g1',
      'w:P:e2',
    ]);
    expect(bundle.failures.map((failure) => failure.pieceId)).toEqual([
      'w:K:e1',
    ]);
  });
});
