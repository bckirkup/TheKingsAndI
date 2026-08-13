import { describe, expect, it } from 'vitest';

import { extractMoveFeatures, LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine/fake';
import { applyEnemyTurn } from '../src/orchestration/enemyTurn';
import type { HeadlessLeaderPort } from '../src/orchestration/headlessMatch';
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

  it('honors the requested tracking cap on every enemy turn', async () => {
    const board = LivingBoard.standard();
    board.applySan('e4');
    const enemyRoster = createStartingRoster(board, 'b', 100, 0.5);
    const result = await applyEnemyTurn({
      board,
      enemyRoster,
      enemySide: 'b',
      random: createSeededRandom(5),
      archetype: 'supportive',
      ply: 1,
      engine: createFakeEnginePort(),
      overrideRefusals: false,
      trackedIdentities: 16,
    });

    expect(result.trackedIdentityCount).toBe(16);
    expect(result.enemyRoster).toHaveLength(16);
  });

  it('uses the supplied commander port for enemy move selection', async () => {
    const board = LivingBoard.standard();
    board.applySan('e4');
    let calls = 0;
    const leader: HeadlessLeaderPort = {
      chooseMove(currentBoard, side) {
        calls += 1;
        const intent = currentBoard
          .legalMoves()
          .find((move) => currentBoard.pieceAt(move.from)?.side === side);
        if (intent === undefined) return undefined;
        const features = extractMoveFeatures(currentBoard, intent);
        return {
          moverId: currentBoard.pieceAt(intent.from)?.id ?? '',
          intent,
          san: features.san,
          leaderImpliedBias: 0,
        };
      },
      shouldOverride: () => false,
    };

    await applyEnemyTurn({
      board,
      enemyRoster: createStartingRoster(board, 'b', 100, 0.5),
      enemySide: 'b',
      random: createSeededRandom(5),
      archetype: 'tyrannical',
      ply: 1,
      engine: createFakeEnginePort(),
      leader,
      trackedIdentities: 16,
    });

    expect(calls).toBeGreaterThan(0);
  });
});
