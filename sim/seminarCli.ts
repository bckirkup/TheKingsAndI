import { seminarPayload, seminarSummary, runSeminar } from './seminar';
import { SEMINAR_CONFIG } from './seminarConfig';
import type { SimEngineKind } from './engine';

function parseInteger(
  values: ReadonlyMap<string, string>,
  key: string,
  fallback: number,
): number {
  const value = Number(values.get(key) ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--${key} must be a positive integer.`);
  }
  return value;
}

function parseArguments(argumentsList: readonly string[]): {
  readonly seed: number;
  readonly weeks: number;
  readonly matches: number;
  readonly commanders: number;
  readonly engine: SimEngineKind;
  readonly draftAtCycleOne: boolean;
  readonly clearingRule: 'first_price' | 'second_price';
  readonly purseToAskingRatioPermille: number;
} {
  const values = new Map<string, string>();
  const supported = new Set([
    'seed',
    'weeks',
    'matches',
    'commanders',
    'engine',
    'draft-at-cycle-one',
    'clearing-rule',
    'purse-to-asking-ratio',
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
    if (!supported.has(key)) throw new Error(`Unrecognised flag: --${key}`);
    if (values.has(key)) throw new Error(`Repeated flag: --${key}`);
    values.set(key, argument.slice(separator + 1));
  }
  const seed = Number(values.get('seed') ?? 0);
  if (!Number.isSafeInteger(seed))
    throw new Error('--seed must be an integer.');
  const engine = values.get('engine') ?? 'fake';
  if (!['fake', 'lozza', 'stockfish'].includes(engine)) {
    throw new Error('--engine must be fake, lozza, or stockfish.');
  }
  const draftAtCycleOne = values.get('draft-at-cycle-one') ?? 'false';
  if (draftAtCycleOne !== 'true' && draftAtCycleOne !== 'false') {
    throw new Error('--draft-at-cycle-one must be true or false.');
  }
  const clearingRule = values.get('clearing-rule') ?? 'first_price';
  if (clearingRule !== 'first_price' && clearingRule !== 'second_price') {
    throw new Error('--clearing-rule must be first_price or second_price.');
  }
  const purseToAskingRatioPermille = Number(
    values.get('purse-to-asking-ratio') ??
      SEMINAR_CONFIG.DRAFT_PURSE_TO_ASKING_RATIO_PERMILLE,
  );
  if (
    !Number.isSafeInteger(purseToAskingRatioPermille) ||
    purseToAskingRatioPermille < 0 ||
    purseToAskingRatioPermille > 1000
  ) {
    throw new Error(
      '--purse-to-asking-ratio must be an integer from 0 to 1000.',
    );
  }
  return {
    seed,
    weeks: parseInteger(values, 'weeks', SEMINAR_CONFIG.WEEKS_PER_SEMESTER),
    matches: parseInteger(values, 'matches', SEMINAR_CONFIG.MATCHES_PER_WEEK),
    commanders: parseInteger(
      values,
      'commanders',
      SEMINAR_CONFIG.COMMANDERS_PER_COHORT,
    ),
    engine: engine as SimEngineKind,
    draftAtCycleOne: draftAtCycleOne === 'true',
    clearingRule,
    purseToAskingRatioPermille,
  };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const result = await runSeminar({
    seed: options.seed,
    config: {
      ...SEMINAR_CONFIG,
      WEEKS_PER_SEMESTER: options.weeks,
      MATCHES_PER_WEEK: options.matches,
      COMMANDERS_PER_COHORT: options.commanders,
      DRAFT_AT_CYCLE_ONE: options.draftAtCycleOne,
      DRAFT_CLEARING_RULE: options.clearingRule,
      DRAFT_PURSE_TO_ASKING_RATIO_PERMILLE: options.purseToAskingRatioPermille,
    },
    engineKind: options.engine,
  });
  console.log(seminarPayload(result));
  console.log(seminarSummary(result));
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
