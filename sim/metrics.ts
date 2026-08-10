import type { MatchEvent } from '../src/psychology';
import type { HeadlessMatchResult } from '../src/orchestration';

import type { Leader } from './cli';
import {
  meanClassContempt,
  meanTauAbil,
  meanTauBenev,
  meanTrust,
} from './roster';

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
  readonly implicitOverrides: number;
  readonly quietQuitMoves: number;
  readonly desertions: number;
  readonly winningPositionDesertions: number;
  readonly cascadeLength: number;
  readonly firstDeparture: DesertionSummary;
  readonly cascadeDeparture: DesertionSummary;
  readonly refusedGoodMoves: number;
  readonly refusalRate: number;
  readonly quietQuitRate: number;
  readonly refusedGoodMoveRate: number;
  readonly overrideRate: number;
  readonly meanTrustStart: number;
  readonly meanTrustEnd: number;
  readonly meanTauAbilStart: number;
  readonly meanTauAbilEnd: number;
  readonly meanTauBenevStart: number;
  readonly meanTauBenevEnd: number;
  readonly classContemptStart: number;
  readonly classContemptEnd: number;
  readonly survivingRosterSize: number;
  readonly winScore: number;
  readonly rout: boolean;
  readonly archetype: LeadershipArchetype;
}

export interface DesertionSummary {
  readonly count: number;
  readonly unknownCauseCount: number;
  readonly meanUStay: number;
  readonly meanUDesert: number;
  readonly meanPCaptured: number;
  readonly meanPain: number;
  readonly meanPLossIfStay: number;
  readonly meanPLossIfLeave: number;
  readonly meanLambda: number;
  readonly meanLambdaTrust: number;
  readonly meanLambdaMorale: number;
  readonly meanLambdaLoyalty: number;
  readonly meanLambdaAffinity: number;
  readonly meanStandingCost: number;
  readonly meanGloryWeight: number;
  readonly meanTauBenev: number;
  readonly meanTauAbil: number;
}

export const EMPTY_DESERTION_SUMMARY: DesertionSummary = {
  count: 0,
  unknownCauseCount: 0,
  meanUStay: 0,
  meanUDesert: 0,
  meanPCaptured: 0,
  meanPain: 0,
  meanPLossIfStay: 0,
  meanPLossIfLeave: 0,
  meanLambda: 0,
  meanLambdaTrust: 0,
  meanLambdaMorale: 0,
  meanLambdaLoyalty: 0,
  meanLambdaAffinity: 0,
  meanStandingCost: 0,
  meanGloryWeight: 0,
  meanTauBenev: 0,
  meanTauAbil: 0,
};

export interface TrustTrajectoryBin {
  readonly match: number;
  readonly meanTrustEnd: number;
}

export interface CampaignTrajectoryBand {
  readonly quartile: 1 | 2 | 3 | 4;
  readonly startMatch: number;
  readonly endMatch: number;
  readonly matches: number;
  readonly meanTauAbil: number;
  readonly meanTauBenev: number;
  readonly meanRefusalRate: number;
  readonly desertionRate: number;
  readonly routRate: number;
  readonly meanSurvivingRosterSize: number;
  readonly meanWinScore: number;
}

export interface CampaignHorizon {
  readonly horizon: number;
  readonly meanWinScore: number;
  readonly routRate: number;
  readonly meanRefusalRate: number;
  readonly desertionRate: number;
  readonly meanDesertions: number;
  readonly meanSurvivingRosterSize: number;
  readonly meanTauAbil: number;
  readonly meanTauBenev: number;
  readonly meanTrustEnd: number;
}

export interface PerRoleCultureMetric {
  readonly role: string;
  readonly meanContemptEnd: number;
}

export interface CampaignMetrics {
  readonly leader: Leader;
  readonly seed: number;
  readonly matches: number;
  readonly matchMetrics: readonly MatchMetrics[];
  readonly desertionCampaignRate: number;
  readonly winningPositionDesertionRate: number;
  readonly routCampaignRate: number;
  readonly meanRefusalRate: number;
  readonly meanQuietQuitRate: number;
  readonly meanRefusedGoodMoveRate: number;
  readonly meanOverrideRate: number;
  readonly meanWinScore: number;
  readonly meanDesertions: number;
  readonly meanSurvivingRosterSize: number;
  readonly meanTauAbil: number;
  readonly meanTauBenev: number;
  readonly meanTrustEnd: number;
  readonly meanTrustDelta: number;
  readonly classContemptDelta: number;
  /** Per-match mean trust at end — distribution over the campaign (3.3). */
  readonly trustTrajectory: readonly TrustTrajectoryBin[];
  /** Mean class contempt by role across the final match of the campaign. */
  readonly perRoleCulture: readonly PerRoleCultureMetric[];
  readonly trajectoryBands: readonly CampaignTrajectoryBand[];
  readonly horizon: readonly CampaignHorizon[];
}

const CSV_HEADER =
  'match,seed,leader,plies,refusals,overrides,implicit_overrides,quiet_quit_moves,desertions,first_desertions,first_unknown_cause,cascade_desertions,cascade_unknown_cause,cascade_length,first_u_stay,first_u_desert,first_p_captured,first_pain,first_p_loss_if_stay,first_p_loss_if_leave,first_lambda,first_lambda_trust,first_lambda_morale,first_lambda_loyalty,first_lambda_affinity,first_standing_cost,first_glory_weight,first_tau_benev,first_tau_abil,refused_good_moves,refusal_rate,quiet_quit_rate,refused_good_move_rate,override_rate,mean_trust_start,mean_trust_end,class_contempt_start,class_contempt_end,win_score,rout,archetype,mean_tau_abil_start,mean_tau_abil_end,mean_tau_benev_start,mean_tau_benev_end,surviving_roster_size';

function countEvents(events: readonly MatchEvent[]): {
  refusals: number;
  overrides: number;
  implicitOverrides: number;
  quietQuitMoves: number;
  desertions: number;
} {
  let refusals = 0;
  let overrides = 0;
  let implicitOverrides = 0;
  let quietQuitMoves = 0;
  let desertions = 0;
  for (const event of events) {
    switch (event.t) {
      case 'REFUSAL':
        refusals += 1;
        break;
      case 'OVERRIDE':
        overrides += 1;
        if (event.implicit === true) implicitOverrides += 1;
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
  return {
    refusals,
    overrides,
    implicitOverrides,
    quietQuitMoves,
    desertions,
  };
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

function summarizeDesertions(
  events: readonly MatchEvent[],
  departureKind: 'first' | 'cascade',
): DesertionSummary {
  const departures = events.filter(
    (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
      event.t === 'DESERTION' && event.departureKind === departureKind,
  );
  const attributed = departures.filter((event) => event.terms !== undefined);
  const count = attributed.length;
  const unknownCauseCount = departures.length - count;
  const mean = (
    pick: (event: Extract<MatchEvent, { t: 'DESERTION' }>) => number,
  ): number =>
    attributed.reduce((sum, event) => sum + pick(event), 0) /
    Math.max(1, count);
  return {
    count,
    unknownCauseCount,
    meanUStay: mean((event) => event.uStay),
    meanUDesert: mean((event) => event.uDesert),
    meanPCaptured: mean((event) => event.terms?.P_captured ?? 0),
    meanPain: mean((event) => event.terms?.pain ?? 0),
    meanPLossIfStay: mean((event) => event.terms?.P_lossIfStay ?? 0),
    meanPLossIfLeave: mean((event) => event.terms?.P_lossIfLeave ?? 0),
    meanLambda: mean((event) => event.terms?.lambda ?? 0),
    meanLambdaTrust: mean((event) => event.terms?.lambdaTrust ?? 0),
    meanLambdaMorale: mean((event) => event.terms?.lambdaMorale ?? 0),
    meanLambdaLoyalty: mean((event) => event.terms?.lambdaLoyalty ?? 0),
    meanLambdaAffinity: mean((event) => event.terms?.lambdaAffinity ?? 0),
    meanStandingCost: mean((event) => event.terms?.standingCost ?? 0),
    meanGloryWeight: mean((event) => event.terms?.gloryWeight ?? 0),
    meanTauBenev: mean((event) => event.terms?.tauBenev ?? 0),
    meanTauAbil: mean((event) => event.terms?.tauAbil ?? 0),
  };
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
  const meanTauAbilStart = meanTauAbil(rosterStart);
  const meanTauAbilEnd = meanTauAbil(result.roster);
  const meanTauBenevStart = meanTauBenev(rosterStart);
  const meanTauBenevEnd = meanTauBenev(result.roster);
  const classContemptStart = meanClassContempt(rosterStart);
  const classContemptEnd = meanClassContempt(result.roster);
  return {
    match,
    seed,
    leader,
    plies: result.plies,
    refusals: counts.refusals,
    overrides: counts.overrides,
    implicitOverrides: counts.implicitOverrides,
    quietQuitMoves: counts.quietQuitMoves,
    desertions: counts.desertions,
    winningPositionDesertions: result.winningPositionDesertions,
    cascadeLength: cascadeLength(result.events),
    firstDeparture: summarizeDesertions(result.events, 'first'),
    cascadeDeparture: summarizeDesertions(result.events, 'cascade'),
    refusedGoodMoves,
    refusalRate,
    quietQuitRate,
    refusedGoodMoveRate,
    overrideRate,
    meanTrustStart,
    meanTrustEnd,
    meanTauAbilStart,
    meanTauAbilEnd,
    meanTauBenevStart,
    meanTauBenevEnd,
    classContemptStart,
    classContemptEnd,
    survivingRosterSize: result.roster.length,
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

function quartileForMatch(match: number, matches: number): 1 | 2 | 3 | 4 {
  return Math.min(4, Math.floor(((match - 1) * 4) / matches) + 1) as
    | 1
    | 2
    | 3
    | 4;
}

export function buildTrajectoryBands(
  matchMetrics: readonly MatchMetrics[],
): readonly CampaignTrajectoryBand[] {
  const matches = matchMetrics.length;
  return ([1, 2, 3, 4] as const).map((quartile) => {
    const metrics = matchMetrics.filter(
      (metric) => quartileForMatch(metric.match, matches) === quartile,
    );
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const mean = (pick: (metric: MatchMetrics) => number): number =>
      metrics.reduce((sum, metric) => sum + pick(metric), 0) /
      Math.max(1, metrics.length);
    return {
      quartile,
      startMatch: first?.match ?? 0,
      endMatch: last?.match ?? 0,
      matches: metrics.length,
      meanTauAbil: mean((metric) => metric.meanTauAbilEnd),
      meanTauBenev: mean((metric) => metric.meanTauBenevEnd),
      meanRefusalRate: mean((metric) => metric.refusalRate),
      desertionRate:
        metrics.filter((metric) => metric.desertions > 0).length /
        Math.max(1, metrics.length),
      routRate:
        metrics.filter((metric) => metric.rout).length /
        Math.max(1, metrics.length),
      meanSurvivingRosterSize: mean((metric) => metric.survivingRosterSize),
      meanWinScore: mean((metric) => metric.winScore),
    };
  });
}

function aggregateCampaignCore(
  leader: Leader,
  seed: number,
  matchMetrics: readonly MatchMetrics[],
): Omit<CampaignMetrics, 'horizon'> {
  const matches = matchMetrics.length;
  const desertionCampaignRate =
    matchMetrics.filter((metric) => metric.desertions > 0).length /
    Math.max(1, matches);
  const totalDesertions = matchMetrics.reduce(
    (sum, metric) => sum + metric.desertions,
    0,
  );
  const winningPositionDesertionRate =
    matchMetrics.reduce(
      (sum, metric) => sum + metric.winningPositionDesertions,
      0,
    ) / Math.max(1, totalDesertions);
  const routCampaignRate =
    matchMetrics.filter((metric) => metric.rout).length / Math.max(1, matches);
  const mean = (pick: (metric: MatchMetrics) => number): number =>
    matchMetrics.reduce((sum, metric) => sum + pick(metric), 0) /
    Math.max(1, matches);
  const trustTrajectory = matchMetrics.map((metric) => ({
    match: metric.match,
    meanTrustEnd: metric.meanTrustEnd,
  }));
  const last = matchMetrics[matchMetrics.length - 1];
  const perRoleCulture: PerRoleCultureMetric[] =
    last === undefined
      ? []
      : [
          {
            role: 'aggregate',
            meanContemptEnd: last.classContemptEnd,
          },
        ];
  return {
    leader,
    seed,
    matches,
    matchMetrics,
    desertionCampaignRate,
    winningPositionDesertionRate,
    routCampaignRate,
    meanRefusalRate: mean((metric) => metric.refusalRate),
    meanQuietQuitRate: mean((metric) => metric.quietQuitRate),
    meanRefusedGoodMoveRate: mean((metric) => metric.refusedGoodMoveRate),
    meanOverrideRate: mean((metric) => metric.overrideRate),
    meanWinScore: mean((metric) => metric.winScore),
    meanDesertions: mean((metric) => metric.desertions),
    meanSurvivingRosterSize: mean((metric) => metric.survivingRosterSize),
    meanTauAbil: mean((metric) => metric.meanTauAbilEnd),
    meanTauBenev: mean((metric) => metric.meanTauBenevEnd),
    meanTrustEnd: last?.meanTrustEnd ?? 0,
    meanTrustDelta: mean(
      (metric) => metric.meanTrustEnd - metric.meanTrustStart,
    ),
    classContemptDelta:
      mean((metric) => metric.classContemptEnd) -
      mean((metric) => metric.classContemptStart),
    trustTrajectory,
    perRoleCulture,
    trajectoryBands: buildTrajectoryBands(matchMetrics),
  };
}

function horizonFromSummary(
  horizon: number,
  summary: Omit<CampaignMetrics, 'horizon'>,
): CampaignHorizon {
  return {
    horizon,
    meanWinScore: summary.meanWinScore,
    routRate: summary.routCampaignRate,
    meanRefusalRate: summary.meanRefusalRate,
    desertionRate: summary.desertionCampaignRate,
    meanDesertions: summary.meanDesertions,
    meanSurvivingRosterSize: summary.meanSurvivingRosterSize,
    meanTauAbil: summary.meanTauAbil,
    meanTauBenev: summary.meanTauBenev,
    meanTrustEnd: summary.meanTrustEnd,
  };
}

export function buildHorizonSeries(
  matchMetrics: readonly MatchMetrics[],
): readonly CampaignHorizon[] {
  const first = matchMetrics[0];
  if (first === undefined) return [];
  return matchMetrics.map((_, index) =>
    horizonFromSummary(
      index + 1,
      aggregateCampaignCore(
        first.leader,
        first.seed,
        matchMetrics.slice(0, index + 1),
      ),
    ),
  );
}

export function aggregateCampaign(
  leader: Leader,
  seed: number,
  matchMetrics: readonly MatchMetrics[],
): CampaignMetrics {
  const summary = aggregateCampaignCore(leader, seed, matchMetrics);
  return {
    ...summary,
    horizon: buildHorizonSeries(matchMetrics),
  };
}

export function renderCsv(
  metrics: readonly MatchMetrics[],
  trajectoryBands?: readonly CampaignTrajectoryBand[],
  horizon?: readonly CampaignHorizon[],
): string {
  const rows = metrics.map((metric) =>
    [
      metric.match,
      metric.seed,
      metric.leader,
      metric.plies,
      metric.refusals,
      metric.overrides,
      metric.implicitOverrides,
      metric.quietQuitMoves,
      metric.desertions,
      metric.firstDeparture.count,
      metric.firstDeparture.unknownCauseCount,
      metric.cascadeDeparture.count,
      metric.cascadeDeparture.unknownCauseCount,
      metric.cascadeLength,
      metric.firstDeparture.meanUStay.toFixed(3),
      metric.firstDeparture.meanUDesert.toFixed(3),
      metric.firstDeparture.meanPCaptured.toFixed(4),
      metric.firstDeparture.meanPain.toFixed(3),
      metric.firstDeparture.meanPLossIfStay.toFixed(4),
      metric.firstDeparture.meanPLossIfLeave.toFixed(4),
      metric.firstDeparture.meanLambda.toFixed(4),
      metric.firstDeparture.meanLambdaTrust.toFixed(4),
      metric.firstDeparture.meanLambdaMorale.toFixed(4),
      metric.firstDeparture.meanLambdaLoyalty.toFixed(4),
      metric.firstDeparture.meanLambdaAffinity.toFixed(4),
      metric.firstDeparture.meanStandingCost.toFixed(3),
      metric.firstDeparture.meanGloryWeight.toFixed(4),
      metric.firstDeparture.meanTauBenev.toFixed(3),
      metric.firstDeparture.meanTauAbil.toFixed(3),
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
      metric.meanTauAbilStart.toFixed(2),
      metric.meanTauAbilEnd.toFixed(2),
      metric.meanTauBenevStart.toFixed(2),
      metric.meanTauBenevEnd.toFixed(2),
      metric.survivingRosterSize,
    ].join(','),
  );
  const output = [CSV_HEADER, ...rows];
  if (trajectoryBands !== undefined) {
    output.push(
      '',
      'trajectory_quartile,start_match,end_match,matches,mean_tau_abil,mean_tau_benev,mean_refusal_rate,desertion_rate,rout_rate,mean_surviving_roster_size,mean_win_score',
      ...trajectoryBands.map((band) =>
        [
          band.quartile,
          band.startMatch,
          band.endMatch,
          band.matches,
          band.meanTauAbil.toFixed(2),
          band.meanTauBenev.toFixed(2),
          band.meanRefusalRate.toFixed(4),
          band.desertionRate.toFixed(4),
          band.routRate.toFixed(4),
          band.meanSurvivingRosterSize.toFixed(2),
          band.meanWinScore.toFixed(2),
        ].join(','),
      ),
    );
  }
  if (horizon !== undefined) {
    output.push(
      '',
      'horizon,mean_win_score,rout_rate,mean_refusal_rate,desertion_rate,mean_desertions,mean_surviving_roster_size,mean_tau_abil,mean_tau_benev,mean_trust_end',
      ...horizon.map((point) =>
        [
          point.horizon,
          point.meanWinScore.toFixed(2),
          point.routRate.toFixed(4),
          point.meanRefusalRate.toFixed(4),
          point.desertionRate.toFixed(4),
          point.meanDesertions.toFixed(2),
          point.meanSurvivingRosterSize.toFixed(2),
          point.meanTauAbil.toFixed(2),
          point.meanTauBenev.toFixed(2),
          point.meanTrustEnd.toFixed(2),
        ].join(','),
      ),
    );
  }
  return `${output.join('\n')}\n`;
}
