import { readFile, writeFile } from 'node:fs/promises';

import { canonicalJson } from '../src/core/canonicalJson';
import { PSYCH_CONFIG_VERSION, SCHEMA_VERSION } from '../src/persistence/types';

import {
  averagePlainChessHorizonSeries,
  plainChessHorizonSeries,
} from './baseline';
import {
  runCampaign,
  type CampaignOptions,
  type CampaignResult,
  type CampaignCheckpoint,
  matchSeedForCampaign,
} from './campaign';
import {
  aggregateCampaign,
  buildHorizonSeries,
  buildTrajectoryBands,
  type CampaignHorizon,
  type CampaignTrajectoryBand,
  type CampaignMetrics,
  type MatchMetrics,
  type ControlHorizon,
} from './metrics';
import { type Leader } from './cli';
import type { OpponentArchetype } from '../src/orchestration/leaderPolicy';
import {
  createSimEngine,
  disposeSimEngine,
  type SimEngineKind,
} from './engine';

export const PARALLEL_MANIFEST_VERSION = 1;
const CAMPAIGN_SEED_SALT = 0xa5f1523d;

export interface CampaignRunPlan {
  readonly totalMatches: number;
  readonly campaignLength: number;
  readonly campaigns: number;
}

export interface RunFlagValues {
  readonly matches: number | undefined;
  readonly campaignLength: number | undefined;
  readonly campaigns: number | undefined;
}

export function resolveRunPlan(values: RunFlagValues): CampaignRunPlan {
  const explicitMatches = values.matches;
  const explicitLength = values.campaignLength;
  const explicitCampaigns = values.campaigns;
  for (const [name, value] of [
    ['matches', explicitMatches],
    ['campaign-length', explicitLength],
    ['campaigns', explicitCampaigns],
  ] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
      throw new Error(`--${name} must be a positive integer.`);
    }
  }
  if (
    explicitMatches === undefined &&
    explicitLength === undefined &&
    explicitCampaigns === undefined
  ) {
    return { totalMatches: 1, campaignLength: 1, campaigns: 1 };
  }
  if (explicitLength !== undefined && explicitCampaigns !== undefined) {
    const impliedMatches = explicitLength * explicitCampaigns;
    if (explicitMatches !== undefined && explicitMatches !== impliedMatches) {
      throw new Error(
        `Inconsistent run dimensions: matches=${explicitMatches}, campaign-length=${explicitLength}, campaigns=${explicitCampaigns}.`,
      );
    }
    return {
      totalMatches: impliedMatches,
      campaignLength: explicitLength,
      campaigns: explicitCampaigns,
    };
  }
  if (explicitMatches !== undefined && explicitLength !== undefined) {
    if (explicitMatches % explicitLength !== 0) {
      throw new Error(
        `--matches=${explicitMatches} is not evenly divisible by --campaign-length=${explicitLength}.`,
      );
    }
    return {
      totalMatches: explicitMatches,
      campaignLength: explicitLength,
      campaigns: explicitMatches / explicitLength,
    };
  }
  if (explicitMatches !== undefined && explicitCampaigns !== undefined) {
    if (explicitMatches % explicitCampaigns !== 0) {
      throw new Error(
        `--matches=${explicitMatches} is not evenly divisible by --campaigns=${explicitCampaigns}.`,
      );
    }
    return {
      totalMatches: explicitMatches,
      campaignLength: explicitMatches / explicitCampaigns,
      campaigns: explicitCampaigns,
    };
  }
  if (explicitLength !== undefined) {
    return {
      totalMatches: explicitLength,
      campaignLength: explicitLength,
      campaigns: 1,
    };
  }
  if (explicitCampaigns !== undefined) {
    throw new Error(
      '--campaigns requires --campaign-length (or --matches to derive it).',
    );
  }
  return {
    totalMatches: explicitMatches ?? 1,
    campaignLength: explicitMatches ?? 1,
    campaigns: 1,
  };
}

export interface ShardOptions {
  readonly plan: CampaignRunPlan;
  readonly leader: Leader;
  readonly opponent: OpponentArchetype;
  readonly masterSeed: number;
  readonly engineKind: SimEngineKind;
  readonly depthCap: number | undefined;
  readonly shardIndex: number;
  readonly shardCount: number;
  readonly checkpoint?: CampaignCheckpoint;
  readonly onCheckpoint?: CampaignOptions['onCheckpoint'];
  readonly campaignRunner?: CampaignRunner;
  readonly campaignRunnerDeterminismId?: string;
}

export type CampaignRunner = (
  options: CampaignOptions,
) => Promise<CampaignResult>;

export interface ShardManifest {
  readonly manifestVersion: number;
  readonly schemaVersion: number;
  readonly psychConfigVersion: string;
  readonly determinismId: string;
  readonly masterSeed: number;
  readonly campaignCount: number;
  readonly campaignLength: number;
  readonly leader: Leader;
  readonly opponent: OpponentArchetype;
  readonly shardIndex: number;
  readonly shardCount: number;
  readonly campaignIndices: readonly number[];
  readonly commitSha?: string;
  readonly nodeVersion: string;
}

export interface CampaignArtifact {
  readonly campaignIndex: number;
  readonly campaignSeed: number;
  readonly metrics: readonly MatchMetrics[];
  readonly matchedSkillHorizon?: readonly ControlHorizon[];
}

export interface ShardArtifact {
  readonly manifest: ShardManifest;
  readonly campaigns: readonly CampaignArtifact[];
  readonly trajectoryBands?: readonly CampaignTrajectoryBand[];
  readonly horizon?: readonly CampaignHorizon[];
  readonly matchedSkillHorizon?: readonly ControlHorizon[];
}

export interface ShardCampaignResult {
  readonly campaignIndex: number;
  readonly campaignSeed: number;
  readonly result: CampaignResult;
  readonly matchedSkillHorizon: readonly ControlHorizon[];
}

export interface ShardResult {
  readonly manifest: ShardManifest;
  readonly campaigns: readonly ShardCampaignResult[];
  readonly summary: CampaignMetrics;
  readonly trajectoryBands: readonly CampaignTrajectoryBand[];
  readonly horizon: readonly CampaignHorizon[];
  readonly matchedSkillHorizon: readonly ControlHorizon[];
}

export function deriveCampaignSeed(
  masterSeed: number,
  campaignIndex: number,
): number {
  if (
    !Number.isSafeInteger(masterSeed) ||
    !Number.isSafeInteger(campaignIndex)
  ) {
    throw new TypeError('Campaign seed inputs must be safe integers.');
  }
  if (campaignIndex < 0) {
    throw new Error('Campaign index must be non-negative.');
  }
  let value =
    (masterSeed >>> 0) ^
    Math.imul((campaignIndex + 1) >>> 0, 0x9e3779b9) ^
    CAMPAIGN_SEED_SALT;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return value >>> 0;
}

export function campaignIndicesForShard(
  campaignCount: number,
  shardIndex: number,
  shardCount: number,
): number[] {
  if (
    !Number.isSafeInteger(campaignCount) ||
    campaignCount < 1 ||
    !Number.isSafeInteger(shardIndex) ||
    !Number.isSafeInteger(shardCount) ||
    shardCount < 1 ||
    shardIndex < 0 ||
    shardIndex >= shardCount
  ) {
    throw new Error('Invalid campaign shard configuration.');
  }
  return Array.from({ length: campaignCount }, (_, index) => index).filter(
    (index) => index % shardCount === shardIndex,
  );
}

function identityFromEnvironment(): {
  commitSha?: string;
  nodeVersion: string;
} {
  const commitSha = process.env.GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  return {
    ...(commitSha === undefined ? {} : { commitSha }),
    nodeVersion: process.version,
  };
}

export async function runShard(options: ShardOptions): Promise<ShardResult> {
  const indices = campaignIndicesForShard(
    options.plan.campaigns,
    options.shardIndex,
    options.shardCount,
  );
  const campaignRunner = options.campaignRunner ?? runCampaign;
  const engine =
    options.campaignRunner === undefined
      ? await createSimEngine(options.engineKind)
      : undefined;
  try {
    const campaigns: ShardCampaignResult[] = [];
    for (const campaignIndex of indices) {
      const campaignSeed =
        options.plan.campaigns === 1
          ? options.masterSeed
          : deriveCampaignSeed(options.masterSeed, campaignIndex);
      const result = await campaignRunner({
        matches: options.plan.campaignLength,
        leader: options.leader,
        opponent: options.opponent,
        seed: campaignSeed,
        ...(engine === undefined ? {} : { engine }),
        depthCap: options.depthCap,
        ...(options.checkpoint === undefined
          ? {}
          : { checkpoint: options.checkpoint }),
        ...(options.onCheckpoint === undefined || campaignIndex !== indices[0]
          ? {}
          : { onCheckpoint: options.onCheckpoint }),
      });
      campaigns.push({
        campaignIndex,
        campaignSeed,
        result,
        matchedSkillHorizon: plainChessHorizonSeries({
          matches: result.metrics.length,
          seed: campaignSeed,
          whiteLeader: options.leader,
          blackLeader: options.opponent,
        }),
      });
    }
    const allMetrics = campaigns.flatMap((campaign) => campaign.result.metrics);
    const determinismId =
      campaigns[0]?.result.determinismId ??
      engine?.determinismId ??
      options.campaignRunnerDeterminismId;
    if (determinismId === undefined) {
      throw new Error('Campaign runner did not provide a determinism ID.');
    }
    const summary = aggregateCampaign(
      options.leader,
      options.masterSeed,
      allMetrics,
    );
    const campaignAttrition =
      campaigns.reduce(
        (sum, campaign) => sum + campaign.result.summary.desertionAttrition,
        0,
      ) / Math.max(1, campaigns.length);
    const manifest: ShardManifest = {
      manifestVersion: PARALLEL_MANIFEST_VERSION,
      schemaVersion: SCHEMA_VERSION,
      psychConfigVersion: PSYCH_CONFIG_VERSION,
      determinismId,
      masterSeed: options.masterSeed,
      campaignCount: options.plan.campaigns,
      campaignLength: options.plan.campaignLength,
      leader: options.leader,
      opponent: options.opponent,
      shardIndex: options.shardIndex,
      shardCount: options.shardCount,
      campaignIndices: indices,
      ...identityFromEnvironment(),
    };
    return {
      manifest,
      campaigns,
      summary: { ...summary, desertionAttrition: campaignAttrition },
      trajectoryBands: averageCampaignTrajectoryBands(
        campaigns.map((campaign) => campaign.result.metrics),
      ),
      horizon: averageCampaignHorizonSeries(
        campaigns.map((campaign) => campaign.result.metrics),
      ),
      matchedSkillHorizon: averagePlainChessHorizonSeries(
        campaigns.map((campaign) => campaign.matchedSkillHorizon),
      ),
    };
  } finally {
    if (engine !== undefined) {
      await disposeSimEngine(options.engineKind);
    }
  }
}

export function artifactFromShard(result: ShardResult): ShardArtifact {
  return {
    manifest: result.manifest,
    campaigns: result.campaigns.map((campaign) => ({
      campaignIndex: campaign.campaignIndex,
      campaignSeed: campaign.campaignSeed,
      metrics: campaign.result.metrics,
      matchedSkillHorizon: campaign.matchedSkillHorizon,
    })),
    trajectoryBands: result.trajectoryBands,
    horizon: result.horizon,
    matchedSkillHorizon: result.matchedSkillHorizon,
  };
}

export async function writeShardArtifact(
  path: string,
  result: ShardResult,
): Promise<void> {
  await writeFile(
    path,
    `${canonicalJson(artifactFromShard(result))}\n`,
    'utf8',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readShardArtifact(path: string): Promise<ShardArtifact> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (
    !isRecord(value) ||
    !isRecord(value.manifest) ||
    !Array.isArray(value.campaigns)
  ) {
    throw new Error(`Invalid shard artifact: ${path}`);
  }
  return value as unknown as ShardArtifact;
}

export interface AggregatedRun {
  readonly manifest: Omit<
    ShardManifest,
    'shardIndex' | 'shardCount' | 'campaignIndices'
  > & {
    readonly shardCount: number;
  };
  readonly summary: CampaignMetrics;
  readonly campaigns: readonly CampaignArtifact[];
  readonly trajectoryBands: readonly CampaignTrajectoryBand[];
  readonly horizon: readonly CampaignHorizon[];
  readonly matchedSkillHorizon: readonly ControlHorizon[];
}

export function averageCampaignTrajectoryBands(
  campaigns: readonly (readonly MatchMetrics[])[],
): readonly CampaignTrajectoryBand[] {
  if (campaigns.length === 0) return [];
  const bands = campaigns.map(buildTrajectoryBands);
  return ([1, 2, 3, 4] as const).map((quartile) => {
    const selected = bands
      .map((campaign) => campaign[quartile - 1])
      .filter((band): band is CampaignTrajectoryBand => band !== undefined);
    const mean = (pick: (band: CampaignTrajectoryBand) => number): number =>
      selected.reduce((sum, band) => sum + pick(band), 0) /
      Math.max(1, selected.length);
    return {
      quartile,
      startMatch:
        selected.length === 0
          ? 0
          : Math.min(...selected.map((band) => band.startMatch)),
      endMatch: Math.max(...selected.map((band) => band.endMatch), 0),
      matches: Math.round(
        selected.reduce((sum, band) => sum + band.matches, 0) /
          Math.max(1, selected.length),
      ),
      meanTauAbil: mean((band) => band.meanTauAbil),
      meanTauBenev: mean((band) => band.meanTauBenev),
      meanRefusalRate: mean((band) => band.meanRefusalRate),
      meanRefusalsPerPly: mean((band) => band.meanRefusalsPerPly),
      meanVindicationRate: mean((band) => band.meanVindicationRate),
      meanDripEvents: mean((band) => band.meanDripEvents),
      meanAdjudicationVindicationRate: mean(
        (band) => band.meanAdjudicationVindicationRate,
      ),
      meanFinalTauAbilByRole: Object.fromEntries(
        [
          ...new Set(
            selected.flatMap((band) =>
              Object.keys(band.meanFinalTauAbilByRole),
            ),
          ),
        ].map((role) => [
          role,
          mean((band) => band.meanFinalTauAbilByRole[role] ?? 0),
        ]),
      ),
      desertionMatchRate: mean((band) => band.desertionMatchRate),
      desertionAttrition: mean((band) => band.desertionAttrition),
      routRate: mean((band) => band.routRate),
      meanSurvivingRosterSize: mean((band) => band.meanSurvivingRosterSize),
      enemyDesertionAttrition: mean((band) => band.enemyDesertionAttrition),
      meanEnemySurvivingRosterSize: mean(
        (band) => band.meanEnemySurvivingRosterSize,
      ),
      meanEnemyDesertions: mean((band) => band.meanEnemyDesertions),
      meanEnemyRefusalRate: mean((band) => band.meanEnemyRefusalRate),
      meanAttritionDifferential: mean((band) => band.meanAttritionDifferential),
      meanSurvivingRosterDifferential: mean(
        (band) => band.meanSurvivingRosterDifferential,
      ),
      meanDesertionDifferential: mean((band) => band.meanDesertionDifferential),
      meanRefusalRateDifferential: mean(
        (band) => band.meanRefusalRateDifferential,
      ),
      meanWinScore: mean((band) => band.meanWinScore),
    };
  });
}

export function averageCampaignHorizonSeries(
  campaigns: readonly (readonly MatchMetrics[])[],
): readonly CampaignHorizon[] {
  const series = campaigns.map((metrics) => buildHorizonSeries(metrics));
  const maxLength = Math.max(...series.map((horizon) => horizon.length), 0);
  return Array.from({ length: maxLength }, (_, index) => {
    const selected = series
      .map((horizon) => horizon[index])
      .filter((point): point is CampaignHorizon => point !== undefined);
    const mean = (pick: (point: CampaignHorizon) => number): number =>
      selected.reduce((sum, point) => sum + pick(point), 0) /
      Math.max(1, selected.length);
    return {
      horizon: index + 1,
      meanWinScore: mean((point) => point.meanWinScore),
      winCount: mean((point) => point.winCount),
      drawCount: mean((point) => point.drawCount),
      lossCount: mean((point) => point.lossCount),
      winRate: mean((point) => point.winRate),
      drawRate: mean((point) => point.drawRate),
      lossRate: mean((point) => point.lossRate),
      routRate: mean((point) => point.routRate),
      meanRefusalRate: mean((point) => point.meanRefusalRate),
      meanRefusalsPerPly: mean((point) => point.meanRefusalsPerPly),
      desertionMatchRate: mean((point) => point.desertionMatchRate),
      desertionAttrition: mean((point) => point.desertionAttrition),
      meanDesertions: mean((point) => point.meanDesertions),
      meanSurvivingRosterSize: mean((point) => point.meanSurvivingRosterSize),
      enemyDesertionAttrition: mean((point) => point.enemyDesertionAttrition),
      meanEnemySurvivingRosterSize: mean(
        (point) => point.meanEnemySurvivingRosterSize,
      ),
      meanEnemyDesertions: mean((point) => point.meanEnemyDesertions),
      meanEnemyRefusalRate: mean((point) => point.meanEnemyRefusalRate),
      attritionDifferential: mean((point) => point.attritionDifferential),
      survivingRosterDifferential: mean(
        (point) => point.survivingRosterDifferential,
      ),
      desertionDifferential: mean((point) => point.desertionDifferential),
      refusalRateDifferential: mean((point) => point.refusalRateDifferential),
      meanTauAbil: mean((point) => point.meanTauAbil),
      meanTauBenev: mean((point) => point.meanTauBenev),
      meanTrustEnd: mean((point) => point.meanTrustEnd),
    };
  });
}

function identityKey(manifest: ShardManifest): string {
  return JSON.stringify([
    manifest.manifestVersion,
    manifest.schemaVersion,
    manifest.psychConfigVersion,
    manifest.determinismId,
    manifest.masterSeed,
    manifest.campaignCount,
    manifest.campaignLength,
    manifest.leader,
    manifest.opponent,
    manifest.commitSha,
    manifest.nodeVersion,
  ]);
}

export function aggregateShardArtifacts(
  artifacts: readonly ShardArtifact[],
): AggregatedRun {
  if (artifacts.length === 0) {
    throw new Error('At least one shard artifact is required.');
  }
  const firstArtifact = artifacts[0];
  if (firstArtifact === undefined) {
    throw new Error('At least one shard artifact is required.');
  }
  const first = firstArtifact.manifest;
  const expectedIdentity = identityKey(first);
  const campaigns = artifacts.flatMap((artifact) => artifact.campaigns);
  const seenShards = new Set<number>();
  for (const artifact of artifacts) {
    if (identityKey(artifact.manifest) !== expectedIdentity) {
      throw new Error('Shard manifests disagree on run identity fields.');
    }
    if (
      artifact.manifest.shardCount !== first.shardCount ||
      artifact.manifest.shardIndex < 0 ||
      artifact.manifest.shardIndex >= first.shardCount ||
      seenShards.has(artifact.manifest.shardIndex)
    ) {
      throw new Error(
        'Shard manifests contain duplicate or inconsistent shards.',
      );
    }
    seenShards.add(artifact.manifest.shardIndex);
    if (
      JSON.stringify(
        [...artifact.manifest.campaignIndices].sort(
          (left, right) => left - right,
        ),
      ) !==
      JSON.stringify(
        artifact.campaigns
          .map((campaign) => campaign.campaignIndex)
          .sort((left, right) => left - right),
      )
    ) {
      throw new Error(
        'Shard manifest campaign indices do not match its campaigns.',
      );
    }
  }
  if (seenShards.size !== first.shardCount) {
    throw new Error(
      `Incomplete shard set: expected ${first.shardCount} shards, received ${seenShards.size}.`,
    );
  }
  const expectedIndices = new Set(
    Array.from({ length: first.campaignCount }, (_, index) => index),
  );
  const seen = new Set<number>();
  for (const campaign of campaigns) {
    if (!expectedIndices.has(campaign.campaignIndex)) {
      throw new Error(
        `Shard artifact contains unexpected campaign index ${campaign.campaignIndex}.`,
      );
    }
    if (seen.has(campaign.campaignIndex)) {
      throw new Error(
        `Campaign index ${campaign.campaignIndex} appears more than once.`,
      );
    }
    seen.add(campaign.campaignIndex);
  }
  if (seen.size !== expectedIndices.size) {
    const missing = [...expectedIndices].filter((index) => !seen.has(index));
    throw new Error(`Missing campaign indices: ${missing.join(', ')}.`);
  }
  const orderedCampaigns = [...campaigns].sort(
    (left, right) => left.campaignIndex - right.campaignIndex,
  );
  const allMetrics = orderedCampaigns.flatMap((campaign) => campaign.metrics);
  const summary = aggregateCampaign(first.leader, first.masterSeed, allMetrics);
  const campaignAttrition =
    orderedCampaigns.reduce(
      (sum, campaign) =>
        sum +
        aggregateCampaign(first.leader, campaign.campaignSeed, campaign.metrics)
          .desertionAttrition,
      0,
    ) / Math.max(1, orderedCampaigns.length);
  return {
    manifest: {
      manifestVersion: first.manifestVersion,
      schemaVersion: first.schemaVersion,
      psychConfigVersion: first.psychConfigVersion,
      determinismId: first.determinismId,
      masterSeed: first.masterSeed,
      campaignCount: first.campaignCount,
      campaignLength: first.campaignLength,
      leader: first.leader,
      opponent: first.opponent,
      ...(first.commitSha === undefined ? {} : { commitSha: first.commitSha }),
      nodeVersion: first.nodeVersion,
      shardCount: artifacts.length,
    },
    summary: { ...summary, desertionAttrition: campaignAttrition },
    campaigns: orderedCampaigns,
    trajectoryBands: averageCampaignTrajectoryBands(
      orderedCampaigns.map((campaign) => campaign.metrics),
    ),
    horizon: averageCampaignHorizonSeries(
      orderedCampaigns.map((campaign) => campaign.metrics),
    ),
    matchedSkillHorizon: averagePlainChessHorizonSeries(
      orderedCampaigns.map(
        (campaign) =>
          campaign.matchedSkillHorizon ??
          plainChessHorizonSeries({
            matches: campaign.metrics.length,
            seed: campaign.campaignSeed,
            whiteLeader: first.leader,
            blackLeader: first.opponent,
          }),
      ),
    ),
  };
}

export function matchSeedsForCampaign(
  campaignSeed: number,
  campaignLength: number,
): number[] {
  return Array.from({ length: campaignLength }, (_, index) =>
    matchSeedForCampaign(campaignSeed, index + 1),
  );
}
