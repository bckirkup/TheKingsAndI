import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  parseCampaignCheckpoint,
  runCampaign,
  type CampaignCheckpoint,
} from './campaign';
import {
  assertCalibrationBounds,
  assertSmokeBounds,
  detectDegeneracy,
} from './degeneracy';
import { disposeSimEngine, type SimEngineKind } from './engine';
import { renderCsv } from './metrics';
import { canonicalJson } from '../src/core/canonicalJson';

export const LEADERS = [
  'tyrannical',
  'supportive',
  'volatile',
  'servant',
  'random',
  'pure_tactician',
  'redeemer',
] as const;

export type Leader = (typeof LEADERS)[number];

export const ENGINES = ['fake', 'lozza', 'stockfish'] as const;

export interface SimulationOptions {
  readonly matches: number;
  readonly leader: Leader;
  readonly seed: number;
  readonly campaign: number;
  readonly engine: SimEngineKind;
  readonly depthCap: number | undefined;
  readonly checkpointOut: string | undefined;
  readonly resume: string | undefined;
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
    'out',
    'engine',
    'depth-cap',
    'checkpoint-out',
    'resume',
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
  const matches = Number(values.get('matches') ?? 1);
  const campaign = Number(values.get('campaign') ?? matches);
  const leaderValue = values.get('leader') ?? 'random';
  if (!Number.isSafeInteger(matches) || matches < 1) {
    throw new Error('--matches must be a positive integer.');
  }
  if (!Number.isSafeInteger(campaign) || campaign < 1) {
    throw new Error('--campaign must be a positive integer.');
  }
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
  const enforceCalibrationValue = values.get('enforce-calibration') ?? 'false';
  if (
    enforceCalibrationValue !== 'true' &&
    enforceCalibrationValue !== 'false'
  ) {
    throw new Error('--enforce-calibration must be true or false.');
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
  return {
    matches,
    campaign,
    leader: leaderValue as Leader,
    seed,
    engine: engineValue as SimEngineKind,
    depthCap: depthCapValue,
    out: values.get('out'),
    checkpointOut: values.get('checkpoint-out'),
    resume: values.get('resume'),
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
  let result;
  try {
    result = await runCampaign({
      matches: options.campaign,
      leader: options.leader,
      seed: options.seed,
      engineKind: options.engine,
      depthCap: options.depthCap,
      ...(checkpoint === undefined ? {} : { checkpoint }),
    });
  } finally {
    await disposeSimEngine(options.engine);
  }
  const csv = renderCsv(result.metrics, result.summary.trajectoryBands);
  if (options.out !== undefined) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, csv, 'utf8');
  }
  if (options.checkpointOut !== undefined) {
    await mkdir(dirname(options.checkpointOut), { recursive: true });
    await writeFile(
      options.checkpointOut,
      `${canonicalJson(result.checkpoint)}\n`,
      'utf8',
    );
  }
  const findings = detectDegeneracy(
    options.leader,
    result.metrics,
    result.summary,
  );
  if (shouldRunSmokeBounds(result.metrics.length)) {
    assertSmokeBounds(options.leader, result.summary);
  }
  console.log(
    `Milestone 3 harness: ${result.metrics.length} matches for ${options.leader} (${result.determinismId}).`,
  );
  console.log(
    `refusal=${result.summary.meanRefusalRate.toFixed(3)} quiet_quit=${result.summary.meanQuietQuitRate.toFixed(3)} desertion_campaign=${result.summary.desertionCampaignRate.toFixed(3)} rout_campaign=${result.summary.routCampaignRate.toFixed(3)}`,
  );
  console.log(
    `refused_good=${result.summary.meanRefusedGoodMoveRate.toFixed(3)} override=${result.summary.meanOverrideRate.toFixed(3)} win=${result.summary.meanWinScore.toFixed(1)} trust_delta=${result.summary.meanTrustDelta.toFixed(2)}`,
  );
  for (const band of result.summary.trajectoryBands) {
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
