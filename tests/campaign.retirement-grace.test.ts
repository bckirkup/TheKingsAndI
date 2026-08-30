import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import {
  applyCaptureInjury,
  applyGrace,
  applySustainedDread,
  defaultCredence,
  defaultRumor,
  ENGINE_CONFIG,
  normalizePieceState,
  startingAbilityForRole,
  type PieceState,
} from '../src/psychology';
import { SQUAD_CONFIG } from '../src/orchestration/squadFielding';
import {
  applyCampaignBoundary,
  careerIdFor,
  parseCampaignCheckpoint,
  runCampaign,
} from '../sim/campaign';
import { mergeCampaignRoster } from '../sim/roster';

function piece(
  id: PieceState['id'],
  role: PieceState['role'],
  trauma: number,
): PieceState {
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
    E_i: 50,
    T_i: 20,
    M_i: 80,
    B_i: trauma,
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
  });
}

function sequenceRandom(values: readonly number[]) {
  let index = 0;
  return {
    nextInt: (maxExclusive: number) => {
      const value = values[Math.min(index++, values.length - 1)];
      if (value === undefined) throw new Error('expected random value');
      return value % maxExclusive;
    },
  };
}

describe('campaign retirement and grace', () => {
  it('uses one canonical retirement threshold for season and campaign paths', () => {
    expect(SQUAD_CONFIG.RETIREMENT_TRAUMA_THRESHOLD).toBe(
      ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD,
    );
  });

  it('retires a traumatized non-King at the campaign boundary', async () => {
    const baseline = await runCampaign({
      matches: 1,
      leader: 'supportive',
      opponent: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
    });
    const target = baseline.checkpoint.roster.find(
      (candidate) => candidate.role !== 'King',
    );
    if (target === undefined) throw new Error('expected a non-King seat');
    const checkpoint = {
      ...baseline.checkpoint,
      roster: baseline.checkpoint.roster.map((candidate) =>
        candidate.id === target.id
          ? {
              ...candidate,
              B_i: ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD,
              E_i: 99,
            }
          : candidate,
      ),
    };
    const checkpoints: Awaited<ReturnType<typeof runCampaign>>['checkpoint'][] =
      [];
    const result = await runCampaign({
      matches: 3,
      leader: 'supportive',
      opponent: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
      checkpoint,
      onCheckpoint: (next) => {
        checkpoints.push(next);
      },
    });

    expect(result.metrics[1]?.retirements).toBe(1);
    expect(
      checkpoints[0]?.roster.some((candidate) => candidate.id === target.id),
    ).toBe(false);
    expect(checkpoints[0]?.retiredCareerIds).toContain(
      careerIdFor(target.id, 1),
    );
    expect(result.metrics[2]?.fieldedCareerIds).toContain(
      careerIdFor(target.id, 2),
    );
    const refielded = mergeCampaignRoster(
      LivingBoard.standard(),
      'w',
      checkpoints[0]?.roster ?? [],
      40,
      0.5,
    ).find((candidate) => candidate.id === target.id);
    expect(refielded).toBeDefined();
    if (refielded === undefined) throw new Error('Expected the reused seat.');
    expect(refielded.B_i).toBe(0);
    expect(refielded.E_i).toBe(startingAbilityForRole(refielded.role));
  });

  it('never retires a King at the trauma ceiling', async () => {
    const baseline = await runCampaign({
      matches: 1,
      leader: 'supportive',
      opponent: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
    });
    const king = baseline.checkpoint.roster.find(
      (candidate) => candidate.role === 'King',
    );
    if (king === undefined) throw new Error('expected a King');
    const result = await runCampaign({
      matches: 2,
      leader: 'supportive',
      opponent: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
      checkpoint: {
        ...baseline.checkpoint,
        roster: baseline.checkpoint.roster.map((candidate) =>
          candidate.id === king.id
            ? {
                ...candidate,
                B_i: ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD,
              }
            : candidate,
        ),
      },
    });

    expect(result.metrics[1]?.retirements).toBe(0);
    expect(result.metrics[1]?.fieldedCareerIds).toContain(
      careerIdFor(king.id, 1),
    );
  });

  it('grades grace rate and relief while preserving bounds', () => {
    const roster = [
      piece('w:P:a1', 'Pawn', 80),
      piece('w:R:a2', 'Rook', 50),
      piece('w:K:a3', 'King', 100),
    ];
    const retirementRoster = [
      piece('w:P:a1', 'Pawn', 100),
      piece('w:R:a2', 'Rook', 50),
      piece('w:K:a3', 'King', 100),
    ];
    const rates = [0, 500, 1_000].map((rate) => {
      const config = ENGINE_CONFIG as unknown as Record<string, number>;
      const previous = config.GRACE_RATE_PERMILLE ?? 0;
      const previousRelief = config.GRACE_RELIEF ?? 0;
      config.GRACE_RATE_PERMILLE = rate;
      config.GRACE_RELIEF = 20;
      try {
        return applyCampaignBoundary(
          retirementRoster,
          { 'w:P:a1': 1, 'w:R:a2': 1, 'w:K:a3': 1 },
          [],
          sequenceRandom([0, 999]),
        );
      } finally {
        config.GRACE_RATE_PERMILLE = previous;
        config.GRACE_RELIEF = previousRelief;
      }
    });
    expect(rates.map((result) => result.graceEvents)).toEqual([0, 1, 2]);
    expect(rates.map((result) => result.retirements)).toEqual([1, 0, 0]);
    expect(rates[0]?.roster.map((candidate) => candidate.B_i)).toEqual([
      50, 100,
    ]);

    const reliefs = [0, 10, 30].map((relief) => {
      const config = ENGINE_CONFIG as unknown as Record<string, number>;
      const previousRate = config.GRACE_RATE_PERMILLE ?? 0;
      const previousRelief = config.GRACE_RELIEF ?? 0;
      config.GRACE_RATE_PERMILLE = 1_000;
      config.GRACE_RELIEF = relief;
      try {
        return applyCampaignBoundary(
          roster,
          { 'w:P:a1': 1, 'w:R:a2': 1, 'w:K:a3': 1 },
          [],
          sequenceRandom([0, 0]),
        );
      } finally {
        config.GRACE_RATE_PERMILLE = previousRate;
        config.GRACE_RELIEF = previousRelief;
      }
    });
    const means = reliefs.map(
      (result) =>
        result.roster.reduce((sum, candidate) => sum + candidate.B_i, 0) /
        result.roster.length,
    );
    expect(means[0] ?? 0).toBeGreaterThan(means[1] ?? 0);
    expect(means[1] ?? 0).toBeGreaterThan(means[2] ?? 0);
    for (const result of reliefs) {
      expect(result.roster.every((candidate) => candidate.B_i >= 0)).toBe(true);
      expect(result.roster.every((candidate) => candidate.B_i <= 100)).toBe(
        true,
      );
    }
  });

  it('does not purchase grace with unrelated piece state', () => {
    const left = piece('w:P:a1', 'Pawn', 40);
    const right = normalizePieceState({
      ...left,
      T_i: -80,
      M_i: 10,
      credence: {
        ...left.credence,
        tauBenev: 5,
        tauAbil: 90,
      },
      dyadicAffinity: { 'w:R:a2': -100 },
      classPrestige: { ...left.classPrestige, Queen: 100 },
    });
    expect(applyGrace(left, 15).B_i).toBe(applyGrace(right, 15).B_i);
    expect(applyGrace(left, 15)).toMatchObject({
      T_i: left.T_i,
      M_i: left.M_i,
      credence: left.credence,
      dyadicAffinity: left.dyadicAffinity,
      classPrestige: left.classPrestige,
    });
  });

  it('does not draw grace randomness when the rate is inert', () => {
    let draws = 0;
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const previousRate = config.GRACE_RATE_PERMILLE ?? 0;
    config.GRACE_RATE_PERMILLE = 0;
    try {
      const result = applyCampaignBoundary(
        [piece('w:R:a2', 'Rook', 40), piece('w:P:a1', 'Pawn', 20)],
        { 'w:P:a1': 1 },
        [],
        {
          nextInt: () => {
            draws += 1;
            return 0;
          },
        },
      );
      expect(result.roster.map((candidate) => candidate.id)).toEqual([
        'w:R:a2',
        'w:P:a1',
      ]);
    } finally {
      config.GRACE_RATE_PERMILLE = previousRate;
    }
    expect(draws).toBe(0);
  });

  it('keeps grace deterministic and checkpoint state round-trippable', async () => {
    const roster = [piece('w:P:a1', 'Pawn', 40)];
    const input = { 'w:P:a1': 1 };
    const first = applyCampaignBoundary(roster, input, [], sequenceRandom([0]));
    const second = applyCampaignBoundary(
      roster,
      input,
      [],
      sequenceRandom([0]),
    );
    expect(second).toEqual(first);

    const result = await runCampaign({
      matches: 1,
      leader: 'supportive',
      seed: 12,
      engineKind: 'fake',
    });
    const parsed = parseCampaignCheckpoint(
      JSON.parse(JSON.stringify(result.checkpoint)) as unknown,
    );
    expect(parsed.checkpointVersion).toBe(4);
    expect(parsed.generations).toEqual(result.checkpoint.generations);
    expect(parsed.retiredCareerIds).toEqual(result.checkpoint.retiredCareerIds);
  });

  it('keeps trauma injury folds bounded', () => {
    const baseline = piece('w:P:a1', 'Pawn', 100);
    expect(applyGrace(baseline, 20).B_i).toBe(80);
    expect(applyGrace(baseline, -20).B_i).toBe(100);
    expect(applyGrace(baseline, -20.5).B_i).toBe(100);
    expect(applyGrace(piece('w:P:a1', 'Pawn', 40), 15.75).B_i).toBe(25);
    expect(applyCaptureInjury(baseline).B_i).toBe(100);
    const dread = applySustainedDread(baseline, undefined, 1);
    expect(dread.piece.B_i).toBe(100);
  });
});
