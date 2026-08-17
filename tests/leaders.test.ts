import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import {
  LEADER_POLICY_CONFIG,
  legalScoredMoves,
  pickByScore,
  scoreLeaderMove,
} from '../sim/leaders';

describe('scripted leader move shaping', () => {
  it('penalizes a move that recreates a previously seen position', () => {
    const board = LivingBoard.standard();
    for (const intent of [
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
    ] as const) {
      board.applyMove(intent);
    }
    const moves = legalScoredMoves(board);
    const repeating = moves.find(
      (move) => board.repetitionCountAfter(move.intent) >= 3,
    );
    const fresh = moves.find(
      (move) => board.repetitionCountAfter(move.intent) < 3,
    );
    expect(repeating).toBeDefined();
    expect(fresh).toBeDefined();
    expect(scoreLeaderMove(board, repeating!, () => 0)).toBeLessThan(
      scoreLeaderMove(board, fresh!, () => 0),
    );
    expect(board.ply()).toBe(8);
  });

  it('wires pawn-prospect weight into the candidate score', () => {
    const board = LivingBoard.standard();
    const move = legalScoredMoves(board).find(
      (candidate) =>
        candidate.intent.from === 'e2' && candidate.intent.to === 'e4',
    );
    expect(move).toBeDefined();
    const withoutAdvance = scoreLeaderMove(board, move!, () => 0, {
      repetitionPenalty: LEADER_POLICY_CONFIG.repetitionPenalty,
      pawnAdvanceWeight: 0,
    });
    const withAdvance = scoreLeaderMove(
      board,
      move!,
      () => 0,
      LEADER_POLICY_CONFIG,
    );
    expect(withAdvance).toBeGreaterThan(withoutAdvance);
  });

  it('uses seeded randomness to resolve equal scores', () => {
    const board = LivingBoard.standard();
    const moves = legalScoredMoves(board).slice(0, 2);
    const config = { repetitionPenalty: 0, pawnAdvanceWeight: 0 };
    const first = pickByScore(
      board,
      moves,
      createSeededRandom(3),
      () => 0,
      config,
    );
    const second = pickByScore(
      board,
      moves,
      createSeededRandom(3),
      () => 0,
      config,
    );
    expect(first?.intent).toEqual(second?.intent);
  });
});
