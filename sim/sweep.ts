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
import type { Leader } from './cli';
import { plainChessMeanWinScore } from './baseline';

export interface SweepPoint {
  readonly knob: string;
  readonly value: number;
  readonly meanRefusalRate: number;
  readonly desertionCampaignRate: number;
  readonly meanOverrideRate: number;
  readonly meanWinScore: number;
  readonly meanTrustDelta: number;
  readonly plainChessWinDelta: number;
}

const MUTABLE_CONFIG = ENGINE_CONFIG as unknown as Record<string, number>;

function parseList(flag: string | undefined, fallback: number[]): number[] {
  if (flag === undefined || flag.length === 0) return fallback;
  return flag.split(',').map((part) => {
    const value = Number(part);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid sweep value: ${part}`);
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
}): Promise<readonly SweepPoint[]> {
  const original = MUTABLE_CONFIG[options.knob as string];
  if (typeof original !== 'number') {
    throw new Error(`Knob ${String(options.knob)} is not a numeric config.`);
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
      const campaign = await runCampaign({
        matches: options.matches,
        leader: options.leader,
        seed: options.seed,
        engineKind: 'fake',
      });
      points.push({
        knob: String(options.knob),
        value,
        meanRefusalRate: campaign.summary.meanRefusalRate,
        desertionCampaignRate: campaign.summary.desertionCampaignRate,
        meanOverrideRate: campaign.summary.meanOverrideRate,
        meanWinScore: campaign.summary.meanWinScore,
        meanTrustDelta: campaign.summary.meanTrustDelta,
        plainChessWinDelta: campaign.summary.meanWinScore - plainWin,
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
  return {
    knob,
    values: parseList(map.get('values'), [15, 25, 35]),
    matches: Number(map.get('matches') ?? 4),
    seed: Number(map.get('seed') ?? 7),
    leader: (map.get('leader') ?? 'tyrannical') as Leader,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const points = await runCoefficientSweep(options);
  console.log(
    'knob,value,refusal,desertion_campaign,override,win,trust_delta,plain_chess_win_delta',
  );
  for (const point of points) {
    console.log(
      [
        point.knob,
        point.value,
        point.meanRefusalRate.toFixed(4),
        point.desertionCampaignRate.toFixed(4),
        point.meanOverrideRate.toFixed(4),
        point.meanWinScore.toFixed(1),
        point.meanTrustDelta.toFixed(2),
        point.plainChessWinDelta.toFixed(1),
      ].join(','),
    );
  }
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
