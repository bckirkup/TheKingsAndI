import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createStartingRoster } from '../src/orchestration/roster';
import type { HeadlessMatchResult } from '../src/orchestration/headlessMatch';
import { metricsFromMatch } from '../sim/metrics';

describe('promotion harness metrics', () => {
  it('folds commander promotions from events and excludes enemy promotions', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 50, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 50, 0.5);
    const pawn = roster.find((piece) => piece.role === 'Pawn');
    const enemyPawn = enemyRoster.find((piece) => piece.role === 'Pawn');
    if (pawn === undefined || enemyPawn === undefined) {
      throw new Error('Starting rosters must contain pawns.');
    }
    const result: HeadlessMatchResult = {
      events: [
        {
          t: 'PROMOTION',
          ply: 1,
          pieceId: pawn.id,
          fromRole: 'Pawn',
          toRole: 'Queen',
        },
        {
          t: 'PROMOTION',
          ply: 2,
          pieceId: enemyPawn.id,
          fromRole: 'Pawn',
          toRole: 'Knight',
        },
      ],
      roster,
      departedRoster: [],
      enemyRoster,
      departedEnemyRoster: [],
      enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
      plies: 2,
      winScore: 50,
      rout: false,
      enemyRout: false,
      refusedGoodMoves: 0,
      winningPositionDesertions: 0,
      justifiedRefusalObviousness: [],
      justifiedRefusalPrivateViewLosses: [],
      determinismId: 'metrics-test',
      enemyObservableBehaviours: [],
    };
    const metric = metricsFromMatch(1, 1, 'supportive', roster, result, 0);
    expect(metric.promotions).toBe(1);
    expect(metric.promotionToRoleCounts).toEqual({ Queen: 1 });
  });
});
