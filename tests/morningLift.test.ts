import { describe, expect, it } from 'vitest';

import {
  applyMorningLift,
  defaultCredence,
  defaultRumor,
  ENGINE_CONFIG,
  normalizePieceState,
  type PieceState,
} from '../src/psychology';
import {
  fieldSquad,
  type SquadFieldingPool,
  type SquadMember,
} from '../src/orchestration/squadFielding';
import { runCampaign } from '../sim/campaign';

function piece(id: string, trust: number): PieceState {
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
    T_i: trust,
    M_i: 60,
    B_i: 20,
    dyadicAffinity: { 'w:R:1': 12 },
    classPrestige: {
      Pawn: -4,
      Knight: 0,
      Bishop: 0,
      Rook: 0,
      Queen: 0,
      King: 0,
    },
    engagementFactor: 1,
    credence: {
      ...defaultCredence(),
      tauBenev: 35,
      tauAbil: 65,
      ruptureDebt: 18,
    },
    rumor: {
      ...defaultRumor(),
      leaderAppraisal: -12,
    },
  });
}

function member(
  id: string,
  role: PieceState['role'],
  trust: number,
): SquadMember {
  return {
    state: { ...piece(id, trust), role },
    originRole: role,
    status: 'available',
    availableAtMatch: 1,
    provenance: 'original',
    service: {
      matchesPlayed: 0,
      desertions: 0,
      refusals: 0,
      captures: 0,
      consecutiveNonSelections: 0,
    },
  };
}

function withMorningLift<T>(
  permille: number,
  baseline: number,
  run: () => T,
): T {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const previousPermille = config.MORNING_LIFT_PERMILLE ?? 0;
  const previousBaseline = config.MORNING_LIFT_TRUST_BASELINE ?? 0;
  config.MORNING_LIFT_PERMILLE = permille;
  config.MORNING_LIFT_TRUST_BASELINE = baseline;
  try {
    return run();
  } finally {
    config.MORNING_LIFT_PERMILLE = previousPermille;
    config.MORNING_LIFT_TRUST_BASELINE = previousBaseline;
  }
}

async function withMorningLiftAsync<T>(
  permille: number,
  baseline: number,
  run: () => Promise<T>,
): Promise<T> {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const previousPermille = config.MORNING_LIFT_PERMILLE ?? 0;
  const previousBaseline = config.MORNING_LIFT_TRUST_BASELINE ?? 0;
  config.MORNING_LIFT_PERMILLE = permille;
  config.MORNING_LIFT_TRUST_BASELINE = baseline;
  try {
    return await run();
  } finally {
    config.MORNING_LIFT_PERMILLE = previousPermille;
    config.MORNING_LIFT_TRUST_BASELINE = previousBaseline;
  }
}

describe('D207 morning lift', () => {
  it('is inert at zero, lift-only at the baseline, and changes only trust', () => {
    const below = piece('w:P:below', -80);
    const atBaseline = piece('w:P:baseline', 0);
    const above = piece('w:P:above', 40);

    expect(withMorningLift(0, 0, () => applyMorningLift(below))).toBe(below);
    expect(withMorningLift(250, 0, () => applyMorningLift(atBaseline))).toBe(
      atBaseline,
    );
    expect(withMorningLift(250, 0, () => applyMorningLift(above))).toBe(above);

    const lifted = withMorningLift(250, 0, () => applyMorningLift(below));
    expect(lifted.T_i).toBe(-60);
    expect(lifted).toMatchObject({
      id: below.id,
      M_i: below.M_i,
      B_i: below.B_i,
      dyadicAffinity: below.dyadicAffinity,
      classPrestige: below.classPrestige,
      credence: below.credence,
      rumor: below.rumor,
    });
  });

  it('lands on the clamped baseline at full lift and clamps inputs', () => {
    const below = piece('w:P:below', -80);
    expect(withMorningLift(1_000, 0, () => applyMorningLift(below)).T_i).toBe(
      0,
    );
    expect(withMorningLift(1_500, 200, () => applyMorningLift(below)).T_i).toBe(
      100,
    );
    expect(withMorningLift(-20, -200, () => applyMorningLift(below)).T_i).toBe(
      -80,
    );
  });

  it('changes campaign outcomes only when a nonzero lift is enabled', async () => {
    const runs = [];
    for (const permille of [0, 500, 1_000]) {
      runs.push(
        await withMorningLiftAsync(permille, 0, () =>
          runCampaign({
            matches: 2,
            leader: 'dismissal_fisher',
            opponent: 'tyrannical',
            seed: 41,
            initialTrust: -80,
            engineKind: 'fake',
          }),
        ),
      );
    }
    const fingerprints = runs.map((result) =>
      JSON.stringify(
        result.metrics.map((metric) => ({
          dismissalPly: metric.dismissalPly,
          dismissed: metric.dismissed,
          meanTrustStart: metric.meanTrustStart,
        })),
      ),
    );
    expect(fingerprints[0]).not.toBe(fingerprints[1]);
    expect(fingerprints[1]).not.toBe(fingerprints[2]);
  });

  it('keeps default campaign output identical to the explicit inert configuration', async () => {
    const implicit = await runCampaign({
      matches: 1,
      leader: 'supportive',
      opponent: 'tyrannical',
      seed: 19,
      engineKind: 'fake',
    });
    const explicit = await withMorningLiftAsync(0, 0, () =>
      runCampaign({
        matches: 1,
        leader: 'supportive',
        opponent: 'tyrannical',
        seed: 19,
        engineKind: 'fake',
      }),
    );
    expect(JSON.stringify(explicit.metrics)).toBe(
      JSON.stringify(implicit.metrics),
    );
  });

  it('lifts fielded lineup members without touching the bench', () => {
    const members = [
      member('w:K:1', 'King', -80),
      ...Array.from({ length: 9 }, (_, index) =>
        member(`w:P:${String(index)}`, 'Pawn', -80),
      ),
    ];
    const pool: SquadFieldingPool = {
      members,
      fieldingPolicy: 'strongest_available',
    };
    const fielded = withMorningLift(500, 0, () =>
      fieldSquad(pool, 1, (role, match, sequence) => ({
        ...member(`conscript:${role}:${String(sequence)}`, role, -80),
        availableAtMatch: match,
        provenance: 'conscript',
      })),
    );
    const fieldedPawn = fielded.lineup.find(
      (candidate) => candidate.state.id === 'w:P:0',
    );
    const benchedPawn = members.find(
      (candidate) => candidate.state.id === 'w:P:8',
    );
    expect(fieldedPawn?.state.T_i).toBe(-40);
    expect(benchedPawn?.state.T_i).toBe(-80);
  });
});
