import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  aggregateCampaign,
  EMPTY_DESERTION_SUMMARY,
  type MatchMetrics,
} from '../sim/metrics';
import type { EnginePort } from '../src/engine/types';

const mocks = vi.hoisted(() => {
  const engine: EnginePort = {
    determinismId: 'wiring-engine',
    evaluate: async () => ({ scoreCp: 0, pv: [] }),
  };
  return {
    engine,
    createSimEngine: vi.fn(),
    disposeSimEngine: vi.fn(),
    runCampaign: vi.fn(),
  };
});

vi.mock('../sim/engine', () => ({
  createSimEngine: mocks.createSimEngine,
  disposeSimEngine: mocks.disposeSimEngine,
}));

vi.mock('../sim/campaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sim/campaign')>();
  return { ...actual, runCampaign: mocks.runCampaign };
});

import { runShard } from '../sim/parallel';

function makeMetric(): MatchMetrics {
  return {
    match: 1,
    seed: 1,
    leader: 'supportive',
    plies: 1,
    refusals: 0,
    overrides: 0,
    implicitOverrides: 0,
    quietQuitMoves: 0,
    desertions: 0,
    promotions: 0,
    promotionToRoleCounts: {},
    winningPositionDesertions: 0,
    cascadeLength: 0,
    firstDeparture: EMPTY_DESERTION_SUMMARY,
    cascadeDeparture: EMPTY_DESERTION_SUMMARY,
    refusedGoodMoves: 0,
    fieldedPieceIds: ['piece'],
    desertedPieceIds: [],
    refusalRate: 0,
    refusalsPerPly: 0,
    quietQuitRate: 0,
    refusedGoodMoveRate: 0,
    overrideRate: 0,
    meanTrustStart: 0,
    meanTrustEnd: 0,
    meanTrustFinal: 0,
    meanTauAbilStart: 0,
    meanTauAbilEnd: 0,
    meanTauBenevStart: 0,
    meanTauBenevEnd: 0,
    classContemptStart: 0,
    classContemptEnd: 0,
    survivingRosterSize: 1,
    enemyAttrition: 0,
    enemyFieldedPieceIds: ['enemy'],
    enemySurvivingRosterSize: 15,
    enemyDesertions: 0,
    enemyDesertedPieceIds: [],
    enemyRefusalRate: 0,
    winScore: 0,
    unjustifiedTrauma: 0,
    leadershipIndex: 0,
    emptiedChairs: 0,
    emptiedChairsScore: 0,
    rout: false,
    archetype: 'mixed',
  };
}

function campaignResult(seed: number) {
  const metrics = [{ ...makeMetric(), seed }];
  return {
    metrics,
    summary: aggregateCampaign('supportive', seed, metrics),
    finalRoster: [],
    finalEnemyRoster: [],
    determinismId: 'wiring-campaign',
    checkpoint: {
      checkpointVersion: 4,
      schemaVersion: 0,
      psychConfigVersion: 'wiring',
      determinismId: 'wiring-campaign',
      seed,
      leader: 'supportive' as const,
      opponent: 'random',
      enemyTrackedIdentities: 16,
      initialTrust: 0,
      nextMatch: 2,
      randomState: { s0: 0, s1: 0, s2: 0, s3: 0 },
      roster: [],
      enemyRoster: [],
      generations: {},
      enemyGenerations: {},
      retiredCareerIds: [],
      enemyRetiredCareerIds: [],
      leaderObservation: {
        matchesObserved: 0,
        refusalPermille: 0,
        desertions: 0,
        survivors: 16,
        winScore: 50,
      },
      opponentObservation: {
        matchesObserved: 0,
        refusalPermille: 0,
        desertions: 0,
        survivors: 16,
        winScore: 50,
      },
      completedMetrics: metrics,
    },
    justifiedRefusalObviousness: [],
    justifiedRefusalPrivateViewLosses: [],
  };
}

const shardOptions = {
  plan: { totalMatches: 1, campaignLength: 1, campaigns: 1 },
  leader: 'supportive' as const,
  opponent: 'random' as const,
  masterSeed: 9,
  engineKind: 'fake' as const,
  depthCap: undefined,
  shardIndex: 0,
  shardCount: 1,
};

describe('runShard production wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSimEngine.mockResolvedValue(mocks.engine);
    mocks.disposeSimEngine.mockResolvedValue(undefined);
    mocks.runCampaign.mockImplementation(async (options) =>
      campaignResult(options.seed),
    );
  });

  it('creates one engine, passes it through, and disposes it', async () => {
    await runShard(shardOptions);

    expect(mocks.createSimEngine).toHaveBeenCalledWith('fake');
    expect(mocks.runCampaign).toHaveBeenCalledTimes(1);
    expect(mocks.runCampaign.mock.calls[0]?.[0].engine).toBe(mocks.engine);
    expect(mocks.disposeSimEngine).toHaveBeenCalledWith('fake');
  });

  it('disposes the engine when the campaign throws', async () => {
    const failure = new Error('synthetic campaign failure');
    mocks.runCampaign.mockRejectedValueOnce(failure);

    await expect(runShard(shardOptions)).rejects.toThrow(failure);
    expect(mocks.disposeSimEngine).toHaveBeenCalledWith('fake');
  });
});
