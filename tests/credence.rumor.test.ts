import { describe, expect, it } from 'vitest';

import {
  ENGINE_CONFIG,
  defaultCredence,
  defaultRumor,
  effectiveAbilityCredence,
  evaluateMoveResponse,
  normalizePieceState,
  type CandidateMoveEvaluation,
  type PieceState,
} from '../src/psychology';

function withAppraisalWeight<T>(weight: number, run: () => T): T {
  const config = ENGINE_CONFIG as unknown as {
    RUMOR_APPRAISAL_ABIL_WEIGHT: number;
  };
  const original = config.RUMOR_APPRAISAL_ABIL_WEIGHT;
  try {
    config.RUMOR_APPRAISAL_ABIL_WEIGHT = weight;
    return run();
  } finally {
    config.RUMOR_APPRAISAL_ABIL_WEIGHT = original;
  }
}

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
    engagementFactor: 1,
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
    deltaV_board: -1,
    privateScoreCp: 0,
    vLeaderImplied: 1,
    deltaV_capture: 0,
    P_captured: 0.1,
    peerSafetyDeltas: {},
    promotionProspect: 0,
    ...overrides,
  };
}

describe('effective ability credence', () => {
  it('is identity when the appraisal weight is zero', () => {
    withAppraisalWeight(0, () => {
      expect(effectiveAbilityCredence(37, 100)).toBe(37);
      expect(effectiveAbilityCredence(37, -100)).toBe(37);
    });
  });

  it('raises and lowers ability credence with signed appraisal', () => {
    withAppraisalWeight(50, () => {
      expect(effectiveAbilityCredence(50, 100)).toBeGreaterThan(50);
      expect(effectiveAbilityCredence(50, -100)).toBeLessThan(50);
    });
  });

  it('clamps both ends and always returns an integer', () => {
    withAppraisalWeight(100, () => {
      expect(effectiveAbilityCredence(95, 100)).toBe(100);
      expect(effectiveAbilityCredence(5, -100)).toBe(0);
      expect(Number.isInteger(effectiveAbilityCredence(51, 33))).toBe(true);
    });
  });
});

describe('D169 verdict wiring', () => {
  it('uses leader appraisal in perceived value and verdict', () => {
    const actor = makePiece({
      T_i: 0,
      rumor: { ...defaultRumor(), leaderAppraisal: -100 },
    });
    const move = makeMove();

    // An end-to-end sim probe is impossible until D168 writes non-zero
    // leaderAppraisal; diffusion currently spreads zeros from one cascade site.
    const baseline = withAppraisalWeight(0, () =>
      evaluateMoveResponse(actor, move, [actor]),
    );
    const wired = withAppraisalWeight(100, () =>
      evaluateMoveResponse(actor, move, [actor]),
    );

    expect(wired.perceivedValue).toBeLessThan(baseline.perceivedValue);
    expect(wired.verdict).not.toBe(baseline.verdict);
  });
});
