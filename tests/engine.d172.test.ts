import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_MAX_INFO_LINES_PER_SEARCH,
  MAX_PLAUSIBLE_MATE_DISTANCE,
  UciEngine,
  UciInfoLineLimitError,
  UciUnsoundScoreError,
  isUnsoundUciScore,
  parseUciScore,
} from '../src/engine/uci';
import {
  createLozzaPort,
  disposeLozzaPort,
} from '../src/engine/adapters/lozza';

const artifactPath = fileURLToPath(
  new URL('../vendor/lozza/lozza.cjs', import.meta.url),
);
const poisonFens = [
  'Q1b1k3/8/8/4pP2/2pP3B/8/P1P2PPP/RN1QKBNR w KQ - 0 16',
  '6Q1/2k1n2Q/8/p2P1P2/P3P3/8/8/RNBQK1NR w KQ - 1 32',
] as const;
const midGameMeasurementFens = [
  'Nrb5/ppp3n1/n4kr1/1q5p/1b1pPPQ1/1P1PR3/P3B1P1/RKB3N1 b - - 5 24',
  'r4bnr/2n1p1p1/2N1bp1k/3p3p/8/8/2QPP2P/2B2BKR w - - 0 22',
  'r4bnr/2n1p1p1/2N1bp1k/3p3p/8/8/2Q5/2B2BKR w - - 0 22',
] as const;

afterEach(async () => {
  await disposeLozzaPort();
});

describe('D172 score soundness', () => {
  it('classifies sentinel and ordinary scores', () => {
    expect(MAX_PLAUSIBLE_MATE_DISTANCE).toBe(100);
    expect(isUnsoundUciScore('mate', 0)).toBe(true);
    expect(isUnsoundUciScore('mate', -500)).toBe(true);
    expect(isUnsoundUciScore('mate', 3)).toBe(false);
    expect(isUnsoundUciScore('mate', -3)).toBe(false);
    expect(isUnsoundUciScore('cp', 31_000)).toBe(true);
    expect(isUnsoundUciScore('cp', 120)).toBe(false);
    expect(parseUciScore(['info', 'score', 'mate', '0']).sound).toBe(false);
    expect(parseUciScore(['info', 'score', 'mate', '3']).sound).toBe(true);
  });

  it('escalates an unsound rung and bounds exhausted escalation', async () => {
    const fixture = fileURLToPath(
      new URL('./fixtures/uci-unsound-then-sound.mjs', import.meta.url),
    );
    const engine = new UciEngine({
      enginePath: fixture,
      maxScoreEscalations: 1,
    });
    await expect(
      engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 1),
    ).resolves.toMatchObject({ scoreCp: 42, sound: true });
    await engine.dispose();

    const exhausted = new UciEngine({
      enginePath: fileURLToPath(
        new URL('./fixtures/uci-mate-zero.mjs', import.meta.url),
      ),
      maxScoreEscalations: 1,
    });
    await expect(
      exhausted.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 1),
    ).rejects.toBeInstanceOf(UciUnsoundScoreError);
    await exhausted.dispose();
  });

  it('fails loudly and disposes when the info-line ceiling is exceeded', async () => {
    const engine = new UciEngine({
      enginePath: fileURLToPath(
        new URL('./fixtures/uci-info-runaway.mjs', import.meta.url),
      ),
      maxInfoLinesPerSearch: 3,
    });
    await expect(
      engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 1),
    ).rejects.toBeInstanceOf(UciInfoLineLimitError);
    expect(engine.isBusy).toBe(false);
    await engine.dispose();
  });
});

describe('D172 real Lozza regression', () => {
  it.each(poisonFens)(
    'returns promptly for the poison position at all requested depths (%s)',
    async (fen) => {
      const engine = new UciEngine({
        enginePath: artifactPath,
        multiPv: 8,
      });
      try {
        for (const depth of [3, 4, 5, 6, 8]) {
          const result = await engine.evaluate(fen, depth);
          expect(Number.isSafeInteger(result.scoreCp)).toBe(true);
          expect(result.sound).toBe(true);
        }
      } finally {
        await engine.dispose();
      }
    },
    120_000,
  );

  it('keeps the default runaway ceiling well above a real depth-8 MultiPV-8 search', async () => {
    const engine = new UciEngine({
      enginePath: artifactPath,
      multiPv: 8,
    });
    try {
      await engine.searchLadder(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        8,
      );
      expect(engine.lastInfoLineCount).toBeLessThan(
        DEFAULT_MAX_INFO_LINES_PER_SEARCH / 10,
      );
    } finally {
      await engine.dispose();
    }
  }, 120_000);

  it('measures adapter info lines across real harness search widths', async () => {
    const port = createLozzaPort({ enginePath: artifactPath });
    const observed: number[] = [];
    for (const fen of midGameMeasurementFens) {
      await port.evaluate(fen, 4);
      observed.push(port.getCostStats?.().lastInfoLines ?? 0);
      await port.bestAt?.(fen, 4);
      observed.push(port.getCostStats?.().lastInfoLines ?? 0);
    }
    expect(observed).toEqual([4, 4, 8, 8, 22, 22]);
    expect(Math.max(...observed)).toBeLessThan(
      DEFAULT_MAX_INFO_LINES_PER_SEARCH / 20,
    );
  }, 120_000);
});

describe('D172 determinism policy identity', () => {
  it('separates score escalation and runaway policies', () => {
    const base = createLozzaPort({ enginePath: artifactPath });
    const escalations = createLozzaPort({
      enginePath: artifactPath,
      maxScoreEscalations: 1,
    });
    const runaway = createLozzaPort({
      enginePath: artifactPath,
      maxInfoLinesPerSearch: 1024,
    });
    expect(escalations.determinismId).not.toBe(base.determinismId);
    expect(runaway.determinismId).not.toBe(base.determinismId);
    expect(base.determinismId).toContain('score-escalate-2');
    expect(base.determinismId).toContain('runaway-512');
  });
});
