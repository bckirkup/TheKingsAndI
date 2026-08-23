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

function parseNonNegativeInteger(
  values: ReadonlyMap<string, string>,
  name: string,
): number {
  const raw = valueFor(values, name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
  return value;
}

const SUPPORTED_FLAGS = new Set([
  'seed',
  'matches',
  'white-style',
  'black-style',
  'pool-depth',
  'depth-factor',
  'reserve-depth',
  'engine',
]);

function collectFlagValues(argumentsList: readonly string[]): Map<string, string> {
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
  return values;
}

function assertSupportedFlags(values: ReadonlyMap<string, string>): void {
  for (const name of values.keys()) {
    if (!SUPPORTED_FLAGS.has(name)) {
      throw new Error(`Unrecognised flag: --${name}`);
    }
  }
}

function parseOpponentArchetype(
  values: ReadonlyMap<string, string>,
  flag: string,
  fallback: string,
): OpponentArchetype {
  const style = valueFor(values, flag, fallback);
  if (!STYLES.includes(style as OpponentArchetype)) {
    throw new Error(`--${flag} must be one of: ${STYLES.join(', ')}.`);
  }
  return style as OpponentArchetype;
}

function parseEngineKindValue(
  values: ReadonlyMap<string, string>,
): SimEngineKind {
  const engineKind = valueFor(values, 'engine', 'fake');
  if (!['fake', 'lozza', 'stockfish'].includes(engineKind)) {
    throw new Error('--engine must be fake, lozza, or stockfish.');
  }
  return engineKind as SimEngineKind;
}

function parseArguments(argumentsList: readonly string[]): {
  readonly seed: number;
  readonly matches: number;
  readonly whiteStyle: OpponentArchetype;
  readonly blackStyle: OpponentArchetype;
  readonly depthFactor: number;
  readonly reserveDepth?: number;
  readonly engineKind: SimEngineKind;
} {
  const values = collectFlagValues(argumentsList);
  assertSupportedFlags(values);
  const seed = Number(valueFor(values, 'seed', '0'));
  if (!Number.isSafeInteger(seed)) {
    throw new Error('--seed must be an integer.');
  }
  const reserveDepth = values.has('reserve-depth')
    ? parseNonNegativeInteger(values, 'reserve-depth')
    : undefined;
  return {
    seed,
    matches: parseInteger(values, 'matches', 20),
    whiteStyle: parseOpponentArchetype(values, 'white-style', 'servant'),
    blackStyle: parseOpponentArchetype(values, 'black-style', 'supportive'),
    depthFactor: parseInteger(
      values,
      'pool-depth',
      Number(values.get('depth-factor') ?? '2'),
    ),
    ...(reserveDepth === undefined ? {} : { reserveDepth }),
    engineKind: parseEngineKindValue(values),
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
      whitePoolMetrics: result.whitePoolMetrics,
      blackPoolMetrics: result.blackPoolMetrics,
      whitePoolFindings: result.whitePoolFindings,
      blackPoolFindings: result.blackPoolFindings,
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
  import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));

if (isMain) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
