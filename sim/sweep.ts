/**
 * Milestone 3.4 coefficient sweep runner.
 *
 * Sweeps named ENGINE_CONFIG knobs by temporarily patching the exported
 * config object (tests/calibration only — never used in production play).
 *
 * Usage:
 *   pnpm exec tsx sim/sweep.ts --knob=BENEV_EXPENDABLE_FLOOR --values=15,25,35 --matches=4 --seed=7
 *   pnpm exec tsx sim/sweep.ts --grid=BENEV_BETRAYAL_CLIFF_PERMILLE=0,500;BENEV_RUPTURE_DEBT_CEILING=50,100 --matches=4 --seed=7
 *
 * `--fixed=KEY=VALUE,KEY=VALUE` pins further knobs for every point of the
 * sweep, so a coefficient that only has meaning in the presence of another
 * (D165 regard and repair) can be measured jointly rather than one at a time.
 */

import { ENGINE_CONFIG } from '../src/psychology/config';

import { runCampaign } from './campaign';
import {
  ENGINES,
  OPPONENT_ARCHETYPES,
  opponentArchetypeForLeader,
  type Leader,
} from './cli';
import { plainChessMeanWinScore } from './baseline';
import { disposeSimEngine, type SimEngineKind } from './engine';
import { csvField } from './metrics';
import type { OpponentArchetype } from '../src/orchestration/leaderPolicy';

export interface SweepPoint {
  readonly knob: string;
  readonly value: number;
  readonly meanRefusalRate: number;
  readonly meanRefusalsPerPly: number;
  readonly desertionMatchRate: number;
  readonly desertionAttrition: number;
  readonly meanOverrideRate: number;
  readonly meanOverrideCount: number;
  readonly meanFreeOverrideCount: number;
  readonly meanBenevLossTarget: number;
  readonly meanBenevLossWitness: number;
  readonly meanFreeInsistencePlyFraction: number;
  readonly meanWinScore: number;
  readonly meanTrustDelta: number;
  readonly meanPlies: number;
  readonly winCount: number;
  readonly drawCount: number;
  readonly lossCount: number;
  readonly meanPromotionsPerMatch: number;
  readonly promotionMatchRate: number;
  readonly promotionToRoleCounts: Readonly<Record<string, number>>;
  readonly enemyDesertionAttrition: number;
  readonly meanEnemyDesertions: number;
  readonly plainChessWinDelta: number;
  readonly meanDripGainTotal: number;
  readonly meanRegardEvents: number;
  readonly meanRegardGainTotal: number;
  readonly meanAdjudicationLoss: number;
  readonly meanTauBenev: number;
  readonly meanQuietQuitRate: number;
  readonly meanTauAbil: number;
  readonly roleTauAbil: Readonly<Record<string, number>>;
  readonly abilityMin: number;
  readonly abilityMax: number;
  readonly meanAbility: number;
  readonly abilityMovedCount: number;
}

export interface GridAxis {
  readonly knob: string;
  readonly values: readonly number[];
}

export interface GridSweepPoint extends Omit<SweepPoint, 'knob' | 'value'> {
  readonly cell: number;
  readonly axisValues: Readonly<Record<string, number>>;
  readonly wallClockMs: number;
  readonly engineCalls: number;
}

const MUTABLE_CONFIG = ENGINE_CONFIG as unknown as Record<string, number>;

export function parseGridSpec(spec: string): readonly GridAxis[] {
  if (spec.length === 0) {
    throw new Error('Empty --grid: --grid=');
  }
  const seen = new Set<string>();
  return spec.split(';').map((axisToken) => {
    const separator = axisToken.indexOf('=');
    if (separator < 1) {
      throw new Error(`Invalid grid axis: ${axisToken}`);
    }
    const knob = axisToken.slice(0, separator);
    if (seen.has(knob)) {
      throw new Error(`Repeated grid axis: ${axisToken}`);
    }
    seen.add(knob);
    if (typeof MUTABLE_CONFIG[knob] !== 'number') {
      throw new TypeError(`Invalid grid config key: ${axisToken}`);
    }
    const valueSpec = axisToken.slice(separator + 1);
    if (valueSpec.length === 0) {
      throw new Error(`Empty grid value list: ${axisToken}`);
    }
    const values = valueSpec.split(',').map((rawValue) => {
      if (rawValue.length === 0) {
        throw new Error(`Empty grid value: ${axisToken}`);
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        throw new TypeError(`Invalid grid value: ${axisToken}`);
      }
      return value;
    });
    return Object.freeze({ knob, values: Object.freeze(values) });
  });
}

export interface GridCell {
  readonly cell: number;
  readonly axisValues: Readonly<Record<string, number>>;
}

export function enumerateGrid(axes: readonly GridAxis[]): readonly GridCell[] {
  if (axes.length === 0) {
    throw new Error('Empty --grid: no axes supplied.');
  }
  const cells: GridCell[] = [];
  const axisValues: Record<string, number> = {};
  const visit = (axisIndex: number): void => {
    const axis = axes[axisIndex];
    if (axis === undefined) {
      cells.push(
        Object.freeze({
          cell: cells.length + 1,
          axisValues: Object.freeze({ ...axisValues }),
        }),
      );
      return;
    }
    for (const value of axis.values) {
      axisValues[axis.knob] = value;
      visit(axisIndex + 1);
    }
    delete axisValues[axis.knob];
  };
  visit(0);
  return Object.freeze(cells);
}

function parseList(flag: string | undefined, fallback: number[]): number[] {
  if (flag === undefined || flag.length === 0) return fallback;
  return flag.split(',').map((part) => {
    const value = Number(part);
    if (!Number.isFinite(value)) {
      throw new TypeError(`Invalid sweep value: ${part}`);
    }
    return value;
  });
}

function parseFixed(
  flag: string | undefined,
): Readonly<Record<string, number>> {
  if (flag === undefined || flag.length === 0) return {};
  const fixed: Record<string, number> = {};
  for (const pair of flag.split(',')) {
    const separator = pair.indexOf('=');
    if (separator < 1) {
      throw new Error(`Expected --fixed=KEY=VALUE, got ${pair}`);
    }
    const key = pair.slice(0, separator);
    const value = Number(pair.slice(separator + 1));
    if (typeof MUTABLE_CONFIG[key] !== 'number') {
      throw new TypeError(`Knob ${key} is not a numeric config.`);
    }
    if (!Number.isFinite(value)) {
      throw new TypeError(`Invalid fixed value: ${pair}`);
    }
    fixed[key] = value;
  }
  return fixed;
}

function sweepMetrics(
  campaign: Awaited<ReturnType<typeof runCampaign>>,
  plainWin: number,
): Omit<SweepPoint, 'knob' | 'value'> {
  return {
    meanRefusalRate: campaign.summary.meanRefusalRate,
    meanRefusalsPerPly: campaign.summary.meanRefusalsPerPly,
    desertionMatchRate: campaign.summary.desertionMatchRate,
    desertionAttrition: campaign.summary.desertionAttrition,
    meanOverrideRate: campaign.summary.meanOverrideRate,
    meanOverrideCount: campaign.summary.meanOverrideCount,
    meanFreeOverrideCount: campaign.summary.meanFreeOverrideCount,
    meanBenevLossTarget: campaign.summary.meanBenevLossTarget,
    meanBenevLossWitness: campaign.summary.meanBenevLossWitness,
    meanFreeInsistencePlyFraction:
      campaign.summary.meanFreeInsistencePlyFraction,
    meanWinScore: campaign.summary.meanWinScore,
    meanTrustDelta: campaign.summary.meanTrustDelta,
    meanPlies: campaign.summary.meanPlies,
    winCount: campaign.summary.winCount,
    drawCount: campaign.summary.drawCount,
    lossCount: campaign.summary.lossCount,
    meanPromotionsPerMatch: campaign.summary.meanPromotionsPerMatch,
    promotionMatchRate: campaign.summary.promotionMatchRate,
    promotionToRoleCounts: campaign.summary.promotionToRoleCounts,
    enemyDesertionAttrition: campaign.summary.enemyDesertionAttrition,
    meanEnemyDesertions: campaign.summary.meanEnemyDesertions,
    plainChessWinDelta: campaign.summary.meanWinScore - plainWin,
    meanDripGainTotal: campaign.summary.meanDripGainTotal,
    meanRegardEvents: campaign.summary.meanRegardEvents,
    meanRegardGainTotal: campaign.summary.meanRegardGainTotal,
    meanAdjudicationLoss: campaign.summary.meanAdjudicationLoss,
    meanTauBenev: campaign.summary.meanTauBenev,
    meanQuietQuitRate: campaign.summary.meanQuietQuitRate,
    meanTauAbil: campaign.summary.meanTauAbil,
    roleTauAbil:
      campaign.summary.trajectoryBands.at(-1)?.meanFinalTauAbilByRole ?? {},
    abilityMin: campaign.summary.abilityMin,
    abilityMax: campaign.summary.abilityMax,
    meanAbility: campaign.summary.meanAbility,
    abilityMovedCount: campaign.summary.abilityMovedCount,
  };
}

interface SweepCampaignResult {
  readonly point: SweepPoint;
  readonly wallClockMs: number;
  readonly engineCalls: number;
}

async function runSweepCampaign(options: {
  readonly matches: number;
  readonly seed: number;
  readonly leader: Leader;
  readonly opponent: OpponentArchetype;
  readonly engineKind: SimEngineKind;
  readonly depthCap: number | undefined;
  readonly plainWin: number;
  readonly knob: string;
  readonly value: number;
}): Promise<SweepCampaignResult> {
  const startedAt = process.hrtime.bigint();
  try {
    const campaign = await runCampaign({
      matches: options.matches,
      leader: options.leader,
      opponent: options.opponent,
      seed: options.seed,
      engineKind: options.engineKind,
      depthCap: options.depthCap,
    });
    return {
      point: {
        knob: options.knob,
        value: options.value,
        ...sweepMetrics(campaign, options.plainWin),
      },
      wallClockMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      engineCalls: campaign.cost?.engineCalls ?? 0,
    };
  } finally {
    await disposeSimEngine(options.engineKind);
  }
}

export async function runCoefficientSweep(options: {
  readonly knob: keyof typeof ENGINE_CONFIG;
  readonly values: readonly number[];
  readonly matches: number;
  readonly seed: number;
  readonly leader: Leader;
  readonly opponent: OpponentArchetype;
  readonly engineKind?: SimEngineKind;
  readonly depthCap?: number | undefined;
}): Promise<readonly SweepPoint[]> {
  const original = MUTABLE_CONFIG[options.knob as string];
  if (typeof original !== 'number') {
    throw new TypeError(
      `Knob ${String(options.knob)} is not a numeric config.`,
    );
  }
  const plainWin = plainChessMeanWinScore({
    matches: options.matches,
    seed: options.seed,
    whiteLeader: options.leader,
    blackLeader: options.opponent,
  });
  const points: SweepPoint[] = [];
  try {
    for (const value of options.values) {
      MUTABLE_CONFIG[options.knob as string] = value;
      const engineKind = options.engineKind ?? 'lozza';
      const result = await runSweepCampaign({
        matches: options.matches,
        leader: options.leader,
        opponent: options.opponent,
        seed: options.seed,
        plainWin,
        knob: String(options.knob),
        value,
        engineKind,
        depthCap: options.depthCap,
      });
      points.push(result.point);
    }
  } finally {
    MUTABLE_CONFIG[options.knob as string] = original;
  }
  return points;
}

function patchConfig(
  values: Readonly<Record<string, number>>,
  originals: Map<string, number>,
): void {
  for (const [key, value] of Object.entries(values)) {
    const original = MUTABLE_CONFIG[key];
    if (typeof original !== 'number') {
      throw new TypeError(`Invalid grid config key: ${key}`);
    }
    if (!originals.has(key)) originals.set(key, original);
    MUTABLE_CONFIG[key] = value;
  }
}

export async function runGridSweep(options: {
  readonly axes: readonly GridAxis[];
  readonly fixed?: Readonly<Record<string, number>>;
  readonly matches: number;
  readonly seed: number;
  readonly leader: Leader;
  readonly opponent: OpponentArchetype;
  readonly engineKind?: SimEngineKind;
  readonly depthCap?: number | undefined;
  readonly skip?: number;
  readonly limit?: number | undefined;
  readonly dryRun?: boolean;
  readonly onCell?: (cell: GridCell, total: number) => void;
}): Promise<readonly GridSweepPoint[]> {
  const axes = options.axes;
  const cells = enumerateGrid(axes);
  const fixed = options.fixed ?? {};
  const engineKind = options.engineKind ?? 'fake';
  const skip = options.skip ?? 0;
  const limit = options.limit;
  if (!Number.isSafeInteger(skip) || skip < 0) {
    throw new Error(`--skip must be a non-negative integer: ${skip}`);
  }
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw new Error(`--limit must be a non-negative integer: ${limit}`);
  }
  if (options.dryRun) return [];
  const plainWin = plainChessMeanWinScore({
    matches: options.matches,
    seed: options.seed,
    whiteLeader: options.leader,
    blackLeader: options.opponent,
  });
  const firstCell = Math.min(skip, cells.length);
  const lastCell = Math.min(
    cells.length,
    limit === undefined ? cells.length : firstCell + limit,
  );
  const originals = new Map<string, number>();
  const points: GridSweepPoint[] = [];
  try {
    for (const cell of cells.slice(firstCell, lastCell)) {
      options.onCell?.(cell, cells.length);
      const axisValues = cell.axisValues;
      patchConfig(fixed, originals);
      patchConfig(axisValues, originals);
      const result = await runSweepCampaign({
        matches: options.matches,
        leader: options.leader,
        opponent: options.opponent,
        seed: options.seed,
        plainWin,
        knob: '',
        value: 0,
        engineKind,
        depthCap: options.depthCap,
      });
      points.push({
        ...result.point,
        cell: cell.cell,
        axisValues,
        wallClockMs: result.wallClockMs,
        engineCalls: result.engineCalls,
      });
    }
  } finally {
    for (const [key, value] of originals) {
      MUTABLE_CONFIG[key] = value;
    }
  }
  return points;
}

interface SweepCliOptions {
  knob: keyof typeof ENGINE_CONFIG;
  values: number[];
  grid: readonly GridAxis[] | undefined;
  matches: number;
  seed: number;
  leader: Leader;
  opponent: OpponentArchetype;
  engine: SimEngineKind;
  depthCap: number | undefined;
  fixed: Readonly<Record<string, number>>;
  dryRun: boolean;
  skip: number;
  limit: number | undefined;
}

const SWEEP_METRIC_HEADER =
  'refusal,refusals_per_ply,desertion_match,desertion_attrition,override,win,trust_delta,mean_plies,win_count,draw_count,loss_count,promotions_per_match,promotion_match,promotion_to_role_counts,enemy_desertion_attrition,mean_enemy_desertions,plain_chess_win_delta,drip_gain_total,regard_events,regard_gain_total,override_count,free_override_count,benev_loss_target,benev_loss_witness,free_insistence_ply_fraction,adjudication_loss,tau_benev,quiet_quit,tau_abil,role_tau_abil,ability_min,ability_max,mean_ability,ability_moved_count';

function sweepMetricFields(
  point: Omit<SweepPoint, 'knob' | 'value'>,
): readonly string[] {
  return [
    point.meanRefusalRate.toFixed(4),
    point.meanRefusalsPerPly.toFixed(4),
    point.desertionMatchRate.toFixed(4),
    point.desertionAttrition.toFixed(4),
    point.meanOverrideRate.toFixed(4),
    point.meanWinScore.toFixed(1),
    point.meanTrustDelta.toFixed(2),
    point.meanPlies.toFixed(1),
    String(point.winCount),
    String(point.drawCount),
    String(point.lossCount),
    point.meanPromotionsPerMatch.toFixed(3),
    point.promotionMatchRate.toFixed(3),
    JSON.stringify(point.promotionToRoleCounts),
    point.enemyDesertionAttrition.toFixed(4),
    point.meanEnemyDesertions.toFixed(2),
    point.plainChessWinDelta.toFixed(1),
    point.meanDripGainTotal.toFixed(2),
    point.meanRegardEvents.toFixed(2),
    point.meanRegardGainTotal.toFixed(2),
    point.meanOverrideCount.toFixed(2),
    point.meanFreeOverrideCount.toFixed(2),
    point.meanBenevLossTarget.toFixed(2),
    point.meanBenevLossWitness.toFixed(2),
    point.meanFreeInsistencePlyFraction.toFixed(4),
    point.meanAdjudicationLoss.toFixed(2),
    point.meanTauBenev.toFixed(2),
    point.meanQuietQuitRate.toFixed(4),
    point.meanTauAbil.toFixed(2),
    JSON.stringify(point.roleTauAbil),
    point.abilityMin.toFixed(2),
    point.abilityMax.toFixed(2),
    point.meanAbility.toFixed(2),
    point.abilityMovedCount.toFixed(2),
  ];
}

function printGridDryRun(axes: readonly GridAxis[]): void {
  console.log(`axes=${axes.map((axis) => axis.knob).join(',')}`);
  for (const axis of axes) {
    console.log(
      `${axis.knob}=${axis.values.map((value) => String(value)).join(',')}`,
    );
  }
  console.log(`cells=${enumerateGrid(axes).length}`);
}

export function parseSweepArgs(argv: readonly string[]): SweepCliOptions {
  const map = new Map<string, string>();
  for (const argument of argv) {
    if (argument === '--dry-run') {
      map.set('dry-run', 'true');
      continue;
    }
    const separator = argument.indexOf('=');
    if (!argument.startsWith('--') || separator < 3) {
      throw new Error(`Expected --flag=value, got ${argument}`);
    }
    map.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  const grid = map.has('grid')
    ? parseGridSpec(map.get('grid') ?? '')
    : undefined;
  if (grid !== undefined && map.has('knob')) {
    throw new Error(
      `--grid and --knob are mutually exclusive: --knob=${map.get('knob')}`,
    );
  }
  const knob = (map.get('knob') ??
    'BENEV_EXPENDABLE_FLOOR') as keyof typeof ENGINE_CONFIG;
  const engine = map.get('engine') ?? (grid === undefined ? 'lozza' : 'fake');
  if (!ENGINES.includes(engine as SimEngineKind)) {
    throw new Error(`--engine must be one of: ${ENGINES.join(', ')}.`);
  }
  const opponentValue = map.get('opponent') ?? 'random';
  if (!OPPONENT_ARCHETYPES.includes(opponentValue as OpponentArchetype)) {
    throw new Error(
      `--opponent must be one of: ${OPPONENT_ARCHETYPES.join(', ')}.`,
    );
  }
  const opponent = opponentArchetypeForLeader(opponentValue as Leader);
  let depthCapValue: number | undefined;
  if (map.get('depth-cap') === undefined) {
    depthCapValue = engine === 'lozza' ? 4 : undefined;
  } else {
    depthCapValue = Number(map.get('depth-cap'));
  }
  if (
    depthCapValue !== undefined &&
    (!Number.isSafeInteger(depthCapValue) || depthCapValue < 1)
  ) {
    throw new Error('--depth-cap must be a positive integer.');
  }
  const skip = Number(map.get('skip') ?? 0);
  const limitValue = map.get('limit');
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  if (!Number.isSafeInteger(skip) || skip < 0) {
    throw new Error(`--skip must be a non-negative integer: ${skip}`);
  }
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw new Error(`--limit must be a non-negative integer: ${limit}`);
  }
  const dryRun = map.get('dry-run') === 'true';
  if (dryRun && grid === undefined) {
    throw new Error('--dry-run requires --grid.');
  }
  return {
    knob,
    values: parseList(map.get('values'), [15, 25, 35]),
    grid,
    matches: Number(map.get('matches') ?? 4),
    seed: Number(map.get('seed') ?? 7),
    leader: (map.get('leader') ?? 'tyrannical') as Leader,
    opponent,
    engine: engine as SimEngineKind,
    depthCap: depthCapValue,
    fixed: parseFixed(map.get('fixed')),
    dryRun,
    skip,
    limit,
  };
}

async function main(): Promise<void> {
  const options = parseSweepArgs(process.argv.slice(2));
  if (options.grid !== undefined) {
    if (options.dryRun) {
      printGridDryRun(options.grid);
      return;
    }
    const points = await runGridSweep({
      axes: options.grid,
      fixed: options.fixed,
      matches: options.matches,
      seed: options.seed,
      leader: options.leader,
      opponent: options.opponent,
      engineKind: options.engine,
      depthCap: options.depthCap,
      skip: options.skip,
      limit: options.limit,
      onCell: (cell, total) => {
        const values = options.grid
          ?.map((axis) => `${axis.knob}=${cell.axisValues[axis.knob]}`)
          .join(' ');
        console.error(`# cell ${cell.cell}/${total} ${values ?? ''}`.trimEnd());
      },
    });
    console.log(
      [
        'cell',
        ...options.grid.map((axis) => axis.knob),
        'wall_ms',
        'engine_calls',
        SWEEP_METRIC_HEADER,
      ].join(','),
    );
    for (const point of points) {
      console.log(
        [
          point.cell,
          ...options.grid.map((axis) => point.axisValues[axis.knob] ?? ''),
          point.wallClockMs.toFixed(1),
          point.engineCalls,
          ...sweepMetricFields(point),
        ]
          .map(csvField)
          .join(','),
      );
    }
    return;
  }
  const restore = new Map<string, number>();
  for (const [key, value] of Object.entries(options.fixed)) {
    const previous = MUTABLE_CONFIG[key];
    if (previous === undefined) {
      throw new TypeError(`Knob ${key} is not a numeric config.`);
    }
    restore.set(key, previous);
    MUTABLE_CONFIG[key] = value;
    console.error(`# fixed ${key}=${value}`);
  }
  let points;
  try {
    points = await runCoefficientSweep({
      ...options,
      engineKind: options.engine,
    });
  } finally {
    for (const [key, value] of restore) {
      MUTABLE_CONFIG[key] = value;
    }
  }
  console.log(`knob,value,${SWEEP_METRIC_HEADER}`);
  for (const point of points) {
    console.log(
      [point.knob, point.value, ...sweepMetricFields(point)]
        .map(csvField)
        .join(','),
    );
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
