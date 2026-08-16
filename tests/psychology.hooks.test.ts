import { describe, expect, it } from 'vitest';

import type { MoveFeatures } from '../src/chess';
import {
  applyDesertionWithCascade,
  buildDesertionContexts,
  desertionContextFor,
  evaluateDesertionCascade,
  ENGINE_CONFIG,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  shouldDesert,
  type DesertionContext,
  type PieceState,
} from '../src/psychology';
import {
  attributeSacrifice,
  applyDeclinedSacrificeSignal,
  applySacrificeWitnesses,
  applyPosthumousClassCredit,
  detectDeclinedSacrificeCostlySignal,
  isAvengedCapture,
  isNearRefusal,
  calculateAbilityDripGain,
} from '../src/orchestration/psychologyHooks';
import { declinedSacrificePiece } from '../src/orchestration/insight';
import { LivingBoard } from '../src/chess';

it('applies bounded posthumous class credit only inside the look-back window', () => {
  const hero = makePiece({ id: 'w:P:e4', role: 'Pawn' });
  const witness = makePiece({ id: 'w:N:g1' });
  const witnessed = {
    t: 'SACRIFICE_WITNESSED' as const,
    ply: 4,
    hero: hero.id,
    beneficiary: witness.id,
  };
  const near = applyPosthumousClassCredit([witness], hero, [witnessed], 7);
  expect(near.roster[0]?.classPrestige.Pawn).toBe(
    witness.classPrestige.Pawn +
      ENGINE_CONFIG.DEFAULT_CLASS_SHIFT_POSTHUMOUS_SACRIFICE,
  );
  expect(near.events).toHaveLength(1);
  const far = applyPosthumousClassCredit([witness], hero, [witnessed], 8);
  expect(far.events).toHaveLength(0);
});

it('wires posthumous knobs and promotion hope into measurable outputs', () => {
  const hero = makePiece({ id: 'w:P:e4', role: 'Pawn' });
  const witness = makePiece({ id: 'w:N:g1' });
  const witnessed = {
    t: 'SACRIFICE_WITNESSED' as const,
    ply: 4,
    hero: hero.id,
    beneficiary: witness.id,
  };
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const originalShift = config.DEFAULT_CLASS_SHIFT_POSTHUMOUS_SACRIFICE;
  const originalWindow = config.POSTHUMOUS_SACRIFICE_LOOKBACK_PLIES;
  try {
    config.DEFAULT_CLASS_SHIFT_POSTHUMOUS_SACRIFICE = 5;
    const low = applyPosthumousClassCredit([witness], hero, [witnessed], 7);
    config.DEFAULT_CLASS_SHIFT_POSTHUMOUS_SACRIFICE = 15;
    const high = applyPosthumousClassCredit([witness], hero, [witnessed], 7);
    expect(
      high.events[0]?.t === 'POSTHUMOUS_CLASS_CREDIT'
        ? high.events[0].delta
        : 0,
    ).toBeGreaterThan(
      low.events[0]?.t === 'POSTHUMOUS_CLASS_CREDIT' ? low.events[0].delta : 0,
    );
    config.POSTHUMOUS_SACRIFICE_LOOKBACK_PLIES = 2;
    expect(
      applyPosthumousClassCredit([witness], hero, [witnessed], 7).events,
    ).toHaveLength(0);
  } finally {
    config.DEFAULT_CLASS_SHIFT_POSTHUMOUS_SACRIFICE = originalShift ?? 10;
    config.POSTHUMOUS_SACRIFICE_LOOKBACK_PLIES = originalWindow ?? 3;
  }
  const context: DesertionContext = {
    P_captured: 0.2,
    P_lossIfStay: 0.5,
    P_lossIfLeave: 0.8,
    pLossBoard: 0,
    pivotality: 0,
    shadowFactor: 1,
    promotionProspect: 1_000,
  };
  const originalHope = config.DESERTION_PROMOTION_HOPE_PERMILLE;
  const originalHopeFloor =
    config.DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE;
  try {
    config.DESERTION_PROMOTION_HOPE_PERMILLE = 0;
    const lowHope = shouldDesert(hero, context, [hero, witness]).terms
      .prospectiveStandingCost;
    config.DESERTION_PROMOTION_HOPE_PERMILLE = 1_000;
    const highHope = shouldDesert(hero, context, [hero, witness]).terms
      .prospectiveStandingCost;
    expect(highHope).toBeGreaterThan(lowHope ?? 0);
    const early = shouldDesert(hero, { ...context, promotionProspect: 250 }, [
      hero,
      witness,
    ]).terms.prospectiveStandingCost;
    const late = shouldDesert(hero, { ...context, promotionProspect: 1_000 }, [
      hero,
      witness,
    ]).terms.prospectiveStandingCost;
    expect(late).toBeGreaterThan(early ?? 0);
    const lowCredence = shouldDesert(
      makePiece({ credence: { ...defaultCredence(), tauAbil: 20 } }),
      context,
      [hero, witness],
    ).terms.prospectiveStandingCost;
    const highCredence = shouldDesert(
      makePiece({ credence: { ...defaultCredence(), tauAbil: 80 } }),
      context,
      [hero, witness],
    ).terms.prospectiveStandingCost;
    expect(highCredence).toBeGreaterThan(lowCredence ?? 0);
    expect(
      shouldDesert(hero, context, [hero, witness]).terms
        .prospectiveStandingCost,
    ).toBe(highHope);

    config.DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE = 0;
    const pureGate = shouldDesert(
      makePiece({ credence: { ...defaultCredence(), tauAbil: 50 } }),
      context,
      [hero, witness],
    ).terms.prospectiveStandingCost;
    const floorValues = [0, 250, 500, 1_000].map((floor) => {
      config.DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE = floor;
      return (
        shouldDesert(
          makePiece({ credence: { ...defaultCredence(), tauAbil: 50 } }),
          context,
          [hero, witness],
        ).terms.prospectiveStandingCost ?? Number.NaN
      );
    });
    expect(floorValues).toEqual([...floorValues].sort((a, b) => a - b));
    expect(new Set(floorValues).size).toBe(4);
    expect(pureGate).toBe(floorValues[0]);

    config.DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE = 1_000;
    const floorMaxLowCredence = shouldDesert(
      makePiece({ credence: { ...defaultCredence(), tauAbil: 0 } }),
      context,
      [hero, witness],
    ).terms.prospectiveStandingCost;
    const floorMaxHighCredence = shouldDesert(
      makePiece({ credence: { ...defaultCredence(), tauAbil: 100 } }),
      context,
      [hero, witness],
    ).terms.prospectiveStandingCost;
    expect(floorMaxLowCredence).toBe(floorMaxHighCredence);
    expect(
      floorValues.every(
        (value) => value !== undefined && Number.isFinite(value) && value >= 0,
      ),
    ).toBe(true);
  } finally {
    config.DESERTION_PROMOTION_HOPE_PERMILLE = originalHope ?? 0;
    config.DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE =
      originalHopeFloor ?? 250;
  }
});
import type { EngineEvaluation } from '../src/engine';
import { appraiseDesertionWitness } from '../src/psychology/witness';

const neutralTraits = {
  w_honor: 0.5,
  w_courage: 0.5,
  w_ambition: 0.5,
  w_loyalty: 0.5,
  w_empathy: 0.5,
  w_prestige: 0.5,
} as const;

function makePiece(overrides: Partial<PieceState> = {}): PieceState {
  return normalizePieceState({
    id: 'w:P:a2',
    role: 'Pawn',
    E_i: 40,
    traits: neutralTraits,
    T_i: -70,
    M_i: 20,
    B_i: 40,
    dyadicAffinity: {},
    classPrestige: {
      King: 0,
      Queen: 0,
      Rook: 0,
      Bishop: 0,
      Knight: 0,
      Pawn: 0,
    },
    engagementFactor: 1,
    credence: defaultCredence(),
    rumor: defaultRumor(),
    ...overrides,
  });
}

function makeFeatures(overrides: Partial<MoveFeatures> = {}): MoveFeatures {
  return {
    moverId: 'w:P:a2',
    san: 'a4',
    deltaVCapture: 0,
    materialDelta: 0,
    pCaptured: 0.1,
    pCapturedDelta: 0,
    captureRiskByPiece: {},
    peerSafetyDeltas: {},
    promotionProspectByPiece: {},
    kingSafetyDelta: 0,
    ...overrides,
  };
}

describe('desertion cascade (live path)', () => {
  it('classifies near refusal with the configured margin', () => {
    expect(isNearRefusal({ utilityScore: -1, refusalThreshold: -1 })).toBe(
      true,
    );
    expect(
      isNearRefusal({ utilityScore: -0.7, refusalThreshold: -1 }, 0.2),
    ).toBe(false);
    expect(
      isNearRefusal({ utilityScore: -0.7, refusalThreshold: -1 }, 0.3),
    ).toBe(true);
  });

  it('changes drip gain when its magnitude changes', () => {
    const piece = makePiece();
    const moveEval = {
      moveNotation: 'a4',
      deltaV_board: 0,
      privateScoreCp: 0,
      vLeaderImplied: 0,
      deltaV_capture: 0,
      P_captured: 0.5,
      peerSafetyDeltas: {},
      promotionProspect: 0,
    };
    const low = calculateAbilityDripGain(piece, moveEval, 2);
    const high = calculateAbilityDripGain(piece, moveEval, 8);
    expect(high).toBeGreaterThan(low);
  });
  it('uses each piece snapshot for capture probability', () => {
    const first = makePiece({ id: 'w:P:a2' });
    const second = makePiece({ id: 'w:P:b2' });
    const firstEval = {
      moveNotation: 'a4',
      deltaV_board: -2,
      privateScoreCp: 0,
      vLeaderImplied: 1,
      deltaV_capture: 0,
      P_captured: 0.1,
      peerSafetyDeltas: {},
      promotionProspect: 0,
    };
    const secondEval = { ...firstEval, P_captured: 0.8 };
    const contexts = buildDesertionContexts([first, second], {
      [first.id]: firstEval,
      [second.id]: secondEval,
    });
    expect(contexts[first.id]?.P_captured).toBe(0.1);
    expect(contexts[second.id]?.P_captured).toBe(0.8);
  });

  it('can cascade to a second piece after loss estimates rise', () => {
    const first = makePiece({ id: 'w:P:a2', T_i: -90, M_i: 5, B_i: 80 });
    const second = makePiece({
      id: 'w:P:b2',
      T_i: -85,
      M_i: 8,
      B_i: 70,
      rumor: { pLossTeam: 700, leaderAppraisal: -20 },
    });
    const king = makePiece({ id: 'w:K:e1', role: 'King', T_i: 50, M_i: 80 });
    const moveEval = {
      moveNotation: 'a4',
      deltaV_board: -2,
      privateScoreCp: 0,
      vLeaderImplied: 1,
      deltaV_capture: 0,
      P_captured: 0.9,
      peerSafetyDeltas: {},
      promotionProspect: 0,
    };
    const decision = shouldDesert(
      first,
      desertionContextFor(first, moveEval, [first, second]),
      [first, second, king],
    );
    const cascade = applyDesertionWithCascade(
      [first, second, king],
      {
        actor: first,
        refusedMove: 'a4',
        refusedMoveEval: moveEval,
        moveEvalByPiece: {
          [first.id]: moveEval,
          [second.id]: moveEval,
          [king.id]: moveEval,
        },
        uStay: decision.uStay,
        uDesert: decision.uDesert,
        terms: decision.terms,
      },
      4,
    );
    expect(cascade.events.some((event) => event.t === 'DESERTION')).toBe(true);
    expect(
      cascade.events.some((event) => event.t === 'DESERTION_WITNESS'),
    ).toBe(true);
    expect(cascade.cascadeLength).toBeGreaterThanOrEqual(1);
    expect(cascade.roster.some((piece) => piece.id === first.id)).toBe(false);
    const departure = cascade.events.find((event) => event.t === 'DESERTION');
    expect(departure).toMatchObject({
      uStay: decision.uStay,
      uDesert: decision.uDesert,
      terms: decision.terms,
      departureKind: 'first',
    });
    const cascadeDepartures = cascade.events.filter(
      (event): event is Extract<typeof event, { t: 'DESERTION' }> =>
        event.t === 'DESERTION' && event.departureKind === 'cascade',
    );
    expect(cascadeDepartures.every((event) => event.terms !== undefined)).toBe(
      true,
    );
  });

  it('uses each witness private move evaluation for departure appraisal', () => {
    const actor = makePiece({
      id: 'w:P:a2',
      T_i: -90,
      M_i: 5,
      B_i: 80,
    });
    const witness = makePiece({
      id: 'w:B:f1',
      T_i: 100,
      M_i: 100,
      B_i: 0,
      dyadicAffinity: { 'w:P:a2': 40 },
    });
    const actorEval = {
      moveNotation: 'a4',
      deltaV_board: -2,
      privateScoreCp: 0,
      vLeaderImplied: 1,
      deltaV_capture: 0,
      P_captured: 0.9,
      peerSafetyDeltas: {},
      promotionProspect: 0,
    };
    const witnessEval = { ...actorEval, deltaV_board: 2 };
    const decision = shouldDesert(
      actor,
      desertionContextFor(actor, actorEval, [actor, witness]),
      [actor, witness],
    );
    const cascade = applyDesertionWithCascade(
      [actor, witness],
      {
        actor,
        refusedMove: 'a4',
        refusedMoveEval: actorEval,
        moveEvalByPiece: {
          [actor.id]: actorEval,
          [witness.id]: witnessEval,
        },
        uStay: decision.uStay,
        uDesert: decision.uDesert,
        terms: decision.terms,
      },
      4,
    );
    expect(cascade.events).toContainEqual({
      t: 'DESERTION_WITNESS',
      ply: 4,
      witnessId: witness.id,
      deserterId: actor.id,
      appraisal: 'coward',
      witnessOwnValue: 2,
    });
    expect(cascade.roster[0]?.dyadicAffinity[actor.id]).toBe(15);
  });

  it('evaluateDesertionCascade uses shouldDesert without a dummy move', () => {
    const piece = makePiece({ T_i: -90, M_i: 5, B_i: 80 });
    const context: DesertionContext = {
      P_captured: 0.9,
      P_lossIfStay: 0.9,
      P_lossIfLeave: 0.1,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    const results = evaluateDesertionCascade([piece], { [piece.id]: context });
    expect(results).toHaveLength(1);
    expect(results[0]?.pieceId).toBe(piece.id);
  });
});

describe('departure witnessing and positive signals', () => {
  it('appraises a departure as a departure and lowers affinity', () => {
    const witness = makePiece({
      id: 'w:B:f1',
      dyadicAffinity: { 'w:P:a2': 40 },
    });
    const result = appraiseDesertionWitness(
      witness,
      makePiece({ id: 'w:P:a2' }),
      {
        moveNotation: 'a4',
        deltaV_board: -2,
        privateScoreCp: 0,
        vLeaderImplied: 1,
        deltaV_capture: 0,
        P_captured: 0.5,
        peerSafetyDeltas: {},
        promotionProspect: 0,
      },
      4,
    );
    expect(result.event).toMatchObject({
      t: 'DESERTION_WITNESS',
      appraisal: 'brave',
    });
    expect(result.witness.dyadicAffinity['w:P:a2']).toBe(15);
    expect(result.witness.T_i).toBe(-80);
    expect(result.witness.rumor.pLossTeam).toBe(180);
  });

  it('appraises a departure as cowardly without brave effects', () => {
    const witness = makePiece({
      id: 'w:B:f1',
      dyadicAffinity: { 'w:P:a2': 40 },
    });
    const result = appraiseDesertionWitness(
      witness,
      makePiece({ id: 'w:P:a2' }),
      {
        moveNotation: 'a4',
        deltaV_board: 2,
        privateScoreCp: 0,
        vLeaderImplied: 1,
        deltaV_capture: 0,
        P_captured: 0.5,
        peerSafetyDeltas: {},
        promotionProspect: 0,
      },
      4,
    );
    expect(result.event).toMatchObject({
      t: 'DESERTION_WITNESS',
      appraisal: 'coward',
    });
    expect(result.witness.dyadicAffinity['w:P:a2']).toBe(15);
    expect(result.witness.T_i).toBe(-70);
    expect(result.witness.rumor.pLossTeam).toBe(100);
  });

  it('does not credit trust when a sacrifice is witnessed', () => {
    const hero = makePiece({ id: 'w:P:a2' });
    const witness = makePiece({ id: 'w:B:f1', T_i: 10 });
    const result = applySacrificeWitnesses(
      [hero, witness],
      hero,
      { removedThreatToPeer: true, enabledForcedWin: false },
      4,
    );
    expect(result.roster.find((piece) => piece.id === witness.id)?.T_i).toBe(
      10,
    );
  });

  it('credits only the spared piece and its affinity friends', () => {
    const spared = makePiece({ id: 'w:Q:d1', T_i: 10 });
    const friend = makePiece({
      id: 'w:B:f1',
      T_i: 20,
      dyadicAffinity: { [spared.id]: 30 },
    });
    const stranger = makePiece({ id: 'w:P:a2', T_i: 30 });
    const result = applyDeclinedSacrificeSignal(
      [spared, friend, stranger],
      spared.id,
      4,
    );
    expect(result.roster.map((piece) => piece.T_i)).toEqual([25, 35, 30]);
    expect(result.events).toHaveLength(2);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pieceId: spared.id }),
        expect.objectContaining({ pieceId: friend.id }),
      ]),
    );
  });
});

describe('sacrifice attribution + avenged window', () => {
  it('attributes sacrifice from peer-safety or forced-win facts', () => {
    expect(
      attributeSacrifice(
        makeFeatures({ peerSafetyDeltas: { 'w:K:e1': 0.2 } }),
        100,
      ).removedThreatToPeer,
    ).toBe(true);
    expect(
      detectDeclinedSacrificeCostlySignal(
        {
          sacrificedPieceId: 'w:Q:d1',
          preferredMove: 'd1d8',
          preferredScoreCp: 500,
        },
        'a2a4',
        100,
      ),
    ).toBe(true);
    expect(
      detectDeclinedSacrificeCostlySignal(
        {
          sacrificedPieceId: 'w:Q:d1',
          preferredMove: 'd1d8',
          preferredScoreCp: 500,
        },
        'd1d8',
        100,
      ),
    ).toBe(false);
    expect(
      attributeSacrifice(makeFeatures({ san: 'Qh5' }), 25_000).enabledForcedWin,
    ).toBe(true);
  });

  it('golden: default avenged window is 3 plies', () => {
    expect(ENGINE_CONFIG.AVENGED_CAPTURE_WINDOW_PLIES).toBe(3);
    expect(isAvengedCapture(5, 8)).toBe(true);
    expect(isAvengedCapture(5, 9)).toBe(false);
  });

  it('sensitivity: changing the window changes avenged detection', () => {
    expect(isAvengedCapture(1, 5, 3)).toBe(false);
    expect(isAvengedCapture(1, 5, 4)).toBe(true);
  });

  it('detects a high-affinity sacrificed piece rather than the highest-ability piece', () => {
    expect(ENGINE_CONFIG.DECLINED_SACRIFICE_MIN_INCOMING_AFFINITY).toBe(100);
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1');
    const spared = makePiece({ id: 'w:Q:d2', E_i: 10 });
    const stronger = makePiece({ id: 'w:K:e1', role: 'King', E_i: 90 });
    const friend = makePiece({
      id: 'w:P:a2',
      dyadicAffinity: { [spared.id]: 120 },
    });
    const line: EngineEvaluation = {
      scoreCp: 500,
      pv: ['d2d7', 'e8d7'],
    };
    expect(
      declinedSacrificePiece(board, line, [spared, stronger, friend]),
    ).toBe(spared.id);
  });

  it('sensitivity: the high-affinity threshold controls declined-sacrifice detection', () => {
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1');
    const spared = makePiece({ id: 'w:Q:d2', E_i: 10 });
    const friend = makePiece({
      id: 'w:P:a2',
      dyadicAffinity: { [spared.id]: 120 },
    });
    const line: EngineEvaluation = {
      scoreCp: 500,
      pv: ['d2d7', 'e8d7'],
    };
    expect(declinedSacrificePiece(board, line, [spared, friend], 100)).toBe(
      spared.id,
    );
    expect(
      declinedSacrificePiece(board, line, [spared, friend], 121),
    ).toBeUndefined();
  });
});
