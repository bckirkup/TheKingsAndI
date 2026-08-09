import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import {
  CONFORMANCE_CORPUS,
  createFakeEnginePort,
  createLozzaPort,
  createStockfishPort,
  disposeLozzaPort,
  disposeStockfishPort,
} from '../src/engine';
import type { EnginePort } from '../src/engine/types';

async function expectMultiPvContract(
  port: EnginePort,
  testCase: (typeof CONFORMANCE_CORPUS)[number],
): Promise<void> {
  if (port.multiPvAt === undefined) {
    throw new Error('engine does not expose per-rung MultiPV');
  }
  const first = await port.multiPvAt(testCase.fen, testCase.depth);
  const second = await port.multiPvAt(testCase.fen, testCase.depth);
  expect(first.length).toBeGreaterThan(0);
  expect(second).toEqual(first);
  expect(new Set(first.map((line) => line.pv.join(' '))).size).toBe(
    first.length,
  );
  expect(first.every((line) => Number.isSafeInteger(line.scoreCp))).toBe(true);
}

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

  it('provides deterministic per-rung MultiPV lines', async () => {
    const testCase = CONFORMANCE_CORPUS[0];
    if (testCase === undefined) throw new Error('missing corpus case');
    await expectMultiPvContract(port, testCase);
  });

  it('includes the vendored artifact contents in its determinism ID', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'the-kings-and-i-lozza-'));
    const artifactPath = join(directory, 'lozza.cjs');
    try {
      const artifact = Buffer.from(
        await readFile(
          fileURLToPath(new URL('../vendor/lozza/lozza.cjs', import.meta.url)),
        ),
      );
      const lastByte = artifact[artifact.length - 1];
      if (lastByte === undefined) throw new Error('Lozza artifact is empty.');
      artifact[artifact.length - 1] = lastByte ^ 1;
      await writeFile(artifactPath, artifact);
      const mutated = createLozzaPort({ enginePath: artifactPath });
      expect(mutated.determinismId).not.toBe(port.determinismId);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  it('provides deterministic per-rung MultiPV lines', async () => {
    const port = await createStockfishPort({ poolSize: 1, dMax: 8 });
    const testCase = CONFORMANCE_CORPUS[0];
    if (testCase === undefined) throw new Error('missing corpus case');
    await expectMultiPvContract(port, testCase);
  }, 120_000);
});

describe('engine conformance corpus (fake)', () => {
  it('provides deterministic per-rung MultiPV lines', async () => {
    const testCase = CONFORMANCE_CORPUS[0];
    if (testCase === undefined) throw new Error('missing corpus case');
    await expectMultiPvContract(createFakeEnginePort(), testCase);
  });
});
