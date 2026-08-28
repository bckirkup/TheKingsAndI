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

  it('reports fielded ability spread and movement from birth values', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 50, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 50, 0.5);
    const first = roster[0];
    if (first === undefined) throw new Error('Expected a starting piece.');
    const result: HeadlessMatchResult = {
      events: [
        {
          t: 'ABILITY_GRADE',
          ply: 1,
          pieceId: first.id,
          wasRight: true,
          delta: 10,
          channel: 'forced',
        },
      ],
      roster: roster.map((piece) =>
        piece.id === first.id ? { ...piece, E_i: piece.E_i + 10 } : piece,
      ),
      departedRoster: [],
      enemyRoster,
      departedEnemyRoster: [],
      enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
      plies: 1,
      winScore: 50,
      rout: false,
      enemyRout: false,
      refusedGoodMoves: 0,
      winningPositionDesertions: 0,
      justifiedRefusalObviousness: [],
      justifiedRefusalPrivateViewLosses: [],
      determinismId: 'metrics-ability-test',
      enemyObservableBehaviours: [],
    };
    const metric = metricsFromMatch(1, 1, 'supportive', roster, result, 0);
    expect(metric.abilityMin).toBeLessThanOrEqual(metric.meanAbility ?? 0);
    expect(metric.abilityMax).toBeGreaterThan(metric.abilityMin ?? 0);
    expect(metric.abilityMovedCount).toBe(1);
  });

  it('folds regard events and their applied gains for commanded pieces', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 50, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 50, 0.5);
    const first = roster[0];
    if (first === undefined) throw new Error('Expected a starting piece.');
    const result: HeadlessMatchResult = {
      events: [
        { t: 'REGARD', ply: 3, pieceId: first.id, gained: 7 },
        {
          t: 'REGARD',
          ply: 4,
          pieceId: enemyRoster[0]?.id ?? 'b:P:a7',
          gained: 11,
        },
      ],
      roster,
      departedRoster: [],
      enemyRoster,
      departedEnemyRoster: [],
      enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
      plies: 4,
      winScore: 50,
      rout: false,
      enemyRout: false,
      refusedGoodMoves: 0,
      winningPositionDesertions: 0,
      justifiedRefusalObviousness: [],
      justifiedRefusalPrivateViewLosses: [],
      determinismId: 'metrics-regard-test',
      enemyObservableBehaviours: [],
    };
    const metric = metricsFromMatch(1, 1, 'supportive', roster, result, 0);
    expect(metric.regardEvents).toBe(1);
    expect(metric.regardGainTotal).toBe(7);
  });

  it('folds free and mixed override benevolence telemetry from events', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 50, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 50, 0.5);
    const actor = roster[0];
    const witness = roster[1];
    if (actor === undefined || witness === undefined) {
      throw new Error('Starting roster must contain pieces.');
    }
    const makeResult = (
      events: HeadlessMatchResult['events'],
    ): HeadlessMatchResult => ({
      events,
      roster,
      departedRoster: [],
      enemyRoster,
      departedEnemyRoster: [],
      enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
      plies: 10,
      winScore: 50,
      rout: false,
      enemyRout: false,
      refusedGoodMoves: 0,
      winningPositionDesertions: 0,
      justifiedRefusalObviousness: [],
      justifiedRefusalPrivateViewLosses: [],
      determinismId: 'metrics-override-test',
      enemyObservableBehaviours: [],
    });
    const free = metricsFromMatch(
      1,
      1,
      'supportive',
      roster,
      makeResult([
        {
          t: 'OVERRIDE',
          ply: 3,
          pieceId: actor.id,
          san: 'Nf3',
          pieceTrustDelta: -35,
        },
      ]),
      0,
    );
    expect(free.overrideCount).toBe(1);
    expect(free.freeOverrideCount).toBe(1);
    expect(free.benevLossTarget).toBe(0);
    expect(free.benevLossWitness).toBe(0);
    expect(free.freeInsistencePlyFraction).toBe(0.7);

    const mixed = metricsFromMatch(
      1,
      1,
      'supportive',
      roster,
      makeResult([
        {
          t: 'OVERRIDE',
          ply: 3,
          pieceId: actor.id,
          san: 'Nf3',
          pieceTrustDelta: -35,
        },
        {
          t: 'PSYCH_DELTA',
          ply: 3,
          pieceId: actor.id,
          field: 'tauBenev',
          delta: -4,
        },
        {
          t: 'PSYCH_DELTA',
          ply: 3,
          pieceId: witness.id,
          field: 'tauBenev',
          delta: -6,
        },
      ]),
      0,
    );
    expect(mixed.overrideCount).toBe(1);
    expect(mixed.freeOverrideCount).toBe(0);
    expect(mixed.benevLossTarget).toBe(4);
    expect(mixed.benevLossWitness).toBe(6);
    expect(mixed.freeInsistencePlyFraction).toBe(0);
  });
});
