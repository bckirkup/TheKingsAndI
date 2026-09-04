import { describe, expect, it } from 'vitest';

import { ENGINE_CONFIG, foldSpite, type MatchEvent } from '../src/psychology';

function withConfig<T>(
  values: Readonly<Record<string, number>>,
  run: () => T,
): T {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const originals = Object.keys(values).map(
    (key) => [key, config[key]] as const,
  );
  try {
    for (const [key, value] of Object.entries(values)) config[key] = value;
    return run();
  } finally {
    for (const [key, value] of originals) config[key] = value ?? 0;
  }
}

const override = (pieceId: string, ply = 1): MatchEvent => ({
  t: 'OVERRIDE',
  ply,
  pieceId,
  san: 'Nf3',
  pieceTrustDelta: -10,
  vindicated: false,
});

const refusal = (
  pieceId: string,
  ply: number,
  perceivedValue: number,
  justified = false,
): MatchEvent => ({
  t: 'REFUSAL',
  ply,
  pieceId,
  utility: -1,
  threshold: 0,
  perceivedValue,
  justified,
});

const desertion = (
  pieceId: string,
  ply: number,
  pivotality: number,
): MatchEvent => ({
  t: 'DESERTION',
  ply,
  pieceId,
  refusedMove: 'a2a3',
  uStay: 0,
  uDesert: 1,
  departureKind: 'first',
  terms: {
    P_captured: 0,
    pain: 0,
    P_lossIfStay: 0,
    P_lossIfLeave: 0,
    tauBenev: 0,
    tauAbil: 0,
    gloryWeight: 0,
    pivotality,
    lambda: 0,
    lambdaTrust: 0,
    lambdaMorale: 0,
    lambdaLoyalty: 0,
    lambdaAffinity: 0,
    standingCost: 0,
  },
});

describe('D209 spite fold', () => {
  it('is disabled by the zero floor sentinels', () => {
    const events = [
      override('p'),
      refusal('p', 2, 100),
      desertion('p', 3, 100),
    ];
    expect(foldSpite(events, ['p'])).toEqual({ incidents: [], count: 0 });
  });

  it('grades refusal classification by commander-cost floor', () => {
    const events = [override('p'), refusal('p', 2, 20), refusal('p', 3, 80)];
    const counts = [10, 50, 90].map((floor) =>
      withConfig(
        {
          SPITE_COMMANDER_COST_FLOOR: floor,
          SPITE_DESERTION_PIVOTALITY_FLOOR: 0,
        },
        () => foldSpite(events, ['p']).count,
      ),
    );
    expect(counts).toEqual([2, 1, 0]);
  });

  it('grades desertion classification independently by pivotality floor', () => {
    const events = [
      override('p'),
      desertion('p', 2, 20),
      desertion('p', 3, 80),
    ];
    const counts = [10, 50, 90].map((floor) =>
      withConfig(
        {
          SPITE_COMMANDER_COST_FLOOR: 0,
          SPITE_DESERTION_PIVOTALITY_FLOOR: floor,
        },
        () => foldSpite(events, ['p']).count,
      ),
    );
    expect(counts).toEqual([2, 1, 0]);
  });

  it('requires an active grievance and prefers override over bitterness', () => {
    const noGround = withConfig({ SPITE_COMMANDER_COST_FLOOR: 1 }, () =>
      foldSpite([refusal('p', 2, 10)], ['p']),
    );
    expect(noGround.count).toBe(0);

    const repaired = withConfig({ SPITE_COMMANDER_COST_FLOOR: 1 }, () =>
      foldSpite(
        [
          override('p'),
          { t: 'REPAIR', ply: 2, pieceId: 'p', repaid: 1 },
          refusal('p', 3, 10),
        ],
        ['p'],
      ),
    );
    expect(repaired.count).toBe(0);

    const bitter = withConfig({ SPITE_COMMANDER_COST_FLOOR: 1 }, () =>
      foldSpite(
        [
          {
            t: 'BITTERNESS_FORMED',
            pieceId: 'p',
            trigger: 'rupture_floor',
            bitternessPermille: 1,
          },
          { t: 'REPAIR', ply: 2, pieceId: 'p', repaid: 1 },
          refusal('p', 3, 10),
        ],
        ['p'],
      ),
    );
    expect(bitter.incidents[0]?.grievance).toBe('bitterness');

    const both = withConfig({ SPITE_COMMANDER_COST_FLOOR: 1 }, () =>
      foldSpite(
        [
          override('p'),
          {
            t: 'BITTERNESS_FORMED',
            pieceId: 'p',
            trigger: 'rupture_floor',
            bitternessPermille: 1,
          },
          refusal('p', 3, 10),
        ],
        ['p'],
      ),
    );
    expect(both.incidents[0]?.grievance).toBe('override');
    expect(both.incidents[0]?.commanderCost).toBe(10);
  });

  it('respects fielded membership and justified refusals', () => {
    const events = [
      override('p'),
      refusal('p', 2, 10, true),
      refusal('q', 3, 10),
    ];
    const folded = withConfig({ SPITE_COMMANDER_COST_FLOOR: 1 }, () =>
      foldSpite(events, ['p']),
    );
    expect(folded).toEqual({ incidents: [], count: 0 });
  });
});
