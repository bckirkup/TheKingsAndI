import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/core/canonicalJson';
import { createSeededRandom } from '../src/core/random';
import {
  ENGINE_CONFIG,
  applyBetrayalSignal,
  applyAuthorityLoss,
  applyAbilityObservation,
  applyEarnedAbilityObservation,
  applyCostlySignal,
  applyHeardSignal,
  applyMatchOutcomeTrust,
  applyOverride,
  applyWitnessedSacrificeEvent,
  calculateAttachment,
  calculateEngineSearchDepth,
  calculateAttachmentPermille,
  calculatePerceivedValue,
  calculatePivotalityPermille,
  calculateShadowFactor,
  calculateUDesert,
  calculateUStay,
  desertionContextFor,
  defaultCredence,
  defaultRumor,
  evaluateMoveResponse,
  isKingExempt,
  isWitnessedSacrifice,
  justifiedRefusalObviousness,
  justifiedRefusalAuthorityLoss,
  normalizePieceState,
  replayDigest,
  replayMatch,
  shouldDesert,
  type CandidateMoveEvaluation,
  type DesertionContext,
  type PieceState,
  type ReplayManifest,
} from '../src/psychology';
import {
  applyOutcomeVindication,
  applyRefusalAuthorityCost,
  applyVindicationAuthorityGain,
  applyRosterAbilityObservations,
  expectedVindicationDelta,
} from '../src/orchestration/psychologyHooks';
import {
  isVindicatedMove,
  resolveVindicationBaselineScore,
} from '../src/orchestration/evaluation';

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
    id: 'w:N:g1',
    role: 'Knight',
    traits: neutralTraits,
    E_i: 50,
    T_i: 50,
    M_i: 80,
    B_i: 0,
    dyadicAffinity: {},
    classPrestige: {
      Pawn: 0,
      Knight: 0,
      Bishop: 0,
      Rook: 0,
      Queen: 0,
      King: 0,
    },
    engagementFactor: 1.0,
    credence: defaultCredence(),
    rumor: defaultRumor(),
    ...overrides,
  });
}

function withExitPermanence<T>(value: number, run: () => T): T {
  const config = ENGINE_CONFIG as {
    DESERTION_EXIT_PERMANENCE_PERMILLE: number;
  };
  const original = config.DESERTION_EXIT_PERMANENCE_PERMILLE;
  try {
    config.DESERTION_EXIT_PERMANENCE_PERMILLE = value;
    return run();
  } finally {
    config.DESERTION_EXIT_PERMANENCE_PERMILLE = original;
  }
}

function makeMove(
  overrides: Partial<CandidateMoveEvaluation> = {},
): CandidateMoveEvaluation {
  return {
    moveNotation: 'Nf3',
    deltaV_board: 0.2,
    privateScoreCp: 0,
    vLeaderImplied: 0.5,
    deltaV_capture: 0,
    P_captured: 0.1,
    peerSafetyDeltas: {},
    promotionProspect: 0,
    ...overrides,
  };
}

describe('psychology invariants (docs/psychology_engine.md §11)', () => {
  it('accretes earned ability asymmetrically and with ceiling curvature', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalScale = config.ABIL_EARNED_STEP_SCALE ?? 0;
    const originalCurvature = config.ABIL_EARNED_CURVATURE ?? 2;
    const originalMultiplier = config.ABIL_EARNED_LOSS_MULTIPLIER ?? 2;
    try {
      config.ABIL_EARNED_STEP_SCALE = 10;
      config.ABIL_EARNED_CURVATURE = 2;
      config.ABIL_EARNED_LOSS_MULTIPLIER = 2;
      const gain = applyEarnedAbilityObservation(50, true) - 50;
      const loss = 50 - applyEarnedAbilityObservation(50, false);
      const lowGain = applyEarnedAbilityObservation(20, true) - 20;
      const highGain = applyEarnedAbilityObservation(90, true) - 90;
      config.ABIL_EARNED_CURVATURE = 0;
      const flatGain = applyEarnedAbilityObservation(90, true) - 90;
      config.ABIL_EARNED_CURVATURE = 4;
      const curvedGain = applyEarnedAbilityObservation(90, true) - 90;
      config.ABIL_EARNED_LOSS_MULTIPLIER = 1;
      const mildLoss = 50 - applyEarnedAbilityObservation(50, false);
      config.ABIL_EARNED_LOSS_MULTIPLIER = 3;
      const severeLoss = 50 - applyEarnedAbilityObservation(50, false);
      expect(loss).toBeGreaterThan(gain);
      expect(lowGain).toBeGreaterThan(highGain);
      expect(curvedGain).toBeLessThan(flatGain);
      expect(severeLoss).toBeGreaterThan(mildLoss);
    } finally {
      config.ABIL_EARNED_STEP_SCALE = originalScale;
      config.ABIL_EARNED_CURVATURE = originalCurvature;
      config.ABIL_EARNED_LOSS_MULTIPLIER = originalMultiplier;
    }
  });

  it('keeps earned ability disabled as an exact no-op and bounded integer', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalScale = config.ABIL_EARNED_STEP_SCALE ?? 0;
    try {
      config.ABIL_EARNED_STEP_SCALE = 0;
      expect(applyEarnedAbilityObservation(47.9, true)).toBe(47);
      config.ABIL_EARNED_STEP_SCALE = 13;
      for (const ability of [-20, 1, 50, 100, 140]) {
        for (const wasRight of [true, false]) {
          const result = applyEarnedAbilityObservation(ability, wasRight);
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(1);
          expect(result).toBeLessThanOrEqual(100);
        }
      }
    } finally {
      config.ABIL_EARNED_STEP_SCALE = originalScale;
    }
  });

  it('wires earned ability scale through to search depth', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalScale = config.ABIL_EARNED_STEP_SCALE ?? 0;
    try {
      config.ABIL_EARNED_STEP_SCALE = 0;
      const disabledAbility = applyEarnedAbilityObservation(50, true);
      config.ABIL_EARNED_STEP_SCALE = 20;
      const earnedAbility = applyEarnedAbilityObservation(50, true);
      expect(earnedAbility).toBeGreaterThan(disabledAbility);
      expect(calculateEngineSearchDepth(earnedAbility, 1)).toBeGreaterThan(
        calculateEngineSearchDepth(disabledAbility, 1),
      );
    } finally {
      config.ABIL_EARNED_STEP_SCALE = originalScale;
    }
  });

  it('grades objector and non-objector judgments with the documented polarity', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalScale = config.ABIL_EARNED_STEP_SCALE ?? 0;
    const originalMargin = config.ABIL_VINDICATION_NEAR_REFUSAL_MARGIN ?? 0.25;
    const actor = makePiece({ id: 'w:P:e4', role: 'Pawn' });
    const move = makeMove();
    const grade = (challenged: boolean, played: number): boolean => {
      config.ABIL_EARNED_STEP_SCALE = 10;
      config.ABIL_VINDICATION_NEAR_REFUSAL_MARGIN = 10_000;
      const result = applyRosterAbilityObservations(
        [actor],
        { [actor.id]: move },
        played,
        0,
        0,
        1,
        actor.id,
        challenged,
      );
      const event = result.events.find((item) => item.t === 'ABILITY_GRADE');
      if (event?.t !== 'ABILITY_GRADE')
        throw new Error('Missing ability grade');
      return event.wasRight;
    };
    try {
      expect(grade(true, 1_000)).toBe(false);
      expect(grade(true, -1_000)).toBe(true);
      expect(grade(false, 1_000)).toBe(true);
      expect(grade(false, -1_000)).toBe(false);
    } finally {
      config.ABIL_EARNED_STEP_SCALE = originalScale;
      config.ABIL_VINDICATION_NEAR_REFUSAL_MARGIN = originalMargin;
    }
  });

  it('charges justified refusal authority by the refusing piece view (golden)', () => {
    expect(justifiedRefusalObviousness(-0.5, true)).toBe(0.2);
    expect(justifiedRefusalObviousness(-2, true)).toBe(0.8);
    expect(justifiedRefusalObviousness(-3, true)).toBe(1);
    expect(justifiedRefusalAuthorityLoss(-0.5, true)).toBe(4);
    expect(justifiedRefusalAuthorityLoss(-2, true)).toBe(16);
    expect(justifiedRefusalAuthorityLoss(-0.5, false)).toBe(0);
    expect(justifiedRefusalAuthorityLoss(0.5, true)).toBe(0);
  });

  it('keeps refusal authority loss sensitive to its coefficient', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.REFUSAL_AUTHORITY_LOSS_SCALE ?? 20;
    try {
      config.REFUSAL_AUTHORITY_LOSS_SCALE = 0;
      expect(justifiedRefusalAuthorityLoss(-1, true)).toBe(0);
      config.REFUSAL_AUTHORITY_LOSS_SCALE = 40;
      expect(justifiedRefusalAuthorityLoss(-1, true)).toBe(16);
    } finally {
      config.REFUSAL_AUTHORITY_LOSS_SCALE = original;
    }
  });

  it('defaults reciprocal vindication gains off (golden)', () => {
    expect(ENGINE_CONFIG.ABIL_VINDICATION_GAIN_SCALE).toBe(
      ENGINE_CONFIG.REFUSAL_AUTHORITY_LOSS_SCALE,
    );
    expect(ENGINE_CONFIG.ABIL_OUTCOME_VINDICATION_SCALE).toBe(0);
    const actor = makePiece({ id: 'w:N:g1' });
    const witness = makePiece({ id: 'w:B:f1' });
    expect(
      applyVindicationAuthorityGain([actor, witness], actor.id, -1, true, true)
        .authorityGain,
    ).toBe(8);
    expect(applyOutcomeVindication([actor, witness], 100, 2)).toEqual([
      actor,
      witness,
    ]);
  });

  it('uses the expectation baseline by default and keeps the oracle branch', () => {
    expect(ENGINE_CONFIG.VINDICATION_BASELINE).toBe('expectation');
    expect(resolveVindicationBaselineScore('expectation', 100, 200, -0.5)).toBe(
      50,
    );
    expect(resolveVindicationBaselineScore('oracle', 100, 200, -0.5)).toBe(200);
  });

  it('uses each witness capture-risk expectation independently', () => {
    const cautious = makePiece({
      id: 'w:P:a2',
      traits: { ...neutralTraits, w_courage: 0 },
    });
    const brave = makePiece({
      id: 'w:Q:d1',
      traits: { ...neutralTraits, w_courage: 1 },
    });
    const move = makeMove({ deltaV_board: 0, P_captured: 0.5 });
    expect(expectedVindicationDelta(cautious, move)).toBe(-0.75);
    expect(expectedVindicationDelta(brave, move)).toBe(0);
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalGain = config.ABIL_VINDICATION_GAIN_SCALE ?? 20;
    config.ABIL_VINDICATION_GAIN_SCALE = 0;
    const observed = applyRosterAbilityObservations(
      [cautious, brave],
      { [cautious.id]: move, [brave.id]: move },
      60,
      100,
      200,
    );
    config.ABIL_VINDICATION_GAIN_SCALE = originalGain;
    expect(observed.vindicatedCount).toBe(1);
    expect(observed.roster[0]?.credence.tauAbil).toBe(56);
    expect(observed.roster[1]?.credence.tauAbil).toBe(10);
  });

  it('raises expectation pessimism as benevolence falls and trauma rises', () => {
    const move = makeMove({ deltaV_board: 0, P_captured: 0.5 });
    const trusting = makePiece({
      id: 'w:P:a2',
      credence: { tauBenev: 100, tauAbil: 50, abilityObservationCount: 0 },
      B_i: 0,
    });
    const distrustful = makePiece({
      id: 'w:P:a2',
      credence: { tauBenev: 0, tauAbil: 50, abilityObservationCount: 0 },
      B_i: 0,
    });
    const traumatised = makePiece({
      id: 'w:P:a2',
      credence: { tauBenev: 100, tauAbil: 50, abilityObservationCount: 0 },
      B_i: 100,
    });
    expect(expectedVindicationDelta(trusting, move)).toBe(-0.25);
    expect(expectedVindicationDelta(distrustful, move)).toBe(-0.5);
    expect(expectedVindicationDelta(traumatised, move)).toBe(-0.5);
  });

  it('goldens and probes the trust-dependent pessimism knob', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.VINDICATION_PESSIMISM_SCALE ?? 100;
    const piece = makePiece({
      id: 'w:P:a2',
      credence: { tauBenev: 0, tauAbil: 50, abilityObservationCount: 0 },
      B_i: 0,
    });
    const move = makeMove({ deltaV_board: 0, P_captured: 0.5 });
    try {
      expect(original).toBe(100);
      config.VINDICATION_PESSIMISM_SCALE = 100;
      const defaultExpectation = expectedVindicationDelta(piece, move);
      config.VINDICATION_PESSIMISM_SCALE = 0;
      const unscaledExpectation = expectedVindicationDelta(piece, move);
      expect(defaultExpectation).toBe(-0.5);
      expect(unscaledExpectation).toBe(-0.25);
      expect(defaultExpectation).not.toBe(unscaledExpectation);
    } finally {
      config.VINDICATION_PESSIMISM_SCALE = original;
    }
  });

  it('changes the vindication baseline when the branch changes', () => {
    const config = ENGINE_CONFIG as {
      VINDICATION_BASELINE: 'expectation' | 'oracle';
    };
    const original = config.VINDICATION_BASELINE;
    try {
      config.VINDICATION_BASELINE = 'expectation';
      const expectation = isVindicatedMove(100, 100, 200, -0.5);
      config.VINDICATION_BASELINE = 'oracle';
      const oracle = isVindicatedMove(100, 100, 200, -0.5);
      expect(expectation).toBe(true);
      expect(oracle).toBe(false);
    } finally {
      config.VINDICATION_BASELINE = original;
    }
  });

  it('credits only witnesses for justified vindication and responds to both scales', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const gainOriginal = config.ABIL_VINDICATION_GAIN_SCALE ?? 0;
    const outcomeOriginal = config.ABIL_OUTCOME_VINDICATION_SCALE ?? 0;
    const actor = makePiece({ id: 'w:N:g1' });
    const witness = makePiece({ id: 'w:B:f1' });
    try {
      config.ABIL_VINDICATION_GAIN_SCALE = 20;
      const gained = applyVindicationAuthorityGain(
        [actor, witness],
        actor.id,
        -1,
        true,
        true,
      );
      expect(gained.authorityGain).toBe(8);
      expect(gained.roster[0]?.credence.tauAbil).toBe(actor.credence.tauAbil);
      expect(gained.roster[1]?.credence.tauAbil).toBe(58);
      expect(
        applyVindicationAuthorityGain(
          [actor, witness],
          actor.id,
          -1,
          false,
          true,
        ).authorityGain,
      ).toBe(0);
      config.ABIL_VINDICATION_GAIN_SCALE = 40;
      expect(
        applyVindicationAuthorityGain(
          [actor, witness],
          actor.id,
          -1,
          true,
          true,
        ).authorityGain,
      ).toBe(16);
      config.ABIL_OUTCOME_VINDICATION_SCALE = 20;
      expect(
        applyOutcomeVindication([actor], 100, 2)[0]?.credence.tauAbil,
      ).toBe(90);
      config.ABIL_OUTCOME_VINDICATION_SCALE = 40;
      expect(
        applyOutcomeVindication([actor], 100, 2)[0]?.credence.tauAbil,
      ).toBe(100);
      expect(applyOutcomeVindication([actor], 0, 2)[0]?.credence.tauAbil).toBe(
        actor.credence.tauAbil,
      );
    } finally {
      config.ABIL_VINDICATION_GAIN_SCALE = gainOriginal;
      config.ABIL_OUTCOME_VINDICATION_SCALE = outcomeOriginal;
    }
  });

  it('updates witnesses ability only for a justified refusal', () => {
    const actor = makePiece({ id: 'w:N:g1' });
    const witness = makePiece({
      id: 'w:B:f1',
      credence: { tauBenev: 61, tauAbil: 63, abilityObservationCount: 0 },
    });
    const accepted = applyRefusalAuthorityCost(
      [actor, witness],
      actor.id,
      -1,
      true,
    );
    expect(accepted.authorityLoss).toBe(8);
    expect(accepted.roster[0]?.credence).toEqual(actor.credence);
    expect(accepted.roster[1]?.credence).toEqual({
      tauBenev: 61,
      tauAbil: 55,
      abilityObservationCount: 0,
    });
    const rejected = applyRefusalAuthorityCost(
      [actor, witness],
      actor.id,
      -1,
      false,
    );
    expect(rejected.authorityLoss).toBe(0);
    expect(rejected.roster[1]?.credence).toEqual(witness.credence);
    expect(applyAuthorityLoss(witness.credence, 0)).toEqual(witness.credence);
  });

  it('clamps state fields after normalization', () => {
    const piece = makePiece({ T_i: 500, M_i: -5, B_i: 200 });
    expect(piece.T_i).toBe(100);
    expect(piece.M_i).toBe(0);
    expect(piece.B_i).toBe(100);
  });

  it('never allows the King to desert', () => {
    const king = makePiece({ id: 'w:K:e1', role: 'King', T_i: -100, M_i: 0 });
    const context: DesertionContext = {
      P_captured: 1,
      P_lossIfStay: 0.9,
      P_lossIfLeave: 0.1,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    expect(isKingExempt(king.role)).toBe(true);
    expect(shouldDesert(king, context, [king]).desert).toBe(false);
  });

  it('uses credence-weighted perception instead of additive trust', () => {
    const lowAbil = makePiece({
      T_i: -80,
      credence: { tauBenev: 80, tauAbil: 0, abilityObservationCount: 0 },
    });
    const highAbil = makePiece({
      credence: { tauBenev: 80, tauAbil: 100, abilityObservationCount: 0 },
    });
    const move = makeMove({ deltaV_board: -1, vLeaderImplied: 3 });
    const toleratedMove = makeMove({ deltaV_board: 2, vLeaderImplied: 3 });
    const low = evaluateMoveResponse(lowAbil, move, [lowAbil]);
    const high = evaluateMoveResponse(highAbil, toleratedMove, [highAbil]);
    expect(low.perceivedValue).toBeLessThan(high.perceivedValue);
    expect(low.verdict).toBe('MORAL_REFUSAL');
    expect(high.verdict).toBe('COMPLIANT_EXECUTION');
  });

  it('attributes sacrifice only through engine-provided facts', () => {
    expect(
      isWitnessedSacrifice({
        removedThreatToPeer: true,
        enabledForcedWin: false,
      }),
    ).toBe(true);
    expect(
      isWitnessedSacrifice({
        removedThreatToPeer: false,
        enabledForcedWin: false,
      }),
    ).toBe(false);
  });

  it('records override as a distinct costly event', () => {
    const piece = makePiece();
    const witness = makePiece({ id: 'w:B:f1', role: 'Bishop' });
    const result = applyOverride(piece, [witness], 3, 'Nf3');
    expect(result.event.t).toBe('OVERRIDE');
    expect(result.overriddenPiece.T_i).toBeLessThan(piece.T_i);
    expect(result.witnesses[0]?.T_i).toBeLessThan(witness.T_i);
  });
});

describe('desertion cascade', () => {
  it('starts attachment near its ceiling and erodes it with alienation (golden)', () => {
    const peer = makePiece({ id: 'w:R:h1' });
    const piece = makePiece();
    expect(calculateAttachmentPermille(piece, [piece, peer])).toBe(1_000);
    expect(calculateAttachment(piece, [piece, peer])).toBe(1);
    expect(
      calculateAttachmentPermille(
        {
          ...piece,
          T_i: 0,
          B_i: 0,
          credence: { ...piece.credence, tauBenev: 50 },
          dyadicAffinity: { [peer.id]: 0 },
          traits: { ...piece.traits, w_loyalty: 0 },
        },
        [piece, peer],
      ),
    ).toBe(1_000);
    expect(
      calculateAttachmentPermille(
        {
          ...piece,
          T_i: -100,
          B_i: 100,
          credence: { ...piece.credence, tauBenev: 0 },
          dyadicAffinity: { [peer.id]: -100 },
          traits: { ...piece.traits, w_loyalty: 0 },
        },
        [piece, peer],
      ),
    ).toBe(300);
    expect(calculateAttachmentPermille(piece, [])).toBeGreaterThan(0);
  });

  it('makes alienation raise desertion incentive and loyalty damp it', () => {
    const peer = makePiece({ id: 'w:R:h1' });
    const context: DesertionContext = {
      P_captured: 0.2,
      P_lossIfStay: 0.5,
      P_lossIfLeave: 0.8,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    const base = makePiece({
      traits: { ...neutralTraits, w_loyalty: 0.5 },
    });
    const alienated = makePiece({
      T_i: -80,
      B_i: 60,
      credence: { ...defaultCredence(), tauBenev: 10 },
      dyadicAffinity: { [peer.id]: -100 },
      traits: { ...neutralTraits, w_loyalty: 0.5 },
    });
    const loyalAlienated = makePiece({
      T_i: -80,
      B_i: 60,
      credence: { ...defaultCredence(), tauBenev: 10 },
      dyadicAffinity: { [peer.id]: -100 },
      traits: { ...neutralTraits, w_loyalty: 1 },
    });
    const baseMargin =
      calculateUDesert(base, context, 0.6, [base, peer]) -
      calculateUStay(base, context, 0.6);
    const alienatedMargin =
      calculateUDesert(alienated, context, 0.6, [alienated, peer]) -
      calculateUStay(alienated, context, 0.6);
    const loyalAlienatedMargin =
      calculateUDesert(loyalAlienated, context, 0.6, [loyalAlienated, peer]) -
      calculateUStay(loyalAlienated, context, 0.6);
    expect(alienatedMargin).toBeGreaterThan(baseMargin);
    expect(loyalAlienatedMargin).toBeLessThan(alienatedMargin);
  });

  it('changes the attachment result when its floor knob changes (sensitivity)', () => {
    const piece = makePiece({
      T_i: -80,
      B_i: 60,
      credence: { ...defaultCredence(), tauBenev: 10 },
      traits: { ...neutralTraits, w_loyalty: 0 },
    });
    const config = ENGINE_CONFIG as { DESERTION_RESIDUAL_STAKE: number };
    const original = config.DESERTION_RESIDUAL_STAKE;
    try {
      const baseline = calculateAttachment(piece, [piece]);
      config.DESERTION_RESIDUAL_STAKE = 0.6;
      const higherFloor = calculateAttachment(piece, [piece]);
      expect(higherFloor).toBeGreaterThan(baseline);
    } finally {
      config.DESERTION_RESIDUAL_STAKE = original;
    }
  });

  it('maps private board score to a monotone rational loss belief (golden)', () => {
    const piece = makePiece({
      rumor: { ...defaultRumor(), pLossTeam: 700 },
    });
    const move = {
      ...makeMove(),
      privateScoreCp: 500,
    };
    const context = desertionContextFor(piece, move, [piece]);
    expect(context.pLossBoard ?? 0).toBe(0.25);
    expect(context.P_lossIfStay).toBe(0.475);
    expect(
      desertionContextFor(piece, { ...move, privateScoreCp: -500 }, [piece])
        .pLossBoard ?? 0,
    ).toBe(0.75);
    expect(
      desertionContextFor(piece, { ...move, privateScoreCp: 0 }, [piece])
        .pLossBoard ?? 0,
    ).toBe(0.5);
  });

  it('is sensitive to the board-loss scale and board/rumor blend knobs', () => {
    const piece = makePiece({
      rumor: { ...defaultRumor(), pLossTeam: 700 },
    });
    const move = { ...makeMove(), privateScoreCp: 500 };
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalScale = config.DESERTION_BOARD_LOSS_SCALE_CP ?? 500;
    const originalWeight = config.DESERTION_BOARD_LOSS_WEIGHT_PERMILLE ?? 500;
    try {
      config.DESERTION_BOARD_LOSS_SCALE_CP = 1_000;
      const broadMap = desertionContextFor(piece, move, [piece]);
      config.DESERTION_BOARD_LOSS_WEIGHT_PERMILLE = 0;
      const rumorOnly = desertionContextFor(piece, move, [piece]);
      expect(broadMap.pLossBoard ?? 0).toBe(0.334);
      expect(rumorOnly.P_lossIfStay).toBe(0.7);
      expect(broadMap.P_lossIfStay).not.toBe(rumorOnly.P_lossIfStay);
    } finally {
      config.DESERTION_BOARD_LOSS_SCALE_CP = originalScale;
      config.DESERTION_BOARD_LOSS_WEIGHT_PERMILLE = originalWeight;
    }
  });

  it('makes queen departure more pivotal than pawn departure', () => {
    const queen = makePiece({ id: 'w:Q:d1', role: 'Queen' });
    const pawn = makePiece({ id: 'w:P:e2', role: 'Pawn' });
    const king = makePiece({ id: 'w:K:e1', role: 'King' });
    const move = { ...makeMove(), privateScoreCp: 0 };
    const queenContext = desertionContextFor(queen, move, [queen, pawn, king]);
    const pawnContext = desertionContextFor(pawn, move, [queen, pawn, king]);
    expect(queenContext.pivotality).toBe(0.45);
    expect(pawnContext.pivotality).toBe(0.05);
    expect(queenContext.P_lossIfLeave).toBeGreaterThan(
      pawnContext.P_lossIfLeave,
    );
    expect(
      calculatePivotalityPermille(queen, [queen, pawn, king]),
    ).toBeGreaterThan(calculatePivotalityPermille(pawn, [queen, pawn, king]));
    expect(calculatePivotalityPermille(queen, [queen, king])).toBeGreaterThan(
      calculatePivotalityPermille(queen, [queen, pawn, king]),
    );
  });

  it('attenuates private pain and standing symmetrically in the shadow', () => {
    const piece = makePiece();
    const peer = makePiece({
      id: 'w:R:h1',
      dyadicAffinity: { [piece.id]: 100 },
    });
    const lowLoss: DesertionContext = {
      P_captured: 0.5,
      P_lossIfStay: 0,
      P_lossIfLeave: 0.5,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    const highLoss: DesertionContext = {
      ...lowLoss,
      P_lossIfStay: 0.8,
    };
    expect(calculateShadowFactor(0.8)).toBeCloseTo(0.2);
    expect(calculateUStay(piece, highLoss, 0)).toBeCloseTo(
      calculateUStay(piece, lowLoss, 0) * 0.2,
    );
    const lowStanding = calculateUDesert(piece, lowLoss, 0, [piece, peer]);
    const highStanding = calculateUDesert(piece, highLoss, 0, [piece, peer]);
    expect(highStanding).toBeCloseTo(lowStanding * 0.2);
  });

  it('uses the configured collective stake in pain units (golden)', () => {
    const piece = makePiece({ T_i: 50, M_i: 80, B_i: 0 });
    const context: DesertionContext = {
      P_captured: 0.25,
      P_lossIfStay: 0.1,
      P_lossIfLeave: 0.6,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    const lambda = 0.64;

    expect(calculateUStay(piece, context, lambda)).toBe(-5.45);
    expect(
      withExitPermanence(0, () =>
        calculateUDesert(piece, context, lambda, [piece]),
      ),
    ).toBe(-19.2);
  });

  it('charges anticipated standing loss in the desertion utility (golden)', () => {
    const piece = makePiece({ T_i: 50, M_i: 80, B_i: 0 });
    const peer = makePiece({
      id: 'w:R:h1',
      dyadicAffinity: { [piece.id]: 100 },
    });
    const context: DesertionContext = {
      P_captured: 0.25,
      P_lossIfStay: 0.1,
      P_lossIfLeave: 0.6,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };

    expect(
      withExitPermanence(0, () =>
        calculateUDesert(piece, context, 0.64, [piece, peer]),
      ),
    ).toBe(-21.45);
  });

  it('makes anticipated standing loss fall with the audience', () => {
    const piece = makePiece();
    const peers = Array.from({ length: 15 }, (_, index) =>
      makePiece({
        id: `w:R:h${index + 1}`,
        dyadicAffinity: { [piece.id]: 100 },
      }),
    );
    const context: DesertionContext = {
      P_captured: 0.25,
      P_lossIfStay: 0.1,
      P_lossIfLeave: 0.6,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };

    const [firstDeserter, lateDeserter] = withExitPermanence(0, () => [
      calculateUDesert(piece, context, 0.64, [piece, ...peers]),
      calculateUDesert(piece, context, 0.64, [piece, ...peers.slice(0, 1)]),
    ]);

    expect(firstDeserter).toBe(-52.95);
    expect(lateDeserter).toBe(-21.45);
    expect(lateDeserter).toBeGreaterThan(firstDeserter);
  });

  it('changes the desertion decision when collective stake changes (sensitivity)', () => {
    const piece = makePiece({ T_i: 50, M_i: 80, B_i: 0 });
    const context: DesertionContext = {
      P_captured: 0.25,
      P_lossIfStay: 0.1,
      P_lossIfLeave: 0.6,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    const config = ENGINE_CONFIG as { DESERTION_COLLECTIVE_STAKE: number };
    const baseline = withExitPermanence(0, () =>
      shouldDesert(piece, context, [piece]),
    );
    const original = config.DESERTION_COLLECTIVE_STAKE;
    try {
      config.DESERTION_COLLECTIVE_STAKE = 0.3;
      const lowStake = withExitPermanence(0, () =>
        shouldDesert(piece, context, [piece]),
      );
      expect(lowStake.desert).not.toBe(baseline.desert);
      expect(lowStake.uStay).not.toBe(baseline.uStay);
      expect(lowStake.uDesert).not.toBe(baseline.uDesert);
    } finally {
      config.DESERTION_COLLECTIVE_STAKE = original;
    }
  });

  it('changes desertion utility when standing stake changes (sensitivity)', () => {
    const piece = makePiece();
    const peer = makePiece({
      id: 'w:R:h1',
      dyadicAffinity: { [piece.id]: 100 },
    });
    const context: DesertionContext = {
      P_captured: 0.25,
      P_lossIfStay: 0.1,
      P_lossIfLeave: 0.6,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    const config = ENGINE_CONFIG as {
      DESERTION_STANDING_STAKE: number;
    };
    const original = config.DESERTION_STANDING_STAKE;
    try {
      const baseline = calculateUDesert(piece, context, 0.64, [piece, peer]);
      config.DESERTION_STANDING_STAKE = 0;
      const withoutStanding = calculateUDesert(piece, context, 0.64, [
        piece,
        peer,
      ]);
      expect(withoutStanding).not.toBe(baseline);
    } finally {
      config.DESERTION_STANDING_STAKE = original;
    }
  });

  it('deserts when U_desert exceeds U_stay', () => {
    const piece = makePiece({ T_i: -80, M_i: 10, B_i: 60 });
    const context: DesertionContext = {
      P_captured: 0.9,
      P_lossIfStay: 0.8,
      P_lossIfLeave: 0.2,
      pLossBoard: 0,
      pivotality: 0,
      shadowFactor: 1,
      promotionProspect: 0,
    };
    const outcome = evaluateMoveResponse(piece, makeMove(), [piece], context);
    expect(outcome.verdict).toBe('DESERTION_MUTINY');
  });
});

describe('credence channel updates', () => {
  it('uses the configured prior strength and advances the account count', () => {
    expect(ENGINE_CONFIG.ABIL_PRIOR_STRENGTH).toBe(10);
    const initial = defaultCredence();
    const observed = applyAbilityObservation(initial, false);
    expect(observed.tauAbil).toBe(10);
    expect(observed.abilityObservationCount).toBe(1);
  });

  it('keeps a one-point revision floor after truncation would freeze', () => {
    let state = { ...defaultCredence(), tauAbil: 0 };
    for (let ply = 0; ply < 200; ply += 1) {
      state = applyAbilityObservation(state, false);
    }
    expect(state.tauAbil).toBe(0);
    expect(applyAbilityObservation(state, true).tauAbil).toBe(1);
  });

  it('makes falsification steeper than vindication and curves with level', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalLoss = config.ABIL_VINDICATION_LOSS_MULTIPLIER ?? 2;
    const originalCurvature = config.ABIL_VINDICATION_CURVATURE ?? 2;
    try {
      config.ABIL_VINDICATION_LOSS_MULTIPLIER = 2;
      config.ABIL_VINDICATION_CURVATURE = 2;
      const initial = defaultCredence();
      expect(applyAbilityObservation(initial, true).tauAbil).toBe(56);
      expect(applyAbilityObservation(initial, false).tauAbil).toBe(10);
      const high = { ...initial, tauAbil: 90 };
      const low = { ...initial, tauAbil: 5 };
      expect(applyAbilityObservation(high, true).tauAbil).toBe(94);
      expect(applyAbilityObservation(low, true).tauAbil).toBe(14);
      config.ABIL_VINDICATION_CURVATURE = 0;
      expect(applyAbilityObservation(high, true).tauAbil).toBe(100);
    } finally {
      config.ABIL_VINDICATION_LOSS_MULTIPLIER = originalLoss;
      config.ABIL_VINDICATION_CURVATURE = originalCurvature;
    }
  });

  it('goldens and probes the loss multiplier knob', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.ABIL_VINDICATION_LOSS_MULTIPLIER ?? 2;
    try {
      expect(original).toBe(2);
      config.ABIL_VINDICATION_LOSS_MULTIPLIER = 2;
      const defaultLoss = applyAbilityObservation(defaultCredence(), false);
      config.ABIL_VINDICATION_LOSS_MULTIPLIER = 1;
      const reducedLoss = applyAbilityObservation(defaultCredence(), false);
      expect(defaultLoss.tauAbil).toBe(10);
      expect(reducedLoss.tauAbil).toBe(30);
      expect(defaultLoss.tauAbil).not.toBe(reducedLoss.tauAbil);
    } finally {
      config.ABIL_VINDICATION_LOSS_MULTIPLIER = original;
    }
  });

  it('goldens and probes the curvature strength knob', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.ABIL_VINDICATION_CURVATURE ?? 2;
    try {
      expect(original).toBe(2);
      config.ABIL_VINDICATION_CURVATURE = 2;
      const curved = applyAbilityObservation(
        { ...defaultCredence(), tauAbil: 90 },
        true,
      );
      config.ABIL_VINDICATION_CURVATURE = 0;
      const linear = applyAbilityObservation(
        { ...defaultCredence(), tauAbil: 90 },
        true,
      );
      expect(curved.tauAbil).toBe(94);
      expect(linear.tauAbil).toBe(100);
      expect(curved.tauAbil).not.toBe(linear.tauAbil);
    } finally {
      config.ABIL_VINDICATION_CURVATURE = original;
    }
  });

  it('moves the revision timing when prior strength changes', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.ABIL_PRIOR_STRENGTH ?? 10;
    const floorPly = (): number => {
      let state = defaultCredence();
      for (let ply = 1; ply <= 150; ply += 1) {
        state = applyAbilityObservation(state, false);
        if (state.tauAbil === 0) return ply;
      }
      return 0;
    };
    try {
      config.ABIL_PRIOR_STRENGTH = 10;
      const defaultSaturation = floorPly();
      config.ABIL_PRIOR_STRENGTH = 20;
      const changedSaturation = floorPly();
      expect(defaultSaturation).toBeGreaterThan(0);
      expect(changedSaturation).toBeGreaterThan(0);
      expect(changedSaturation).toBeGreaterThan(defaultSaturation);
    } finally {
      config.ABIL_PRIOR_STRENGTH = original;
    }
  });

  it('raises benevolence only when real value was surrendered', () => {
    const credence = defaultCredence();
    expect(applyHeardSignal(credence, false).tauBenev).toBe(credence.tauBenev);
    expect(applyHeardSignal(credence, true).tauBenev).toBe(
      credence.tauBenev + ENGINE_CONFIG.BENEV_HEARD_STEP,
    );
  });

  it('applies a betrayal cliff larger than linear erosion', () => {
    const credence = {
      tauBenev: 80,
      tauAbil: 50,
      abilityObservationCount: 0,
    };
    const betrayed = applyBetrayalSignal(credence, 8);
    expect(betrayed.tauBenev).toBeLessThanOrEqual(credence.tauBenev - 30);
  });
});

describe('trust dynamics', () => {
  it('lowers trust after a loss and credits costly signals', () => {
    const roster = [makePiece(), makePiece({ id: 'w:R:a1', role: 'Rook' })];
    const afterLoss = applyMatchOutcomeTrust(roster, 20);
    expect(afterLoss[0]?.T_i).toBeLessThan(roster[0]?.T_i ?? 0);
    const signal = applyCostlySignal(makePiece(), 'king_endangerment', 1);
    expect(signal.piece.T_i).toBeGreaterThan(makePiece().T_i);
    expect(signal.event.t).toBe('COSTLY_SIGNAL');
  });
});

describe('replay determinism', () => {
  const manifest: ReplayManifest = {
    seed: 4242,
    roster: [makePiece(), makePiece({ id: 'w:B:f1', role: 'Bishop', T_i: 10 })],
    plies: [
      {
        pieceId: 'w:N:g1',
        san: 'Nf3',
        moveEval: makeMove(),
      },
      {
        pieceId: 'w:B:f1',
        san: 'Bc4',
        moveEval: makeMove({ deltaV_board: -2, vLeaderImplied: 1 }),
        forced: true,
      },
    ],
  };

  it('replays to a byte-identical event log', () => {
    const first = replayMatch(manifest);
    const second = replayMatch(manifest);
    expect(canonicalJson(first.events)).toBe(canonicalJson(second.events));
    expect(replayDigest(manifest)).toBe(canonicalJson(first.events));
  });

  it('is stable across one hundred random manifests', () => {
    const random = createSeededRandom(99_001);
    for (let match = 0; match < 100; match += 1) {
      const trust = random.nextInt(200) - 100;
      const piece = makePiece({ T_i: trust });
      const randomManifest: ReplayManifest = {
        seed: random.nextInt(1_000_000),
        roster: [piece],
        plies: [
          {
            pieceId: piece.id,
            san: 'Nf3',
            moveEval: makeMove({
              deltaV_board: random.nextInt(2000) / 1000 - 1,
              privateScoreCp: 0,
              vLeaderImplied: random.nextInt(2000) / 1000 - 1,
            }),
          },
        ],
      };
      const a = replayDigest(randomManifest);
      const b = replayDigest(randomManifest);
      expect(a).toBe(b);
    }
  });
});

describe('witnessed sacrifice fold', () => {
  it('updates affinity and class prestige for observers', () => {
    const observer = makePiece({ id: 'w:P:e2', role: 'Pawn' });
    const hero = makePiece({ id: 'w:N:g1', role: 'Knight' });
    const updated = applyWitnessedSacrificeEvent(observer, hero);
    expect(updated.dyadicAffinity[hero.id]).toBe(50);
    expect(updated.classPrestige.Knight).toBe(20);
  });
});

describe('perceived value golden values', () => {
  it('blends own and leader-implied views by ability credence', () => {
    expect(calculatePerceivedValue(-1, 3, 0)).toBe(-1);
    expect(calculatePerceivedValue(-1, 3, 100)).toBe(3);
    expect(calculatePerceivedValue(0, 2, 50)).toBe(1);
  });
});
