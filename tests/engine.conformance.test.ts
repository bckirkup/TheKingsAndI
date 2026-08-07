import { afterAll, describe, expect, it } from 'vitest';

import {
  CONFORMANCE_CORPUS,
  createLozzaPort,
  createStockfishPort,
  disposeLozzaPort,
  disposeStockfishPort,
} from '../src/engine';

describe('engine conformance corpus (Lozza)', () => {
  const port = createLozzaPort();

  afterAll(async () => {
    await disposeLozzaPort();
  });

  it('records stable Lozza 11 evaluations for the fixed corpus', async () => {
    for (const testCase of CONFORMANCE_CORPUS) {
      const result = await port.evaluate(testCase.fen, testCase.depth);
      expect(result.scoreCp).toBe(testCase.scoreCp);
      if (testCase.pvPrefix.length > 0) {
        expect(result.pv.slice(0, testCase.pvPrefix.length)).toEqual([
          ...testCase.pvPrefix,
        ]);
      }
    }
  });

  it('is reproducible on repeat evaluation', async () => {
    const testCase = CONFORMANCE_CORPUS[1];
    if (testCase === undefined) throw new Error('missing corpus case');
    const first = await port.evaluate(testCase.fen, testCase.depth);
    const second = await port.evaluate(testCase.fen, testCase.depth);
    expect(second).toEqual(first);
  });

  it('changes output when depth changes (sensitivity)', async () => {
    const testCase = CONFORMANCE_CORPUS[0];
    if (testCase === undefined) throw new Error('missing corpus case');
    const shallow = await port.evaluate(testCase.fen, 2);
    const deep = await port.evaluate(testCase.fen, testCase.depth);
    expect(shallow.scoreCp).not.toBe(deep.scoreCp);
  });
});

describe('engine conformance corpus (Stockfish)', () => {
  afterAll(async () => {
    await disposeStockfishPort();
  });

  it('is reproducible on the fixed FEN corpus', async () => {
    const port = await createStockfishPort({ poolSize: 1, dMax: 8 });
    for (const testCase of CONFORMANCE_CORPUS) {
      const first = await port.evaluate(testCase.fen, testCase.depth, {});
      const second = await port.evaluate(testCase.fen, testCase.depth, {});
      expect(second).toEqual(first);
      expect(Number.isSafeInteger(first.scoreCp)).toBe(true);
      expect(first.pv.length).toBeGreaterThan(0);
    }
  }, 120_000);

  it('changes truncation when depth changes (sensitivity)', async () => {
    const port = await createStockfishPort({ poolSize: 1, dMax: 6 });
    const testCase = CONFORMANCE_CORPUS[0];
    if (testCase === undefined) throw new Error('missing corpus case');
    const shallow = await port.evaluate(testCase.fen, 2, {});
    const deep = await port.evaluate(testCase.fen, 6, {});
    expect(deep.pv.length).toBeGreaterThanOrEqual(shallow.pv.length);
  }, 60_000);
});
