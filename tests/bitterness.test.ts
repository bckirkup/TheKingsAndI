import { describe, expect, it } from 'vitest';

import {
  applyOverride,
  applyRegardSignal,
  applyRepairSignal,
  decayBitterness,
  defaultCredence,
  defaultRumor,
  ENGINE_CONFIG,
  formBitterness,
  normalizePieceState,
  applyMorningLift,
  type PieceState,
} from '../src/psychology';
import { createCommanderPool } from '../sim/pool';
import { decayCaptiveBenevolenceWithEvents } from '../sim/ransom';

const traits = {
  w_honor: 0.5,
  w_courage: 0.5,
  w_ambition: 0.5,
  w_loyalty: 0.5,
  w_empathy: 0.5,
  w_prestige: 0.5,
} as const;

function piece(overrides: Partial<PieceState> = {}): PieceState {
  return normalizePieceState({
    id: 'w:N:bitterness',
    role: 'Knight',
    traits,
    E_i: 50,
    T_i: -80,
    M_i: 70,
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
  const originals: Array<[string, number]> = Object.keys(values).map((key) => [
    key,
    config[key] ?? 0,
  ]);
  try {
    for (const [key, value] of Object.entries(values)) config[key] = value;
    return run();
  } finally {
    for (const [key, value] of originals) config[key] = value ?? 0;
  }
}

describe('D208 bitterness', () => {
  it('forms only when the inert magnitude is positive and clamps the carrier', () => {
    const base = piece({ bitternessPermille: 990 });
    expect(
      formBitterness(base, 'not_ransomed', { week: 1 }).event,
    ).toBeUndefined();
    const formed = withConfig({ BITTERNESS_PER_TRIGGER_PERMILLE: 30 }, () =>
      formBitterness(base, 'not_ransomed', { week: 1 }),
    );
    expect(formed.piece.bitternessPermille).toBe(1000);
    expect(formed.event).toMatchObject({
      t: 'BITTERNESS_FORMED',
      trigger: 'not_ransomed',
      week: 1,
      bitternessPermille: 1000,
    });
  });

  it('discounts positive repair and regard gains without changing charges', () => {
    const credence = { ...defaultCredence(), tauBenev: 0, ruptureDebt: 30 };
    const base = applyRepairSignal(credence, 0);
    const bitter = applyRepairSignal(credence, 500);
    expect(base.repaid).toBe(bitter.repaid);
    expect(
      withConfig(
        { BITTERNESS_REPAIR_DISCOUNT_PERMILLE: 500 },
        () => applyRepairSignal(credence, 500).credence.tauBenev,
      ),
    ).toBeLessThan(bitter.credence.tauBenev);
    const regardBase = applyRegardSignal(defaultCredence(), 3, 500);
    const regardDiscounted = withConfig(
      { BITTERNESS_REPAIR_DISCOUNT_PERMILLE: 500 },
      () => applyRegardSignal(defaultCredence(), 3, 500),
    );
    expect(regardDiscounted.tauBenev).toBeLessThan(regardBase.tauBenev);
  });

  it('uses the separate morning-lift discount and decays monotonically', () => {
    const bitter = piece({ bitternessPermille: 500 });
    const base = applyMorningLift(bitter);
    const discounted = withConfig(
      { BITTERNESS_MORNING_DISCOUNT_PERMILLE: 500 },
      () => applyMorningLift(bitter),
    );
    expect(discounted.T_i).toBeGreaterThanOrEqual(bitter.T_i);
    expect(discounted.T_i).toBeLessThan(base.T_i);
    const decayed = withConfig(
      { BITTERNESS_DECAY_PERMILLE_PER_MATCH: 120 },
      () => decayBitterness(bitter),
    );
    expect(decayed.bitternessPermille).toBe(380);
    expect(
      decayBitterness(piece({ bitternessPermille: 0 })).bitternessPermille,
    ).toBe(0);
  });

  it('forms rupture bitterness only for an unvindicated floor charge', () => {
    const target = piece({
      credence: {
        ...defaultCredence(),
        tauBenev: 40,
        ruptureDebt: 88,
      },
    });
    const witness = piece({ id: 'w:B:watcher' });
    const result = withConfig(
      {
        BITTERNESS_PER_TRIGGER_PERMILLE: 100,
        BITTERNESS_RUPTURE_THRESHOLD_PERMILLE: 500,
      },
      () => applyOverride(target, [witness], 3, 'Nf3', false),
    );
    expect(result.bitternessEvent).toBeUndefined();
    const floor = piece({
      credence: {
        ...defaultCredence(),
        tauBenev: 0,
        ruptureDebt: 100,
      },
    });
    const formed = withConfig(
      {
        BITTERNESS_PER_TRIGGER_PERMILLE: 100,
        BITTERNESS_RUPTURE_THRESHOLD_PERMILLE: 500,
      },
      () => applyOverride(floor, [witness], 3, 'Nf3', false),
    );
    expect(formed.bitternessEvent?.trigger).toBe('rupture_floor');
    const vindicated = withConfig(
      { BITTERNESS_PER_TRIGGER_PERMILLE: 100 },
      () => applyOverride(floor, [witness], 3, 'Nf3', true),
    );
    expect(vindicated.bitternessEvent).toBeUndefined();
  });

  it('gates captive-week formation on actual positive decay', () => {
    const pool = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'servant',
      randomUnit: 0.5,
    });
    const source = pool.members[0];
    if (source === undefined) throw new Error('Expected a pool member.');
    const captivePool = {
      ...pool,
      members: [
        {
          ...source,
          status: 'captive' as const,
          heldBy: 'b:commander:00',
          heldSinceWeek: 1,
          state: {
            ...source.state,
            credence: { ...source.state.credence, tauBenev: 50 },
          },
        },
      ],
    };
    const noDecay = withConfig({ BITTERNESS_PER_TRIGGER_PERMILLE: 100 }, () =>
      decayCaptiveBenevolenceWithEvents(
        new Map([[pool.id, captivePool]]),
        0,
        1,
      ),
    );
    expect(noDecay.events).toHaveLength(0);
    const decayed = withConfig({ BITTERNESS_PER_TRIGGER_PERMILLE: 100 }, () =>
      decayCaptiveBenevolenceWithEvents(
        new Map([[pool.id, captivePool]]),
        10,
        1,
      ),
    );
    expect(decayed.events).toHaveLength(1);
    expect(
      [...decayed.pools.values()][0]?.members[0]?.state.bitternessPermille,
    ).toBe(100);
  });
});
