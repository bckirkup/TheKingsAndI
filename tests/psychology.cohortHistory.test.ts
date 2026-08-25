import { describe, expect, it } from 'vitest';

import {
  applyCohortHistory,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type PieceState,
} from '../src/psychology';
import type { CohortHistory } from '../src/core/cohortHistory';

function piece(overrides: Partial<PieceState> = {}): PieceState {
  return normalizePieceState({
    id: 'piece',
    role: 'Knight',
    traits: {
      w_honor: 0.5,
      w_courage: 0.5,
      w_ambition: 0.5,
      w_loyalty: 0.5,
      w_empathy: 0.5,
      w_prestige: 0.5,
    },
    E_i: 50,
    T_i: 50,
    M_i: 50,
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

describe('cohort history fold', () => {
  it('leaves empty history deeply unchanged', () => {
    const state = piece();
    expect(
      applyCohortHistory(state, { intakeByMember: {}, relations: [] }),
    ).toBe(state);
  });

  it('preserves signs, clamps affinity, and shoves officer prestige', () => {
    const history: CohortHistory = {
      intakeByMember: { piece: 0, ally: 0, rival: 0 },
      relations: [
        { from: 'piece', to: 'ally', type: 'served_together', weight: 140 },
        { from: 'piece', to: 'rival', type: 'resents', weight: 140 },
        {
          from: 'piece',
          to: 'ally',
          type: 'bereaved_together',
          weight: 5,
        },
      ],
    };
    const folded = applyCohortHistory(
      piece({
        dyadicAffinity: { ally: 90, rival: -90 },
        classPrestige: {
          Pawn: 0,
          Knight: 98,
          Bishop: 0,
          Rook: 0,
          Queen: 0,
          King: 0,
        },
      }),
      history,
    );
    expect(folded.dyadicAffinity.ally).toBe(100);
    expect(folded.dyadicAffinity.rival).toBe(-100);
    expect(folded.classPrestige.Knight).toBe(93);
    expect(folded.classPrestige.Bishop).toBe(-5);
    expect(folded.classPrestige.Rook).toBe(-5);
    expect(folded.classPrestige.Queen).toBe(-5);
    expect(folded.classPrestige.Pawn).toBe(0);
  });

  it('responds to each fold magnitude as an integer quantitative probe', () => {
    const history: CohortHistory = {
      intakeByMember: { piece: 0, ally: 0 },
      relations: [
        { from: 'piece', to: 'ally', type: 'served_together', weight: 1 },
      ],
    };
    const values = [1, 10, 40].map(
      (weight) =>
        applyCohortHistory(piece(), {
          ...history,
          relations: [
            { from: 'piece', to: 'ally', type: 'served_together', weight },
          ],
        }).dyadicAffinity.ally,
    );
    expect(values).toEqual([1, 10, 40]);
  });

  it('probes the bereavement prestige shove independently', () => {
    const history: CohortHistory = {
      intakeByMember: { piece: 0, ally: 0 },
      relations: [
        {
          from: 'piece',
          to: 'ally',
          type: 'bereaved_together',
          weight: 1,
        },
      ],
    };
    const values = [0, 5, 20].map(
      (shove) =>
        applyCohortHistory(piece(), history, {
          INTAKE_SIZE: 8,
          RELATIONS_PER_PIECE: 1,
          CROSS_INTAKE_TAIL_PERMILLE: 0,
          WEIGHT_SERVED: 20,
          WEIGHT_OWES: 15,
          WEIGHT_RESENTS: 20,
          WEIGHT_BEREAVED: 25,
          BEREAVED_PRESTIGE_SHOVE: shove,
        }).classPrestige.Queen,
    );
    expect(values).toEqual([0, -5, -20]);
  });
});
