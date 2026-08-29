import { afterAll, describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import {
  DEFAULT_LOZZA_LADDER_CACHE_CAPACITY,
  createLozzaPort,
  disposeLozzaPort,
} from '../src/engine/adapters/lozza';
import { UciEngine, type DepthLadder } from '../src/engine/uci';
import { parseArguments } from '../sim/cli';

const artifactPath = fileURLToPath(
  new URL('../vendor/lozza/lozza.cjs', import.meta.url),
);

const TARGET_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const HISTORY_FENS = [
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  'r1bq1rk1/ppp2ppp/2n2n2/3pp3/3PP3/2P1BN2/PP1N1PPP/R2Q1RK1 w - - 0 7',
] as const;

function serializeLadder(ladder: DepthLadder): string {
  return JSON.stringify({
    maxDepth: ladder.maxDepth,
    at: [...ladder.at.entries()].sort(([left], [right]) => left - right),
    multiPvAt: [...ladder.multiPvAt.entries()]
      .sort(([left], [right]) => left - right)
      .map(([depth, lines]) => [
        depth,
        [...lines.entries()].sort(([left], [right]) => left - right),
      ]),
    multiPvAtMax: [...ladder.multiPvAtMax.entries()].sort(
      ([left], [right]) => left - right,
    ),
  });
}

async function divergentHistory(engine: UciEngine): Promise<void> {
  await engine.searchLadder(TARGET_FEN, 1);
  for (const fen of HISTORY_FENS) {
    await engine.searchLadder(fen, 6);
  }
}

describe('Lozza cold-search contract', () => {
  afterAll(async () => {
    await disposeLozzaPort();
  });

  it('returns the same bundle after divergent history as a fresh cold engine', async () => {
    const afterHistory = new UciEngine({ enginePath: artifactPath });
    const fresh = new UciEngine({ enginePath: artifactPath });
    try {
      await divergentHistory(afterHistory);
      const historical = await afterHistory.searchLadder(TARGET_FEN, 4);
      const first = await fresh.searchLadder(TARGET_FEN, 4);
      expect(serializeLadder(historical)).toBe(serializeLadder(first));
    } finally {
      await Promise.all([afterHistory.dispose(), fresh.dispose()]);
    }
  }, 120_000);

  it('keeps the warm path as a distinct, path-dependent contrast', async () => {
    const warmAfterHistory = new UciEngine({
      enginePath: artifactPath,
      coldSearch: false,
    });
    const warmFresh = new UciEngine({
      enginePath: artifactPath,
      coldSearch: false,
    });
    try {
      await divergentHistory(warmAfterHistory);
      const historical = await warmAfterHistory.searchLadder(TARGET_FEN, 4);
      const first = await warmFresh.searchLadder(TARGET_FEN, 4);
      expect(serializeLadder(historical)).not.toBe(serializeLadder(first));
    } finally {
      await Promise.all([warmAfterHistory.dispose(), warmFresh.dispose()]);
    }
  }, 120_000);

  it('includes cold versus warm policy in the Lozza determinism ID', () => {
    const cold = createLozzaPort({
      enginePath: artifactPath,
      coldSearch: true,
    });
    const warm = createLozzaPort({
      enginePath: artifactPath,
      coldSearch: false,
    });
    expect(cold.determinismId).toContain('/search-cold');
    expect(warm.determinismId).toContain('/search-warm');
    expect(cold.determinismId).toContain('/ladder-rung-canonical/');
    expect(cold.determinismId).not.toBe(warm.determinismId);
  });

  it('exposes cold search as the default and a warm measurement option', () => {
    expect(
      parseArguments(['--matches=1', '--leader=tyrannical']).coldSearch ?? true,
    ).toBe(true);
    expect(
      parseArguments([
        '--matches=1',
        '--leader=tyrannical',
        '--cold-search=false',
      ]).coldSearch,
    ).toBe(false);
  });

  it('keeps results invariant when the ladder LRU evicts entries', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'the-kings-and-i-d171-'));
    const smallPath = join(directory, 'small-lozza.cjs');
    const largePath = join(directory, 'large-lozza.cjs');
    try {
      const artifact = await readFile(artifactPath);
      await Promise.all([
        writeFile(smallPath, artifact),
        writeFile(largePath, artifact),
      ]);
      const small = createLozzaPort({
        enginePath: smallPath,
        ladderCacheCapacity: 1,
      });
      const large = createLozzaPort({
        enginePath: largePath,
        ladderCacheCapacity: 2,
      });
      const sequence = [TARGET_FEN, ...HISTORY_FENS.slice(0, 2), TARGET_FEN];
      const evaluate = async (port: typeof small) =>
        Promise.all(sequence.map((fen) => port.evaluate(fen, 4)));
      expect(await evaluate(small)).toEqual(await evaluate(large));
      expect(DEFAULT_LOZZA_LADDER_CACHE_CAPACITY).toBe(4_096);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
