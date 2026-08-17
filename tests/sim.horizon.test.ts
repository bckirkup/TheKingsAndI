import { describe, expect, it } from 'vitest';

import {
  aggregateCampaign,
  buildMatchTrajectory,
  buildHorizonSeries,
  buildTrajectoryBands,
  renderCsv,
  EMPTY_DESERTION_SUMMARY,
  type MatchMetrics,
} from '../sim/metrics';
import { averageCampaignHorizonSeries } from '../sim/parallel';

function metric(
  match: number,
  values: Partial<MatchMetrics> = {},
): MatchMetrics {
  return {
    match,
    seed: match,
    leader: 'supportive',
    plies: 10,
    refusals: match,
    overrides: 0,
    implicitOverrides: 0,
    quietQuitMoves: 0,
    desertions: match % 2,
    promotions: 0,
    promotionToRoleCounts: {},
    winningPositionDesertions: 0,
    cascadeLength: 0,
    firstDeparture: EMPTY_DESERTION_SUMMARY,
    cascadeDeparture: EMPTY_DESERTION_SUMMARY,
    refusedGoodMoves: 0,
    fieldedPieceIds: ['piece'],
    desertedPieceIds: [],
    refusalRate: match / (match + 10),
    refusalsPerPly: match / 10,
    quietQuitRate: 0,
    refusedGoodMoveRate: 0,
    overrideRate: 0,
    meanTrustStart: 10,
    meanTrustEnd: match,
    meanTauAbilStart: match,
    meanTauAbilEnd: match * 2,
    meanTauBenevStart: match,
    meanTauBenevEnd: match * 3,
    classContemptStart: 0,
    classContemptEnd: 0,
    survivingRosterSize: 20 - match,
    enemyAttrition: 0,
    enemyFieldedPieceIds: [
      'b:p1',
      'b:p2',
      'b:p3',
      'b:p4',
      'b:p5',
      'b:p6',
      'b:p7',
      'b:p8',
    ],
    enemySurvivingRosterSize: 16 - match,
    enemyDesertions: 0,
    enemyDesertedPieceIds: [],
    enemyRefusalRate: 0,
    winScore: match * 10,
    rout: match % 2 === 0,
    archetype: 'caretaker',
    ...values,
  };
}

describe('campaign horizon series', () => {
  it('folds distinct deserted and fielded identities into attrition', () => {
    const metrics = [
      metric(1, {
        fieldedPieceIds: ['a', 'b'],
        desertedPieceIds: ['a'],
        desertions: 1,
        enemyAttrition: 0.25,
        enemyFieldedPieceIds: [
          'b:p1',
          'b:p2',
          'b:p3',
          'b:p4',
          'b:p5',
          'b:p6',
          'b:p7',
          'b:p8',
        ],
        enemySurvivingRosterSize: 12,
        enemyDesertions: 2,
        enemyDesertedPieceIds: ['b:p1', 'b:p2'],
        enemyRefusalRate: 0.2,
      }),
      metric(2, {
        fieldedPieceIds: ['a', 'b'],
        desertedPieceIds: [],
      }),
    ];
    const summary = aggregateCampaign('supportive', 1, metrics);
    expect(summary.desertionMatchRate).toBe(0.5);
    expect(summary.desertionAttrition).toBe(0.5);
    expect(summary.enemyDesertionAttrition).toBe(0.25);
    expect(summary.meanEnemySurvivingRosterSize).toBe(13);
    expect(summary.meanEnemyDesertions).toBe(1);
    expect(summary.meanEnemyRefusalRate).toBe(0.1);
    expect(summary.meanAttritionDifferential).toBeCloseTo(0.125);
    expect(summary.meanSurvivingRosterDifferential).toBe(5.5);
    expect(summary.meanDesertionDifferential).toBe(-0.5);
    expect(summary.meanRefusalRateDifferential).toBeCloseTo(0.0288, 3);
    expect(summary.horizon[1]?.attritionDifferential).toBeCloseTo(0.25);
  });

  it('uses cumulative prefixes and matches the campaign summary at full length', () => {
    const metrics = [metric(1), metric(2), metric(3)];
    const summary = aggregateCampaign('supportive', 1, metrics);
    const first = summary.horizon[0];
    const final = summary.horizon[summary.horizon.length - 1];
    const firstMetric = metrics[0];
    if (firstMetric === undefined) {
      throw new Error('Expected a first metric.');
    }

    expect(first).toEqual({
      horizon: 1,
      meanWinScore: firstMetric.winScore,
      winCount: firstMetric.winScore === 100 ? 1 : 0,
      drawCount: firstMetric.winScore === 50 ? 1 : 0,
      lossCount: firstMetric.winScore === 0 ? 1 : 0,
      winRate: firstMetric.winScore === 100 ? 1 : 0,
      drawRate: firstMetric.winScore === 50 ? 1 : 0,
      lossRate: firstMetric.winScore === 0 ? 1 : 0,
      routRate: firstMetric.rout ? 1 : 0,
      meanRefusalRate: firstMetric.refusalRate,
      meanRefusalsPerPly: firstMetric.refusalsPerPly,
      desertionMatchRate: firstMetric.desertions > 0 ? 1 : 0,
      desertionAttrition: 0,
      meanDesertions: firstMetric.desertions,
      meanSurvivingRosterSize: firstMetric.survivingRosterSize,
      enemyDesertionAttrition: 0,
      meanEnemySurvivingRosterSize: firstMetric.enemySurvivingRosterSize,
      meanEnemyDesertions: firstMetric.enemyDesertions,
      meanEnemyRefusalRate: firstMetric.enemyRefusalRate,
      attritionDifferential: 0,
      survivingRosterDifferential:
        firstMetric.survivingRosterSize - firstMetric.enemySurvivingRosterSize,
      desertionDifferential:
        firstMetric.desertions - firstMetric.enemyDesertions,
      refusalRateDifferential:
        firstMetric.refusalRate - firstMetric.enemyRefusalRate,
      meanTauAbil: firstMetric.meanTauAbilEnd,
      meanTauBenev: firstMetric.meanTauBenevEnd,
      meanTrustEnd: firstMetric.meanTrustEnd,
    });
    expect(final).toEqual({
      horizon: summary.matches,
      meanWinScore: summary.meanWinScore,
      winCount: 0,
      drawCount: 0,
      lossCount: 0,
      winRate: 0,
      drawRate: 0,
      lossRate: 0,
      routRate: summary.routCampaignRate,
      meanRefusalRate: summary.meanRefusalRate,
      meanRefusalsPerPly: summary.meanRefusalsPerPly,
      desertionMatchRate: summary.desertionMatchRate,
      desertionAttrition: summary.desertionAttrition,
      meanDesertions: summary.meanDesertions,
      meanSurvivingRosterSize: summary.meanSurvivingRosterSize,
      enemyDesertionAttrition: summary.enemyDesertionAttrition,
      meanEnemySurvivingRosterSize: summary.meanEnemySurvivingRosterSize,
      meanEnemyDesertions: summary.meanEnemyDesertions,
      meanEnemyRefusalRate: summary.meanEnemyRefusalRate,
      attritionDifferential:
        summary.desertionAttrition - summary.enemyDesertionAttrition,
      survivingRosterDifferential:
        summary.meanSurvivingRosterSize - summary.meanEnemySurvivingRosterSize,
      desertionDifferential:
        summary.meanDesertions - summary.meanEnemyDesertions,
      refusalRateDifferential:
        summary.meanRefusalRate - summary.meanEnemyRefusalRate,
      meanTauAbil: summary.meanTauAbil,
      meanTauBenev: summary.meanTauBenev,
      meanTrustEnd: summary.meanTrustEnd,
    });
  });

  it('keeps pointwise match trajectory distinct from cumulative horizon', () => {
    const metrics = [metric(1), metric(2), metric(3)];
    expect(buildMatchTrajectory(metrics)).toEqual([
      {
        match: 1,
        meanTauAbil: 2,
        meanTauBenev: 3,
        meanSurvivingRosterSize: 19,
      },
      {
        match: 2,
        meanTauAbil: 4,
        meanTauBenev: 6,
        meanSurvivingRosterSize: 18,
      },
      {
        match: 3,
        meanTauAbil: 6,
        meanTauBenev: 9,
        meanSurvivingRosterSize: 17,
      },
    ]);
    expect(
      buildHorizonSeries(metrics).map((point) => point.meanTauAbil),
    ).toEqual([2, 3, 4]);
  });

  it('has one point per match for 16-match and odd-length campaigns', () => {
    expect(buildHorizonSeries([])).toEqual([]);
    const sixteen = buildHorizonSeries(
      Array.from({ length: 16 }, (_, index) => metric(index + 1)),
    );
    const five = buildHorizonSeries(
      Array.from({ length: 5 }, (_, index) => metric(index + 1)),
    );

    expect(sixteen).toHaveLength(16);
    expect(sixteen.map((point) => point.horizon)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    expect(five).toHaveLength(5);
    expect(five.map((point) => point.horizon)).toEqual([1, 2, 3, 4, 5]);
    expect(five[1]?.meanWinScore).toBe(15);
    expect(five[4]?.meanWinScore).toBe(30);
  });

  it('assigns the 20-match fourth quartile to matches 16 through 20', () => {
    const bands = buildTrajectoryBands(
      Array.from({ length: 20 }, (_, index) => metric(index + 1)),
    );
    expect(
      bands.map((band) => [band.startMatch, band.endMatch, band.matches]),
    ).toEqual([
      [1, 5, 5],
      [6, 10, 5],
      [11, 15, 5],
      [16, 20, 5],
    ]);
  });

  it('averages only campaigns that reach each ragged horizon', () => {
    const short = [metric(1, { winScore: 100 }), metric(2, { winScore: 0 })];
    const long = [
      metric(1, { winScore: 0 }),
      metric(2, { winScore: 100 }),
      metric(3, { winScore: 50 }),
    ];
    const average = averageCampaignHorizonSeries([short, long]);

    expect(average).toHaveLength(3);
    expect(average[0]?.meanWinScore).toBe(50);
    expect(average[1]?.meanWinScore).toBe(50);
    expect(average[2]?.meanWinScore).toBe(50);
    expect(average[2]?.meanRefusalsPerPly).toBeCloseTo(0.2);
    expect(average[2]?.meanTrustEnd).toBe(long[2]?.meanTrustEnd);
  });

  it('adds mean win score to bands and emits the horizon section', () => {
    const metrics = [metric(1), metric(2), metric(3), metric(4)];
    const bands = buildTrajectoryBands(metrics);
    const horizon = buildHorizonSeries(metrics);
    const csv = renderCsv(metrics, bands, horizon);

    expect(bands[0]?.meanWinScore).toBe(10);
    expect(csv).toContain(
      'trajectory_quartile,start_match,end_match,matches,mean_tau_abil,mean_tau_benev,mean_refusal_rate,mean_refusals_per_ply,desertion_match_rate,desertion_attrition,rout_rate,mean_surviving_roster_size,enemy_desertion_attrition,mean_enemy_surviving_roster_size,mean_enemy_desertions,mean_enemy_refusal_rate,mean_attrition_differential,mean_surviving_roster_differential,mean_desertion_differential,mean_refusal_rate_differential,mean_win_score',
    );
    expect(csv).toContain(
      'horizon,mean_win_score,win_count,draw_count,loss_count,win_rate,draw_rate,loss_rate,rout_rate,mean_refusal_rate,mean_refusals_per_ply,desertion_match_rate,desertion_attrition,mean_desertions,mean_surviving_roster_size,enemy_desertion_attrition,mean_enemy_surviving_roster_size,mean_enemy_desertions,mean_enemy_refusal_rate,attrition_differential,surviving_roster_differential,desertion_differential,refusal_rate_differential,mean_tau_abil,mean_tau_benev,mean_trust_end',
    );
    expect(csv.indexOf('\n\ntrajectory_quartile')).toBeGreaterThan(-1);
    expect(csv.indexOf('\n\nhorizon')).toBeGreaterThan(
      csv.indexOf('\n\ntrajectory_quartile'),
    );
    expect(csv).toContain(
      '\n1,10.00,0,0,0,0.0000,0.0000,0.0000,0.0000,0.0909,0.1000,1.0000,0.0000,1.00,19.00,0.0000,15.00,0.00,0.0000,0.0000,4.00,1.00,0.0909,2.00,3.00,1.00\n',
    );
  });
});
