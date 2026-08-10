import { describe, expect, it } from 'vitest';

import { runCampaign } from '../sim/campaign';
import { buildTrajectoryBands, type MatchMetrics } from '../sim/metrics';

function handCheckMetric(match: number): MatchMetrics {
  return {
    match,
    seed: match,
    leader: 'supportive',
    plies: 10,
    refusals: 1,
    overrides: 0,
    implicitOverrides: 0,
    quietQuitMoves: 0,
    desertions: match % 2,
    winningPositionDesertions: 0,
    cascadeLength: match % 2,
    refusedGoodMoves: 1,
    refusalRate: match / 100,
    quietQuitRate: 0,
    refusedGoodMoveRate: 1,
    overrideRate: 0,
    meanTrustStart: 10,
    meanTrustEnd: 10,
    meanTauAbilStart: match * 10,
    meanTauAbilEnd: match * 10 + 1,
    meanTauBenevStart: match * 20,
    meanTauBenevEnd: match * 20 + 2,
    classContemptStart: 0,
    classContemptEnd: 0,
    survivingRosterSize: match,
    winScore: 50,
    rout: match % 2 === 1,
    archetype: 'caretaker',
  };
}

describe('campaign trajectory bands', () => {
  it('uses four equal quartiles for 16 and 52 matches', async () => {
    const requested = process.env.HEAVY_CAMPAIGN_MATCHES;
    const matchCounts =
      requested === undefined || requested === 'all'
        ? [16, 52]
        : requested.split(',').map((value) => Number(value));
    if (
      matchCounts.some((matches) => matches !== 16 && matches !== 52) ||
      matchCounts.length === 0
    ) {
      throw new Error('HEAVY_CAMPAIGN_MATCHES must be all, 16, or 52.');
    }
    for (const matches of matchCounts) {
      const bands = (
        await runCampaign({
          matches,
          leader: 'supportive',
          seed: 12,
          engineKind: 'fake',
        })
      ).summary.trajectoryBands;
      expect(bands.map((band) => [band.startMatch, band.endMatch])).toEqual(
        matches === 16
          ? [
              [1, 4],
              [5, 8],
              [9, 12],
              [13, 16],
            ]
          : [
              [1, 13],
              [14, 26],
              [27, 39],
              [40, 52],
            ],
      );
    }
  });

  it('assigns remainder matches to earlier quartiles', () => {
    const bands = buildTrajectoryBands([1, 2, 3, 4, 5].map(handCheckMetric));

    expect(bands.map((band) => [band.startMatch, band.endMatch])).toEqual([
      [1, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ]);
    expect(bands[0]?.meanTauAbil).toBe(16);
    expect(bands[0]?.meanTauBenev).toBe(32);
    expect(bands[0]?.meanSurvivingRosterSize).toBe(1.5);
    expect(bands[0]?.desertionRate).toBe(0.5);
    expect(bands[0]?.routRate).toBe(0.5);
  });
});
