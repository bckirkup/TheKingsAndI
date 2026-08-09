import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { canonicalJson } from '../src/core/canonicalJson';
import { scoreMatchOutcome } from '../src/orchestration/outcomeScore';
import {
  parseArguments,
  renderCsv,
  runCampaign,
  runSimulation,
  shouldRunSmokeBounds,
} from '../sim/cli';
import { parseCampaignCheckpoint } from '../sim/campaign';
import {
  assertCalibrationBounds,
  assertSmokeBounds,
  detectDegeneracy,
} from '../sim/degeneracy';
import {
  aggregateCampaign,
  buildTrajectoryBands,
  type MatchMetrics,
} from '../sim/metrics';

describe('simulation harness golden output', () => {
  it('renders a fixed CSV for a fixed configuration', async () => {
    const csv = renderCsv(
      await runSimulation({
        matches: 2,
        leader: 'tyrannical',
        seed: 7,
        engineKind: 'fake',
      }),
    );
    const legacyCsv = csv
      .split('\n')
      .map((line) =>
        line.includes(',') ? line.split(',').slice(0, 21).join(',') : line,
      )
      .join('\n');
    expect(legacyCsv).toBe(
      [
        'match,seed,leader,plies,refusals,overrides,quiet_quit_moves,desertions,cascade_length,refused_good_moves,refusal_rate,quiet_quit_rate,refused_good_move_rate,override_rate,mean_trust_start,mean_trust_end,class_contempt_start,class_contempt_end,win_score,rout,archetype',
        '1,1000004,tyrannical,27,0,8,5,15,13,0,0.0000,0.1852,0.0000,0.2963,-10.00,-67.00,-20.00,15.00,0,1,tyrant',
        '2,2000001,tyrannical,144,10,46,20,14,12,10,0.0694,0.1389,1.0000,0.3194,-13.56,-100.00,-18.75,35.00,0,1,tyrant',
        '',
      ].join('\n'),
    );
    expect(csv).toContain(
      ',mean_tau_abil_start,mean_tau_abil_end,mean_tau_benev_start,mean_tau_benev_end,surviving_roster_size',
    );
  });

  it('is byte-identical when repeated with the same seed', async () => {
    const options = {
      matches: 4,
      leader: 'supportive' as const,
      seed: 12,
      engineKind: 'fake' as const,
    };
    expect(renderCsv(await runSimulation(options))).toBe(
      renderCsv(await runSimulation(options)),
    );
  });

  it('resumes a campaign boundary with byte-identical metrics and roster', async () => {
    const options = {
      leader: 'supportive' as const,
      seed: 12,
      engineKind: 'fake' as const,
    };
    const straight = await runCampaign({ ...options, matches: 6 });
    const firstSegment = await runCampaign({ ...options, matches: 3 });
    const checkpoint = parseCampaignCheckpoint(
      JSON.parse(canonicalJson(firstSegment.checkpoint)) as unknown,
    );
    const resumed = await runCampaign({
      ...options,
      matches: 6,
      checkpoint,
    });

    expect(resumed.metrics).toEqual(straight.metrics);
    expect(resumed.finalRoster).toEqual(straight.finalRoster);
    expect(resumed.summary).toEqual(straight.summary);
  });

  it.each([
    ['schemaVersion', 'schemaVersion mismatch'],
    ['psychConfigVersion', 'psychConfigVersion mismatch'],
    ['determinismId', 'determinismId mismatch'],
    ['leader', 'leader mismatch'],
  ] as const)('rejects a checkpoint %s mismatch', async (field, message) => {
    const checkpoint = (
      await runCampaign({
        matches: 1,
        leader: 'supportive',
        seed: 12,
        engineKind: 'fake',
      })
    ).checkpoint;
    const mismatched = {
      ...checkpoint,
      [field]:
        field === 'schemaVersion'
          ? checkpoint.schemaVersion + 1
          : field === 'psychConfigVersion'
            ? 'different-psych-config'
            : field === 'determinismId'
              ? 'different-engine'
              : 'tyrannical',
    };

    await expect(
      runCampaign({
        matches: 1,
        leader: 'supportive',
        seed: 12,
        engineKind: 'fake',
        checkpoint: mismatched,
      }),
    ).rejects.toThrow(message);
  });
});

describe('simulation harness sensitivity', () => {
  it('changes output when the harness depth cap changes', async () => {
    const base = await runCampaign({
      matches: 1,
      leader: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
      depthCap: 2,
    });
    const deeper = await runCampaign({
      matches: 1,
      leader: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
      depthCap: 8,
    });
    expect(base.determinismId).toContain('/depth-cap-2');
    expect(deeper.determinismId).toContain('/depth-cap-8');
    expect(base.determinismId).not.toBe(deeper.determinismId);
  });

  it('changes output when seed changes', async () => {
    expect(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'random',
          seed: 1,
          engineKind: 'fake',
        }),
      ),
    ).not.toBe(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'random',
          seed: 2,
          engineKind: 'fake',
        }),
      ),
    );
  });

  it('changes output when leader changes', async () => {
    expect(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'random',
          seed: 1,
          engineKind: 'fake',
        }),
      ),
    ).not.toBe(
      renderCsv(
        await runSimulation({
          matches: 2,
          leader: 'redeemer',
          seed: 1,
          engineKind: 'fake',
        }),
      ),
    );
  });
});

describe('match outcome scoring', () => {
  it('scores routs and dismissals as losses while unfinished play is a draw', () => {
    const board = LivingBoard.standard();
    expect(scoreMatchOutcome(board, 'w', true)).toBe(0);
    expect(scoreMatchOutcome(board, 'w', false)).toBe(50);
  });
});

describe('simulation harness argument parsing', () => {
  it('accepts the explicit equals form', () => {
    expect(
      parseArguments([
        '--matches=20',
        '--leader=tyrannical',
        '--seed=7',
        '--campaign=20',
        '--out=metrics.csv',
      ]),
    ).toEqual({
      matches: 20,
      campaign: 20,
      campaigns: 1,
      campaignLength: 20,
      leader: 'tyrannical',
      seed: 7,
      engine: 'lozza',
      depthCap: 4,
      out: 'metrics.csv',
      checkpointOut: undefined,
      resume: undefined,
      artifactOut: 'metrics.csv.json',
      shardIndex: 0,
      shardCount: 1,
      enforceCalibration: false,
    });
  });

  it('accepts explicit calibration enforcement', () => {
    expect(
      parseArguments([
        '--leader=tyrannical',
        '--engine=fake',
        '--enforce-calibration=true',
      ]).enforceCalibration,
    ).toBe(true);
  });

  it('keys the smoke gate to executed campaign matches', () => {
    const options = parseArguments(['--matches=21', '--campaign=21']);
    expect(options.matches).toBe(21);
    expect(options.campaign).toBe(21);
    expect(shouldRunSmokeBounds(options.matches)).toBe(false);
    expect(shouldRunSmokeBounds(20)).toBe(true);
  });

  it('accepts checkpoint emit and resume flags', () => {
    expect(
      parseArguments([
        '--campaign=6',
        '--checkpoint-out=checkpoint.json',
        '--resume=prior.json',
      ]),
    ).toMatchObject({
      campaign: 6,
      checkpointOut: 'checkpoint.json',
      resume: 'prior.json',
    });
  });

  it('rejects a malformed checkpoint roster with its index', async () => {
    const checkpoint = (
      await runCampaign({
        matches: 1,
        leader: 'supportive',
        seed: 12,
        engineKind: 'fake',
      })
    ).checkpoint;

    expect(() =>
      parseCampaignCheckpoint({
        ...checkpoint,
        roster: [...checkpoint.roster.slice(0, 1), { id: 'broken' }],
      }),
    ).toThrow('roster[1]');
  });

  it.each([
    ['--unknown=value', 'Unrecognised flag'],
    ['--matches', 'Expected --flag=value form'],
    ['--matches=2', 'Repeated flag'],
  ])('rejects malformed or repeated flags', (argument, message) => {
    const argumentsList =
      argument === '--matches=2' ? ['--matches=1', argument] : [argument];
    expect(() => parseArguments(argumentsList)).toThrow(message);
  });

  it('rejects the space-separated flag form', () => {
    expect(() => parseArguments(['--matches', '20'])).toThrow(
      'Expected --flag=value form',
    );
  });
});

describe('degeneracy detectors', () => {
  it('flags tyrannical campaigns with no desertions', async () => {
    const metrics = await runSimulation({
      matches: 1,
      leader: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
    });
    const summary = aggregateCampaign('tyrannical', 7, metrics);
    const findings = detectDegeneracy('tyrannical', metrics, {
      ...summary,
      desertionCampaignRate: 0,
      meanRefusalRate: 0.1,
    });
    expect(findings.some((finding) => finding.code === 'no-rout')).toBe(true);
  });

  it('flags early quartile saturation', async () => {
    const metrics = await runSimulation({
      matches: 4,
      leader: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
    });
    const summary = aggregateCampaign('tyrannical', 7, metrics);
    const findings = detectDegeneracy('tyrannical', metrics, summary);
    expect(
      findings.some((finding) => finding.code === 'early-saturation'),
    ).toBe(true);
    expect(() => assertSmokeBounds('tyrannical', summary)).not.toThrow();
    expect(() => assertCalibrationBounds('tyrannical', summary)).toThrow(
      'early',
    );
  });
});

function handCheckMetric(match: number): MatchMetrics {
  return {
    match,
    seed: match,
    leader: 'supportive',
    plies: 10,
    refusals: 1,
    overrides: 0,
    quietQuitMoves: 0,
    desertions: match % 2,
    winningPositionDesertions: 0,
    cascadeLength: match % 2,
    refusedGoodMoves: 1,
    refusalRate: match / 100,
    quietQuitRate: 0,
    refusedGoodMoveRate: 1,
    overrideRate: 0,
    meanTrustStart: 10,
    meanTrustEnd: 10,
    meanTauAbilStart: match * 10,
    meanTauAbilEnd: match * 10 + 1,
    meanTauBenevStart: match * 20,
    meanTauBenevEnd: match * 20 + 2,
    classContemptStart: 0,
    classContemptEnd: 0,
    survivingRosterSize: match,
    winScore: 50,
    rout: match % 2 === 1,
    archetype: 'caretaker',
  };
}

describe('campaign trajectory bands', () => {
  it('uses four equal quartiles for 16 and 52 matches', async () => {
    const intensive = (
      await runCampaign({
        matches: 16,
        leader: 'supportive',
        seed: 12,
        engineKind: 'fake',
      })
    ).summary.trajectoryBands;
    const nibelungen = (
      await runCampaign({
        matches: 52,
        leader: 'supportive',
        seed: 12,
        engineKind: 'fake',
      })
    ).summary.trajectoryBands;

    expect(intensive.map((band) => [band.startMatch, band.endMatch])).toEqual([
      [1, 4],
      [5, 8],
      [9, 12],
      [13, 16],
    ]);
    expect(nibelungen.map((band) => [band.startMatch, band.endMatch])).toEqual([
      [1, 13],
      [14, 26],
      [27, 39],
      [40, 52],
    ]);
  });

  it('assigns remainder matches to earlier quartiles', () => {
    const bands = buildTrajectoryBands([1, 2, 3, 4, 5].map(handCheckMetric));

    expect(bands.map((band) => [band.startMatch, band.endMatch])).toEqual([
      [1, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ]);
    expect(bands[0]?.meanTauAbil).toBe(16);
    expect(bands[0]?.meanTauBenev).toBe(32);
    expect(bands[0]?.meanSurvivingRosterSize).toBe(1.5);
    expect(bands[0]?.desertionRate).toBe(0.5);
    expect(bands[0]?.routRate).toBe(0.5);
  });
});
