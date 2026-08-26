import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import {
  LEADER_POLICY_CONFIG,
  legalScoredMoves,
  leaderPolicy,
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
    if (repeating === undefined || fresh === undefined) return;
    const scoreAtNoPenalty = scoreLeaderMove(board, repeating, () => 0, {
      repetitionPenalty: 0,
      pawnAdvanceWeight: 0,
    });
    const scoreAtModeratePenalty = scoreLeaderMove(board, repeating, () => 0, {
      repetitionPenalty: -250,
      pawnAdvanceWeight: 0,
    });
    const scoreAtDefaultPenalty = scoreLeaderMove(board, repeating, () => 0, {
      repetitionPenalty: LEADER_POLICY_CONFIG.repetitionPenalty,
      pawnAdvanceWeight: 0,
    });
    expect(scoreAtNoPenalty).toBeGreaterThanOrEqual(
      scoreLeaderMove(board, fresh, () => 0, {
        repetitionPenalty: 0,
        pawnAdvanceWeight: 0,
      }),
    );
    expect(scoreAtModeratePenalty).toBeLessThan(scoreAtNoPenalty);
    expect(scoreAtDefaultPenalty).toBeLessThan(scoreAtModeratePenalty);
  });

  it('wires pawn-prospect weight into the candidate score', () => {
    const board = LivingBoard.standard();
    const move = legalScoredMoves(board).find(
      (candidate) =>
        candidate.intent.from === 'e2' && candidate.intent.to === 'e4',
    );
    expect(move).toBeDefined();
    if (move === undefined) return;
    const withoutAdvance = scoreLeaderMove(board, move, () => 0, {
      repetitionPenalty: LEADER_POLICY_CONFIG.repetitionPenalty,
      pawnAdvanceWeight: 0,
    });
    const withAdvance = scoreLeaderMove(
      board,
      move,
      () => 0,
      LEADER_POLICY_CONFIG,
    );
    expect(withAdvance).toBeGreaterThan(withoutAdvance);
  });

  it('uses seeded randomness to resolve equal scores', () => {
    const board = LivingBoard.standard();
    const moves = legalScoredMoves(board);
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
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.intent).toEqual(second?.intent);

    const selections = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) =>
          pickByScore(board, moves, createSeededRandom(seed), () => 0, config)
            ?.intent.from,
      ),
    );
    expect(selections.size).toBeGreaterThan(1);
  });

  it('separates care and insistence on an off-diagonal board position', () => {
    const board = LivingBoard.fromFen(
      'Nrb5/ppp3n1/n4kr1/1q5p/1b1pPPQ1/1P1PR3/P3B1P1/RKB3N1 b - - 5 24',
    );
    const moves = legalScoredMoves(board);
    const context = {
      matchIndex: 1,
      campaignMatch: 1,
      ply: 47,
      redeemerSwitchMatch: 10,
    };
    const exacting = leaderPolicy('exacting').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const absentee = leaderPolicy('absentee').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const steady = leaderPolicy('steady').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const supportive = leaderPolicy('supportive').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const pureTactician = leaderPolicy('pure_tactician').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    expect(exacting).toBeDefined();
    expect(absentee).toBeDefined();
    expect(steady).toBeDefined();
    expect(supportive).toBeDefined();
    expect(pureTactician).toBeDefined();
    if (
      exacting === undefined ||
      absentee === undefined ||
      steady === undefined ||
      supportive === undefined ||
      pureTactician === undefined
    ) {
      return;
    }
    expect(
      absentee.features.pCaptured - exacting.features.pCaptured,
    ).toBeGreaterThan(0.1);
    expect(steady.features.pCaptured).toBeGreaterThan(
      supportive.features.pCaptured,
    );
    expect(steady.features.pCaptured).toBeLessThan(
      pureTactician.features.pCaptured,
    );
  });

  it('orders override frequencies across the insistence axis', () => {
    const context = {
      matchIndex: 1,
      campaignMatch: 1,
      ply: 1,
      redeemerSwitchMatch: 10,
    };
    const counts = (style: Parameters<typeof leaderPolicy>[0]): number => {
      const policy = leaderPolicy(style);
      return Array.from({ length: 1_000 }, (_, index) =>
        policy.shouldOverride(createSeededRandom(index + 1), context),
      ).filter(Boolean).length;
    };
    const absentee = counts('absentee');
    const steady = counts('steady');
    const exacting = counts('exacting');
    expect(absentee).toBeLessThan(steady);
    expect(steady).toBeLessThan(exacting);
    expect(steady - absentee).toBeGreaterThan(200);
    expect(exacting - steady).toBeGreaterThan(200);
  });
});
