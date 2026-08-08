import { describe, expect, it } from 'vitest';

import {
  buildTrajectoryBands,
  renderCsv,
  type MatchMetrics,
} from '../sim/metrics';
import {
  aggregateShardArtifacts,
  artifactFromShard,
  averageCampaignTrajectoryBands,
  deriveCampaignSeed,
  matchSeedsForCampaign,
  resolveRunPlan,
  runShard,
} from '../sim/parallel';
import { runCampaign } from '../sim/campaign';

function makeMetric(match: number, tauAbil: number, length = 4): MatchMetrics {
  return {
    match,
    seed: match,
    leader: 'supportive',
    plies: 1,
    refusals: 0,
    overrides: 0,
    quietQuitMoves: 0,
    desertions: match <= Math.ceil(length / 4) ? 1 : 0,
    cascadeLength: 0,
    refusedGoodMoves: 0,
    refusalRate: 0,
    quietQuitRate: 0,
    refusedGoodMoveRate: 0,
    overrideRate: 0,
    meanTrustStart: 0,
    meanTrustEnd: tauAbil,
    meanTauAbilStart: 0,
    meanTauAbilEnd: tauAbil,
    meanTauBenevStart: 0,
    meanTauBenevEnd: tauAbil,
    classContemptStart: 0,
    classContemptEnd: 0,
    survivingRosterSize: 1,
    winScore: 0,
    rout: match <= Math.ceil(length / 4),
    archetype: 'mixed',
  };
}

describe('parallel campaign planning', () => {
  it('keeps --matches=20 equivalent to one twenty-match campaign', () => {
    expect(
      resolveRunPlan({
        matches: 20,
        campaignLength: undefined,
        campaigns: undefined,
      }),
    ).toEqual({ totalMatches: 20, campaignLength: 20, campaigns: 1 });
  });

  it('derives independent campaign counts from total matches', () => {
    expect(
      resolveRunPlan({
        matches: 1000,
        campaignLength: 20,
        campaigns: undefined,
      }),
    ).toEqual({ totalMatches: 1000, campaignLength: 20, campaigns: 50 });
    expect(
      resolveRunPlan({ matches: 1000, campaignLength: 20, campaigns: 50 }),
    ).toEqual({ totalMatches: 1000, campaignLength: 20, campaigns: 50 });
    expect(() =>
      resolveRunPlan({
        matches: 1001,
        campaignLength: 20,
        campaigns: undefined,
      }),
    ).toThrow(/matches=1001.*campaign-length=20/);
    expect(() =>
      resolveRunPlan({ matches: 1000, campaignLength: 20, campaigns: 49 }),
    ).toThrow(/matches=1000.*campaign-length=20.*campaigns=49/);
  });

  it('mixes at least one thousand campaign seeds without match collisions', () => {
    const seeds = Array.from({ length: 1000 }, (_, index) =>
      deriveCampaignSeed(7, index),
    );
    expect(new Set(seeds).size).toBe(seeds.length);
    const matchSeeds = new Set(
      seeds.flatMap((seed) => matchSeedsForCampaign(seed, 20)),
    );
    expect(seeds.some((seed) => matchSeeds.has(seed))).toBe(false);
  });
});

describe('parallel campaign sharding', () => {
  it('keeps a one-shard run identical to the unsharded run', async () => {
    const options = {
      plan: { totalMatches: 6, campaignLength: 3, campaigns: 2 },
      leader: 'supportive' as const,
      masterSeed: 9,
      engineKind: 'fake' as const,
      depthCap: undefined,
    };
    const unsharded = await runShard({
      ...options,
      shardIndex: 0,
      shardCount: 1,
    });
    const oneShard = await runShard({
      ...options,
      shardIndex: 0,
      shardCount: 1,
    });
    expect(artifactFromShard(oneShard)).toEqual(artifactFromShard(unsharded));
  });

  it('keeps the legacy single-campaign CSV byte-identical', async () => {
    const direct = await runCampaign({
      matches: 3,
      leader: 'supportive',
      seed: 9,
      engineKind: 'fake',
    });
    const planned = await runShard({
      plan: { totalMatches: 3, campaignLength: 3, campaigns: 1 },
      leader: 'supportive',
      masterSeed: 9,
      engineKind: 'fake',
      depthCap: undefined,
      shardIndex: 0,
      shardCount: 1,
    });
    expect(renderCsv(direct.metrics)).toBe(
      renderCsv(planned.campaigns[0]?.result.metrics ?? []),
    );
  });

  it('unions shards to the exact unsharded campaign set', async () => {
    const options = {
      plan: { totalMatches: 9, campaignLength: 3, campaigns: 3 },
      leader: 'supportive' as const,
      masterSeed: 9,
      engineKind: 'fake' as const,
      depthCap: undefined,
    };
    const unsharded = await runShard({
      ...options,
      shardIndex: 0,
      shardCount: 1,
    });
    const shards = await Promise.all(
      [0, 1, 2].map((shardIndex) =>
        runShard({ ...options, shardIndex, shardCount: 3 }),
      ),
    );
    const merged = aggregateShardArtifacts(shards.map(artifactFromShard));
    expect(merged.campaigns).toEqual(artifactFromShard(unsharded).campaigns);
    expect(merged.summary).toEqual(unsharded.summary);
  });

  it('rejects incomplete, duplicate, and identity-mismatched shard sets', async () => {
    const options = {
      plan: { totalMatches: 6, campaignLength: 2, campaigns: 3 },
      leader: 'supportive' as const,
      masterSeed: 9,
      engineKind: 'fake' as const,
      depthCap: undefined,
    };
    const shards = await Promise.all(
      [0, 1, 2].map((shardIndex) =>
        runShard({ ...options, shardIndex, shardCount: 3 }),
      ),
    );
    const artifacts = shards.map(artifactFromShard);
    const first = artifacts.at(0);
    const second = artifacts.at(1);
    const third = artifacts.at(2);
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Expected three shard artifacts.');
    }
    expect(() => aggregateShardArtifacts(artifacts.slice(0, 2))).toThrow(
      /Incomplete shard set|Missing campaign indices/,
    );
    expect(() =>
      aggregateShardArtifacts([first, first, second, third]),
    ).toThrow(/appears more than once|duplicate/);
    const mismatched = {
      ...second,
      manifest: { ...second.manifest, masterSeed: 10 },
    };
    expect(() => aggregateShardArtifacts([first, mismatched, third])).toThrow(
      /identity/,
    );
  });
});

describe('trajectory aggregation', () => {
  it('buckets 16, 52, and remainder campaigns with early remainder matches', () => {
    const make = (length: number): MatchMetrics[] =>
      Array.from({ length }, (_, index) =>
        makeMetric(index + 1, index, length),
      );
    expect(buildTrajectoryBands(make(16)).map((band) => band.matches)).toEqual([
      4, 4, 4, 4,
    ]);
    expect(buildTrajectoryBands(make(52)).map((band) => band.matches)).toEqual([
      13, 13, 13, 13,
    ]);
    expect(buildTrajectoryBands(make(10)).map((band) => band.matches)).toEqual([
      3, 2, 3, 2,
    ]);
  });

  it('averages campaign bands before combining different campaign lengths', () => {
    const make = (length: number, offset: number): MatchMetrics[] =>
      Array.from({ length }, (_, index) => ({
        ...makeMetric(
          index + 1,
          index < Math.ceil(length / 4) ? offset : 0,
          length,
        ),
      }));
    const bands = averageCampaignTrajectoryBands([make(4, 100), make(8, 0)]);
    expect(bands[0]?.meanTauAbil).toBe(50);
    const concatenatedFirstQuartile = [...make(4, 100), ...make(8, 0)].slice(
      0,
      3,
    );
    expect(
      concatenatedFirstQuartile.reduce(
        (sum, metric) => sum + metric.meanTauAbilEnd,
        0,
      ) / concatenatedFirstQuartile.length,
    ).not.toBe(bands[0]?.meanTauAbil);
  });
});
