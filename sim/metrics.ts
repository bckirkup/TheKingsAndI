import type { MatchEvent } from '../src/psychology';
import type { HeadlessMatchResult } from '../src/orchestration';

import type { Leader } from './cli';
import { meanClassContempt, meanTrust } from './roster';

export type LeadershipArchetype =
  | 'tyrant'
  | 'caretaker'
  | 'chaotic'
  | 'tactician'
  | 'redeemer_arc'
  | 'mixed';

export interface MatchMetrics {
  readonly match: number;
  readonly seed: number;
  readonly leader: Leader;
  readonly plies: number;
  readonly refusals: number;
  readonly overrides: number;
  readonly quietQuitMoves: number;
  readonly desertions: number;
  readonly cascadeLength: number;
  readonly refusedGoodMoves: number;
  readonly refusalRate: number;
  readonly quietQuitRate: number;
  readonly refusedGoodMoveRate: number;
  readonly overrideRate: number;
  readonly meanTrustStart: number;
  readonly meanTrustEnd: number;
  readonly classContemptStart: number;
  readonly classContemptEnd: number;
  readonly winScore: number;
  readonly rout: boolean;
  readonly archetype: LeadershipArchetype;
}

export interface CampaignMetrics {
  readonly leader: Leader;
  readonly seed: number;
  readonly matches: number;
  readonly matchMetrics: readonly MatchMetrics[];
  readonly desertionCampaignRate: number;
  readonly routCampaignRate: number;
  readonly meanRefusalRate: number;
  readonly meanQuietQuitRate: number;
  readonly meanRefusedGoodMoveRate: number;
  readonly meanOverrideRate: number;
  readonly meanWinScore: number;
  readonly meanTrustDelta: number;
  readonly classContemptDelta: number;
}

const CSV_HEADER =
  'match,seed,leader,plies,refusals,overrides,quiet_quit_moves,desertions,cascade_length,refused_good_moves,refusal_rate,quiet_quit_rate,refused_good_move_rate,override_rate,mean_trust_start,mean_trust_end,class_contempt_start,class_contempt_end,win_score,rout,archetype';

function countEvents(events: readonly MatchEvent[]): {
  refusals: number;
  overrides: number;
  quietQuitMoves: number;
  desertions: number;
} {
  let refusals = 0;
  let overrides = 0;
  let quietQuitMoves = 0;
  let desertions = 0;
  for (const event of events) {
    switch (event.t) {
      case 'REFUSAL':
        refusals += 1;
        break;
      case 'OVERRIDE':
        overrides += 1;
        break;
      case 'MOVE':
        if (event.verdict === 'QUIET_QUITTING') quietQuitMoves += 1;
        break;
      case 'DESERTION':
        desertions += 1;
        break;
      default:
        break;
    }
  }
  return { refusals, overrides, quietQuitMoves, desertions };
}

function cascadeLength(events: readonly MatchEvent[]): number {
  let current = 0;
  let max = 0;
  for (const event of events) {
    if (event.t === 'DESERTION') {
      current += 1;
      max = Math.max(max, current);
    } else if (event.t === 'MOVE') {
      current = 0;
    }
  }
  return max;
}

function classifyArchetype(
  leader: Leader,
  refusalRate: number,
  overrideRate: number,
  desertions: number,
): LeadershipArchetype {
  if (leader === 'redeemer') return 'redeemer_arc';
  if (leader === 'pure_tactician') return 'tactician';
  if (overrideRate > 0.15 || desertions >= 2) return 'tyrant';
  if (refusalRate < 0.02 && overrideRate < 0.01) return 'caretaker';
  if (leader === 'volatile') return 'chaotic';
  return 'mixed';
}

export function metricsFromMatch(
  match: number,
  seed: number,
  leader: Leader,
  rosterStart: readonly import('../src/psychology').PieceState[],
  result: HeadlessMatchResult,
  refusedGoodMoves: number,
): MatchMetrics {
  const counts = countEvents(result.events);
  const plies = Math.max(1, result.plies);
  const refusalRate = counts.refusals / plies;
  const quietQuitRate = counts.quietQuitMoves / plies;
  const refusedGoodMoveRate =
    counts.refusals === 0 ? 0 : refusedGoodMoves / counts.refusals;
  const overrideRate = counts.overrides / plies;
  const meanTrustStart = meanTrust(rosterStart);
  const meanTrustEnd = meanTrust(result.roster);
  const classContemptStart = meanClassContempt(rosterStart);
  const classContemptEnd = meanClassContempt(result.roster);
  return {
    match,
    seed,
    leader,
    plies: result.plies,
    refusals: counts.refusals,
    overrides: counts.overrides,
    quietQuitMoves: counts.quietQuitMoves,
    desertions: counts.desertions,
    cascadeLength: cascadeLength(result.events),
    refusedGoodMoves,
    refusalRate,
    quietQuitRate,
    refusedGoodMoveRate,
    overrideRate,
    meanTrustStart,
    meanTrustEnd,
    classContemptStart,
    classContemptEnd,
    winScore: result.winScore,
    rout: result.rout,
    archetype: classifyArchetype(
      leader,
      refusalRate,
      overrideRate,
      counts.desertions,
    ),
  };
}

export function aggregateCampaign(
  leader: Leader,
  seed: number,
  matchMetrics: readonly MatchMetrics[],
): CampaignMetrics {
  const matches = matchMetrics.length;
  const desertionCampaignRate =
    matchMetrics.filter((metric) => metric.desertions > 0).length /
    Math.max(1, matches);
  const routCampaignRate =
    matchMetrics.filter((metric) => metric.rout).length / Math.max(1, matches);
  const mean = (pick: (metric: MatchMetrics) => number): number =>
    matchMetrics.reduce((sum, metric) => sum + pick(metric), 0) /
    Math.max(1, matches);
  return {
    leader,
    seed,
    matches,
    matchMetrics,
    desertionCampaignRate,
    routCampaignRate,
    meanRefusalRate: mean((metric) => metric.refusalRate),
    meanQuietQuitRate: mean((metric) => metric.quietQuitRate),
    meanRefusedGoodMoveRate: mean((metric) => metric.refusedGoodMoveRate),
    meanOverrideRate: mean((metric) => metric.overrideRate),
    meanWinScore: mean((metric) => metric.winScore),
    meanTrustDelta: mean(
      (metric) => metric.meanTrustEnd - metric.meanTrustStart,
    ),
    classContemptDelta:
      mean((metric) => metric.classContemptEnd) -
      mean((metric) => metric.classContemptStart),
  };
}

export function renderCsv(metrics: readonly MatchMetrics[]): string {
  const rows = metrics.map((metric) =>
    [
      metric.match,
      metric.seed,
      metric.leader,
      metric.plies,
      metric.refusals,
      metric.overrides,
      metric.quietQuitMoves,
      metric.desertions,
      metric.cascadeLength,
      metric.refusedGoodMoves,
      metric.refusalRate.toFixed(4),
      metric.quietQuitRate.toFixed(4),
      metric.refusedGoodMoveRate.toFixed(4),
      metric.overrideRate.toFixed(4),
      metric.meanTrustStart.toFixed(2),
      metric.meanTrustEnd.toFixed(2),
      metric.classContemptStart.toFixed(2),
      metric.classContemptEnd.toFixed(2),
      metric.winScore,
      metric.rout ? 1 : 0,
      metric.archetype,
    ].join(','),
  );
  return `${[CSV_HEADER, ...rows].join('\n')}\n`;
}
