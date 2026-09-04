import { describe, expect, it } from 'vitest';

import {
  applyGriefDepthSuppression,
  applyGriefLoss,
  decayGrief,
  normalizePieceState,
  releaseCaptiveGrief,
  defaultCredence,
  defaultRumor,
  type PieceState,
} from '../src/psychology';
import { foldSeminarGrief } from '../sim/grief';
import type { MatchRecord } from '../src/persistence';

function piece(id: string, affinity: number, griefLoad?: number): PieceState {
  return normalizePieceState({
    id,
    role: 'Pawn',
    traits: {
      w_honor: 0.5,
      w_courage: 0.5,
      w_ambition: 0.5,
      w_loyalty: 0.5,
      w_empathy: 0.5,
      w_prestige: 0.5,
    },
    E_i: 50,
    T_i: 20,
    M_i: 70,
    B_i: 0,
    dyadicAffinity: { lost: affinity },
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
    ...(griefLoad === undefined ? {} : { griefLoad }),
  });
}

describe('grief mechanics', () => {
  it('applies affinity-gated, bounded loss load and names incidents', () => {
    const transition = applyGriefLoss(
      [piece('mourner', 80), piece('borderline', 49), piece('lost', 100)],
      'lost',
      'captured',
      3,
      1_000,
      { affinityThreshold: 50, loadPerLossPermille: 400 },
    );
    expect(transition.roster[0]?.griefLoad).toBe(400);
    expect(transition.roster[1]?.griefLoad).toBeUndefined();
    expect(transition.roster[2]?.griefLoad).toBeUndefined();
    expect(transition.incidents).toEqual([
      {
        pieceId: 'mourner',
        mournedId: 'lost',
        cause: 'captured',
        weekOrMatch: 3,
      },
    ]);
  });

  it('uses captive half-weight and lifts that portion on return', () => {
    const full = applyGriefLoss(
      [piece('mourner', 80)],
      'lost',
      'captured',
      1,
      1_000,
      { loadPerLossPermille: 400 },
    );
    const half = applyGriefLoss(
      [piece('mourner', 80)],
      'lost',
      'captured',
      1,
      500,
      { loadPerLossPermille: 400 },
    );
    expect(full.roster[0]?.griefLoad).toBe(400);
    expect(half.roster[0]?.griefLoad).toBe(200);
    expect(releaseCaptiveGrief(half.roster[0]!, 500, 400).griefLoad).toBe(0);
  });

  it('clamps decay and suppression without negative values', () => {
    expect(decayGrief(piece('p', 0, 100), 250).griefLoad).toBe(0);
    expect(applyGriefDepthSuppression(16, 1_000, 1_000)).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('grades effective depth while leaving the input unchanged', () => {
    const low = applyGriefDepthSuppression(16, 200, 500);
    const high = applyGriefDepthSuppression(16, 800, 500);
    expect(high).toBeLessThan(low);
    expect(applyGriefDepthSuppression(16, 0, 500)).toBe(16);
  });

  it('folds only terminal mourning events by owner', () => {
    const record = {
      events: [
        {
          t: 'GRIEF_MOURNING',
          ply: 4,
          pieceId: 'mourner',
          mournedId: 'lost',
          cause: 'career_ended',
          weekOrMatch: 2,
        },
      ],
    } as unknown as MatchRecord;
    expect(
      foldSeminarGrief([{ week: 2, records: { commander: [record] } }])
        .commander?.incidents,
    ).toEqual([
      {
        pieceId: 'mourner',
        mournedId: 'lost',
        cause: 'career_ended',
        weekOrMatch: 2,
      },
    ]);
  });
});
