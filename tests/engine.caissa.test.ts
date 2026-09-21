import { existsSync } from 'node:fs';

import { afterAll, describe, expect, it } from 'vitest';

import {
  applyPrivateScoring,
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
  resolveInsightRound,
  buildInsightRound,
  requireComplete,
  SHARED_SEARCH_D_MAX,
} from '../src/engine';
import {
  CAISSA_ENGINE_PATH_ENV,
  caissaDeterminismId,
  createCaissaPort,
  defaultCaissaPath,
  disposeCaissaPort,
} from '../src/engine/node';
import type { PieceId } from '../src/core/ids';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const envPath = process.env[CAISSA_ENGINE_PATH_ENV];
const hasBinary = envPath !== undefined && existsSync(envPath);

describe('shared-search broker (Caissa)', () => {
  afterAll(async () => {
    await disposeCaissaPort();
  });

  it('throws a named error when the engine path env var is unset', () => {
    const saved = process.env[CAISSA_ENGINE_PATH_ENV];
    try {
      delete process.env[CAISSA_ENGINE_PATH_ENV];
      expect(() => defaultCaissaPath()).toThrow(CAISSA_ENGINE_PATH_ENV);
      expect(() => defaultCaissaPath()).toThrow(
        'https://github.com/Witek902/Caissa',
      );
    } finally {
      if (saved !== undefined) process.env[CAISSA_ENGINE_PATH_ENV] = saved;
    }
  });

  it.skipIf(!hasBinary)(
    'truncates a shared D_max search to per-seat depths',
    async () => {
      const port = await createCaissaPort({ poolSize: 1, dMax: 6 });
      const shallow = await port.evaluate(START, 2, {});
      const deep = await port.evaluate(START, 6, {});
      expect(Number.isSafeInteger(shallow.scoreCp)).toBe(true);
      expect(Number.isSafeInteger(deep.scoreCp)).toBe(true);
      // Depth sensitivity: deeper truncation exposes a longer (or equal) PV.
      expect(deep.pv.length).toBeGreaterThanOrEqual(shallow.pv.length);
    },
    60_000,
  );

  it.skipIf(!hasBinary)(
    'keeps true D_max eval off the psychology-facing evaluate path shape',
    async () => {
      const port = await createCaissaPort({ poolSize: 1, dMax: 4 });
      const trueEval = await port.evaluateTrue(START);
      const pieceView = await port.evaluate(START, 2, { safety: 0 });
      expect(Number.isSafeInteger(trueEval.scoreCp)).toBe(true);
      expect(pieceView.pv.length).toBeGreaterThan(0);
      expect(SHARED_SEARCH_D_MAX).toBe(16);
    },
    60_000,
  );

  it.skipIf(!hasBinary)(
    'derives the Caissa determinism ID from the binary artifact',
    () => {
      const enginePath = defaultCaissaPath();
      const id = caissaDeterminismId(enginePath);
      expect(DEFAULT_PRIVATE_MULTIPV_WIDTH).toBe(8);
      expect(id).toContain('caissa-2.0.1/artifact-');
      expect(id).toContain('dmax-16');
      expect(id).toContain('multipv-8');
      expect(id).toContain(
        `preferred-multipv-${DEFAULT_PREFERRED_MULTIPV_WIDTH}`,
      );
      expect(id).toContain(`preferred-pool-${DEFAULT_PREFERRED_POOL_SIZE}`);
      expect(id).toContain('search-cold');
      expect(id).toContain('/ladder-rung-canonical');
      expect(caissaDeterminismId(enginePath, 8)).toContain('dmax-8');
      expect(caissaDeterminismId(enginePath, 8)).not.toBe(id);
      expect(caissaDeterminismId(enginePath, 16, 4)).not.toBe(id);
      expect(caissaDeterminismId(enginePath, 16, 8, 2)).not.toBe(id);
      expect(caissaDeterminismId(enginePath, 16, 8, 1, 2)).not.toBe(id);
      // The artifact hash is stable for an unchanged binary.
      expect(caissaDeterminismId(enginePath)).toBe(id);
    },
  );

  it('keeps engine transport profile-agnostic', () => {
    const base = { scoreCp: 40, pv: ['e2e4'] as const };
    const plain = applyPrivateScoring(base, {});
    const biased = applyPrivateScoring(base, { safety: 2, material: -1 });
    expect(plain.scoreCp).toBe(40);
    expect(biased.scoreCp).toBe(40);
  });

  it.skipIf(!hasBinary)(
    'serves a barrier round from one shared search',
    async () => {
      const port = await createCaissaPort({ poolSize: 2, dMax: 4 });
      const seats = [
        {
          pieceId: 'wP_a2' as PieceId,
          depth: 2,
          evalProfile: { a: 0 },
        },
        {
          pieceId: 'wP_b2' as PieceId,
          depth: 4,
          evalProfile: { a: 1 },
        },
      ];
      const requests = buildInsightRound({ fen: START, seats });
      const bundle = requireComplete(
        await resolveInsightRound(port, requests, { round: 0 }),
      );
      expect(bundle.insights).toHaveLength(2);
      expect(bundle.determinismId).toContain('caissa-2.0.1/artifact-');
    },
    60_000,
  );
});
