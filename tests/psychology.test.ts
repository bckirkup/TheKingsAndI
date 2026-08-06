import { describe, expect, it } from 'vitest';

import {
  ENGINE_CONFIG,
  calculateEngineSearchDepth,
  calculateMoveUtility,
  calculateRefusalThreshold,
  evaluateMoveResponse,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type CandidateMoveEvaluation,
  type PieceState,
} from '../src/psychology';

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

const quietMove: CandidateMoveEvaluation = {
  moveNotation: 'Nf3',
  deltaV_board: 0.2,
  vLeaderImplied: 0.3,
  deltaV_capture: 0,
  P_captured: 0.1,
  peerSafetyDeltas: {},
};

const braveMove: CandidateMoveEvaluation = {
  moveNotation: 'Nxf7',
  deltaV_board: 3.0,
  vLeaderImplied: 3.5,
  deltaV_capture: 3,
  P_captured: 0.8,
  peerSafetyDeltas: {},
};

describe('search depth golden values', () => {
  it('matches the reference formula at key boundaries', () => {
    expect(calculateEngineSearchDepth(100, 1.0)).toBe(16);
    expect(calculateEngineSearchDepth(100, 0.2)).toBe(4);
    expect(calculateEngineSearchDepth(1, 1.0)).toBe(2);
    expect(calculateEngineSearchDepth(50, 0.5)).toBe(5);
  });
});

describe('refusal threshold golden values', () => {
  it('matches docs/psychology_engine.md §5', () => {
    expect(calculateRefusalThreshold(100)).toBe(-50);
    expect(calculateRefusalThreshold(0)).toBe(0);
    expect(calculateRefusalThreshold(-100)).toBe(50);
  });
});

describe('move utility golden values', () => {
  it('combines honor, ambition, risk, and peer protection without additive trust', () => {
    const actor = makePiece({ T_i: 40 });
    const peer = makePiece({ id: 'w:P:e2', role: 'Pawn' });
    const moveEval: CandidateMoveEvaluation = {
      moveNotation: 'Nd5',
      deltaV_board: 1.0,
      vLeaderImplied: 1.2,
      deltaV_capture: 0,
      P_captured: 0.2,
      peerSafetyDeltas: { 'w:P:e2': 0.5 },
    };
    const utility = calculateMoveUtility(actor, moveEval, [actor, peer]);
    expect(utility).toBeCloseTo(0.4, 5);
  });
});

describe('verdict ladder', () => {
  it('returns MORAL_REFUSAL when perceived value is below threshold', () => {
    const actor = makePiece({
      T_i: -80,
      credence: { tauBenev: 10, tauAbil: 10 },
    });
    const outcome = evaluateMoveResponse(actor, quietMove, [actor]);
    expect(outcome.verdict).toBe('MORAL_REFUSAL');
    expect(outcome.engagementFactor).toBe(ENGINE_CONFIG.QUIET_QUIT_ENGAGEMENT);
    expect(outcome.effectiveSearchDepth).toBe(3);
  });

  it('returns QUIET_QUITTING when trust is exhausted but the move is tolerable', () => {
    const actor = makePiece({
      T_i: 0,
      credence: { tauBenev: 80, tauAbil: 80 },
    });
    const toleratedMove: CandidateMoveEvaluation = {
      ...quietMove,
      deltaV_board: 1.0,
      vLeaderImplied: 1.0,
      P_captured: 0.1,
    };
    const outcome = evaluateMoveResponse(actor, toleratedMove, [actor]);
    expect(outcome.verdict).toBe('QUIET_QUITTING');
  });

  it('returns HEROIC_EXECUTION for a trusted piece taking real risk', () => {
    const actor = makePiece({ T_i: 80 });
    const outcome = evaluateMoveResponse(actor, braveMove, [actor]);
    expect(outcome.verdict).toBe('HEROIC_EXECUTION');
    expect(outcome.engagementFactor).toBe(ENGINE_CONFIG.FULL_ENGAGEMENT);
  });

  it('returns COMPLIANT_EXECUTION for a routine developing move', () => {
    const actor = makePiece({ T_i: 80 });
    const outcome = evaluateMoveResponse(actor, quietMove, [actor]);
    expect(outcome.verdict).toBe('COMPLIANT_EXECUTION');
  });
});

describe('config sensitivity', () => {
  it('changes search depth when MAX_SEARCH_DEPTH changes', () => {
    const baseline = calculateEngineSearchDepth(100, 1.0);
    const tuned = calculateEngineSearchDepth(100, 1.0, 2, 8);
    expect(tuned).not.toBe(baseline);
    expect(tuned).toBe(8);
  });

  it('changes heroic classification when HEROIC_TRUST_FLOOR changes', () => {
    const trusted = makePiece({ T_i: 55 });
    const heroic = evaluateMoveResponse(trusted, braveMove, [trusted]);
    const notHeroic = evaluateMoveResponse(
      makePiece({ T_i: ENGINE_CONFIG.HEROIC_TRUST_FLOOR }),
      braveMove,
      [trusted],
    );
    expect(heroic.verdict).toBe('HEROIC_EXECUTION');
    expect(notHeroic.verdict).toBe('COMPLIANT_EXECUTION');
  });
});
