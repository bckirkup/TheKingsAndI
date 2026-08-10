import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/core/canonicalJson';
import { createSeededRandom } from '../src/core/random';
import {
  ENGINE_CONFIG,
  applyBetrayalSignal,
  applyAuthorityLoss,
  applyAbilityObservation,
  applyCostlySignal,
  applyHeardSignal,
  applyMatchOutcomeTrust,
  applyOverride,
  applyWitnessedSacrificeEvent,
  calculatePerceivedValue,
  calculateUDesert,
  calculateUStay,
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
import { applyRefusalAuthorityCost } from '../src/orchestration/psychologyHooks';

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

function makeMove(
  overrides: Partial<CandidateMoveEvaluation> = {},
): CandidateMoveEvaluation {
  return {
    moveNotation: 'Nf3',
    deltaV_board: 0.2,
    vLeaderImplied: 0.5,
    deltaV_capture: 0,
    P_captured: 0.1,
    peerSafetyDeltas: {},
    ...overrides,
  };
}

describe('psychology invariants (docs/psychology_engine.md §11)', () => {
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
  it('uses the configured collective stake in pain units (golden)', () => {
    const piece = makePiece({ T_i: 50, M_i: 80, B_i: 0 });
    const context: DesertionContext = {
      P_captured: 0.25,
      P_lossIfStay: 0.1,
      P_lossIfLeave: 0.6,
    };
    const lambda = 0.64;

    expect(calculateUStay(piece, context, lambda)).toBe(-5.7);
    expect(calculateUDesert(piece, context, lambda, [piece])).toBe(-5.76);
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
    };

    expect(calculateUDesert(piece, context, 0.64, [piece, peer])).toBe(-8.26);
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
    };

    const firstDeserter = calculateUDesert(piece, context, 0.64, [
      piece,
      ...peers,
    ]);
    const lateDeserter = calculateUDesert(piece, context, 0.64, [
      piece,
      ...peers.slice(0, 1),
    ]);

    expect(firstDeserter).toBe(-43.26);
    expect(lateDeserter).toBe(-8.26);
    expect(lateDeserter).toBeGreaterThan(firstDeserter);
  });

  it('changes the desertion decision when collective stake changes (sensitivity)', () => {
    const piece = makePiece({ T_i: 50, M_i: 80, B_i: 0 });
    const context: DesertionContext = {
      P_captured: 0.25,
      P_lossIfStay: 0.1,
      P_lossIfLeave: 0.6,
    };
    const config = ENGINE_CONFIG as { DESERTION_COLLECTIVE_STAKE: number };
    const baseline = shouldDesert(piece, context, [piece]);
    const original = config.DESERTION_COLLECTIVE_STAKE;
    try {
      config.DESERTION_COLLECTIVE_STAKE = 0.3;
      const lowStake = shouldDesert(piece, context, [piece]);
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
    expect(observed.tauAbil).toBe(40);
    expect(observed.abilityObservationCount).toBe(1);
  });

  it('moves the saturation ply when prior strength changes', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.ABIL_PRIOR_STRENGTH ?? 10;
    const saturationPly = (): number => {
      let state = defaultCredence();
      for (let ply = 1; ply <= 150; ply += 1) {
        state = applyAbilityObservation(state, false);
        if (state.tauAbil === 0) return ply;
      }
      return 0;
    };
    try {
      config.ABIL_PRIOR_STRENGTH = 10;
      const defaultSaturation = saturationPly();
      config.ABIL_PRIOR_STRENGTH = 20;
      const changedSaturation = saturationPly();
      expect(defaultSaturation).toBeGreaterThan(0);
      expect(changedSaturation).toBeGreaterThan(0);
      expect(defaultSaturation).not.toBe(changedSaturation);
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
