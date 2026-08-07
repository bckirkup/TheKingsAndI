import { describe, expect, it } from 'vitest';

import type { MoveFeatures } from '../src/chess';
import {
  applyDesertionWithCascade,
  evaluateDesertionCascade,
  ENGINE_CONFIG,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type DesertionContext,
  type PieceState,
} from '../src/psychology';
import {
  attributeSacrifice,
  isAvengedCapture,
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
    kingSafetyDelta: 0,
    ...overrides,
  };
}

describe('desertion cascade (live path)', () => {
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
      vLeaderImplied: 1,
      deltaV_capture: 0,
      P_captured: 0.9,
      peerSafetyDeltas: {},
    };
    const cascade = applyDesertionWithCascade(
      [first, second, king],
      {
        actor: first,
        refusedMove: 'a4',
        refusedMoveEval: moveEval,
        uStay: -1,
        uDesert: 0,
      },
      4,
    );
    expect(cascade.events.some((event) => event.t === 'DESERTION')).toBe(true);
    expect(
      cascade.events.some((event) => event.t === 'DESERTION_WITNESS'),
    ).toBe(true);
    expect(cascade.cascadeLength).toBeGreaterThanOrEqual(1);
    expect(cascade.roster.some((piece) => piece.id === first.id)).toBe(false);
  });

  it('evaluateDesertionCascade uses shouldDesert without a dummy move', () => {
    const piece = makePiece({ T_i: -90, M_i: 5, B_i: 80 });
    const context: DesertionContext = {
      P_captured: 0.9,
      P_lossIfStay: 0.9,
      P_lossIfLeave: 0.1,
    };
    const results = evaluateDesertionCascade([piece], { [piece.id]: context });
    expect(results).toHaveLength(1);
    expect(results[0]?.pieceId).toBe(piece.id);
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
});
