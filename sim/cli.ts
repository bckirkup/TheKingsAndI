import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { createSeededRandom } from '../src/core/random';

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
}

export interface MatchMetric {
  readonly match: number;
  readonly seed: number;
  readonly leader: Leader;
  readonly placeholderScore: number;
}

const CSV_HEADER = 'match,seed,leader,placeholder_score';

function leaderOffset(leader: Leader): number {
  return [...leader].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
}

export function runSimulation(options: SimulationOptions): MatchMetric[] {
  const random = createSeededRandom(
    options.seed ^ leaderOffset(options.leader),
  );
  return Array.from({ length: options.matches }, (_, index) => ({
    match: index + 1,
    seed: options.seed,
    leader: options.leader,
    placeholderScore: random.nextInt(1_000_000),
  }));
}

export function renderCsv(metrics: readonly MatchMetric[]): string {
  return `${[CSV_HEADER, ...metrics.map((metric) => `${metric.match},${metric.seed},${metric.leader},${metric.placeholderScore}`)].join('\n')}\n`;
}

function parseArguments(
  argumentsList: readonly string[],
): SimulationOptions & { out: string | undefined } {
  const values = new Map<string, string>();
  const supportedFlags = new Set(['matches', 'leader', 'seed', 'out']);
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
  const leaderValue = values.get('leader') ?? 'random';
  if (!Number.isSafeInteger(matches) || matches < 1)
    throw new Error('--matches must be a positive integer.');
  if (!LEADERS.includes(leaderValue as Leader))
    throw new Error(`--leader must be one of: ${LEADERS.join(', ')}.`);
  const seed = Number(values.get('seed') ?? 0);
  if (!Number.isSafeInteger(seed))
    throw new Error('--seed must be an integer.');
  if (values.has('out') && values.get('out') === '')
    throw new Error('--out must not be empty.');
  return {
    matches,
    leader: leaderValue as Leader,
    seed,
    out: values.get('out'),
  };
}

export { parseArguments };

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const metrics = runSimulation(options);
  const csv = renderCsv(metrics);
  if (options.out !== undefined) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, csv, 'utf8');
  }
  const total = metrics.reduce(
    (sum, metric) => sum + metric.placeholderScore,
    0,
  );
  console.log(
    `Milestone 0 harness skeleton: ${metrics.length} placeholder matches for ${options.leader}.`,
  );
  console.log(`Placeholder metric total: ${total}`);
  if (options.out !== undefined) console.log(`CSV written to ${options.out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
