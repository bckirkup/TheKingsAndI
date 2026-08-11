import { describe, expect, it } from 'vitest';

import {
  ENGINE_CONFIG,
  applyFatalisticComplianceCosts,
  defaultCredence,
  defaultRumor,
  evaluateMoveResponse,
  isFatalisticCompliance,
  normalizePieceState,
  type CandidateMoveEvaluation,
  type PieceState,
} from '../src/psychology';
import {
  assertDifficultyIsLeaderPolicy,
  trackEnemyIdentities,
} from '../src/orchestration/enemyTurn';
import {
  CAMPAIGN_CONFIG,
  kingDepthForAppointment,
} from '../src/orchestration/campaignConfig';
import {
  evaluateDismissal,
  selectSuccessorLeader,
  shouldDismissByKing,
  thinRosterForDiminishedAppointment,
  updateKingTauAbil,
} from '../src/orchestration/campaignPolicy';

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
    T_i: -10,
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
    credence: { ...defaultCredence(), tauAbil: 20 },
    rumor: defaultRumor(),
    ...overrides,
  });
}

function makeMove(
  overrides: Partial<CandidateMoveEvaluation> = {},
): CandidateMoveEvaluation {
  return {
    moveNotation: 'Nf3',
    deltaV_board: 0.5,
    privateScoreCp: 0,
    vLeaderImplied: 0.5,
    deltaV_capture: 0,
    P_captured: 0.7,
    peerSafetyDeltas: {},
    ...overrides,
  };
}

describe('FATALISTIC_COMPLIANCE (ADR 0024)', () => {
  it('fires when quiet-quit conditions meet high capture risk and low tauAbil', () => {
    const actor = makePiece();
    const move = makeMove();
    expect(isFatalisticCompliance(actor, move)).toBe(true);
    const outcome = evaluateMoveResponse(actor, move, [actor]);
    expect(outcome.verdict).toBe('FATALISTIC_COMPLIANCE');
    expect(outcome.engagementFactor).toBe(ENGINE_CONFIG.FULL_ENGAGEMENT);
  });

  it('is sensitive to FATALISTIC_CAPTURE_RISK', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.FATALISTIC_CAPTURE_RISK ?? 0.55;
    const actor = makePiece();
    const move = makeMove({ P_captured: 0.6 });
    try {
      config.FATALISTIC_CAPTURE_RISK = 0.9;
      expect(evaluateMoveResponse(actor, move, [actor]).verdict).toBe(
        'QUIET_QUITTING',
      );
      config.FATALISTIC_CAPTURE_RISK = 0.5;
      expect(evaluateMoveResponse(actor, move, [actor]).verdict).toBe(
        'FATALISTIC_COMPLIANCE',
      );
    } finally {
      config.FATALISTIC_CAPTURE_RISK = original;
    }
  });

  it('costs witnesses and future willingness, not the move', () => {
    const actor = makePiece({ id: 'actor' });
    const witness = makePiece({ id: 'witness', T_i: 40 });
    const result = applyFatalisticComplianceCosts([actor, witness], 'actor', 3);
    expect(
      result.events.some((event) => event.t === 'FATALISTIC_WITNESS'),
    ).toBe(true);
    const nextActor = result.roster.find((piece) => piece.id === 'actor');
    const nextWitness = result.roster.find((piece) => piece.id === 'witness');
    expect(nextActor?.engagementFactor).toBeLessThan(1);
    expect(nextWitness?.T_i).toBeLessThan(40);
  });
});

describe('King results channel and diminished act (ADR 0024)', () => {
  it('dismisses by the King when results collapse with high room mandate', () => {
    const roster = [makePiece({ T_i: 60 }), makePiece({ id: 'b', T_i: 55 })];
    expect(shouldDismissByKing(10)).toBe(true);
    const decision = evaluateDismissal(roster, 10);
    expect(decision).toEqual({
      dismiss: true,
      cause: 'dismissed_by_king',
    });
  });

  it('is sensitive to KING_DISMISSAL_TAU_ABIL', () => {
    const config = CAMPAIGN_CONFIG as unknown as Record<string, number>;
    const original = config.KING_DISMISSAL_TAU_ABIL ?? 15;
    try {
      config.KING_DISMISSAL_TAU_ABIL = 5;
      expect(shouldDismissByKing(10)).toBe(false);
      config.KING_DISMISSAL_TAU_ABIL = 20;
      expect(shouldDismissByKing(10)).toBe(true);
    } finally {
      config.KING_DISMISSAL_TAU_ABIL = original;
    }
  });

  it('updates kingTauAbil from realized quality', () => {
    expect(updateKingTauAbil(50, 80)).toBeGreaterThan(50);
    expect(updateKingTauAbil(50, 20)).toBeLessThan(50);
  });

  it('thins the roster and lowers king depth on diminished appointments', () => {
    const roster = Array.from({ length: 16 }, (_, index) =>
      makePiece({ id: `p${index}`, T_i: index }),
    );
    const thinned = thinRosterForDiminishedAppointment(roster);
    expect(thinned.length).toBe(CAMPAIGN_CONFIG.DIMINISHED_ROSTER_CAP);
    expect(kingDepthForAppointment(true)).toBeLessThan(
      kingDepthForAppointment(false),
    );
  });

  it('prefers the rival successor when available', () => {
    expect(
      selectSuccessorLeader({
        rivalLeaderId: 'opponent:tyrannical',
        kingLeaderId: 'king:field-command',
        rivalAvailable: true,
      }),
    ).toBe('opponent:tyrannical');
    expect(
      selectSuccessorLeader({
        rivalLeaderId: 'opponent:tyrannical',
        kingLeaderId: 'king:field-command',
        rivalAvailable: false,
      }),
    ).toBe('king:field-command');
  });
});

describe('enemy psychology helpers (ADR 0025)', () => {
  it('caps tracked enemy identities', () => {
    const roster = Array.from({ length: 16 }, (_, index) =>
      makePiece({ id: `e${index}`, E_i: index }),
    );
    const tracked = trackEnemyIdentities(roster, 8);
    expect(tracked).toHaveLength(8);
  });

  it('is sensitive to ENEMY_TRACKED_IDENTITIES', () => {
    const config = CAMPAIGN_CONFIG as unknown as Record<string, number>;
    const original = config.ENEMY_TRACKED_IDENTITIES ?? 8;
    const roster = Array.from({ length: 12 }, (_, index) =>
      makePiece({ id: `e${index}`, E_i: index }),
    );
    try {
      config.ENEMY_TRACKED_IDENTITIES = 3;
      expect(trackEnemyIdentities(roster)).toHaveLength(3);
      config.ENEMY_TRACKED_IDENTITIES = 10;
      expect(trackEnemyIdentities(roster)).toHaveLength(10);
    } finally {
      config.ENEMY_TRACKED_IDENTITIES = original;
    }
  });

  it('rejects difficulty-by-depth', () => {
    expect(() =>
      assertDifficultyIsLeaderPolicy({ easy: 8, hard: 8 }),
    ).not.toThrow();
    expect(() => assertDifficultyIsLeaderPolicy({ easy: 4, hard: 12 })).toThrow(
      /difficulty-by-depth/,
    );
  });
});
