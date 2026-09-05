import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createStartingRoster } from '../src/orchestration/roster';
import type { HeadlessMatchResult } from '../src/orchestration/headlessMatch';
import type { MatchEvent } from '../src/psychology';
import {
  foldUnjustifiedTrauma,
  calculateEmptiedChairsScore,
  metricsFromMatch,
  renderCsv,
} from '../sim/metrics';

describe('unjustified trauma metrics', () => {
  const pieceId = 'w:P:a2' as const;
  const override = (
    ply: number,
    vindicated?: boolean,
  ): Extract<MatchEvent, { t: 'OVERRIDE' }> => ({
    t: 'OVERRIDE',
    ply,
    pieceId,
    san: 'Nf3',
    pieceTrustDelta: -10,
    ...(vindicated === undefined ? {} : { vindicated }),
  });
  const trauma = (
    ply: number,
    delta: number,
  ): Extract<MatchEvent, { t: 'PSYCH_DELTA' }> => ({
    t: 'PSYCH_DELTA',
    ply,
    pieceId,
    field: 'B_i',
    delta,
  });

  it('excludes vindicated overrides, negative deltas, and out-of-window trauma', () => {
    expect(
      foldUnjustifiedTrauma(
        [
          override(1, true),
          trauma(2, 10),
          override(4, false),
          trauma(5, -20),
          trauma(6, 8),
          trauma(7, 99),
        ],
        [pieceId],
        2,
      ),
    ).toBe(4);
  });

  it('counts trauma once when override windows overlap', () => {
    expect(
      foldUnjustifiedTrauma(
        [override(1), override(2), trauma(3, 10)],
        [pieceId],
        1,
      ),
    ).toBe(10);
  });

  it('averages over the supplied roster and clamps to the score bounds', () => {
    expect(
      foldUnjustifiedTrauma([override(1), trauma(3, 10)], [pieceId], 4),
    ).toBe(2.5);
    expect(
      foldUnjustifiedTrauma([override(1), trauma(3, 1_000)], [pieceId], 4),
    ).toBe(100);
  });
});

describe('promotion harness metrics', () => {
  it('clamps emptied chairs scores to the declared bounds', () => {
    expect(calculateEmptiedChairsScore(-1, 10)).toBe(0);
    expect(calculateEmptiedChairsScore(3, 2)).toBe(100);
  });

  it('reports leadership index components in metrics and CSV', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 50, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 50, 0.5);
    const actor = roster[0];
    if (actor === undefined) throw new Error('Expected a starting piece.');
    const result: HeadlessMatchResult = {
      events: [
        {
          t: 'OVERRIDE',
          ply: 1,
          pieceId: actor.id,
          san: 'Nf3',
          pieceTrustDelta: -10,
        },
        {
          t: 'PSYCH_DELTA',
          ply: 3,
          pieceId: actor.id,
          field: 'B_i',
          delta: 4,
        },
      ],
      roster,
      departedRoster: [],
      enemyRoster,
      departedEnemyRoster: [],
      enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
      plies: 3,
      winScore: 50,
      rout: false,
      enemyRout: false,
      dismissed: false,
      dismissalCause: null,
      dismissalPly: null,
      refusedGoodMoves: 0,
      winningPositionDesertions: 0,
      justifiedRefusalObviousness: [],
      justifiedRefusalPrivateViewLosses: [],
      determinismId: 'metrics-leadership-test',
      enemyObservableBehaviours: [],
    };
    const metric = metricsFromMatch(1, 1, 'supportive', roster, result, 0);
    expect(metric.unjustifiedTrauma).toBe(0.25);
    expect(metric.leadershipIndex).toBeCloseTo(34.95);
    const [header, row] = renderCsv([metric]).split('\n');
    expect(metric.meanTrustFinal).toBe(metric.meanTrustEnd);
    expect(metric.emptiedChairs).toBe(0);
    expect(metric.emptiedChairsScore).toBe(0);
    expect(metric.dismissed).toBe(false);
    expect(metric.dismissalCause).toBeNull();
    expect(metric.dismissalPly).toBeNull();
    expect(header).toMatch(
      /,unjustified_trauma,leadership_index,mean_trust_final,emptied_chairs,emptied_chairs_score,dismissed,dismissal_cause,dismissal_ply,shame_exposures,grief_mournings,bitterness_formations,mean_grief_load_end,mean_bitterness_end,panic_onsets,panic_plies,relief_events,heroism_nominations,lonely_stay_decisions$/,
    );
    expect(row).toMatch(
      /,0\.25,34\.95,50\.00,0,0\.00,0,,,0,0,0,0\.00,0\.00,0,0,0,0,0$/,
    );
  });

  it('uses departed exit trust in mean_trust_final but preserves survivor mean_trust_end', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 50, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 50, 0.5);
    const departed = roster[0];
    if (departed === undefined) throw new Error('Expected a starting piece.');
    const result: HeadlessMatchResult = {
      events: [],
      roster: roster.slice(1),
      departedRoster: [{ ...departed, T_i: 10 }],
      enemyRoster,
      departedEnemyRoster: [],
      enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
      plies: 0,
      winScore: 50,
      rout: false,
      enemyRout: false,
      dismissed: false,
      dismissalCause: null,
      dismissalPly: null,
      refusedGoodMoves: 0,
      winningPositionDesertions: 0,
      justifiedRefusalObviousness: [],
      justifiedRefusalPrivateViewLosses: [],
      determinismId: 'metrics-trust-final-test',
      enemyObservableBehaviours: [],
    };
    const metric = metricsFromMatch(1, 1, 'supportive', roster, result, 0);

    expect(metric.meanTrustEnd).toBe(50);
    expect(metric.meanTrustFinal).toBeLessThan(metric.meanTrustEnd);
    expect(metric.leadershipIndex).toBeCloseTo(34, 8);
  });

  it('folds Phase C trigger events and optional terms by own-side identity', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 50, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 50, 0.5);
    const actor = roster[0];
    const witness = roster[1];
    if (actor === undefined || witness === undefined) {
      throw new Error('Expected starting witnesses.');
    }
    const metric = metricsFromMatch(
      1,
      1,
      'supportive',
      roster,
      {
        events: [
          {
            t: 'PANIC_ONSET',
            ply: 1,
            side: 'w',
            trigger: 'dread',
            dreading: [actor.id],
            fielded: roster.length,
          },
          {
            t: 'PANIC_ONSET',
            ply: 2,
            side: 'b',
            trigger: 'dread',
            dreading: [enemyRoster[0]?.id ?? 'b:P:a7'],
            fielded: enemyRoster.length,
          },
          {
            t: 'MOVE',
            ply: 3,
            san: 'a3',
            pieceId: actor.id,
            verdict: 'COMPLIANT_EXECUTION',
            panicPermille: 500,
          },
          {
            t: 'RELIEF',
            ply: 4,
            pieceId: actor.id,
            priorRiskPermille: 700,
            riskPermille: 100,
          },
          {
            t: 'HEROISM_NOMINATION',
            ply: 5,
            pieceId: witness.id,
            san: 'Nb1',
          },
          {
            t: 'DESERTION',
            ply: 6,
            pieceId: actor.id,
            refusedMove: 'a3',
            uStay: -1,
            uDesert: 1,
            departureKind: 'first',
            terms: {
              P_captured: 0.5,
              pain: 0.2,
              P_lossIfStay: 0.4,
              P_lossIfLeave: 0.2,
              lambda: 1,
              lambdaTrust: 1,
              lambdaMorale: 0,
              lambdaLoyalty: 0,
              lambdaAffinity: 0,
              standingCost: 0,
              gloryWeight: 0,
              tauBenev: 0,
              tauAbil: 0,
              lonely: true,
            },
          },
        ],
        roster,
        departedRoster: [],
        enemyRoster,
        departedEnemyRoster: [],
        enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
        plies: 6,
        winScore: 50,
        rout: false,
        enemyRout: false,
        dismissed: false,
        dismissalCause: null,
        dismissalPly: null,
        refusedGoodMoves: 0,
        winningPositionDesertions: 0,
        lonelyStayDecisions: 1,
        justifiedRefusalObviousness: [],
        justifiedRefusalPrivateViewLosses: [],
        determinismId: 'phase-c-metrics-test',
        enemyObservableBehaviours: [],
      },
      0,
    );
    expect(metric.panicOnsets).toBe(1);
    expect(metric.panicPlies).toBe(1);
    expect(metric.reliefEvents).toBe(1);
    expect(metric.heroismNominations).toBe(1);
    expect(metric.lonelyStayDecisions).toBe(1);
  });

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
      dismissed: false,
      dismissalCause: null,
      dismissalPly: null,
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
      dismissed: false,
      dismissalCause: null,
      dismissalPly: null,
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
      dismissed: false,
      dismissalCause: null,
      dismissalPly: null,
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
      dismissed: false,
      dismissalCause: null,
      dismissalPly: null,
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
    expect(free.overrides).toBe(1);
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
    expect(mixed.overrides).toBe(1);
    expect(mixed.freeOverrideCount).toBe(0);
    expect(mixed.benevLossTarget).toBe(4);
    expect(mixed.benevLossWitness).toBe(6);
    expect(mixed.freeInsistencePlyFraction).toBe(0);
  });
});
