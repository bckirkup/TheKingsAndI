/**
 * Unit + wiring (sensitivity) probes for ENGINE_CONFIG knobs.
 *
 * While psychology is still under active calibration, prefer:
 *   - unit behaviour (clamps, gates, monotone relations)
 *   - wiring: change one input → output must differ
 * over brittle exact-number goldens that churn with every retune.
 */
import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { evalProfileFor } from '../src/orchestration/privateEvaluation';
import {
  ENGINE_CONFIG,
  applyBetrayalSignal,
  applyCaptureInjury,
  applyCostlySignal,
  costlySignalCredit,
  applyFatalisticComplianceCosts,
  applyHeardSignal,
  applyNeglectSignal,
  applyOverride,
  applySustainedDread,
  applyWitnessedSacrificeEvent,
  appraiseDesertionWitness,
  attentionWeight,
  applyAbilityObservation,
  calculateBenchingTrustPenalties,
  calculateEngineSearchDepth,
  calculateInterPieceProtection,
  calculateLambda,
  calculateMoveUtility,
  calculatePain,
  calculatePivotalityPermille,
  calculateSingleMatchLeadershipIndex,
  calculateStayAttachmentWeightPermille,
  calculateUDesert,
  defaultCredence,
  defaultRumor,
  diffuseRumor,
  evaluateMoveResponse,
  isExpendableRefusal,
  normalizePieceState,
  shouldDesert,
  type CandidateMoveEvaluation,
  type DesertionContext,
  type PieceState,
} from '../src/psychology';
import {
  calculateAbilityDripGain,
  isNearRefusal,
} from '../src/orchestration/psychologyHooks';

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

function mutateConfig(key: string, value: unknown, run: () => void): void {
  const config = ENGINE_CONFIG as unknown as Record<string, unknown>;
  const original = config[key];
  try {
    config[key] = value;
    run();
  } finally {
    config[key] = original;
  }
}

function makeDesertionContext(
  overrides: Partial<DesertionContext> = {},
): DesertionContext {
  return {
    P_captured: 0.5,
    P_lossIfStay: 0.5,
    P_lossIfLeave: 0.5,
    pLossBoard: 0.5,
    pivotality: 0,
    shadowFactor: 1,
    ...overrides,
  };
}

function bondedPeer(overrides: Partial<PieceState> = {}): PieceState {
  return makePiece({
    id: 'w:P:e2',
    role: 'Pawn',
    T_i: 40,
    dyadicAffinity: { 'w:N:g1': 100 },
    classPrestige: {
      Pawn: 0,
      Knight: 100,
      Bishop: 0,
      Rook: 0,
      Queen: 0,
      King: 0,
    },
    traits: { ...neutralTraits, w_empathy: 0 },
    ...overrides,
  });
}

describe('wiring — depth & engagement', () => {
  it('unit: search depth rises with experience and engagement', () => {
    expect(calculateEngineSearchDepth(1, 0.1)).toBeLessThan(
      calculateEngineSearchDepth(100, 1.0),
    );
    expect(calculateEngineSearchDepth(100, 0.2)).toBeLessThan(
      calculateEngineSearchDepth(100, 1.0),
    );
  });

  it('wiring: MIN_SEARCH_DEPTH changes rookie depth', () => {
    const lowFloor = calculateEngineSearchDepth(1, 1.0, 2, 16);
    const highFloor = calculateEngineSearchDepth(1, 1.0, 6, 16);
    expect(highFloor).toBeGreaterThan(lowFloor);
  });

  it('wiring: DESERTION_ENGAGEMENT reaches mutiny engagementFactor', () => {
    const actor = makePiece({
      T_i: -90,
      M_i: 5,
      B_i: 90,
      traits: { ...neutralTraits, w_loyalty: 0, w_ambition: 0, w_prestige: 0 },
    });
    const context = makeDesertionContext({
      P_captured: 0.99,
      P_lossIfStay: 0.99,
      P_lossIfLeave: 0.05,
      pLossBoard: 0.99,
    });
    const peers = [actor, makePiece({ id: 'w:P:a2', role: 'Pawn' })];
    expect(shouldDesert(actor, context, peers).desert).toBe(true);
    const move: CandidateMoveEvaluation = {
      moveNotation: 'Nxh7',
      deltaV_board: -2,
      privateScoreCp: -800,
      vLeaderImplied: 1,
      deltaV_capture: 0,
      P_captured: 0.99,
      peerSafetyDeltas: {},
    };
    let low = 0;
    let high = 0;
    mutateConfig('DESERTION_ENGAGEMENT', 0.05, () => {
      low = evaluateMoveResponse(actor, move, peers, context).engagementFactor;
    });
    mutateConfig('DESERTION_ENGAGEMENT', 0.2, () => {
      high = evaluateMoveResponse(actor, move, peers, context).engagementFactor;
    });
    expect(high).toBeGreaterThan(low);
  });
});

describe('wiring — benching & leadership', () => {
  it('wiring: DEFAULT_BENCHING_SELF_PENALTY scales the trust drop', () => {
    const benched = makePiece({ T_i: 40 });
    let mild = 0;
    let harsh = 0;
    mutateConfig('DEFAULT_BENCHING_SELF_PENALTY', -5, () => {
      mild = calculateBenchingTrustPenalties(benched, []).benchedPieceNewTrust;
    });
    mutateConfig('DEFAULT_BENCHING_SELF_PENALTY', -50, () => {
      harsh = calculateBenchingTrustPenalties(benched, []).benchedPieceNewTrust;
    });
    expect(harsh).toBeLessThan(mild);
  });

  it('wiring: DEFAULT_BENCHING_PEER_BASE_PENALTY scales peer trust drop', () => {
    const benched = makePiece({ T_i: 40 });
    const peer = bondedPeer();
    let mild = 0;
    let harsh = 0;
    mutateConfig('DEFAULT_BENCHING_PEER_BASE_PENALTY', -1, () => {
      mild =
        calculateBenchingTrustPenalties(benched, [peer]).updatedPeers[0]?.T_i ??
        0;
    });
    mutateConfig('DEFAULT_BENCHING_PEER_BASE_PENALTY', -40, () => {
      harsh =
        calculateBenchingTrustPenalties(benched, [peer]).updatedPeers[0]?.T_i ??
        0;
    });
    expect(harsh).toBeLessThan(mild);
  });

  it('wiring: LEADERSHIP_WEIGHTS change the index', () => {
    const baseline = calculateSingleMatchLeadershipIndex(50, 100, 10, 5);
    const tuned = calculateSingleMatchLeadershipIndex(50, 100, 10, 5, {
      alpha: 0.1,
      beta: 0.1,
      gamma: 0.1,
      delta: 0.1,
    } as unknown as typeof ENGINE_CONFIG.LEADERSHIP_WEIGHTS);
    expect(tuned).not.toBe(baseline);
  });
});

describe('wiring — sacrifice & clamp', () => {
  it('unit: repeated sacrifice saturates affinity and prestige', () => {
    let observer = makePiece({ id: 'w:P:a2', role: 'Pawn' });
    const hero = makePiece();
    for (let i = 0; i < 5; i += 1) {
      observer = applyWitnessedSacrificeEvent(observer, hero);
    }
    expect(observer.dyadicAffinity[hero.id]).toBe(100);
    expect(observer.classPrestige.Knight).toBe(100);
  });

  it('wiring: zero affinity shift freezes dyadic affinity', () => {
    const observer = makePiece({ id: 'w:P:a2', role: 'Pawn' });
    const hero = makePiece();
    const baseline = applyWitnessedSacrificeEvent(observer, hero);
    mutateConfig('DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE', 0, () => {
      const next = applyWitnessedSacrificeEvent(observer, hero);
      expect(next.dyadicAffinity[hero.id] ?? 0).toBe(0);
      expect(next.dyadicAffinity[hero.id]).not.toBe(
        baseline.dyadicAffinity[hero.id],
      );
    });
  });

  it('wiring: zero class shift freezes class prestige', () => {
    const observer = makePiece({ id: 'w:P:a2', role: 'Pawn' });
    const hero = makePiece();
    const baseline = applyWitnessedSacrificeEvent(observer, hero);
    mutateConfig('DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE', 0, () => {
      const next = applyWitnessedSacrificeEvent(observer, hero);
      expect(next.classPrestige.Knight).toBe(0);
      expect(next.classPrestige.Knight).not.toBe(baseline.classPrestige.Knight);
    });
  });
});

describe('wiring — override penalties', () => {
  it('unit: override hurts actor and witness trust, not trauma', () => {
    const piece = makePiece({ T_i: 50, B_i: 10 });
    const witness = makePiece({ id: 'w:P:a2', role: 'Pawn', T_i: 50 });
    const result = applyOverride(piece, [witness], 1, 'Nf3');
    expect(result.overriddenPiece.T_i).toBeLessThan(piece.T_i);
    expect(result.overriddenPiece.B_i).toBe(piece.B_i);
    expect(result.witnesses[0]?.T_i).toBeLessThan(witness.T_i);
  });

  it('wiring: OVERRIDE_PIECE_TRUST_PENALTY scales actor trust drop', () => {
    const piece = makePiece({ T_i: 50 });
    let mild = 0;
    let harsh = 0;
    mutateConfig('OVERRIDE_PIECE_TRUST_PENALTY', -10, () => {
      mild = applyOverride(piece, [], 1, 'Nf3').overriddenPiece.T_i;
    });
    mutateConfig('OVERRIDE_PIECE_TRUST_PENALTY', -70, () => {
      harsh = applyOverride(piece, [], 1, 'Nf3').overriddenPiece.T_i;
    });
    expect(harsh).toBeLessThan(mild);
  });

  it('wiring: OVERRIDE_WITNESS_TRUST_PENALTY scales witness trust', () => {
    const piece = makePiece();
    const witness = makePiece({ id: 'w:P:a2', role: 'Pawn', T_i: 50 });
    let mild = 0;
    let harsh = 0;
    mutateConfig('OVERRIDE_WITNESS_TRUST_PENALTY', -2, () => {
      mild = applyOverride(piece, [witness], 1, 'Nf3').witnesses[0]?.T_i ?? 0;
    });
    mutateConfig('OVERRIDE_WITNESS_TRUST_PENALTY', -20, () => {
      harsh = applyOverride(piece, [witness], 1, 'Nf3').witnesses[0]?.T_i ?? 0;
    });
    expect(harsh).toBeLessThan(mild);
  });

  it('wiring: OVERRIDE_BENEV_CLIFF_INPUT changes benevolence drop', () => {
    const piece = makePiece({
      credence: { tauBenev: 80, tauAbil: 50, abilityObservationCount: 0 },
    });
    mutateConfig('OVERRIDE_BENEV_CLIFF_INPUT', 0, () => {
      const mild = applyOverride(piece, [], 1, 'Nf3').overriddenPiece.credence
        .tauBenev;
      mutateConfig('OVERRIDE_BENEV_CLIFF_INPUT', 12, () => {
        const harsh = applyOverride(piece, [], 1, 'Nf3').overriddenPiece
          .credence.tauBenev;
        expect(harsh).toBeLessThan(mild);
      });
    });
  });
});

describe('wiring — injury and dread', () => {
  it('unit: capture injury raises trauma; dread needs a sustained run', () => {
    const piece = makePiece({ B_i: 0 });
    expect(applyCaptureInjury(piece).B_i).toBeGreaterThan(piece.B_i);
    const first = applySustainedDread(piece, undefined, 0.8);
    const second = applySustainedDread(piece, first.exposure, 0.8);
    expect(first.piece.B_i).toBe(piece.B_i);
    expect(second.piece.B_i).toBeGreaterThan(first.piece.B_i);
  });

  it('wiring: CAPTURE_TRAUMA_GAIN scales capture injury', () => {
    const piece = makePiece({ B_i: 0 });
    let mild = 0;
    let harsh = 0;
    mutateConfig('CAPTURE_TRAUMA_GAIN', 7, () => {
      mild = applyCaptureInjury(piece).B_i;
    });
    mutateConfig('CAPTURE_TRAUMA_GAIN', 25, () => {
      harsh = applyCaptureInjury(piece).B_i;
    });
    expect(harsh).toBeGreaterThan(mild);
  });

  it('unit: capture injury does not scale with role or traits', () => {
    const pawn = makePiece({ role: 'Pawn', B_i: 10 });
    const queen = makePiece({
      role: 'Queen',
      B_i: 10,
      traits: { ...neutralTraits, w_honor: 1, w_courage: 1 },
    });
    expect(applyCaptureInjury(pawn).B_i).toBe(applyCaptureInjury(queen).B_i);
  });

  it('wiring: DREAD_CAPTURE_RISK_THRESHOLD changes which risks qualify', () => {
    const piece = makePiece({ B_i: 0 });
    const qualifying = applySustainedDread(piece, undefined, 0.8);
    expect(qualifying.exposure.streak).toBeGreaterThan(0);
    mutateConfig('DREAD_CAPTURE_RISK_THRESHOLD', 0.9, () => {
      expect(applySustainedDread(piece, undefined, 0.8).exposure.streak).toBe(
        0,
      );
    });
  });

  it('wiring: DREAD_TRAUMA_GAIN scales sustained injury', () => {
    const piece = makePiece({ B_i: 0 });
    const first = applySustainedDread(piece, undefined, 0.8);
    let mild = 0;
    let harsh = 0;
    mutateConfig('DREAD_TRAUMA_GAIN', 3, () => {
      mild = applySustainedDread(piece, first.exposure, 0.8).piece.B_i;
    });
    mutateConfig('DREAD_TRAUMA_GAIN', 9, () => {
      harsh = applySustainedDread(piece, first.exposure, 0.8).piece.B_i;
    });
    expect(harsh).toBeGreaterThan(mild);
  });

  it('wiring: DREAD_REQUIRED_PLIES delays injury', () => {
    const piece = makePiece({ B_i: 0 });
    const first = applySustainedDread(piece, undefined, 0.8);
    mutateConfig('DREAD_REQUIRED_PLIES', 3, () => {
      expect(applySustainedDread(piece, first.exposure, 0.8).injured).toBe(
        false,
      );
    });
  });
});

describe('wiring — costly signals', () => {
  it('wiring: each COSTLY_SIGNAL_* credit reaches trust', () => {
    const kinds = [
      'king_endangerment',
      'declined_sacrifice',
      'retained_piece',
      'avenged_capture',
    ] as const;
    for (const kind of kinds) {
      const piece = makePiece({ T_i: 0 });
      expect(applyCostlySignal(piece, kind, 1).piece.T_i).toBe(
        costlySignalCredit(kind),
      );
      expect(costlySignalCredit(kind)).toBeGreaterThan(0);
    }
  });

  it('wiring: zeroing COSTLY_SIGNAL_KING_DANGER removes the credit', () => {
    const piece = makePiece({ T_i: 0 });
    const baseline = applyCostlySignal(piece, 'king_endangerment', 1).piece.T_i;
    mutateConfig('COSTLY_SIGNAL_KING_DANGER', 0, () => {
      expect(applyCostlySignal(piece, 'king_endangerment', 1).piece.T_i).toBe(
        0,
      );
      expect(costlySignalCredit('king_endangerment')).not.toBe(baseline);
    });
  });

  it('wiring: COSTLY_SIGNAL_DECLINED_SACRIFICE / RETAINED / AVENGED scale', () => {
    const piece = makePiece({ T_i: 0 });
    mutateConfig('COSTLY_SIGNAL_DECLINED_SACRIFICE', 40, () => {
      expect(applyCostlySignal(piece, 'declined_sacrifice', 1).piece.T_i).toBe(
        40,
      );
    });
    mutateConfig('COSTLY_SIGNAL_RETAINED_PIECE', 0, () => {
      expect(applyCostlySignal(piece, 'retained_piece', 1).piece.T_i).toBe(0);
    });
    mutateConfig('COSTLY_SIGNAL_AVENGED_CAPTURE', 30, () => {
      expect(applyCostlySignal(piece, 'avenged_capture', 1).piece.T_i).toBe(30);
    });
  });
});

describe('wiring — benevolence & ability knobs', () => {
  it('wiring: BENEV_HEARD_STEP changes heard-signal gain', () => {
    const before = defaultCredence();
    let small = 0;
    let large = 0;
    mutateConfig('BENEV_HEARD_STEP', 5, () => {
      small = applyHeardSignal(before, true).tauBenev;
    });
    mutateConfig('BENEV_HEARD_STEP', 20, () => {
      large = applyHeardSignal(before, true).tauBenev;
    });
    expect(large).toBeGreaterThan(small);
  });

  it('wiring: BENEV_BETRAYAL_CLIFF_SCALE and DROP change betrayal drop', () => {
    const before = { ...defaultCredence(), tauBenev: 80 };
    mutateConfig('BENEV_BETRAYAL_CLIFF_SCALE', 0, () => {
      const soft = applyBetrayalSignal(before, 6).tauBenev;
      mutateConfig('BENEV_BETRAYAL_CLIFF_DROP', 80, () => {
        mutateConfig('BENEV_BETRAYAL_CLIFF_SCALE', 8, () => {
          const hard = applyBetrayalSignal(before, 6).tauBenev;
          expect(hard).toBeLessThan(soft);
        });
      });
    });
  });

  it('wiring: BENEV_NEGLECT_EROSION changes neglect drop', () => {
    const before = { ...defaultCredence(), tauBenev: 50 };
    let mild = 0;
    let harsh = 0;
    mutateConfig('BENEV_NEGLECT_EROSION', 1, () => {
      mild = applyNeglectSignal(before).tauBenev;
    });
    mutateConfig('BENEV_NEGLECT_EROSION', 10, () => {
      harsh = applyNeglectSignal(before).tauBenev;
    });
    expect(harsh).toBeLessThan(mild);
  });

  it('wiring: BENEV_EXPENDABLE_FLOOR and GAP gate expendable refusal', () => {
    mutateConfig('BENEV_EXPENDABLE_FLOOR', 10, () => {
      mutateConfig('BENEV_EXPENDABLE_GAP', 3, () => {
        expect(isExpendableRefusal(-1, 2.5, 5)).toBe(false);
        expect(isExpendableRefusal(-1, 3, 5)).toBe(true);
      });
    });
  });

  it('wiring: ABIL_BAYES_NUMERATOR changes observation step size', () => {
    const before = {
      ...defaultCredence(),
      tauAbil: 50,
      abilityObservationCount: 0,
    };
    mutateConfig('ABIL_BAYES_NUMERATOR', 50, () => {
      const small = applyAbilityObservation(before, true).tauAbil;
      mutateConfig('ABIL_BAYES_NUMERATOR', 200, () => {
        const large = applyAbilityObservation(before, true).tauAbil;
        expect(large).toBeGreaterThan(small);
      });
    });
  });

  it('wiring: ABIL_DRIP_SCALE changes drip gain magnitude', () => {
    const piece = makePiece({ E_i: 40 });
    const move: CandidateMoveEvaluation = {
      moveNotation: 'Nxh7',
      deltaV_board: 0,
      privateScoreCp: 0,
      vLeaderImplied: 0,
      deltaV_capture: 0,
      P_captured: 0.8,
      peerSafetyDeltas: {},
    };
    const baseline = calculateAbilityDripGain(piece, move);
    mutateConfig('ABIL_DRIP_SCALE', 0, () => {
      expect(calculateAbilityDripGain(piece, move)).toBe(0);
      expect(calculateAbilityDripGain(piece, move)).not.toBe(baseline);
    });
  });

  it('wiring: ABIL_VINDICATION_NEAR_REFUSAL_MARGIN changes near-refusal gate', () => {
    const outcome = { utilityScore: 0.4, refusalThreshold: 0 };
    mutateConfig('ABIL_VINDICATION_NEAR_REFUSAL_MARGIN', 0.1, () => {
      expect(isNearRefusal(outcome)).toBe(false);
    });
    mutateConfig('ABIL_VINDICATION_NEAR_REFUSAL_MARGIN', 0.5, () => {
      expect(isNearRefusal(outcome)).toBe(true);
    });
  });
});

describe('wiring — desertion λ / pain / hysteresis / pivotality', () => {
  it('unit: trauma increases desertion pain', () => {
    expect(calculatePain(makePiece({ B_i: 40 }))).toBeGreaterThan(
      calculatePain(makePiece({ B_i: 0 })),
    );
  });

  it('wiring: DESERTION_PAIN_BASE and TRAUMA_SCALE change pain', () => {
    const piece = makePiece({ B_i: 20 });
    let baseZero = 0;
    let traumaHeavy = 0;
    mutateConfig('DESERTION_PAIN_BASE', 0, () => {
      baseZero = calculatePain(piece);
    });
    mutateConfig('DESERTION_PAIN_TRAUMA_SCALE', 1, () => {
      traumaHeavy = calculatePain(piece);
    });
    expect(traumaHeavy).toBeGreaterThan(baseZero);
  });

  it('wiring: each DESERTION_LAMBDA_* scale changes λ', () => {
    const piece = makePiece({
      T_i: 100,
      M_i: 100,
      traits: { ...neutralTraits, w_loyalty: 1 },
      dyadicAffinity: { 'w:P:a2': 100 },
    });
    const peers = [piece, makePiece({ id: 'w:P:a2', role: 'Pawn' })];
    const baseline = calculateLambda(piece, peers);
    for (const key of [
      'DESERTION_LAMBDA_TRUST_SCALE',
      'DESERTION_LAMBDA_MORALE_SCALE',
      'DESERTION_LAMBDA_LOYALTY_SCALE',
      'DESERTION_LAMBDA_AFFINITY_SCALE',
    ] as const) {
      mutateConfig(key, 0, () => {
        expect(calculateLambda(piece, peers)).toBeLessThan(baseline);
      });
    }
  });

  it('wiring: DESERTION_HYSTERESIS can suppress a borderline desertion', () => {
    const piece = makePiece({
      T_i: -80,
      M_i: 10,
      B_i: 80,
      traits: {
        ...neutralTraits,
        w_loyalty: 0.1,
        w_ambition: 0,
        w_prestige: 0,
      },
    });
    const peers = [piece, makePiece({ id: 'w:P:a2', role: 'Pawn' })];
    const context = makeDesertionContext({
      P_captured: 0.95,
      P_lossIfStay: 0.9,
      P_lossIfLeave: 0.2,
      pLossBoard: 0.9,
    });
    mutateConfig('DESERTION_HYSTERESIS', 0, () => {
      const eager = shouldDesert(piece, context, peers);
      mutateConfig('DESERTION_HYSTERESIS', 1_000, () => {
        const reluctant = shouldDesert(piece, context, peers);
        expect(eager.uDesert - eager.uStay).toBeGreaterThan(0);
        expect(reluctant.desert).toBe(false);
        expect(eager.desert).not.toBe(reluctant.desert);
      });
    });
  });

  it('wiring: DESERTION_PIVOTALITY_SCALE_PERMILLE scales reported pivotality', () => {
    const piece = makePiece({ role: 'Queen' });
    const peers = [
      piece,
      makePiece({ id: 'w:P:a2', role: 'Pawn' }),
      makePiece({ id: 'w:P:b2', role: 'Pawn' }),
    ];
    const raw = calculatePivotalityPermille(piece, peers);
    mutateConfig('DESERTION_PIVOTALITY_SCALE_PERMILLE', 0, () => {
      const decision = shouldDesert(piece, makeDesertionContext(), peers);
      expect(decision.terms.pivotality).toBe(0);
      expect(raw).toBeGreaterThan(0);
    });
  });

  it('wiring: DESERTION_ROLE_FORCE_WEIGHTS change pivotality', () => {
    const piece = makePiece({ role: 'Queen' });
    const peers = [piece, makePiece({ id: 'w:P:a2', role: 'Pawn' })];
    const baseline = calculatePivotalityPermille(piece, peers);
    mutateConfig(
      'DESERTION_ROLE_FORCE_WEIGHTS',
      {
        Pawn: 1,
        Knight: 3,
        Bishop: 3,
        Rook: 5,
        Queen: 1,
        King: 0,
      },
      () => {
        expect(calculatePivotalityPermille(piece, peers)).not.toBe(baseline);
      },
    );
  });

  it('wiring: DESERTION_SHADOW_SCALE_PERMILLE changes stay utility', () => {
    const piece = makePiece({ B_i: 40 });
    const context = makeDesertionContext({
      P_captured: 0.8,
      P_lossIfStay: 0.8,
      P_lossIfLeave: 0.5,
      pLossBoard: 0.8,
    });
    const peers = [piece];
    const baseline = shouldDesert(piece, context, peers).uStay;
    mutateConfig('DESERTION_SHADOW_SCALE_PERMILLE', 0, () => {
      expect(shouldDesert(piece, context, peers).uStay).not.toBe(baseline);
    });
  });
});

describe('wiring — rumor, attention, witness, heroic, fatalistic', () => {
  it('wiring: RUMOR_P_LOSS_RATE and RUMOR_LEADER_RATE change diffusion', () => {
    const speaker = makePiece({
      id: 'w:R:a1',
      role: 'Rook',
      rumor: { pLossTeam: 800, leaderAppraisal: 80 },
    });
    const listener = makePiece({
      dyadicAffinity: { 'w:R:a1': 100 },
      classPrestige: {
        Pawn: 0,
        Knight: 0,
        Bishop: 0,
        Rook: 100,
        Queen: 0,
        King: 0,
      },
      rumor: { pLossTeam: 0, leaderAppraisal: 0 },
    });
    const baseline = diffuseRumor(listener, speaker);
    mutateConfig('RUMOR_P_LOSS_RATE', 0, () => {
      expect(diffuseRumor(listener, speaker).pLossTeam).toBe(0);
      expect(diffuseRumor(listener, speaker).pLossTeam).not.toBe(
        baseline.pLossTeam,
      );
    });
    mutateConfig('RUMOR_LEADER_RATE', 0, () => {
      expect(diffuseRumor(listener, speaker).leaderAppraisal).toBe(0);
      expect(diffuseRumor(listener, speaker).leaderAppraisal).not.toBe(
        baseline.leaderAppraisal,
      );
    });
  });

  it('unit + wiring: attention decays with distance and ATTENTION_DISTANCE_DECAY', () => {
    expect(attentionWeight(0)).toBeGreaterThan(attentionWeight(4));
    const baseline = attentionWeight(2);
    mutateConfig('ATTENTION_DISTANCE_DECAY', 0.5, () => {
      expect(attentionWeight(2)).toBeLessThan(baseline);
    });
  });

  it('wiring: WITNESS_BRAVE_TRUST_LOSS and WITNESS_COWARD_AFFINITY_LOSS', () => {
    const witness = makePiece({ T_i: 50, dyadicAffinity: { 'w:N:b8': 40 } });
    const deserter = makePiece({ id: 'w:N:b8' });
    const braveMove: CandidateMoveEvaluation = {
      moveNotation: 'Nxh7',
      deltaV_board: -1,
      privateScoreCp: -100,
      vLeaderImplied: 1,
      deltaV_capture: 0,
      P_captured: 0.8,
      peerSafetyDeltas: {},
    };
    const cowardMove: CandidateMoveEvaluation = {
      ...braveMove,
      deltaV_board: 1,
    };
    let mildTrust = 0;
    let harshTrust = 0;
    mutateConfig('WITNESS_BRAVE_TRUST_LOSS', 5, () => {
      mildTrust = appraiseDesertionWitness(witness, deserter, braveMove, 1)
        .witness.T_i;
    });
    mutateConfig('WITNESS_BRAVE_TRUST_LOSS', 25, () => {
      harshTrust = appraiseDesertionWitness(witness, deserter, braveMove, 1)
        .witness.T_i;
    });
    expect(harshTrust).toBeLessThan(mildTrust);

    let mildAff = 0;
    let harshAff = 0;
    mutateConfig('WITNESS_COWARD_AFFINITY_LOSS', 5, () => {
      mildAff =
        appraiseDesertionWitness(witness, deserter, cowardMove, 1).witness
          .dyadicAffinity['w:N:b8'] ?? 0;
    });
    mutateConfig('WITNESS_COWARD_AFFINITY_LOSS', 30, () => {
      harshAff =
        appraiseDesertionWitness(witness, deserter, cowardMove, 1).witness
          .dyadicAffinity['w:N:b8'] ?? 0;
    });
    expect(harshAff).toBeLessThan(mildAff);
  });

  it('wiring: HEROIC_CAPTURE_RISK and HEROIC_BOARD_DELTA change classification', () => {
    const actor = makePiece({ T_i: 80 });
    const risky: CandidateMoveEvaluation = {
      moveNotation: 'Nxh7',
      deltaV_board: 0.5,
      privateScoreCp: 0,
      vLeaderImplied: 0.5,
      deltaV_capture: 0,
      P_captured: 0.4,
      peerSafetyDeltas: {},
    };
    mutateConfig('HEROIC_CAPTURE_RISK', 0.3, () => {
      expect(evaluateMoveResponse(actor, risky, [actor]).verdict).toBe(
        'HEROIC_EXECUTION',
      );
    });
    mutateConfig('HEROIC_CAPTURE_RISK', 0.9, () => {
      mutateConfig('HEROIC_BOARD_DELTA', 3, () => {
        expect(evaluateMoveResponse(actor, risky, [actor]).verdict).toBe(
          'COMPLIANT_EXECUTION',
        );
      });
    });
    mutateConfig('HEROIC_BOARD_DELTA', 0.2, () => {
      mutateConfig('HEROIC_CAPTURE_RISK', 0.9, () => {
        expect(evaluateMoveResponse(actor, risky, [actor]).verdict).toBe(
          'HEROIC_EXECUTION',
        );
      });
    });
  });

  it('wiring: FATALISTIC_TAU_ABIL_CEILING gates fatalistic compliance', () => {
    const actor = makePiece({
      T_i: 0,
      credence: { tauBenev: 50, tauAbil: 40, abilityObservationCount: 0 },
    });
    const move: CandidateMoveEvaluation = {
      moveNotation: 'Nxh7',
      deltaV_board: 0.5,
      privateScoreCp: 50,
      vLeaderImplied: 0.5,
      deltaV_capture: 0,
      P_captured: 0.7,
      peerSafetyDeltas: {},
    };
    mutateConfig('FATALISTIC_TAU_ABIL_CEILING', 50, () => {
      expect(evaluateMoveResponse(actor, move, [actor]).verdict).toBe(
        'FATALISTIC_COMPLIANCE',
      );
    });
    mutateConfig('FATALISTIC_TAU_ABIL_CEILING', 10, () => {
      expect(evaluateMoveResponse(actor, move, [actor]).verdict).not.toBe(
        'FATALISTIC_COMPLIANCE',
      );
    });
  });

  it('wiring: FATALISTIC witness/actor penalties change costs', () => {
    const actor = makePiece({ id: 'w:N:g1', engagementFactor: 1 });
    const witness = makePiece({ id: 'w:P:a2', role: 'Pawn', T_i: 50 });
    let mildTrust = 0;
    let harshTrust = 0;
    mutateConfig('FATALISTIC_WITNESS_TRUST_PENALTY', -5, () => {
      mildTrust =
        applyFatalisticComplianceCosts(
          [actor, witness],
          actor.id,
          1,
        ).roster.find((p) => p.id === witness.id)?.T_i ?? 0;
    });
    mutateConfig('FATALISTIC_WITNESS_TRUST_PENALTY', -30, () => {
      harshTrust =
        applyFatalisticComplianceCosts(
          [actor, witness],
          actor.id,
          1,
        ).roster.find((p) => p.id === witness.id)?.T_i ?? 0;
    });
    expect(harshTrust).toBeLessThan(mildTrust);

    let mildEng = 0;
    let harshEng = 0;
    mutateConfig('FATALISTIC_ACTOR_ENGAGEMENT_PENALTY', 0.1, () => {
      mildEng =
        applyFatalisticComplianceCosts(
          [actor, witness],
          actor.id,
          1,
        ).roster.find((p) => p.id === actor.id)?.engagementFactor ?? 0;
    });
    mutateConfig('FATALISTIC_ACTOR_ENGAGEMENT_PENALTY', 0.5, () => {
      harshEng =
        applyFatalisticComplianceCosts(
          [actor, witness],
          actor.id,
          1,
        ).roster.find((p) => p.id === actor.id)?.engagementFactor ?? 0;
    });
    expect(harshEng).toBeLessThan(mildEng);
  });
});

describe('wiring — desertion attachment weighting', () => {
  it('unit: stay attachment weight follows k at 0, 500, and 1000', () => {
    expect(calculateStayAttachmentWeightPermille(400, 0)).toBe(1_000);
    expect(calculateStayAttachmentWeightPermille(400, 500)).toBe(700);
    expect(calculateStayAttachmentWeightPermille(400, 1_000)).toBe(400);
  });

  it('wiring: stay attachment knob produces graded utility movement', () => {
    const piece = makePiece({
      T_i: -100,
      traits: { ...neutralTraits, w_loyalty: 0 },
      credence: { ...defaultCredence(), tauBenev: 0 },
    });
    const context = makeDesertionContext({
      P_captured: 0,
      P_lossIfStay: 0.5,
      P_lossIfLeave: 0.5,
    });
    const values: number[] = [];
    for (const k of [0, 500, 1_000]) {
      mutateConfig('DESERTION_STAY_ATTACHMENT_PERMILLE', k, () => {
        values.push(shouldDesert(piece, context, [piece]).uStay);
      });
    }
    const [low, middle, high] = values as [number, number, number];
    expect(low).toBeLessThan(middle);
    expect(middle).toBeLessThan(high);
  });
});

describe('wiring — desertion exit permanence', () => {
  it('unit: exit permanence is zero, partial, and full at k=0, 500, and 1000', () => {
    const piece = makePiece({ B_i: 20, T_i: -40 });
    const context = makeDesertionContext({
      P_captured: 0,
      P_lossIfStay: 0.2,
      P_lossIfLeave: 0.5,
    });
    const values: number[] = [];
    for (const k of [0, 500, 1_000]) {
      mutateConfig('DESERTION_EXIT_PERMANENCE_PERMILLE', k, () => {
        values.push(calculateUDesert(piece, context, 0, [piece]));
      });
    }
    const [none, partial, full] = values as [number, number, number];
    expect(none).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(full);
    expect(none).not.toBe(partial);
    expect(partial).not.toBe(full);
  });

  it('wiring: exit permanence changes desertion utility monotonically', () => {
    const piece = makePiece({ B_i: 20, T_i: -40 });
    const context = makeDesertionContext({
      P_captured: 0,
      P_lossIfStay: 0.2,
      P_lossIfLeave: 0.5,
    });
    const values: number[] = [];
    for (const k of [0, 250, 500, 1_000]) {
      mutateConfig('DESERTION_EXIT_PERMANENCE_PERMILLE', k, () => {
        values.push(calculateUDesert(piece, context, 0, [piece]));
      });
    }
    expect(values).toEqual([...values].sort((left, right) => right - left));
    expect(new Set(values).size).toBe(4);
  });
});

describe('wiring — private evaluation', () => {
  it('unit: PRIVATE_EVAL_TRAUMA_DRIFT stays off by default', () => {
    expect(ENGINE_CONFIG.PRIVATE_EVAL_TRAUMA_DRIFT).toBe(false);
  });

  it('wiring: PRIVATE_EVAL_TRAUMA_DRIFT changes the profile', () => {
    const piece = makePiece({ B_i: 40 });
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/6N1/4K3 w - - 0 1');
    const baseline = evalProfileFor(piece, board);
    let drifted: ReturnType<typeof evalProfileFor> | undefined;
    mutateConfig('PRIVATE_EVAL_TRAUMA_DRIFT', true, () => {
      drifted = evalProfileFor(piece, board);
    });
    expect(drifted?.['weight:ownSafety']).not.toBe(
      baseline['weight:ownSafety'],
    );
    expect(drifted?.['weight:ownSafety'] ?? 0).toBeGreaterThan(
      baseline['weight:ownSafety'] ?? 0,
    );
  });
});

describe('wiring — PieceTraits', () => {
  const protectiveMove: CandidateMoveEvaluation = {
    moveNotation: 'Nd5',
    deltaV_board: 0.2,
    privateScoreCp: 0,
    vLeaderImplied: 0.2,
    deltaV_capture: 0.5,
    P_captured: 0.4,
    peerSafetyDeltas: { 'w:P:e2': 1.0 },
  };
  const peer = makePiece({ id: 'w:P:e2', role: 'Pawn' });

  it('wiring: w_courage reduces risk penalty in utility', () => {
    const timid = makePiece({ traits: { ...neutralTraits, w_courage: 0 } });
    const brave = makePiece({ traits: { ...neutralTraits, w_courage: 1 } });
    expect(
      calculateMoveUtility(brave, protectiveMove, [brave, peer]),
    ).toBeGreaterThan(
      calculateMoveUtility(timid, protectiveMove, [timid, peer]),
    );
  });

  it('wiring: w_empathy enables protective term', () => {
    const cold = makePiece({
      traits: { ...neutralTraits, w_empathy: 0 },
      dyadicAffinity: { 'w:P:e2': 100 },
    });
    const warm = makePiece({
      traits: { ...neutralTraits, w_empathy: 1 },
      dyadicAffinity: { 'w:P:e2': 100 },
    });
    expect(
      calculateMoveUtility(warm, protectiveMove, [warm, peer]),
    ).toBeGreaterThan(calculateMoveUtility(cold, protectiveMove, [cold, peer]));
  });

  it('wiring: w_honor and w_ambition change utility terms', () => {
    const base = makePiece();
    const honorable = makePiece({ traits: { ...neutralTraits, w_honor: 1 } });
    const ambitious = makePiece({
      traits: { ...neutralTraits, w_ambition: 1 },
    });
    expect(
      calculateMoveUtility(honorable, protectiveMove, [honorable, peer]),
    ).not.toBe(calculateMoveUtility(base, protectiveMove, [base, peer]));
    expect(
      calculateMoveUtility(ambitious, protectiveMove, [ambitious, peer]),
    ).not.toBe(calculateMoveUtility(base, protectiveMove, [base, peer]));
  });

  it('wiring: w_prestige reaches inter-piece protection (D20)', () => {
    const without = calculateInterPieceProtection(1, 0, 0, 100, 1);
    const withPrestige = calculateInterPieceProtection(1, 1, 0, 100, 1);
    expect(withPrestige).toBeGreaterThan(without);
  });

  it('wiring: w_loyalty changes desertion λ', () => {
    const peers = [makePiece({ id: 'w:P:a2', role: 'Pawn' })];
    const loyal = makePiece({ traits: { ...neutralTraits, w_loyalty: 1 } });
    const disloyal = makePiece({ traits: { ...neutralTraits, w_loyalty: 0 } });
    expect(calculateLambda(loyal, [loyal, ...peers])).toBeGreaterThan(
      calculateLambda(disloyal, [disloyal, ...peers]),
    );
  });
});
