import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { chooseKingCommandMove } from '../src/orchestration/kingCommand';

describe('kingCommand', () => {
  it('returns undefined when the side to move has no legal moves', () => {
    const mated = LivingBoard.fromFen(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    );
    expect(mated.legalMovesSan()).toHaveLength(0);
    expect(chooseKingCommandMove(mated, createSeededRandom(7))).toBeUndefined();
  });

  it('picks a legal SAN and is seed-stable', () => {
    const board = LivingBoard.standard();
    const first = chooseKingCommandMove(board, createSeededRandom(11));
    const second = chooseKingCommandMove(board, createSeededRandom(11));
    expect(first).toBeDefined();
    expect(second).toBe(first);
    expect(board.legalMovesSan()).toContain(first);
  });

  it('keeps choosing among legal moves under material tension', () => {
    const board = LivingBoard.fromFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const picks = [1, 2, 3, 4, 5].map((seed) =>
      chooseKingCommandMove(board, createSeededRandom(seed)),
    );
    for (const san of picks) {
      expect(san).toBeDefined();
      expect(board.legalMovesSan()).toContain(san);
    }
  });
});
