import { describe, expect, it } from 'vitest';

import {
  ENGINE_CONFIG,
  applyOverride,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type PieceState,
} from '../src/psychology';
import { foldCampaignShame, type MatchRecord } from '../src/persistence';
import { foldSeminarShame } from '../sim/shame';

const traits = {
  w_honor: 0.5,
  w_courage: 0.5,
  w_ambition: 0.5,
  w_loyalty: 0.5,
  w_empathy: 0.5,
  w_prestige: 0.5,
} as const;

function piece(id: string, overrides: Partial<PieceState> = {}): PieceState {
  return normalizePieceState({
    id,
    role: 'Knight',
    traits,
    E_i: 50,
    T_i: 80,
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

function withConfig<T>(
  values: Readonly<Record<string, number>>,
  run: () => T,
): T {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const originals = Object.keys(values).map(
    (key) => [key, config[key] ?? 0] as const,
  );
  try {
    for (const [key, value] of Object.entries(values)) config[key] = value;
    return run();
  } finally {
    for (const [key, value] of originals) config[key] = value;
  }
}

describe('D212 shame', () => {
  it('increases the target loss with witness count and standing', () => {
    const target = piece('target');
    const witness = piece('witness', {
      dyadicAffinity: { target: 80 },
      classPrestige: { ...target.classPrestige, Knight: 20 },
    });
    const second = piece('second', {
      dyadicAffinity: { target: 80 },
      classPrestige: { ...target.classPrestige, Knight: 20 },
    });
    withConfig(
      {
        SHAME_PER_WITNESS_PERMILLE: 100,
        SHAME_STANDING_PERMILLE: 100,
        SHAME_CAP_PERMILLE: 1_000,
      },
      () => {
        const one = applyOverride(target, [witness], 2, 'Nf3');
        const two = applyOverride(target, [witness, second], 2, 'Nf3');
        expect(two.overriddenPiece.T_i).toBeLessThan(one.overriddenPiece.T_i);
        expect(two.overriddenPiece.credence.tauBenev).toBeLessThan(
          one.overriddenPiece.credence.tauBenev,
        );
        expect(two.shameEvent?.shamePermille).toBeGreaterThan(
          one.shameEvent?.shamePermille ?? 0,
        );
        expect(two.shameEvent).toEqual({
          t: 'SHAME_EXPOSURE',
          ply: 2,
          pieceId: 'target',
          witnesses: 2,
          shamePermille: two.shameEvent?.shamePermille,
        });
      },
    );
  });

  it('increases shame with witness standing independently of count', () => {
    const target = piece('target');
    const low = piece('low', {
      dyadicAffinity: { target: 20 },
      classPrestige: { ...target.classPrestige, Knight: 0 },
    });
    const high = piece('high', {
      dyadicAffinity: { target: 80 },
      classPrestige: { ...target.classPrestige, Knight: 20 },
    });
    withConfig(
      {
        SHAME_PER_WITNESS_PERMILLE: 0,
        SHAME_STANDING_PERMILLE: 500,
      },
      () => {
        const lower = applyOverride(target, [low], 2, 'Nf3');
        const higher = applyOverride(target, [high], 2, 'Nf3');
        expect(higher.shameEvent?.shamePermille).toBeGreaterThan(
          lower.shameEvent?.shamePermille ?? 0,
        );
        expect(higher.overriddenPiece.T_i).toBeLessThan(
          lower.overriddenPiece.T_i,
        );
      },
    );
  });

  it('caps shame and preserves witness charges', () => {
    const target = piece('target');
    const witness = piece('witness', {
      dyadicAffinity: { target: 100 },
      classPrestige: { ...target.classPrestige, Knight: 100 },
    });
    const baseline = withConfig(
      {
        SHAME_PER_WITNESS_PERMILLE: 0,
        SHAME_STANDING_PERMILLE: 0,
      },
      () => applyOverride(target, [witness], 2, 'Nf3'),
    );
    const capped = withConfig(
      {
        SHAME_PER_WITNESS_PERMILLE: 2_000,
        SHAME_STANDING_PERMILLE: 2_000,
        SHAME_CAP_PERMILLE: 300,
      },
      () => applyOverride(target, [witness], 2, 'Nf3'),
    );
    expect(capped.shameEvent?.shamePermille).toBe(300);
    expect(capped.witnesses).toEqual(baseline.witnesses);
  });

  it('keeps private and vindicated overrides shame-free', () => {
    const target = piece('target');
    const witness = piece('witness');
    withConfig(
      {
        SHAME_PER_WITNESS_PERMILLE: 500,
        SHAME_STANDING_PERMILLE: 500,
      },
      () => {
        const privateResult = applyOverride(target, [], 2, 'Nf3');
        const vindicated = applyOverride(target, [witness], 2, 'Nf3', true);
        expect(privateResult.shameEvent).toBeUndefined();
        expect(vindicated.shameEvent).toBeUndefined();
      },
    );
  });

  it('preserves the default override result shape', () => {
    const target = piece('target');
    const witness = piece('witness');
    const implicitDefaults = applyOverride(target, [witness], 2, 'Nf3');
    const explicitDefaults = withConfig(
      {
        SHAME_PER_WITNESS_PERMILLE: 50,
        SHAME_STANDING_PERMILLE: 0,
        SHAME_CAP_PERMILLE: 1_000,
      },
      () => applyOverride(target, [witness], 2, 'Nf3'),
    );
    expect(explicitDefaults).toEqual(implicitDefaults);
  });

  it('folds only recorded shame events into terminal readings', () => {
    const event = {
      t: 'SHAME_EXPOSURE' as const,
      ply: 4,
      pieceId: 'target',
      witnesses: 2,
      shamePermille: 175,
    };
    const record = { events: [event] } as unknown as MatchRecord;
    expect(foldCampaignShame([record])).toEqual({
      incidents: [
        {
          pieceId: 'target',
          ply: 4,
          witnesses: 2,
          shamePermille: 175,
        },
      ],
    });
    const seminar = foldSeminarShame([
      {
        week: 1,
        records: { commander: [record] },
      },
    ]);
    expect(seminar.commander?.incidents[0]).toEqual({
      pieceId: 'target',
      ply: 4,
      witnesses: 2,
      shamePermille: 175,
    });
  });
});
