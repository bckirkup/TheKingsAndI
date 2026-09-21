import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { terminalMoveScore } from '../src/orchestration/insight';
import { UciEngine, parseUciScore } from '../src/engine/uci';

describe('terminal post-move evaluation', () => {
  it('scores checkmate as a decisive mover win', () => {
    const board = LivingBoard.fromFen('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');
    expect(terminalMoveScore(board)).toBe(29_999);
  });

  it('scores stalemate as a draw', () => {
    const board = LivingBoard.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(terminalMoveScore(board)).toBe(0);
  });
});

describe('UCI score failures', () => {
  it('retains MultiPV lines at each iterative-deepening rung', async () => {
    const engine = new UciEngine({
      enginePath: fileURLToPath(
        new URL('./fixtures/uci-multipv-ladder.mjs', import.meta.url),
      ),
      multiPv: 2,
    });
    const ladder = await engine.searchLadder('8/8/8/8/8/8/8/7K w - - 0 1', 2);
    expect(ladder.multiPvAt.get(1)?.size).toBe(2);
    expect(ladder.multiPvAt.get(2)?.size).toBe(2);
    await engine.dispose();
  });

  it('rejects a bestmove with no score', async () => {
    const engine = new UciEngine({
      enginePath: fileURLToPath(
        new URL('./fixtures/uci-no-score.mjs', import.meta.url),
      ),
    });
    await expect(
      engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 2),
    ).rejects.toThrow(
      'without a score at depth 2 for FEN 8/8/8/8/8/8/8/7K w - - 0 1',
    );
    await engine.dispose();
  });

  it('distinguishes a child exit during search from a missing score', async () => {
    const engine = new UciEngine({
      enginePath: fileURLToPath(
        new URL('./fixtures/uci-exit-during-search.mjs', import.meta.url),
      ),
    });
    await expect(
      engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 2),
    ).rejects.toThrow(
      'Engine child exited with code 17 at depth 2 for FEN ' +
        '8/8/8/8/8/8/8/7K w - - 0 1',
    );
    await engine.dispose();
  });

  it.skipIf(platform() === 'win32')(
    'spawns a native executable under spawnMode native',
    async () => {
      const fixture = fileURLToPath(
        new URL('./fixtures/uci-fake-native.sh', import.meta.url),
      );
      const engine = new UciEngine({
        enginePath: fixture,
        spawnMode: 'native',
      });
      const result = await engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 1);
      expect(result.scoreCp).toBe(12);
      await engine.dispose();
    },
  );

  it.skipIf(platform() === 'win32')(
    'rejects a shell script under the default node spawn mode',
    async () => {
      const fixture = fileURLToPath(
        new URL('./fixtures/uci-fake-native.sh', import.meta.url),
      );
      const engine = new UciEngine({ enginePath: fixture });
      await expect(
        engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 1),
      ).rejects.toThrow();
      await engine.dispose();
    },
  );

  it("treats Lozza's mate-zero sentinel as unsound", () => {
    // ADR 0068 withdraws mate 0 as an immediate-mate evaluation.
    expect(parseUciScore(['info', 'score', 'mate', '0'])).toMatchObject({
      sound: false,
    });
  });
});
