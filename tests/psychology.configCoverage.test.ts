/**
 * Golden anchors + configuration sensitivity probes for ENGINE_CONFIG knobs
 * that were previously uncovered (AGENTS.md rule 6 / ci-test-design skill).
 */
import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { evalProfileFor } from '../src/orchestration/privateEvaluation';
import {
  ENGINE_CONFIG,
  applyBetrayalSignal,
  applyCostlySignal,
  costlySignalCredit,
  applyFatalisticComplianceCosts,
  applyHeardSignal,
  applyNeglectSignal,
  applyOverride,
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

describe('ENGINE_CONFIG coverage — depth & engagement', () => {
  it('golden: (E=1, η=0.1) floors at MIN_SEARCH_DEPTH', () => {
    expect(calculateEngineSearchDepth(1, 0.1)).toBe(2);
  });

  it('sensitivity: MIN_SEARCH_DEPTH changes rookie depth', () => {
    const baseline = calculateEngineSearchDepth(1, 1.0);
    const tuned = calculateEngineSearchDepth(1, 1.0, 6, 16);
    expect(baseline).toBe(2);
    expect(tuned).toBe(6);
    expect(tuned).not.toBe(baseline);
  });

  it('golden + sensitivity: DESERTION_ENGAGEMENT is the mutiny engagement factor', () => {
    expect(ENGINE_CONFIG.DESERTION_ENGAGEMENT).toBe(0.1);
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
    mutateConfig('DESERTION_ENGAGEMENT', 0.05, () => {
      const outcome = evaluateMoveResponse(
        actor,
        {
          moveNotation: 'Nxh7',
          deltaV_board: -2,
          privateScoreCp: -800,
          vLeaderImplied: 1,
          deltaV_capture: 0,
          P_captured: 0.99,
          peerSafetyDeltas: {},
        },
        peers,
        context,
      );
      expect(outcome.verdict).toBe('DESERTION_MUTINY');
      expect(outcome.engagementFactor).toBe(0.05);
    });
  });
});

describe('ENGINE_CONFIG coverage — benching & leadership', () => {
  it('golden: default benching penalties match ENGINE_CONFIG', () => {
    expect(ENGINE_CONFIG.DEFAULT_BENCHING_SELF_PENALTY).toBe(-30);
    expect(ENGINE_CONFIG.DEFAULT_BENCHING_PEER_BASE_PENALTY).toBe(-10);
    const benched = makePiece({ T_i: 40 });
    const peer = makePiece({
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
      traits: { ...neutralTraits, w_empathy: 1 },
    });
    const result = calculateBenchingTrustPenalties(benched, [peer]);
    expect(result.benchedPieceNewTrust).toBe(10);
    expect(result.updatedPeers[0]?.T_i).toBe(20);
  });

  it('sensitivity: DEFAULT_BENCHING_SELF_PENALTY scales the benched trust drop', () => {
    const benched = makePiece({ T_i: 40 });
    mutateConfig('DEFAULT_BENCHING_SELF_PENALTY', -5, () => {
      expect(
        calculateBenchingTrustPenalties(benched, []).benchedPieceNewTrust,
      ).toBe(35);
    });
    mutateConfig('DEFAULT_BENCHING_SELF_PENALTY', -50, () => {
      expect(
        calculateBenchingTrustPenalties(benched, []).benchedPieceNewTrust,
      ).toBe(-10);
    });
  });

  it('sensitivity: DEFAULT_BENCHING_PEER_BASE_PENALTY scales peer trust drop', () => {
    const benched = makePiece({ T_i: 40 });
    const peer = makePiece({
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
    });
    mutateConfig('DEFAULT_BENCHING_PEER_BASE_PENALTY', -1, () => {
      expect(
        calculateBenchingTrustPenalties(benched, [peer]).updatedPeers[0]?.T_i,
      ).toBe(39);
    });
    mutateConfig('DEFAULT_BENCHING_PEER_BASE_PENALTY', -40, () => {
      expect(
        calculateBenchingTrustPenalties(benched, [peer]).updatedPeers[0]?.T_i,
      ).toBe(0);
    });
  });

  it('golden + sensitivity: LEADERSHIP_WEIGHTS change the index', () => {
    expect(ENGINE_CONFIG.LEADERSHIP_WEIGHTS.alpha).toBe(0.4);
    const baseline = calculateSingleMatchLeadershipIndex(50, 100, 10, 5);
    expect(baseline).toBeCloseTo(0.4 * 50 + 0.3 * 100 - 0.2 * 10 - 0.1 * 5, 5);
    const tuned = calculateSingleMatchLeadershipIndex(50, 100, 10, 5, {
      alpha: 0.1,
      beta: 0.1,
      gamma: 0.1,
      delta: 0.1,
    } as unknown as typeof ENGINE_CONFIG.LEADERSHIP_WEIGHTS);
    expect(tuned).not.toBe(baseline);
  });
});

describe('ENGINE_CONFIG coverage — sacrifice & clamp', () => {
  it('golden: repeated heroic sacrifice clamps affinity and prestige at ±100', () => {
    let observer = makePiece({ id: 'w:P:a2', role: 'Pawn' });
    const hero = makePiece();
    for (let i = 0; i < 5; i += 1) {
      observer = applyWitnessedSacrificeEvent(observer, hero);
    }
    expect(observer.dyadicAffinity[hero.id]).toBe(100);
    expect(observer.classPrestige.Knight).toBe(100);
  });

  it('sensitivity: DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE=0 freezes affinity', () => {
    const observer = makePiece({ id: 'w:P:a2', role: 'Pawn' });
    const hero = makePiece();
    mutateConfig('DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE', 0, () => {
      const next = applyWitnessedSacrificeEvent(observer, hero);
      expect(next.dyadicAffinity[hero.id] ?? 0).toBe(0);
    });
  });

  it('sensitivity: DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE=0 freezes class prestige', () => {
    const observer = makePiece({ id: 'w:P:a2', role: 'Pawn' });
    const hero = makePiece();
    mutateConfig('DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE', 0, () => {
      const next = applyWitnessedSacrificeEvent(observer, hero);
      expect(next.classPrestige.Knight).toBe(0);
    });
  });
});

describe('ENGINE_CONFIG coverage — override penalties', () => {
  it('golden: override applies configured trust/trauma/witness deltas', () => {
    const piece = makePiece({ T_i: 50, B_i: 10 });
    const witness = makePiece({ id: 'w:P:a2', role: 'Pawn', T_i: 50 });
    const result = applyOverride(piece, [witness], 1, 'Nf3');
    expect(result.overriddenPiece.T_i).toBe(
      50 + ENGINE_CONFIG.OVERRIDE_PIECE_TRUST_PENALTY,
    );
    expect(result.overriddenPiece.B_i).toBe(
      10 + ENGINE_CONFIG.OVERRIDE_PIECE_TRAUMA_GAIN,
    );
    expect(result.witnesses[0]?.T_i).toBe(
      50 + ENGINE_CONFIG.OVERRIDE_WITNESS_TRUST_PENALTY,
    );
  });

  it('sensitivity: OVERRIDE_PIECE_TRUST_PENALTY changes the actor trust drop', () => {
    const piece = makePiece({ T_i: 50 });
    mutateConfig('OVERRIDE_PIECE_TRUST_PENALTY', -10, () => {
      expect(applyOverride(piece, [], 1, 'Nf3').overriddenPiece.T_i).toBe(40);
    });
    mutateConfig('OVERRIDE_PIECE_TRUST_PENALTY', -70, () => {
      expect(applyOverride(piece, [], 1, 'Nf3').overriddenPiece.T_i).toBe(-20);
    });
  });

  it('sensitivity: OVERRIDE_PIECE_TRAUMA_GAIN changes trauma', () => {
    const piece = makePiece({ B_i: 0 });
    mutateConfig('OVERRIDE_PIECE_TRAUMA_GAIN', 5, () => {
      expect(applyOverride(piece, [], 1, 'Nf3').overriddenPiece.B_i).toBe(5);
    });
    mutateConfig('OVERRIDE_PIECE_TRAUMA_GAIN', 40, () => {
      expect(applyOverride(piece, [], 1, 'Nf3').overriddenPiece.B_i).toBe(40);
    });
  });

  it('sensitivity: OVERRIDE_WITNESS_TRUST_PENALTY changes witness trust', () => {
    const piece = makePiece();
    const witness = makePiece({ id: 'w:P:a2', role: 'Pawn', T_i: 50 });
    mutateConfig('OVERRIDE_WITNESS_TRUST_PENALTY', -2, () => {
      expect(applyOverride(piece, [witness], 1, 'Nf3').witnesses[0]?.T_i).toBe(
        48,
      );
    });
    mutateConfig('OVERRIDE_WITNESS_TRUST_PENALTY', -20, () => {
      expect(applyOverride(piece, [witness], 1, 'Nf3').witnesses[0]?.T_i).toBe(
        30,
      );
    });
  });

  it('sensitivity: OVERRIDE_BENEV_CLIFF_INPUT changes benevolence drop', () => {
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

describe('ENGINE_CONFIG coverage — costly signals', () => {
  it('golden: each COSTLY_SIGNAL_* credit matches config', () => {
    const piece = makePiece({ T_i: 0 });
    expect(costlySignalCredit('king_endangerment')).toBe(
      ENGINE_CONFIG.COSTLY_SIGNAL_KING_DANGER,
    );
    expect(costlySignalCredit('declined_sacrifice')).toBe(
      ENGINE_CONFIG.COSTLY_SIGNAL_DECLINED_SACRIFICE,
    );
    expect(costlySignalCredit('retained_piece')).toBe(
      ENGINE_CONFIG.COSTLY_SIGNAL_RETAINED_PIECE,
    );
    expect(costlySignalCredit('avenged_capture')).toBe(
      ENGINE_CONFIG.COSTLY_SIGNAL_AVENGED_CAPTURE,
    );
    expect(applyCostlySignal(piece, 'king_endangerment', 1).piece.T_i).toBe(
      ENGINE_CONFIG.COSTLY_SIGNAL_KING_DANGER,
    );
  });

  it('sensitivity: zeroing COSTLY_SIGNAL_KING_DANGER removes the credit', () => {
    const piece = makePiece({ T_i: 0 });
    mutateConfig('COSTLY_SIGNAL_KING_DANGER', 0, () => {
      const result = applyCostlySignal(piece, 'king_endangerment', 1);
      expect(result.piece.T_i).toBe(0);
      expect(costlySignalCredit('king_endangerment')).toBe(0);
    });
  });

  it('sensitivity: COSTLY_SIGNAL_DECLINED_SACRIFICE scales the credit', () => {
    const piece = makePiece({ T_i: 0 });
    mutateConfig('COSTLY_SIGNAL_DECLINED_SACRIFICE', 40, () => {
      expect(applyCostlySignal(piece, 'declined_sacrifice', 1).piece.T_i).toBe(
        40,
      );
    });
  });

  it('sensitivity: COSTLY_SIGNAL_RETAINED_PIECE and AVENGED_CAPTURE scale', () => {
    const piece = makePiece({ T_i: 0 });
    mutateConfig('COSTLY_SIGNAL_RETAINED_PIECE', 0, () => {
      expect(applyCostlySignal(piece, 'retained_piece', 1).piece.T_i).toBe(0);
    });
    mutateConfig('COSTLY_SIGNAL_AVENGED_CAPTURE', 30, () => {
      expect(applyCostlySignal(piece, 'avenged_capture', 1).piece.T_i).toBe(30);
    });
  });
});

describe('ENGINE_CONFIG coverage — benevolence & ability knobs', () => {
  it('golden + sensitivity: BENEV_HEARD_STEP', () => {
    expect(ENGINE_CONFIG.BENEV_HEARD_STEP).toBe(15);
    const before = defaultCredence();
    expect(applyHeardSignal(before, true).tauBenev).toBe(before.tauBenev + 15);
    mutateConfig('BENEV_HEARD_STEP', 5, () => {
      expect(applyHeardSignal(before, true).tauBenev).toBe(before.tauBenev + 5);
    });
  });

  it('sensitivity: BENEV_BETRAYAL_CLIFF_SCALE and DROP change betrayal drop', () => {
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

  it('golden + sensitivity: BENEV_NEGLECT_EROSION', () => {
    expect(ENGINE_CONFIG.BENEV_NEGLECT_EROSION).toBe(3);
    const before = { ...defaultCredence(), tauBenev: 50 };
    expect(applyNeglectSignal(before).tauBenev).toBe(47);
    mutateConfig('BENEV_NEGLECT_EROSION', 10, () => {
      expect(applyNeglectSignal(before).tauBenev).toBe(40);
    });
  });

  it('sensitivity: BENEV_EXPENDABLE_FLOOR and GAP gate expendable refusal', () => {
    mutateConfig('BENEV_EXPENDABLE_FLOOR', 10, () => {
      mutateConfig('BENEV_EXPENDABLE_GAP', 3, () => {
        expect(isExpendableRefusal(-1, 2.5, 5)).toBe(false);
        expect(isExpendableRefusal(-1, 3, 5)).toBe(true);
      });
    });
  });

  it('sensitivity: ABIL_BAYES_NUMERATOR changes observation step size', () => {
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

  it('sensitivity: ABIL_DRIP_SCALE changes drip gain magnitude', () => {
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

  it('sensitivity: ABIL_VINDICATION_NEAR_REFUSAL_MARGIN changes near-refusal gate', () => {
    const outcome = { utilityScore: 0.4, refusalThreshold: 0 };
    mutateConfig('ABIL_VINDICATION_NEAR_REFUSAL_MARGIN', 0.1, () => {
      expect(isNearRefusal(outcome)).toBe(false);
    });
    mutateConfig('ABIL_VINDICATION_NEAR_REFUSAL_MARGIN', 0.5, () => {
      expect(isNearRefusal(outcome)).toBe(true);
    });
  });
});

describe('ENGINE_CONFIG coverage — desertion λ / pain / hysteresis / pivotality', () => {
  it('golden: pain uses DESERTION_PAIN_BASE and trauma scale', () => {
    expect(ENGINE_CONFIG.DESERTION_PAIN_BASE).toBe(10);
    expect(ENGINE_CONFIG.DESERTION_PAIN_TRAUMA_SCALE).toBe(0.5);
    expect(calculatePain(makePiece({ B_i: 20 }))).toBe(20);
  });

  it('sensitivity: DESERTION_PAIN_BASE and TRAUMA_SCALE change pain', () => {
    const piece = makePiece({ B_i: 20 });
    mutateConfig('DESERTION_PAIN_BASE', 0, () => {
      expect(calculatePain(piece)).toBe(10);
    });
    mutateConfig('DESERTION_PAIN_TRAUMA_SCALE', 1, () => {
      expect(calculatePain(piece)).toBe(30);
    });
  });

  it('sensitivity: each DESERTION_LAMBDA_* scale changes λ', () => {
    const piece = makePiece({
      T_i: 100,
      M_i: 100,
      traits: { ...neutralTraits, w_loyalty: 1 },
      dyadicAffinity: { 'w:P:a2': 100 },
    });
    const peers = [piece, makePiece({ id: 'w:P:a2', role: 'Pawn' })];
    const baseline = calculateLambda(piece, peers);
    mutateConfig('DESERTION_LAMBDA_TRUST_SCALE', 0, () => {
      expect(calculateLambda(piece, peers)).toBeLessThan(baseline);
    });
    mutateConfig('DESERTION_LAMBDA_MORALE_SCALE', 0, () => {
      expect(calculateLambda(piece, peers)).toBeLessThan(baseline);
    });
    mutateConfig('DESERTION_LAMBDA_LOYALTY_SCALE', 0, () => {
      expect(calculateLambda(piece, peers)).toBeLessThan(baseline);
    });
    mutateConfig('DESERTION_LAMBDA_AFFINITY_SCALE', 0, () => {
      expect(calculateLambda(piece, peers)).toBeLessThan(baseline);
    });
  });

  it('sensitivity: DESERTION_HYSTERESIS can suppress a borderline desertion', () => {
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

  it('sensitivity: DESERTION_PIVOTALITY_SCALE_PERMILLE scales reported pivotality', () => {
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

  it('sensitivity: DESERTION_ROLE_FORCE_WEIGHTS change pivotality', () => {
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

  it('sensitivity: DESERTION_SHADOW_SCALE_PERMILLE changes stay utility', () => {
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

describe('ENGINE_CONFIG coverage — rumor, attention, witness, heroic, fatalistic', () => {
  it('sensitivity: RUMOR_P_LOSS_RATE and RUMOR_LEADER_RATE change diffusion', () => {
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

  it('golden + sensitivity: ATTENTION_DISTANCE_DECAY', () => {
    expect(ENGINE_CONFIG.ATTENTION_DISTANCE_DECAY).toBe(0.15);
    expect(attentionWeight(0)).toBe(1);
    expect(attentionWeight(4)).toBeCloseTo(0.4, 5);
    mutateConfig('ATTENTION_DISTANCE_DECAY', 0.5, () => {
      expect(attentionWeight(2)).toBe(0.1);
    });
  });

  it('sensitivity: WITNESS_BRAVE_TRUST_LOSS and WITNESS_COWARD_AFFINITY_LOSS', () => {
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
    mutateConfig('WITNESS_BRAVE_TRUST_LOSS', 25, () => {
      expect(
        appraiseDesertionWitness(witness, deserter, braveMove, 1).witness.T_i,
      ).toBe(25);
    });
    mutateConfig('WITNESS_COWARD_AFFINITY_LOSS', 10, () => {
      expect(
        appraiseDesertionWitness(witness, deserter, cowardMove, 1).witness
          .dyadicAffinity['w:N:b8'],
      ).toBe(30);
    });
  });

  it('sensitivity: HEROIC_CAPTURE_RISK and HEROIC_BOARD_DELTA change classification', () => {
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

  it('sensitivity: FATALISTIC_TAU_ABIL_CEILING gates fatalistic compliance', () => {
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

  it('sensitivity: FATALISTIC witness/actor penalties change costs', () => {
    const actor = makePiece({ id: 'w:N:g1', engagementFactor: 1 });
    const witness = makePiece({ id: 'w:P:a2', role: 'Pawn', T_i: 50 });
    mutateConfig('FATALISTIC_WITNESS_TRUST_PENALTY', -30, () => {
      const result = applyFatalisticComplianceCosts(
        [actor, witness],
        actor.id,
        1,
      );
      expect(result.roster.find((p) => p.id === witness.id)?.T_i).toBe(20);
    });
    mutateConfig('FATALISTIC_ACTOR_ENGAGEMENT_PENALTY', 0.5, () => {
      const result = applyFatalisticComplianceCosts(
        [actor, witness],
        actor.id,
        1,
      );
      expect(
        result.roster.find((p) => p.id === actor.id)?.engagementFactor,
      ).toBe(0.5);
    });
  });
});

describe('ENGINE_CONFIG coverage — private evaluation', () => {
  it('golden: PRIVATE_EVAL_TRAUMA_DRIFT export keeps drift off by default', () => {
    const piece = makePiece({ B_i: 40 });
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/6N1/4K3 w - - 0 1');
    expect(ENGINE_CONFIG.PRIVATE_EVAL_TRAUMA_DRIFT).toBe(false);
    expect(evalProfileFor(piece, board)['weight:ownSafety']).toBe(675);
  });

  it('sensitivity: PRIVATE_EVAL_TRAUMA_DRIFT export changes the profile', () => {
    const piece = makePiece({ B_i: 40 });
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/6N1/4K3 w - - 0 1');
    const baseline = evalProfileFor(piece, board);
    let drifted: ReturnType<typeof evalProfileFor> | undefined;
    mutateConfig('PRIVATE_EVAL_TRAUMA_DRIFT', true, () => {
      drifted = evalProfileFor(piece, board);
    });
    expect(drifted?.['weight:ownSafety']).toBe(945);
    expect(drifted?.['weight:ownSafety']).not.toBe(
      baseline['weight:ownSafety'],
    );
  });
});

describe('PieceTraits sensitivity (testing_strategy §3)', () => {
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

  it('sensitivity: w_courage reduces risk penalty in utility', () => {
    const timid = makePiece({
      traits: { ...neutralTraits, w_courage: 0 },
    });
    const brave = makePiece({
      traits: { ...neutralTraits, w_courage: 1 },
    });
    expect(
      calculateMoveUtility(brave, protectiveMove, [brave, peer]),
    ).toBeGreaterThan(
      calculateMoveUtility(timid, protectiveMove, [timid, peer]),
    );
  });

  it('sensitivity: w_empathy enables protective term', () => {
    const cold = makePiece({
      traits: { ...neutralTraits, w_empathy: 0 },
      dyadicAffinity: { 'w:P:e2': 100 },
    });
    const warm = makePiece({
      traits: { ...neutralTraits, w_empathy: 1 },
      dyadicAffinity: { 'w:P:e2': 100 },
    });
    expect(calculateMoveUtility(cold, protectiveMove, [cold, peer])).toBe(
      calculateMoveUtility(
        makePiece({ traits: { ...neutralTraits, w_empathy: 0 } }),
        { ...protectiveMove, peerSafetyDeltas: {} },
        [cold],
      ),
    );
    expect(
      calculateMoveUtility(warm, protectiveMove, [warm, peer]),
    ).toBeGreaterThan(calculateMoveUtility(cold, protectiveMove, [cold, peer]));
  });

  it('sensitivity: w_honor and w_ambition change utility terms', () => {
    const base = makePiece();
    const honorable = makePiece({
      traits: { ...neutralTraits, w_honor: 1 },
    });
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

  it('sensitivity: w_prestige wires into inter-piece protection (D20 regression)', () => {
    const without = calculateInterPieceProtection(1, 0, 0, 100, 1);
    const withPrestige = calculateInterPieceProtection(1, 1, 0, 100, 1);
    expect(withPrestige).toBeGreaterThan(without);
    expect(withPrestige).toBeCloseTo(0.5, 5);
  });

  it('sensitivity: w_loyalty changes desertion λ', () => {
    const peers = [makePiece({ id: 'w:P:a2', role: 'Pawn' })];
    const loyal = makePiece({ traits: { ...neutralTraits, w_loyalty: 1 } });
    const disloyal = makePiece({ traits: { ...neutralTraits, w_loyalty: 0 } });
    expect(calculateLambda(loyal, [loyal, ...peers])).toBeGreaterThan(
      calculateLambda(disloyal, [disloyal, ...peers]),
    );
  });
});
