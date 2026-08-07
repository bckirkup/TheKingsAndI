import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { terminalMoveScore } from '../src/orchestration/insight';
import { UciEngine } from '../src/engine/uci';

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
  it('rejects a bestmove with no score', async () => {
    const engine = new UciEngine({
      enginePath: fileURLToPath(
        new URL('./fixtures/uci-no-score.mjs', import.meta.url),
      ),
    });
    await expect(
      engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 2),
    ).rejects.toThrow('without a score');
    await engine.dispose();
  });

  it('accepts Lozza mate zero as a decisive score', async () => {
    const engine = new UciEngine({
      enginePath: fileURLToPath(
        new URL('./fixtures/uci-mate-zero.mjs', import.meta.url),
      ),
    });
    await expect(
      engine.evaluate('8/8/8/8/8/8/8/7K w - - 0 1', 1),
    ).resolves.toMatchObject({ scoreCp: 29_999 });
    await engine.dispose();
  });
});
