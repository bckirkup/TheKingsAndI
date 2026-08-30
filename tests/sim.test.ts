import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { LivingBoard } from '../src/chess';
import type { MoveIntent } from '../src/chess';
import { canonicalJson } from '../src/core/canonicalJson';
import { ENGINE_CONFIG } from '../src/psychology';
import { scoreMatchOutcome } from '../src/orchestration/outcomeScore';
import {
  parseArguments,
  renderCsv,
  runCampaign,
  runSimulation,
  assertCheckpointShardAssignment,
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
import type {
  PlayerCommendationId,
  PlayerCommendationSet,
  PublicRegister,
} from '../src/persistence';
import {
  aggregateCampaign,
  EMPTY_DESERTION_SUMMARY,
  type MatchMetrics,
} from '../sim/metrics';
import type { PoolSeasonMetrics } from '../sim/pool';

import { describeHeavy, itHeavy } from './tier';

// Campaign-scale: nightly tier (docs/testing_strategy.md §7).
describeHeavy('simulation harness determinism', () => {
  it('keeps the campaign digest unchanged with zero regard and repair steps', async () => {
    const options = {
      matches: 1,
      leader: 'exacting' as const,
      seed: 7,
      engineKind: 'fake' as const,
    };
    const baseline = renderCsv(await runSimulation(options));
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const originalRegard = ENGINE_CONFIG.BENEV_REGARD_STEP;
    const originalRepair = ENGINE_CONFIG.BENEV_REPAIR_STEP;
    config.BENEV_REGARD_STEP = 0;
    config.BENEV_REPAIR_STEP = 0;
    try {
      expect(renderCsv(await runSimulation(options))).toBe(baseline);
    } finally {
      config.BENEV_REGARD_STEP = originalRegard;
      config.BENEV_REPAIR_STEP = originalRepair;
    }
  });

  it('is byte-identical when repeated with the same seed', async () => {
    const options = {
      matches: 2,
      leader: 'supportive' as const,
      seed: 12,
      engineKind: 'fake' as const,
    };
    const first = await runSimulation(options);
    const second = await runSimulation(options);
    expect(renderCsv(first)).toBe(renderCsv(second));
    expect(first.every((metric) => metric.firstDeparture !== undefined)).toBe(
      true,
    );
    expect(first.every((metric) => metric.cascadeDeparture !== undefined)).toBe(
      true,
    );
    expect(renderCsv(first)).toContain(
      'first_desertions,first_unknown_cause,cascade_desertions,cascade_unknown_cause,cascade_length,first_u_stay',
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
      checkpointVersion: 3,
      schemaVersion: 1,
      psychConfigVersion: 'psychology-v1',
      determinismId: 'sim-fake/depth-fixed',
      seed: 12,
      leader: 'supportive',
      opponent: 'random',
      enemyTrackedIdentities: 16,
      initialTrust: 40,
      nextMatch: 2,
      randomState: { s0: 1, s1: 2, s2: 3, s3: 4 },
      roster: [],
      enemyRoster: [],
      generations: {},
      enemyGenerations: {},
      retiredCareerIds: [],
      enemyRetiredCareerIds: [],
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
  // Campaign-scale: nightly tier (docs/testing_strategy.md §7).
  itHeavy('changes output when the harness depth cap changes', async () => {
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

  itHeavy('changes output when seed changes', async () => {
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

  itHeavy('changes output when leader changes', async () => {
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

  it('quotes promotion JSON while preserving CSV field boundaries', () => {
    const twoRoleMetric = {
      ...handCheckMetric(1),
      promotionToRoleCounts: { Rook: 1, Queen: 2 },
    };
    const [header, row] = renderCsv([twoRoleMetric]).trimEnd().split('\n');
    if (header === undefined || row === undefined) {
      throw new Error('expected a CSV header and data row');
    }
    const fields = splitCsvRow(row);
    expect(fields).toHaveLength(header.split(',').length);
    const promotionField = fields[10];
    if (promotionField === undefined) {
      throw new Error('expected promotion JSON field');
    }
    expect(promotionField).toBe('"{""Rook"":1,""Queen"":2}"');
    expect(JSON.parse(promotionField.slice(1, -1).replace(/""/g, '"'))).toEqual(
      { Rook: 1, Queen: 2 },
    );

    const emptyMetric = handCheckMetric(1);
    const singleRoleMetric = {
      ...handCheckMetric(1),
      promotionToRoleCounts: { Queen: 1 },
    };
    const [, emptyRow] = renderCsv([emptyMetric]).trimEnd().split('\n');
    const [, singleRoleRow] = renderCsv([singleRoleMetric])
      .trimEnd()
      .split('\n');
    if (emptyRow === undefined || singleRoleRow === undefined) {
      throw new Error('expected CSV data rows');
    }
    expect(splitCsvRow(emptyRow)[10]).toBe('{}');
    expect(splitCsvRow(singleRoleRow)[10]).toBe('"{""Queen"":1}"');
  });
});

describe('match outcome scoring', () => {
  it('scores routs and dismissals as losses while unfinished play is a draw', () => {
    const board = LivingBoard.standard();
    expect(scoreMatchOutcome(board, 'w', true)).toBe(0);
    expect(scoreMatchOutcome(board, 'w', false)).toBe(50);
  });

  it('scores checkmate decisively but repetition and other draws as draws', () => {
    const checkmate = LivingBoard.fromFen('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');
    const repetition = LivingBoard.standard();
    for (const intent of [
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
    ] as MoveIntent[]) {
      repetition.applyMove(intent);
    }
    // A threefold shuffle is a draw, not a parity-decided win or loss.
    expect(scoreMatchOutcome(checkmate, 'w', false)).toBe(100);
    expect(scoreMatchOutcome(repetition, 'w', false)).toBe(50);
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
      opponent: 'random',
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

  it('requires one assigned campaign when resuming a checkpoint', () => {
    expect(() =>
      assertCheckpointShardAssignment({
        campaigns: 4,
        shardIndex: 0,
        shardCount: 2,
      }),
    ).toThrow(
      'Checkpoint resume requires a single campaign assigned to this shard.',
    );
    expect(() =>
      assertCheckpointShardAssignment({
        campaigns: 4,
        shardIndex: 0,
        shardCount: 4,
      }),
    ).not.toThrow();
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
  it('uses named attrition thresholds and responds to each threshold', async () => {
    expect(DEGENERACY_CONFIG.noRoutAttritionThreshold).toBe(0.05);
    expect(DEGENERACY_CONFIG.supportiveRoutAttritionThreshold).toBe(0.5);
    expect(DEGENERACY_CONFIG.earlySaturationAttritionThreshold).toBe(0.8);
    expect(DEGENERACY_CONFIG.earlySaturationRoutThreshold).toBe(0.8);
    expect(DEGENERACY_CONFIG.refusalDeadRateThreshold).toBe(0.001);
    expect(DEGENERACY_CONFIG.toothlessRefusalRateThreshold).toBe(0.05);
    expect(DEGENERACY_CONFIG.overrideInertRefusalRateThreshold).toBe(0.05);

    const metrics = await runSimulation({
      matches: 1,
      leader: 'tyrannical',
      seed: 7,
      engineKind: 'fake',
    });
    const summary = aggregateCampaign('tyrannical', 7, metrics);
    const noRoutSummary = { ...summary, desertionAttrition: 0 };
    expect(
      detectDegeneracy('tyrannical', metrics, noRoutSummary).some(
        (finding) => finding.code === 'no-rout',
      ),
    ).toBe(true);
    const adoptedDefaultSummary = { ...summary, desertionAttrition: 0.063 };
    const thresholdFindings = [0.05, 0.06, 0.07].map((threshold) =>
      detectDegeneracy('tyrannical', metrics, adoptedDefaultSummary, {
        noRoutAttritionThreshold: threshold,
      }).some((finding) => finding.code === 'no-rout'),
    );
    expect(thresholdFindings).toEqual([false, false, true]);

    const supportiveSummary = {
      ...summary,
      desertionAttrition: 0.6,
    };
    expect(
      detectDegeneracy('supportive', metrics, supportiveSummary).some(
        (finding) => finding.code === 'supportive-rout',
      ),
    ).toBe(true);
    expect(
      detectDegeneracy('supportive', metrics, supportiveSummary, {
        supportiveRoutAttritionThreshold: 0.7,
      }).some((finding) => finding.code === 'supportive-rout'),
    ).toBe(false);

    const earlySummary = {
      ...summary,
      trajectoryBands: summary.trajectoryBands.map((band, index) =>
        index === 0
          ? { ...band, desertionAttrition: 0.9, routRate: 0.9 }
          : band,
      ),
    };
    expect(
      detectDegeneracy('tyrannical', metrics, earlySummary).some(
        (finding) => finding.code === 'early-saturation',
      ),
    ).toBe(true);
    expect(
      detectDegeneracy('tyrannical', metrics, earlySummary, {
        earlySaturationAttritionThreshold: 0.95,
      }).some((finding) => finding.code === 'early-saturation'),
    ).toBe(false);
    expect(
      detectDegeneracy('tyrannical', metrics, earlySummary, {
        earlySaturationRoutThreshold: 0.95,
      }).some((finding) => finding.code === 'early-saturation'),
    ).toBe(false);

    const refusalSummary = {
      ...summary,
      meanRefusalRate: 0.0005,
      meanRefusedGoodMoveRate: 0,
      meanOverrideRate: 0,
    };
    expect(
      detectDegeneracy('tyrannical', metrics, refusalSummary).some(
        (finding) => finding.code === 'refusal-dead',
      ),
    ).toBe(true);
    expect(
      detectDegeneracy('tyrannical', metrics, refusalSummary, {
        refusalDeadRateThreshold: 0.0001,
      }).some((finding) => finding.code === 'refusal-dead'),
    ).toBe(false);

    const toothlessSummary = {
      ...summary,
      meanRefusalRate: 0.06,
      meanRefusedGoodMoveRate: 0,
    };
    expect(
      detectDegeneracy('supportive', metrics, toothlessSummary).some(
        (finding) => finding.code === 'toothless-refusal',
      ),
    ).toBe(true);
    expect(
      detectDegeneracy('supportive', metrics, toothlessSummary, {
        toothlessRefusalRateThreshold: 0.07,
      }).some((finding) => finding.code === 'toothless-refusal'),
    ).toBe(false);

    const overrideSummary = {
      ...summary,
      meanRefusalRate: 0.06,
      meanOverrideRate: 0,
    };
    expect(
      detectDegeneracy('tyrannical', metrics, overrideSummary).some(
        (finding) => finding.code === 'override-inert',
      ),
    ).toBe(true);
    expect(
      detectDegeneracy('tyrannical', metrics, overrideSummary, {
        overrideInertRefusalRateThreshold: 0.07,
      }).some((finding) => finding.code === 'override-inert'),
    ).toBe(false);
  });

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
      desertionMatchRate: 0,
      desertionAttrition: 0,
      meanRefusalRate: 0.1,
    });
    expect(findings.some((finding) => finding.code === 'no-rout')).toBe(true);
  });

  it('flags early quartile saturation', () => {
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('tyrannical', 7, metrics);
    const saturatedSummary = {
      ...summary,
      desertionAttrition: 0.9,
      trajectoryBands: summary.trajectoryBands.map((band) => ({
        ...band,
        desertionAttrition: 0.9,
        routRate: 0.9,
      })),
    };
    const findings = detectDegeneracy('tyrannical', metrics, saturatedSummary);
    expect(
      findings.some((finding) => finding.code === 'early-saturation'),
    ).toBe(true);
    expect(() =>
      assertSmokeBounds('tyrannical', saturatedSummary),
    ).not.toThrow();
    expect(() =>
      assertCalibrationBounds('tyrannical', saturatedSummary),
    ).toThrow('early');
  });

  it('detects promotion decoration and the elevation trap, but not a healthy crown', () => {
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('supportive', 7, metrics);
    const degenerate: PoolSeasonMetrics = {
      squadSize: 31,
      firstCycleLevies: 1,
      distinctMembersFielded: 16,
      benchUtilisation: 16 / 31,
      meanLineupChurn: 0,
      postPromotionSelectionRate: 0,
      unpromotedOriginControlRate: 0.7,
      crownedNeverFieldedAgain: 2,
      crownedRetiredForObsolescence: 1,
      promotions: 2,
      promotionsWithRemainingWindow: 2,
      crownedSelectionRate: 0,
    };
    const healthy: PoolSeasonMetrics = {
      ...degenerate,
      firstCycleLevies: 0,
      distinctMembersFielded: 28,
      benchUtilisation: 28 / 31,
      meanLineupChurn: 0.2,
      postPromotionSelectionRate: 0.6,
      crownedNeverFieldedAgain: 0,
      crownedRetiredForObsolescence: 0,
      crownedSelectionRate: 0.6,
    };
    const degenerateCodes = detectDegeneracy('supportive', metrics, summary, {
      poolMetrics: degenerate,
    }).map((finding) => finding.code);
    expect(degenerateCodes).toContain('promotion-decoration');
    expect(degenerateCodes).toContain('promotion-trap');
    expect(degenerateCodes).toContain('frozen-bench');
    expect(degenerateCodes).toContain('cycle-one-unplayability');
    const healthyCodes = detectDegeneracy('supportive', metrics, summary, {
      poolMetrics: healthy,
    }).map((finding) => finding.code);
    expect(healthyCodes).not.toContain('promotion-decoration');
    expect(healthyCodes).not.toContain('promotion-trap');
    expect(healthyCodes).not.toContain('frozen-bench');

    const afterMeasurement = {
      ...healthy,
      postPromotionSelectionRate: 0.57,
      unpromotedOriginControlRate: 0.499,
      crownedSelectionRate: 0.57,
      crownedNeverFieldedAgain: 0,
      promotionsWithRemainingWindow: 3,
    };
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        poolMetrics: afterMeasurement,
      }).some((finding) => finding.code === 'promotion-trap'),
    ).toBe(false);

    const preChangeTrap = {
      ...healthy,
      postPromotionSelectionRate: 0.09,
      unpromotedOriginControlRate: 0.67,
      crownedSelectionRate: 0.09,
      crownedNeverFieldedAgain: 0,
      promotions: 2,
      promotionsWithRemainingWindow: 2,
    };
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        poolMetrics: preChangeTrap,
      }).some((finding) => finding.code === 'promotion-trap'),
    ).toBe(true);

    const finalMatchPromotion = {
      ...healthy,
      promotions: 1,
      promotionsWithRemainingWindow: 0,
      crownedSelectionRate: 0,
      postPromotionSelectionRate: 0,
    };
    const finalMatchCodes = detectDegeneracy('supportive', metrics, summary, {
      poolMetrics: finalMatchPromotion,
    }).map((finding) => finding.code);
    expect(finalMatchCodes).not.toContain('promotion-decoration');
    expect(finalMatchCodes).not.toContain('promotion-trap');
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

  it('detects early verdict stability, but stays quiet with live or sparse awards', () => {
    const stability = (bestOfBest: number) => ({
      evenness_of_attention: bestOfBest,
      best_of_the_best: bestOfBest,
      nobody_drowned: bestOfBest,
      overcoming_a_weakness: bestOfBest,
      grit_and_endurance: bestOfBest,
      overall_improvement: bestOfBest,
      honest_sacrifice: bestOfBest,
      repaired_breach: bestOfBest,
    });
    const early = [1, 2, 3, 4].map((index) => ({
      leader: `leader-${index}`,
      cycleMatches: 6,
      verdictStability: stability(1),
    }));
    const live = early.map((career) => ({
      ...career,
      verdictStability: stability(6),
    }));
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('supportive', 7, metrics);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCommendationLiveness: early,
      }).some((finding) => finding.code === 'commendation-dead-by-match-two'),
    ).toBe(true);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCommendationLiveness: live,
      }).some((finding) => finding.code === 'commendation-dead-by-match-two'),
    ).toBe(false);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCommendationLiveness: early.slice(0, 3),
      }).some((finding) => finding.code === 'commendation-dead-by-match-two'),
    ).toBe(false);
    expect(DEGENERACY_CONFIG.commendationLivenessMinimumCareers).toBe(4);
  });

  it('changes verdict-liveness findings at the configured fraction', () => {
    const stability = (bestOfBest: number) => ({
      evenness_of_attention: bestOfBest,
      best_of_the_best: bestOfBest,
      nobody_drowned: bestOfBest,
      overcoming_a_weakness: bestOfBest,
      grit_and_endurance: bestOfBest,
      overall_improvement: bestOfBest,
      honest_sacrifice: bestOfBest,
      repaired_breach: bestOfBest,
    });
    const careers = [1, 2, 3, 6].map((bestOfBest) => ({
      leader: `leader-${bestOfBest}`,
      cycleMatches: 6,
      verdictStability: stability(bestOfBest),
    }));
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('supportive', 7, metrics);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCommendationLiveness: careers,
      }).some((finding) => finding.code === 'commendation-dead-by-match-two'),
    ).toBe(false);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCommendationLiveness: careers,
        commendationLivenessFraction: 0.5,
      }).some((finding) => finding.code === 'commendation-dead-by-match-two'),
    ).toBe(true);
  });

  it('detects signed register mirroring and anti-correlation independently', () => {
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('supportive', 7, metrics);
    const entries = (scores: readonly number[]) =>
      scores.map((score, index) => ({
        leader: `leader-${index}`,
        register: registerFor(index + 1),
        commendations: commendationsWithBestScore(score),
      }));
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleRegisterCommendations: entries([1, 2, 3, 4, 5]),
      }).some((finding) => finding.code === 'register-mirroring'),
    ).toBe(true);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleRegisterCommendations: entries([5, 4, 3, 2, 1]),
      }).some((finding) => finding.code === 'register-anti-correlation'),
    ).toBe(true);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleRegisterCommendations: entries([0, 1, 0, 1, 0]),
      }).some((finding) => finding.code.startsWith('register-')),
    ).toBe(false);
  });

  it('skips zero-variance register columns and awards, and respects correlation sensitivity', () => {
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('supportive', 7, metrics);
    const entries = [1, 2, 3, 4, 5].map((_, index) => ({
      leader: `leader-${index}`,
      register: registerFor(1),
      commendations: commendationsWithBestScore(1),
    }));
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleRegisterCommendations: entries,
      }).some((finding) => finding.code.startsWith('register-')),
    ).toBe(false);

    const varying = [1, 2, 3, 4, 5].map((value) => ({
      leader: `leader-${value}`,
      register: registerFor(value),
      commendations: commendationsWithBestScore(value),
    }));
    expect(DEGENERACY_CONFIG.registerCorrelationThreshold).toBe(0.8);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleRegisterCommendations: varying,
        registerCorrelationThreshold: 1,
      }).some((finding) => finding.code.startsWith('register-')),
    ).toBe(false);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleRegisterCommendations: varying,
        registerCorrelationThreshold: 0.8,
      }).some((finding) => finding.code === 'register-mirroring'),
    ).toBe(true);
  });

  it('detects oracular and decorative counsel in the correct direction', () => {
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('supportive', 7, metrics);
    const oracleCounsel = [1, 2, 3, 4, 5].map((value) => ({
      leader: `leader-${value}`,
      counsel: value,
      realizedContribution: value * 10,
    }));
    const decorativeCounsel = [1, 2, 3, 4, 5].map((value) => ({
      leader: `leader-${value}`,
      counsel: value,
      realizedContribution: value % 2,
    }));
    const healthyCounselPairs: readonly (readonly [number, number])[] = [
      [1, 3],
      [2, 1],
      [3, 4],
      [4, 2],
      [5, 5],
    ];
    const healthyCounsel = healthyCounselPairs.map(
      ([counsel, realizedContribution], index) => ({
        leader: `leader-${index}`,
        counsel,
        realizedContribution,
      }),
    );
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCounsel,
      }).some((finding) => finding.code === 'counsel-oracular'),
    ).toBe(true);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCounsel: decorativeCounsel,
      }).some((finding) => finding.code === 'counsel-decorative'),
    ).toBe(true);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCounsel: healthyCounsel,
      }).some((finding) => finding.code.startsWith('counsel-')),
    ).toBe(false);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCounsel: oracleCounsel.slice(0, 4),
      }).some((finding) => finding.code.startsWith('counsel-')),
    ).toBe(false);
  });

  it('keeps counsel detectors silent for zero variance and grades thresholds', () => {
    const metrics = [1, 2, 3, 4].map(handCheckMetric);
    const summary = aggregateCampaign('supportive', 7, metrics);
    const entries = [1, 2, 3, 4, 5].map((value) => ({
      leader: `leader-${value}`,
      counsel: value,
      realizedContribution: value,
    }));
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCounsel: entries.map((entry) => ({
          ...entry,
          realizedContribution: 1,
        })),
      }).some((finding) => finding.code.startsWith('counsel-')),
    ).toBe(false);
    expect(DEGENERACY_CONFIG.counselOracularCorrelationThreshold).toBe(0.8);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCounsel: entries,
        counselOracularCorrelationThreshold: 1,
      }).some((finding) => finding.code === 'counsel-oracular'),
    ).toBe(false);
    expect(
      detectDegeneracy('supportive', metrics, summary, {
        oracleCounsel: entries,
        counselOracularCorrelationThreshold: 0.8,
      }).some((finding) => finding.code === 'counsel-oracular'),
    ).toBe(true);
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
    implicitOverrides: 0,
    quietQuitMoves: 0,
    desertions: 0,
    promotions: 0,
    promotionToRoleCounts: {},
    winningPositionDesertions: 0,
    cascadeLength: 0,
    firstDeparture: EMPTY_DESERTION_SUMMARY,
    cascadeDeparture: EMPTY_DESERTION_SUMMARY,
    refusedGoodMoves: 1,
    fieldedPieceIds: ['piece'],
    desertedPieceIds: [],
    refusalRate: 1 / 11,
    refusalsPerPly: 1 / 10,
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
    enemyAttrition: 0,
    enemyFieldedPieceIds: ['enemy'],
    enemySurvivingRosterSize: 16,
    enemyDesertions: 0,
    enemyDesertedPieceIds: [],
    enemyRefusalRate: 0,
    winScore: 50,
    rout: false,
    archetype: 'caretaker',
  };
}

function splitCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (quoted) {
      field += character;
      if (character === '"') {
        if (row[index + 1] === '"') {
          field += row[index + 1];
          index += 1;
        } else {
          quoted = false;
        }
      }
    } else if (character === ',') {
      fields.push(field);
      field = '';
    } else if (character === '"' && field.length === 0) {
      field += character;
      quoted = true;
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

function registerFor(value: number): PublicRegister {
  return {
    foldVersion: 'test-register',
    matchesPlayed: value,
    wins: value,
    losses: 0,
    draws: 0,
    routs: 0,
    materialTaken: value,
    materialLost: 0,
    largestMaterialMargin: value,
    ownPiecesLost: 0,
    unattributedCaptures: 0,
    promotionsReached: 0,
    currentWinStreak: value,
    longestWinStreak: value,
  };
}

function commendationsWithBestScore(score: number): PlayerCommendationSet {
  const ids: readonly PlayerCommendationId[] = [
    'evenness_of_attention',
    'best_of_the_best',
    'nobody_drowned',
    'overcoming_a_weakness',
    'grit_and_endurance',
    'overall_improvement',
    'honest_sacrifice',
    'repaired_breach',
  ];
  const awards = ids.map((id) => ({
    id,
    label: id,
    earned: false,
    score: id === 'best_of_the_best' ? score : 0,
    threshold: 1,
  }));
  return {
    foldVersion: 'test-commendations',
    awards,
    earnedIds: [],
    learningDelta: null,
  };
}
