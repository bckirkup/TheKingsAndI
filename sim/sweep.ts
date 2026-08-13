/**
 * Milestone 3.4 coefficient sweep runner.
 *
 * Sweeps named ENGINE_CONFIG knobs by temporarily patching the exported
 * config object (tests/calibration only — never used in production play).
 *
 * Usage:
 *   pnpm exec tsx sim/sweep.ts --knob=BENEV_EXPENDABLE_FLOOR --values=15,25,35 --matches=4 --seed=7
 */

import { ENGINE_CONFIG } from '../src/psychology/config';

import { runCampaign } from './campaign';
import { ENGINES, type Leader } from './cli';
import { plainChessMeanWinScore } from './baseline';
import { disposeSimEngine, type SimEngineKind } from './engine';

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
  readonly plainChessWinDelta: number;
  readonly meanDripGainTotal: number;
  readonly meanAdjudicationLoss: number;
  readonly meanTauAbil: number;
  readonly roleTauAbil: Readonly<Record<string, number>>;
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

export async function runCoefficientSweep(options: {
  readonly knob: keyof typeof ENGINE_CONFIG;
  readonly values: readonly number[];
  readonly matches: number;
  readonly seed: number;
  readonly leader: Leader;
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
  });
  const points: SweepPoint[] = [];
  try {
    for (const value of options.values) {
      MUTABLE_CONFIG[options.knob as string] = value;
      const engineKind = options.engineKind ?? 'lozza';
      const campaign = await runCampaign({
        matches: options.matches,
        leader: options.leader,
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
        plainChessWinDelta: campaign.summary.meanWinScore - plainWin,
        meanDripGainTotal: campaign.summary.meanDripGainTotal,
        meanAdjudicationLoss: campaign.summary.meanAdjudicationLoss,
        meanTauAbil: campaign.summary.meanTauAbil,
        roleTauAbil:
          campaign.summary.trajectoryBands.at(-1)?.meanFinalTauAbilByRole ?? {},
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
  engine: SimEngineKind;
  depthCap: number | undefined;
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
    engine: engine as SimEngineKind,
    depthCap: depthCapValue,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const points = await runCoefficientSweep({
    ...options,
    engineKind: options.engine,
  });
  console.log(
    'knob,value,refusal,refusals_per_ply,desertion_match,desertion_attrition,override,win,trust_delta,plain_chess_win_delta,drip_gain_total,adjudication_loss,tau_abil,role_tau_abil',
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
        point.plainChessWinDelta.toFixed(1),
        point.meanDripGainTotal.toFixed(2),
        point.meanAdjudicationLoss.toFixed(2),
        point.meanTauAbil.toFixed(2),
        JSON.stringify(point.roleTauAbil),
      ].join(','),
    );
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
