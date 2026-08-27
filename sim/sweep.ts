/**
 * Milestone 3.4 coefficient sweep runner.
 *
 * Sweeps named ENGINE_CONFIG knobs by temporarily patching the exported
 * config object (tests/calibration only — never used in production play).
 *
 * Usage:
 *   pnpm exec tsx sim/sweep.ts --knob=BENEV_EXPENDABLE_FLOOR --values=15,25,35 --matches=4 --seed=7
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

const MUTABLE_CONFIG = ENGINE_CONFIG as unknown as Record<string, number>;

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
      const campaign = await runCampaign({
        matches: options.matches,
        leader: options.leader,
        opponent: options.opponent,
        seed: options.seed,
        engineKind,
        depthCap: options.depthCap,
      });
      await disposeSimEngine(engineKind);
      points.push({
        knob: String(options.knob),
        value,
        meanRefusalRate: campaign.summary.meanRefusalRate,
        meanRefusalsPerPly: campaign.summary.meanRefusalsPerPly,
        desertionMatchRate: campaign.summary.desertionMatchRate,
        desertionAttrition: campaign.summary.desertionAttrition,
        meanOverrideRate: campaign.summary.meanOverrideRate,
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
      });
    }
  } finally {
    MUTABLE_CONFIG[options.knob as string] = original;
  }
  return points;
}

function parseArgs(argv: readonly string[]): {
  knob: keyof typeof ENGINE_CONFIG;
  values: number[];
  matches: number;
  seed: number;
  leader: Leader;
  opponent: OpponentArchetype;
  engine: SimEngineKind;
  depthCap: number | undefined;
  fixed: Readonly<Record<string, number>>;
} {
  const map = new Map<string, string>();
  for (const argument of argv) {
    const separator = argument.indexOf('=');
    if (!argument.startsWith('--') || separator < 3) {
      throw new Error(`Expected --flag=value, got ${argument}`);
    }
    map.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  const knob = (map.get('knob') ??
    'BENEV_EXPENDABLE_FLOOR') as keyof typeof ENGINE_CONFIG;
  const engine = map.get('engine') ?? 'lozza';
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
  return {
    knob,
    values: parseList(map.get('values'), [15, 25, 35]),
    matches: Number(map.get('matches') ?? 4),
    seed: Number(map.get('seed') ?? 7),
    leader: (map.get('leader') ?? 'tyrannical') as Leader,
    opponent,
    engine: engine as SimEngineKind,
    depthCap: depthCapValue,
    fixed: parseFixed(map.get('fixed')),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
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
  console.log(
    'knob,value,refusal,refusals_per_ply,desertion_match,desertion_attrition,override,win,trust_delta,mean_plies,win_count,draw_count,loss_count,promotions_per_match,promotion_match,promotion_to_role_counts,enemy_desertion_attrition,mean_enemy_desertions,plain_chess_win_delta,drip_gain_total,regard_events,regard_gain_total,adjudication_loss,tau_benev,quiet_quit,tau_abil,role_tau_abil,ability_min,ability_max,mean_ability,ability_moved_count',
  );
  for (const point of points) {
    console.log(
      [
        point.knob,
        point.value,
        point.meanRefusalRate.toFixed(4),
        point.meanRefusalsPerPly.toFixed(4),
        point.desertionMatchRate.toFixed(4),
        point.desertionAttrition.toFixed(4),
        point.meanOverrideRate.toFixed(4),
        point.meanWinScore.toFixed(1),
        point.meanTrustDelta.toFixed(2),
        point.meanPlies.toFixed(1),
        point.winCount,
        point.drawCount,
        point.lossCount,
        point.meanPromotionsPerMatch.toFixed(3),
        point.promotionMatchRate.toFixed(3),
        JSON.stringify(point.promotionToRoleCounts),
        point.enemyDesertionAttrition.toFixed(4),
        point.meanEnemyDesertions.toFixed(2),
        point.plainChessWinDelta.toFixed(1),
        point.meanDripGainTotal.toFixed(2),
        point.meanRegardEvents.toFixed(2),
        point.meanRegardGainTotal.toFixed(2),
        point.meanAdjudicationLoss.toFixed(2),
        point.meanTauBenev.toFixed(2),
        point.meanQuietQuitRate.toFixed(4),
        point.meanTauAbil.toFixed(2),
        JSON.stringify(point.roleTauAbil),
        point.abilityMin.toFixed(2),
        point.abilityMax.toFixed(2),
        point.meanAbility.toFixed(2),
        point.abilityMovedCount.toFixed(2),
      ]
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
