import { describe, expect, it } from 'vitest';

import { applyPromotion } from '../src/orchestration/promotion';
import {
  ENGINE_CONFIG,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
} from '../src/psychology';
import type { PieceState } from '../src/psychology';

function makePiece(id: string, role: PieceState['role']): PieceState {
  return normalizePieceState({
    id,
    role,
    traits: {
      w_honor: 0.5,
      w_courage: 0.5,
      w_ambition: 0.5,
      w_loyalty: 0.5,
      w_empathy: 0.5,
      w_prestige: 0.5,
    },
    E_i: role === 'Pawn' ? 20 : 55,
    T_i: 20,
    M_i: 70,
    B_i: 4,
    dyadicAffinity: { 'w:P:a7': 12 },
    classPrestige: {
      Pawn: -20,
      Knight: 0,
      Bishop: 0,
      Rook: 0,
      Queen: 0,
      King: 0,
    },
    engagementFactor: 1,
    credence: defaultCredence(),
    rumor: defaultRumor(),
  });
}

describe('promotion truth', () => {
  it('changes only the promoted role and emits one event', () => {
    const promoted = makePiece('w:P:a7', 'Pawn');
    const witness = makePiece('w:N:b1', 'Knight');
    const result = applyPromotion(
      [promoted, witness],
      { pieceId: promoted.id, fromRole: 'P', toRole: 'Q' },
      7,
    );

    expect(result.event).toEqual({
      t: 'PROMOTION',
      ply: 7,
      pieceId: promoted.id,
      fromRole: 'Pawn',
      toRole: 'Queen',
    });
    expect(result.roster[0]).toEqual({ ...promoted, role: 'Queen' });
    expect(result.roster[1]).toEqual(witness);
  });

  it('grades signed origin-class prestige shifts for every witness', () => {
    const original = ENGINE_CONFIG.PROMOTION_CLASS_PRESTIGE_SHIFT;
    const config = ENGINE_CONFIG as { PROMOTION_CLASS_PRESTIGE_SHIFT: number };
    try {
      const values = [-20, 0, 10, 30];
      const observed = values.map((shift) => {
        config.PROMOTION_CLASS_PRESTIGE_SHIFT = shift;
        return applyPromotion(
          [makePiece('b:P:a2', 'Pawn'), makePiece('b:N:b8', 'Knight')],
          { pieceId: 'b:P:a2', fromRole: 'P', toRole: 'R' },
          1,
        ).roster[1]?.classPrestige.Pawn;
      });
      expect(observed).toEqual([-40, -20, -10, 10]);
      expect(observed).toEqual([...observed].sort((a = 0, b = 0) => a - b));
      expect(new Set(observed).size).toBe(values.length);
    } finally {
      config.PROMOTION_CLASS_PRESTIGE_SHIFT = original;
    }
  });
});
