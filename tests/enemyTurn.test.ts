import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine/fake';
import { applyEnemyTurn } from '../src/orchestration/enemyTurn';
import { createStartingRoster } from '../sim/roster';

describe('enemy turn progress', () => {
  it('always advances the async enemy turn', async () => {
    const board = LivingBoard.standard();
    board.applySan('e4');
    const result = await applyEnemyTurn({
      board,
      enemyRoster: createStartingRoster(board, 'b', -100, 0.5),
      enemySide: 'b',
      random: createSeededRandom(5),
      archetype: 'supportive',
      ply: 1,
      engine: createFakeEnginePort(),
      overrideRefusals: false,
    });

    expect(result.lastMove).not.toBeNull();
    expect(result.ply).toBe(2);
    expect(board.turn()).toBe('w');
  });
});
