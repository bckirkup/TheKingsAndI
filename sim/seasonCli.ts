import type { OpponentArchetype } from '../src/orchestration/leaderPolicy';

import { runSeason } from './season';
import type { SimEngineKind } from './engine';

const STYLES: readonly OpponentArchetype[] = [
  'tyrannical',
  'supportive',
  'volatile',
  'servant',
  'random',
];

function valueFor(
  values: ReadonlyMap<string, string>,
  name: string,
  fallback: string | undefined = undefined,
): string {
  const value = values.get(name) ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`--${name} is required.`);
  }
  return value;
}

function parseInteger(
  values: ReadonlyMap<string, string>,
  name: string,
  fallback?: number,
): number {
  const raw = valueFor(values, name, fallback?.toString());
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return value;
}

function parseArguments(argumentsList: readonly string[]): {
  readonly seed: number;
  readonly matches: number;
  readonly whiteStyle: OpponentArchetype;
  readonly blackStyle: OpponentArchetype;
  readonly depthFactor: number;
  readonly engineKind: SimEngineKind;
} {
  const values = new Map<string, string>();
  for (const argument of argumentsList) {
    if (!argument.startsWith('--')) {
      throw new Error(`Unrecognised argument: ${argument}`);
    }
    const separator = argument.indexOf('=');
    if (separator < 3) {
      throw new Error(`Expected --flag=value form: ${argument}`);
    }
    const name = argument.slice(2, separator);
    if (values.has(name)) throw new Error(`Repeated flag: --${name}`);
    values.set(name, argument.slice(separator + 1));
  }
  const supported = new Set([
    'seed',
    'matches',
    'white-style',
    'black-style',
    'pool-depth',
    'depth-factor',
    'engine',
  ]);
  for (const name of values.keys()) {
    if (!supported.has(name)) throw new Error(`Unrecognised flag: --${name}`);
  }
  const seed = Number(valueFor(values, 'seed', '0'));
  if (!Number.isSafeInteger(seed))
    throw new Error('--seed must be an integer.');
  const whiteStyle = valueFor(values, 'white-style', 'servant');
  const blackStyle = valueFor(values, 'black-style', 'supportive');
  if (!STYLES.includes(whiteStyle as OpponentArchetype)) {
    throw new Error(`--white-style must be one of: ${STYLES.join(', ')}.`);
  }
  if (!STYLES.includes(blackStyle as OpponentArchetype)) {
    throw new Error(`--black-style must be one of: ${STYLES.join(', ')}.`);
  }
  const engineKind = valueFor(values, 'engine', 'fake');
  if (!['fake', 'lozza', 'stockfish'].includes(engineKind)) {
    throw new Error('--engine must be fake, lozza, or stockfish.');
  }
  return {
    seed,
    matches: parseInteger(values, 'matches', 20),
    whiteStyle: whiteStyle as OpponentArchetype,
    blackStyle: blackStyle as OpponentArchetype,
    depthFactor: parseInteger(
      values,
      'pool-depth',
      Number(values.get('depth-factor') ?? '2'),
    ),
    engineKind: engineKind as SimEngineKind,
  };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const result = await runSeason(options);
  console.log(
    JSON.stringify({
      metrics: result.metrics,
      horizon: result.horizon,
      whiteSnapshots: result.whiteSnapshots,
      blackSnapshots: result.blackSnapshots,
      finalWhiteTrauma: result.finalWhitePool.members.map(
        (member) => member.state.B_i,
      ),
      finalBlackTrauma: result.finalBlackPool.members.map(
        (member) => member.state.B_i,
      ),
    }),
  );
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
