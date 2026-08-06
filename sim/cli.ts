import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { runCampaign } from './campaign';
import { assertSmokeBounds } from './degeneracy';
import { renderCsv } from './metrics';

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

export interface SimulationOptions {
  readonly matches: number;
  readonly leader: Leader;
  readonly seed: number;
  readonly campaign: number;
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
  return {
    matches,
    campaign,
    leader: leaderValue as Leader,
    seed,
    out: values.get('out'),
  };
}

export { parseArguments, renderCsv };
export { runCampaign, runSimulation } from './campaign';

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const result = runCampaign({
    matches: options.campaign,
    leader: options.leader,
    seed: options.seed,
  });
  const csv = renderCsv(result.metrics);
  if (options.out !== undefined) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, csv, 'utf8');
  }
  if (options.matches <= 20) {
    assertSmokeBounds(options.leader, result.summary);
  }
  console.log(
    `Milestone 3 harness: ${result.metrics.length} matches for ${options.leader}.`,
  );
  console.log(
    `refusal=${result.summary.meanRefusalRate.toFixed(3)} quiet_quit=${result.summary.meanQuietQuitRate.toFixed(3)} desertion_campaign=${result.summary.desertionCampaignRate.toFixed(3)} rout_campaign=${result.summary.routCampaignRate.toFixed(3)}`,
  );
  console.log(
    `refused_good=${result.summary.meanRefusedGoodMoveRate.toFixed(3)} override=${result.summary.meanOverrideRate.toFixed(3)} win=${result.summary.meanWinScore.toFixed(1)} trust_delta=${result.summary.meanTrustDelta.toFixed(2)}`,
  );
  if (options.out !== undefined) console.log(`CSV written to ${options.out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
