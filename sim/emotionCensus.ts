import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { ENGINE_CONFIG } from '../src/psychology/config';
import { LEADERS, type Leader } from './cli';
import { foldSeminarAwe, type SeminarAweOwnerResult } from './awe';
import {
  foldSeminarLoneliness,
  type SeminarLonelinessOwnerResult,
} from './loneliness';
import { foldSeminarPanic } from './panic';
import { foldSeminarRelief, type SeminarReliefOwnerResult } from './relief';
import { foldSeminarSpite } from './spite';
import { foldSeminarGuilt } from './guilt';
import { foldEnvy } from './envy';
import { foldPride } from './pride';
import { runSeminar, type SeminarResult } from './seminar';
import { SEMINAR_CONFIG } from './seminarConfig';
import type { SimEngineKind } from './engine';

export interface EmotionCensusArgs {
  readonly seed: number;
  readonly weeks: number;
  readonly matches: number;
  readonly commanders: number;
  readonly catalogue: readonly Leader[];
  readonly engine: SimEngineKind;
  readonly out: string | undefined;
  readonly panicFloor: number;
  readonly relief: number;
  readonly guiltSafetyFloor: number;
}

export interface CensusCommander {
  readonly id: string;
  readonly style: string;
}

export interface CensusIncident {
  readonly commanderId: string;
  readonly week: number;
  readonly pieceId: string;
  readonly pieceIds?: readonly string[];
  readonly match?: number;
}

export interface CensusRow {
  readonly commanders: number;
  readonly matches: number;
  readonly named: number;
  readonly matchesWithNaming: number;
  readonly pieces: number;
  readonly perMatch: number;
}

export type CensusTable = Readonly<Record<string, CensusRow>>;

export interface EmotionCensusOutput {
  readonly args: EmotionCensusArgs;
  readonly playDigest: string;
  readonly recordDigest: string;
  readonly tables: Readonly<
    Record<string, Readonly<Record<string, CensusTable>>>
  >;
}

const MUTABLE_CONFIG = ENGINE_CONFIG as unknown as Record<string, number>;
const DEFAULT_CATALOGUE: readonly Leader[] = [
  'servant',
  'supportive',
  'tyrannical',
  'volatile',
  'random',
  'steady',
];

function positiveInteger(
  value: string | undefined,
  flag: string,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`--${flag} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(
  value: string | undefined,
  flag: string,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`--${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function nonNegativeNumber(
  value: string | undefined,
  flag: string,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${flag} must be a non-negative number.`);
  }
  return parsed;
}

function parseCatalogue(value: string | undefined): readonly Leader[] {
  if (value === undefined) return DEFAULT_CATALOGUE;
  const catalogue = value.split(',').map((style) => style.trim());
  if (catalogue.length === 0 || catalogue.some((style) => style.length === 0)) {
    throw new Error('--catalogue must contain at least one style.');
  }
  for (const style of catalogue) {
    if (!LEADERS.includes(style as Leader)) {
      throw new Error(`--catalogue contains an invalid leader style: ${style}`);
    }
  }
  return catalogue as Leader[];
}

export function parseEmotionCensusArgs(
  argumentsList: readonly string[],
): EmotionCensusArgs {
  const supported = new Set([
    'seed',
    'weeks',
    'matches',
    'commanders',
    'catalogue',
    'engine',
    'out',
    'panic-floor',
    'relief',
    'guilt-safety-floor',
  ]);
  const values = new Map<string, string>();
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
  const out = values.get('out');
  if (out === '') throw new Error('--out must not be empty.');
  return {
    seed,
    weeks: positiveInteger(
      values.get('weeks'),
      'weeks',
      SEMINAR_CONFIG.WEEKS_PER_SEMESTER,
    ),
    matches: positiveInteger(
      values.get('matches'),
      'matches',
      SEMINAR_CONFIG.MATCHES_PER_WEEK,
    ),
    commanders: positiveInteger(
      values.get('commanders'),
      'commanders',
      SEMINAR_CONFIG.COMMANDERS_PER_COHORT,
    ),
    catalogue: parseCatalogue(values.get('catalogue')),
    engine: engine as SimEngineKind,
    out,
    panicFloor: nonNegativeInteger(
      values.get('panic-floor'),
      'panic-floor',
      ENGINE_CONFIG.PANIC_ROSTER_FLOOR,
    ),
    relief: nonNegativeInteger(
      values.get('relief'),
      'relief',
      ENGINE_CONFIG.RELIEF_CAPTURE_RISK_PERMILLE,
    ),
    guiltSafetyFloor: nonNegativeNumber(
      values.get('guilt-safety-floor'),
      'guilt-safety-floor',
      ENGINE_CONFIG.GUILT_PEER_SAFETY_FLOOR,
    ),
  };
}

export function withPatchedEngineConfig<T>(
  changes: Readonly<Record<string, number>>,
  callback: () => T,
): T {
  const previous = new Map<string, number>();
  for (const key of Object.keys(changes)) {
    if (typeof MUTABLE_CONFIG[key] !== 'number') {
      throw new TypeError(`Unknown numeric engine config key: ${key}`);
    }
    previous.set(key, MUTABLE_CONFIG[key] as number);
  }
  for (const [key, value] of Object.entries(changes)) {
    MUTABLE_CONFIG[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of previous) MUTABLE_CONFIG[key] = value;
  }
}

export async function withPatchedEngineConfigAsync<T>(
  changes: Readonly<Record<string, number>>,
  callback: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, number>();
  for (const key of Object.keys(changes)) {
    if (typeof MUTABLE_CONFIG[key] !== 'number') {
      throw new TypeError(`Unknown numeric engine config key: ${key}`);
    }
    previous.set(key, MUTABLE_CONFIG[key] as number);
  }
  for (const [key, value] of Object.entries(changes)) {
    MUTABLE_CONFIG[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) MUTABLE_CONFIG[key] = value;
  }
}

export function buildIncidenceTable(
  incidents: readonly CensusIncident[],
  commanders: readonly CensusCommander[],
  weeks: number,
  matchesPerWeek: number,
): CensusTable {
  const byStyle = new Map<
    string,
    { readonly commanders: Set<string>; readonly incidents: CensusIncident[] }
  >();
  for (const commander of commanders) {
    const current = byStyle.get(commander.style);
    if (current === undefined) {
      byStyle.set(commander.style, {
        commanders: new Set([commander.id]),
        incidents: [],
      });
    } else {
      current.commanders.add(commander.id);
    }
  }
  for (const incident of incidents) {
    const commander = commanders.find(
      (candidate) => candidate.id === incident.commanderId,
    );
    if (commander === undefined) {
      throw new Error(`Unknown census commander: ${incident.commanderId}`);
    }
    byStyle.get(commander.style)?.incidents.push(incident);
  }
  return Object.fromEntries(
    [...byStyle.entries()].map(([style, data]) => {
      const matches = data.commanders.size * weeks * matchesPerWeek;
      const matchKeys = new Set(
        data.incidents.map((incident) =>
          incident.match === undefined
            ? `${incident.commanderId}:${incident.week}`
            : `${incident.commanderId}:${incident.week}:${incident.match}`,
        ),
      );
      const pieces = new Set(
        data.incidents.flatMap(
          (incident) => incident.pieceIds ?? [incident.pieceId],
        ),
      );
      return [
        style,
        {
          commanders: data.commanders.size,
          matches,
          named: data.incidents.length,
          matchesWithNaming: matchKeys.size,
          pieces: pieces.size,
          perMatch: matches === 0 ? 0 : data.incidents.length / matches,
        },
      ];
    }),
  );
}

function foldWeeks(result: SeminarResult) {
  return result.weeks.map(({ week, records }) => ({ week, records }));
}

function panicIncidents(result: SeminarResult): CensusIncident[] {
  const folded = foldSeminarPanic(foldWeeks(result));
  return Object.entries(folded).flatMap(([commanderId, owner]) =>
    owner.incidents.flatMap((incident) => {
      const event = result.weeks
        .find((week) => week.week === incident.week)
        ?.records[commanderId]?.flatMap((record) => record.events)
        .find(
          (candidate) =>
            candidate.t === 'PANIC_ONSET' &&
            candidate.ply === incident.ply &&
            candidate.trigger === incident.trigger,
        );
      return event?.t === 'PANIC_ONSET'
        ? [
            {
              commanderId,
              week: incident.week,
              pieceId: `${commanderId}:panic:${incident.week}:${incident.ply}`,
              pieceIds: event.dreading,
            },
          ]
        : [];
    }),
  );
}

function reliefIncidents(
  folded: Readonly<Record<string, SeminarReliefOwnerResult>>,
): CensusIncident[] {
  return Object.entries(folded).flatMap(([commanderId, result]) =>
    result.incidents.map((incident) => ({
      commanderId,
      week: incident.week,
      pieceId: incident.pieceId,
    })),
  );
}

function aweIncidents(
  folded: Readonly<Record<string, SeminarAweOwnerResult>>,
): CensusIncident[] {
  return Object.entries(folded).flatMap(([commanderId, result]) =>
    result.heroes.map((hero) => ({
      commanderId,
      week: hero.week,
      pieceId: hero.pieceId,
    })),
  );
}

function lonelinessIncidents(
  folded: Readonly<Record<string, SeminarLonelinessOwnerResult>>,
): CensusIncident[] {
  return Object.entries(folded).flatMap(([commanderId, result]) =>
    result.lonely.map((reading) => ({
      commanderId,
      week: reading.week,
      pieceId: reading.pieceId,
    })),
  );
}

function envyIncidents(
  folded: Readonly<
    Record<
      string,
      readonly { readonly cycle: number; readonly pieceId: string }[]
    >
  >,
): CensusIncident[] {
  return Object.entries(folded).flatMap(([commanderId, incidents]) =>
    incidents.map((incident) => ({
      commanderId,
      week: incident.cycle,
      pieceId: incident.pieceId,
    })),
  );
}

function prideIncidents(
  folded: Readonly<
    Record<
      string,
      {
        readonly proud: readonly {
          readonly pieceId: string;
          readonly steps: readonly { readonly cycle: number }[];
        }[];
        readonly wounded: readonly {
          readonly pieceId: string;
          readonly steps: readonly { readonly cycle: number }[];
        }[];
      }
    >
  >,
): CensusIncident[] {
  return Object.entries(folded).flatMap(([commanderId, reading]) =>
    [...reading.proud, ...reading.wounded].map((career) => ({
      commanderId,
      week: career.steps[0]?.cycle ?? 0,
      pieceId: career.pieceId,
    })),
  );
}

function eventIncidents(
  folded: Readonly<
    Record<
      string,
      readonly {
        readonly pieceId: string;
        readonly week: number;
        readonly match: number;
      }[]
    >
  >,
): CensusIncident[] {
  return Object.entries(folded).flatMap(([commanderId, incidents]) =>
    incidents.map((incident) => ({
      commanderId,
      week: incident.week,
      match: incident.match,
      pieceId: incident.pieceId,
    })),
  );
}

function recordedIncidents(
  result: SeminarResult,
  key: string,
): CensusIncident[] {
  return result.commanders.flatMap((commander) => {
    const value = commander[key as keyof typeof commander];
    const items: readonly unknown[] = Array.isArray(value)
      ? value
      : value !== null && typeof value === 'object'
        ? Object.values(value).flatMap((entry) =>
            Array.isArray(entry) ? entry : [],
          )
        : [];
    return items.map((item, index) => {
      const object =
        item !== null && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {};
      const pieceId =
        typeof object.pieceId === 'string'
          ? object.pieceId
          : `${commander.commander.id}:${key}:${index}`;
      const week = typeof object.week === 'number' ? object.week : 0;
      const match = typeof object.match === 'number' ? object.match : undefined;
      return {
        commanderId: commander.commander.id,
        week,
        pieceId,
        ...(match === undefined ? {} : { match }),
      };
    });
  });
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function styleMap(result: SeminarResult): readonly CensusCommander[] {
  return result.commanders.map((entry) => ({
    id: entry.commander.id,
    style: entry.commander.style,
  }));
}

function table(
  incidents: readonly CensusIncident[],
  commanders: readonly CensusCommander[],
  args: EmotionCensusArgs,
): CensusTable {
  return buildIncidenceTable(incidents, commanders, args.weeks, args.matches);
}

export async function runEmotionCensus(
  args: EmotionCensusArgs,
): Promise<EmotionCensusOutput> {
  const result = await withPatchedEngineConfigAsync(
    {
      PANIC_ROSTER_FLOOR: args.panicFloor,
      RELIEF_CAPTURE_RISK_PERMILLE: args.relief,
      GUILT_PEER_SAFETY_FLOOR: args.guiltSafetyFloor,
    },
    () =>
      runSeminar({
        seed: args.seed,
        config: {
          ...SEMINAR_CONFIG,
          WEEKS_PER_SEMESTER: args.weeks,
          MATCHES_PER_WEEK: args.matches,
          COMMANDERS_PER_COHORT: args.commanders,
          COMMANDER_STYLE_CATALOGUE: args.catalogue,
        },
        engineKind: args.engine,
      }),
  );
  const commanders = styleMap(result);
  const weeks = foldWeeks(result);
  const tables: Record<string, Record<string, CensusTable>> = {};
  const add = (
    knob: string,
    value: number | string,
    incidents: readonly CensusIncident[],
  ) => {
    (tables[knob] ??= {})[String(value)] = table(incidents, commanders, args);
  };

  for (const floor of [1, 10, 20, 40]) {
    add('envy', floor, envyIncidents(foldEnvy(result.envyCycles, floor)));
  }
  for (const ema of [250, 500]) {
    for (const floor of [1, 100, 250, 500]) {
      add(
        'pride',
        `ema=${ema},floor=${floor}`,
        prideIncidents(
          foldPride(result.prideEvents, result.config, ema, floor),
        ),
      );
    }
  }
  for (const floor of [1, 2, 3]) {
    add('awe', floor, aweIncidents(foldSeminarAwe(weeks, floor)));
  }
  for (const threshold of [25, 50, 75]) {
    add(
      'loneliness',
      threshold,
      lonelinessIncidents(foldSeminarLoneliness(weeks, threshold)),
    );
  }
  for (const cost of [1, 2, 3, 5]) {
    add(
      'spiteCommanderCost',
      cost,
      withPatchedEngineConfig(
        {
          SPITE_COMMANDER_COST_FLOOR: cost,
          SPITE_DESERTION_PIVOTALITY_FLOOR: 0,
        },
        () =>
          eventIncidents(
            foldSeminarSpite(weeks) as Readonly<
              Record<
                string,
                readonly {
                  readonly pieceId: string;
                  readonly week: number;
                  readonly match: number;
                }[]
              >
            >,
          ),
      ),
    );
  }
  for (const pivotality of [0.1, 0.25, 0.5, 0.75]) {
    add(
      'spiteDesertionPivotality',
      pivotality,
      withPatchedEngineConfig(
        {
          SPITE_COMMANDER_COST_FLOOR: 0,
          SPITE_DESERTION_PIVOTALITY_FLOOR: pivotality,
        },
        () =>
          eventIncidents(
            foldSeminarSpite(weeks) as Readonly<
              Record<
                string,
                readonly {
                  readonly pieceId: string;
                  readonly week: number;
                  readonly match: number;
                }[]
              >
            >,
          ),
      ),
    );
  }
  for (const window of [2, 4, 8]) {
    add(
      'guiltCascadeWindow',
      window,
      withPatchedEngineConfig(
        {
          GUILT_CASCADE_WINDOW_PLIES: window,
          GUILT_PEER_SAFETY_FLOOR: args.guiltSafetyFloor,
        },
        () =>
          eventIncidents(
            foldSeminarGuilt(weeks) as Readonly<
              Record<
                string,
                readonly {
                  readonly pieceId: string;
                  readonly week: number;
                  readonly match: number;
                }[]
              >
            >,
          ),
      ),
    );
  }
  add('panic', 'recorded', panicIncidents(result));
  add('relief', 'recorded', reliefIncidents(foldSeminarRelief(weeks)));
  add('gratitude', 'recorded', recordedIncidents(result, 'gratitude'));
  add('grief', 'recorded', recordedIncidents(result, 'grief'));
  add('shame', 'recorded', recordedIncidents(result, 'shame'));
  add('bitterness', 'recorded', recordedIncidents(result, 'bitterness'));

  return {
    args,
    playDigest: digest([
      result.standings,
      result.commanders.map((entry) => [
        entry.commander.id,
        entry.judgementSeat,
      ]),
    ]),
    recordDigest: digest(result.weeks.map((week) => week.recordDigests)),
    tables,
  };
}

function printCensus(output: EmotionCensusOutput): void {
  console.log(`playDigest=${output.playDigest}`);
  console.log(`recordDigest=${output.recordDigest}`);
  for (const [knob, values] of Object.entries(output.tables)) {
    for (const [value, rows] of Object.entries(values)) {
      for (const [style, row] of Object.entries(rows)) {
        console.log(
          [
            knob,
            value,
            style,
            `commanders=${row.commanders}`,
            `matches=${row.matches}`,
            `named=${row.named}`,
            `matchesWithNaming=${row.matchesWithNaming}`,
            `pieces=${row.pieces}`,
            `perMatch=${row.perMatch}`,
          ].join('\t'),
        );
      }
    }
  }
}

async function main(): Promise<void> {
  const args = parseEmotionCensusArgs(process.argv.slice(2));
  const output = await runEmotionCensus(args);
  printCensus(output);
  if (args.out !== undefined) {
    await mkdir(dirname(args.out), { recursive: true });
    await writeFile(args.out, JSON.stringify(output, null, 2), 'utf8');
  }
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
