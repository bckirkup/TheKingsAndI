import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { LivingBoard } from '../src/chess';
import { canonicalJson } from '../src/core/canonicalJson';
import { scoreMatchOutcome } from '../src/orchestration/outcomeScore';
import {
  parseArguments,
  renderCsv,
  runCampaign,
  runSimulation,
  shouldRunSmokeBounds,
  writeAtomicCheckpoint,
} from '../sim/cli';
import {
  parseCampaignCheckpoint,
  type CampaignCheckpoint,
} from '../sim/campaign';
import {
  assertCalibrationBounds,
  assertSmokeBounds,
  DEGENERACY_CONFIG,
  detectDegeneracy,
} from '../sim/degeneracy';
import { aggregateCampaign, type MatchMetrics } from '../sim/metrics';

describe('simulation harness determinism', () => {
  it('is byte-identical when repeated with the same seed', async () => {
    const options = {
      matches: 2,
      leader: 'supportive' as const,
      seed: 12,
      engineKind: 'fake' as const,
    };
    expect(renderCsv(await runSimulation(options))).toBe(
      renderCsv(await runSimulation(options)),
    );
  });

  it('resumes each emitted campaign boundary identically', async () => {
    const options = {
      leader: 'supportive' as const,
      seed: 12,
      engineKind: 'fake' as const,
    };
    const straight = await runCampaign({ ...options, matches: 4 });
    const emitted: Record<
      number,
      Awaited<ReturnType<typeof runCampaign>>['checkpoint']
    > = {};
    await runCampaign({
      ...options,
      matches: 3,
      onCheckpoint: (checkpoint) => {
        emitted[checkpoint.nextMatch - 1] = checkpoint;
      },
    });
    expect(emitted[2]?.nextMatch).toBe(3);
    expect(emitted[3]?.nextMatch).toBe(4);
    for (const completedMatches of [2, 3]) {
      const checkpoint = parseCampaignCheckpoint(
        JSON.parse(canonicalJson(emitted[completedMatches])) as unknown,
      );
      const resumed = await runCampaign({
        ...options,
        matches: 4,
        checkpoint,
      });
      expect(resumed.metrics).toEqual(straight.metrics);
      expect(resumed.finalRoster).toEqual(straight.finalRoster);
      expect(resumed.summary).toEqual(straight.summary);
    }
  });

  it('preserves the last checkpoint when a sibling write is truncated', async () => {
    const checkpoint: CampaignCheckpoint = {
      schemaVersion: 1,
      psychConfigVersion: 'psychology-v1',
      determinismId: 'sim-fake/depth-fixed',
      seed: 12,
      leader: 'supportive',
      initialTrust: 40,
      nextMatch: 2,
      randomState: { s0: 1, s1: 2, s2: 3, s3: 4 },
      roster: [],
      completedMetrics: [],
    };
    const path = `${process.cwd()}/.tmp-checkpoint-${process.pid}.json`;
    const temporaryPath = `${path}.${process.pid}.tmp`;
    try {
      await writeAtomicCheckpoint(path, checkpoint);
      await writeFile(temporaryPath, '{"truncated"', 'utf8');
      expect(
        parseCampaignCheckpoint(
          JSON.parse(await readFile(path, 'utf8')) as unknown,
        ).nextMatch,
      ).toBe(2);
    } finally {
      await Promise.all([
        unlink(path).catch(() => undefined),
        unlink(temporaryPath).catch(() => undefined),
      ]);
    }
  });

  it('flushes a completed-match checkpoint before exiting on SIGTERM', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'the-kings-and-i-'));
    const checkpointPath = join(directory, 'checkpoint.json');
    const child = spawn(
      process.execPath,
      [
        resolve('node_modules/tsx/dist/cli.mjs'),
        'sim/cli.ts',
        '--matches=3',
        '--leader=supportive',
        '--seed=5',
        '--engine=fake',
        `--checkpoint-out=${checkpointPath}`,
      ],
      { cwd: process.cwd(), stdio: 'ignore' },
    );
    try {
      let checkpoint: CampaignCheckpoint | undefined;
      const deadline = Date.now() + 120_000;
      while (checkpoint === undefined && Date.now() < deadline) {
        try {
          checkpoint = parseCampaignCheckpoint(
            JSON.parse(await readFile(checkpointPath, 'utf8')) as unknown,
          );
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      expect(checkpoint).toBeDefined();
      child.kill('SIGTERM');
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code) => resolve(code ?? -1));
      });
      expect(exitCode).not.toBe(0);

      const finalCheckpoint = parseCampaignCheckpoint(
        JSON.parse(await readFile(checkpointPath, 'utf8')) as unknown,
      );
      expect(finalCheckpoint.nextMatch).toBeGreaterThan(1);
      expect(finalCheckpoint.nextMatch).toBeLessThan(3);
    } finally {
      child.kill('SIGKILL');
      await rm(directory, { recursive: true, force: true });
    }
  }, 130_000);

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

  it('flags collinear transcript metrics with a golden pair', () => {
    const metrics = [1, 2, 3, 4].map((match) => ({
      ...handCheckMetric(match),
      refusalRate: match / 10,
      quietQuitRate: match / 20,
    }));
    const summary = aggregateCampaign('supportive', 7, metrics);
    const findings = detectDegeneracy('supportive', metrics, summary);
    expect(findings.map((finding) => finding.code)).toContain(
      'metric-collinearity',
    );
  });

  it('does not flag collinearity for too few samples or constants', () => {
    const shortMetrics = [1, 2, 3].map(handCheckMetric);
    const shortSummary = aggregateCampaign('supportive', 7, shortMetrics);
    expect(
      detectDegeneracy('supportive', shortMetrics, shortSummary).some(
        (finding) => finding.code === 'metric-collinearity',
      ),
    ).toBe(false);

    const constantMetrics = [1, 2, 3, 4].map((match) => ({
      ...handCheckMetric(match),
      refusalRate: 0.2,
      quietQuitRate: 0.2,
    }));
    const constantSummary = aggregateCampaign('supportive', 7, constantMetrics);
    expect(
      detectDegeneracy('supportive', constantMetrics, constantSummary).some(
        (finding) => finding.code === 'metric-collinearity',
      ),
    ).toBe(false);
  });

  it('changes collinearity findings when its threshold changes', () => {
    const metrics = [1, 2, 3, 4].map((match) => ({
      ...handCheckMetric(match),
      refusalRate: match / 10,
      quietQuitRate: match / 20 + (match === 4 ? 0.4 : 0),
    }));
    const summary = aggregateCampaign('supportive', 7, metrics);
    const defaultCodes = detectDegeneracy('supportive', metrics, summary).map(
      (finding) => finding.code,
    );
    const sensitiveCodes = detectDegeneracy('supportive', metrics, summary, {
      metricCorrelationThreshold: 0.5,
    }).map((finding) => finding.code);
    expect(defaultCodes).not.toContain('metric-collinearity');
    expect(sensitiveCodes).toContain('metric-collinearity');
    expect(DEGENERACY_CONFIG.metricCorrelationThreshold).toBe(0.95);
  });

  it('flags a redeemer with no movement between trajectory bands', () => {
    const metrics = [1, 2, 3, 4].map((match) => ({
      ...handCheckMetric(match),
      leader: 'redeemer' as const,
      archetype: 'redeemer_arc' as const,
      meanTauAbilEnd: 10,
      meanTauBenevEnd: 10,
    }));
    const summary = aggregateCampaign('redeemer', 7, metrics);
    const findings = detectDegeneracy('redeemer', metrics, summary);
    expect(findings.map((finding) => finding.code)).toContain(
      'unmeasurable-learning',
    );
  });

  it('changes learning findings when its movement threshold changes', () => {
    const metrics = [1, 2, 3, 4].map((match) => ({
      ...handCheckMetric(match),
      leader: 'redeemer' as const,
      archetype: 'redeemer_arc' as const,
      meanTauAbilEnd: match === 3 ? 20 : 10,
      meanTauBenevEnd: 10,
    }));
    const summary = aggregateCampaign('redeemer', 7, metrics);
    expect(
      detectDegeneracy('redeemer', metrics, summary).some(
        (finding) => finding.code === 'unmeasurable-learning',
      ),
    ).toBe(false);
    expect(
      detectDegeneracy('redeemer', metrics, summary, {
        learningDeltaThreshold: 0.5,
      }).some((finding) => finding.code === 'unmeasurable-learning'),
    ).toBe(true);
  });

  it('flags the weak seed-matched counterfactual approximation', () => {
    const subjectMetrics = [1, 2, 3, 4].map(handCheckMetric);
    const subject = aggregateCampaign('supportive', 7, subjectMetrics);
    const oracle = aggregateCampaign(
      'pure_tactician',
      7,
      subjectMetrics.map((metric) => ({
        ...metric,
        winScore: metric.winScore,
      })),
    );
    const findings = detectDegeneracy('supportive', subjectMetrics, subject, {
      oracleCampaigns: [oracle],
    });
    expect(findings.map((finding) => finding.code)).toContain(
      'flattering-counterfactual',
    );
  });

  it('changes counterfactual findings when minimum matches changes', () => {
    const subjectMetrics = [1, 2, 3, 4].map(handCheckMetric);
    const subject = aggregateCampaign('supportive', 7, subjectMetrics);
    const oracle = aggregateCampaign('pure_tactician', 7, [subjectMetrics[0]!]);
    expect(
      detectDegeneracy('supportive', subjectMetrics, subject, {
        oracleCampaigns: [oracle],
        counterfactualMinimumMatches: 2,
      }).some((finding) => finding.code === 'flattering-counterfactual'),
    ).toBe(false);
    expect(
      detectDegeneracy('supportive', subjectMetrics, subject, {
        oracleCampaigns: [oracle],
        counterfactualMinimumMatches: 1,
      }).some((finding) => finding.code === 'flattering-counterfactual'),
    ).toBe(true);
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
    desertions: 0,
    winningPositionDesertions: 0,
    cascadeLength: 0,
    refusedGoodMoves: 1,
    refusalRate: match / 100,
    quietQuitRate: 0,
    refusedGoodMoveRate: 1,
    overrideRate: 0,
    meanTrustStart: 10,
    meanTrustEnd: 10,
    meanTauAbilStart: 10,
    meanTauAbilEnd: 11,
    meanTauBenevStart: 20,
    meanTauBenevEnd: 22,
    classContemptStart: 0,
    classContemptEnd: 0,
    survivingRosterSize: 10,
    winScore: 50,
    rout: false,
    archetype: 'caretaker',
  };
}
