import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { parseCampaignCheckpoint, type CampaignCheckpoint } from './campaign';
import {
  assertCalibrationBounds,
  assertSmokeBounds,
  detectDegeneracy,
} from './degeneracy';
import { type SimEngineKind } from './engine';
import { renderCsv } from './metrics';
import { resolveRunPlan, runShard, writeShardArtifact } from './parallel';
import { plainChessMeanWinScore } from './baseline';
import { canonicalJson } from '../src/core/canonicalJson';

export const LEADERS = [
  'tyrannical',
  'supportive',
  'volatile',
  'servant',
  'random',
  'pure_tactician',
  'redeemer',
  'cold_winner',
  'rebuilder',
] as const;

export type Leader = (typeof LEADERS)[number];

export const ENGINES = ['fake', 'lozza', 'stockfish'] as const;

export interface SimulationOptions {
  readonly matches: number;
  readonly leader: Leader;
  readonly seed: number;
  readonly campaign: number;
  readonly campaigns: number;
  readonly campaignLength: number;
  readonly engine: SimEngineKind;
  readonly depthCap: number | undefined;
  readonly checkpointOut: string | undefined;
  readonly resume: string | undefined;
  readonly artifactOut: string | undefined;
  readonly shardIndex: number;
  readonly shardCount: number;
  readonly enforceCalibration: boolean;
}

export function shouldRunSmokeBounds(executedMatches: number): boolean {
  return executedMatches <= 20;
}

function parseArguments(
  argumentsList: readonly string[],
): SimulationOptions & { out: string | undefined } {
  const values = new Map<string, string>();
  const supportedFlags = new Set([
    'matches',
    'leader',
    'seed',
    'campaign',
    'campaign-length',
    'campaigns',
    'out',
    'engine',
    'depth-cap',
    'checkpoint-out',
    'resume',
    'artifact-out',
    'shard-index',
    'shard-count',
    'enforce-calibration',
  ]);
  for (const argument of argumentsList) {
    if (!argument.startsWith('--')) {
      throw new Error(`Unrecognised argument: ${argument}`);
    }
    const separator = argument.indexOf('=');
    if (separator < 3) {
      throw new Error(`Expected --flag=value form: ${argument}`);
    }
    const key = argument.slice(2, separator);
    const value = argument.slice(separator + 1);
    if (!supportedFlags.has(key)) {
      throw new Error(`Unrecognised flag: --${key}`);
    }
    if (values.has(key)) {
      throw new Error(`Repeated flag: --${key}`);
    }
    values.set(key, value);
  }
  if (values.has('campaign') && values.has('campaign-length')) {
    throw new Error(
      'Use only one of --campaign and --campaign-length; they are aliases.',
    );
  }
  const matchesValue =
    values.get('matches') === undefined
      ? undefined
      : Number(values.get('matches'));
  const campaignLengthValue =
    values.get('campaign-length') ?? values.get('campaign');
  const campaignLength =
    campaignLengthValue === undefined ? undefined : Number(campaignLengthValue);
  const campaigns =
    values.get('campaigns') === undefined
      ? undefined
      : Number(values.get('campaigns'));
  const plan = resolveRunPlan({
    matches: matchesValue,
    campaignLength,
    campaigns,
  });
  const leaderValue = values.get('leader') ?? 'random';
  if (!LEADERS.includes(leaderValue as Leader)) {
    throw new Error(`--leader must be one of: ${LEADERS.join(', ')}.`);
  }
  const seed = Number(values.get('seed') ?? 0);
  if (!Number.isSafeInteger(seed)) {
    throw new Error('--seed must be an integer.');
  }
  if (values.has('out') && values.get('out') === '') {
    throw new Error('--out must not be empty.');
  }
  if (values.has('checkpoint-out') && values.get('checkpoint-out') === '') {
    throw new Error('--checkpoint-out must not be empty.');
  }
  if (values.has('resume') && values.get('resume') === '') {
    throw new Error('--resume must not be empty.');
  }
  if (values.has('artifact-out') && values.get('artifact-out') === '') {
    throw new Error('--artifact-out must not be empty.');
  }
  const engineValue = values.get('engine') ?? 'lozza';
  if (!ENGINES.includes(engineValue as SimEngineKind)) {
    throw new Error(`--engine must be one of: ${ENGINES.join(', ')}.`);
  }
  const depthCapValue =
    values.get('depth-cap') === undefined
      ? engineValue === 'lozza'
        ? 4
        : undefined
      : Number(values.get('depth-cap'));
  if (
    depthCapValue !== undefined &&
    (!Number.isSafeInteger(depthCapValue) || depthCapValue < 1)
  ) {
    throw new Error('--depth-cap must be a positive integer.');
  }
  const shardIndex = Number(values.get('shard-index') ?? 0);
  const shardCount = Number(values.get('shard-count') ?? 1);
  const enforceCalibrationValue = values.get('enforce-calibration') ?? 'false';
  if (
    enforceCalibrationValue !== 'true' &&
    enforceCalibrationValue !== 'false'
  ) {
    throw new Error('--enforce-calibration must be true or false.');
  }
  if (!Number.isSafeInteger(shardIndex) || shardIndex < 0) {
    throw new Error('--shard-index must be a non-negative integer.');
  }
  if (!Number.isSafeInteger(shardCount) || shardCount < 1) {
    throw new Error('--shard-count must be a positive integer.');
  }
  if (shardIndex >= shardCount) {
    throw new Error('--shard-index must be less than --shard-count.');
  }
  const artifactOut =
    values.get('artifact-out') ??
    (values.get('out') === undefined
      ? undefined
      : `${values.get('out') as string}.json`);
  return {
    matches: plan.totalMatches,
    campaign: plan.campaignLength,
    campaigns: plan.campaigns,
    campaignLength: plan.campaignLength,
    leader: leaderValue as Leader,
    seed,
    engine: engineValue as SimEngineKind,
    depthCap: depthCapValue,
    out: values.get('out'),
    checkpointOut: values.get('checkpoint-out'),
    resume: values.get('resume'),
    artifactOut,
    shardIndex,
    shardCount,
    enforceCalibration: enforceCalibrationValue === 'true',
  };
}

export { parseArguments, renderCsv };
export {
  parseCampaignCheckpoint,
  runCampaign,
  runSimulation,
} from './campaign';

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  let checkpoint: CampaignCheckpoint | undefined;
  if (options.resume !== undefined) {
    checkpoint = parseCampaignCheckpoint(
      JSON.parse(await readFile(options.resume, 'utf8')) as unknown,
    );
  }
  if (checkpoint !== undefined && options.campaigns !== 1) {
    throw new Error('Checkpoint resume requires a single campaign run.');
  }
  const result = await runShard({
    plan: {
      totalMatches: options.matches,
      campaignLength: options.campaignLength,
      campaigns: options.campaigns,
    },
    leader: options.leader,
    masterSeed: options.seed,
    engineKind: options.engine,
    depthCap: options.depthCap,
    shardIndex: options.shardIndex,
    shardCount: options.shardCount,
    ...(checkpoint === undefined ? {} : { checkpoint }),
  });
  const csv = renderCsv(
    result.campaigns.flatMap((campaign) => campaign.result.metrics),
    result.trajectoryBands,
  );
  if (options.out !== undefined) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, csv, 'utf8');
  }
  if (options.checkpointOut !== undefined) {
    await mkdir(dirname(options.checkpointOut), { recursive: true });
    await writeFile(
      options.checkpointOut,
      `${canonicalJson(result.campaigns[0]?.result.checkpoint)}\n`,
      'utf8',
    );
  }
  const findings = detectDegeneracy(
    options.leader,
    result.summary.matchMetrics,
    result.summary,
    {
      matchedSkillWinScore: plainChessMeanWinScore({
        matches: result.summary.matches,
        seed: options.seed,
        whiteLeader: options.leader,
      }),
    },
  );
  if (
    !options.enforceCalibration &&
    shouldRunSmokeBounds(result.summary.matches)
  ) {
    assertSmokeBounds(options.leader, result.summary, {
      matchedSkillWinScore: plainChessMeanWinScore({
        matches: result.summary.matches,
        seed: options.seed,
        whiteLeader: options.leader,
      }),
    });
  }
  console.log(
    `Milestone 3 harness: ${result.summary.matches} matches across ${result.campaigns.length} campaigns for ${options.leader} (${result.manifest.determinismId}).`,
  );
  console.log(
    `refusal=${result.summary.meanRefusalRate.toFixed(3)} quiet_quit=${result.summary.meanQuietQuitRate.toFixed(3)} desertion_campaign=${result.summary.desertionCampaignRate.toFixed(3)} winning_position_desertion=${result.summary.winningPositionDesertionRate.toFixed(3)} rout_campaign=${result.summary.routCampaignRate.toFixed(3)}`,
  );
  console.log(
    `refused_good=${result.summary.meanRefusedGoodMoveRate.toFixed(3)} override=${result.summary.meanOverrideRate.toFixed(3)} win=${result.summary.meanWinScore.toFixed(1)} trust_delta=${result.summary.meanTrustDelta.toFixed(2)}`,
  );
  for (const band of result.trajectoryBands) {
    console.log(
      `quartile=${band.quartile} matches=${band.startMatch}-${band.endMatch} tau_abil=${band.meanTauAbil.toFixed(2)} tau_benev=${band.meanTauBenev.toFixed(2)} refusal=${band.meanRefusalRate.toFixed(3)} desertion=${band.desertionRate.toFixed(3)} rout=${band.routRate.toFixed(3)} roster=${band.meanSurvivingRosterSize.toFixed(2)}`,
    );
  }
  for (const finding of findings) {
    console.log(`degeneracy=${finding.code} ${finding.message}`);
  }
  if (options.enforceCalibration) {
    assertCalibrationBounds(options.leader, result.summary);
  }
  if (options.out !== undefined) console.log(`CSV written to ${options.out}`);
  if (options.artifactOut !== undefined) {
    await mkdir(dirname(options.artifactOut), { recursive: true });
    await writeShardArtifact(options.artifactOut, result);
    console.log(`Shard artifact written to ${options.artifactOut}`);
  }
  if (options.checkpointOut !== undefined)
    console.log(`Checkpoint written to ${options.checkpointOut}`);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
