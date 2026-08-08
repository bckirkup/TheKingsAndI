import { LivingBoard } from '../src/chess';
import {
  createSeededRandom,
  createSeededRandomFromState,
  type RandomState,
} from '../src/core/random';
import type { EnginePort } from '../src/engine/types';
import { PSYCH_CONFIG_VERSION, SCHEMA_VERSION } from '../src/persistence/types';
import type { PieceState } from '../src/psychology';

import type { Leader } from './cli';
import { capEngineDepth, createSimEngine, type SimEngineKind } from './engine';
import { runMatch } from './match';
import {
  aggregateCampaign,
  metricsFromMatch,
  type CampaignMetrics,
  type MatchMetrics,
} from './metrics';
import { createStartingRoster, mergeCampaignRoster } from './roster';

export interface CampaignOptions {
  readonly matches: number;
  readonly leader: Leader;
  readonly seed: number;
  readonly initialTrust?: number;
  readonly engine?: EnginePort;
  readonly engineKind?: SimEngineKind;
  /** Harness-only tractability cap; does not alter psychology depth allocation. */
  readonly depthCap?: number | undefined;
  readonly checkpoint?: CampaignCheckpoint;
}

export interface CampaignCheckpoint {
  readonly schemaVersion: number;
  readonly psychConfigVersion: string;
  readonly determinismId: string;
  readonly seed: number;
  readonly leader: Leader;
  readonly initialTrust: number;
  readonly nextMatch: number;
  readonly randomState: RandomState;
  readonly roster: readonly PieceState[];
  readonly completedMetrics: readonly MatchMetrics[];
}

export interface CampaignResult {
  readonly metrics: readonly MatchMetrics[];
  readonly summary: CampaignMetrics;
  readonly finalRoster: readonly PieceState[];
  readonly determinismId: string;
  readonly checkpoint: CampaignCheckpoint;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCampaignCheckpoint(value: unknown): CampaignCheckpoint {
  if (!isRecord(value)) {
    throw new Error('Campaign checkpoint must be a JSON object.');
  }
  const randomState = value.randomState;
  if (!isRecord(randomState)) {
    throw new Error('Campaign checkpoint randomState is missing.');
  }
  const requiredKeys = [
    'schemaVersion',
    'psychConfigVersion',
    'determinismId',
    'seed',
    'leader',
    'initialTrust',
    'nextMatch',
    'roster',
    'completedMetrics',
  ] as const;
  for (const key of requiredKeys) {
    if (!(key in value)) {
      throw new Error(`Campaign checkpoint is missing ${key}.`);
    }
  }
  for (const key of ['s0', 's1', 's2', 's3'] as const) {
    if (!(key in randomState)) {
      throw new Error(`Campaign checkpoint randomState is missing ${key}.`);
    }
  }
  if (!Array.isArray(value.roster) || !Array.isArray(value.completedMetrics)) {
    throw new Error(
      'Campaign checkpoint roster and completedMetrics must be arrays.',
    );
  }
  return value as unknown as CampaignCheckpoint;
}

function leaderTrustBias(leader: Leader): number {
  switch (leader) {
    case 'supportive':
    case 'servant':
      return 40;
    case 'tyrannical':
    case 'pure_tactician':
      return -10;
    case 'volatile':
      return 10;
    case 'redeemer':
      return 0;
    case 'random':
    default:
      return 20;
  }
}

export async function runCampaign(
  options: CampaignOptions,
): Promise<CampaignResult> {
  const board = LivingBoard.standard();
  const baseEngine =
    options.engine ?? (await createSimEngine(options.engineKind ?? 'lozza'));
  const engine = capEngineDepth(baseEngine, options.depthCap);
  const initialTrust = options.initialTrust ?? leaderTrustBias(options.leader);
  const checkpoint = options.checkpoint;
  if (checkpoint !== undefined) {
    validateCheckpoint(checkpoint, options, engine.determinismId, initialTrust);
  }
  const random =
    checkpoint === undefined
      ? createSeededRandom(options.seed)
      : createSeededRandomFromState(checkpoint.randomState);
  let roster =
    checkpoint === undefined
      ? createStartingRoster(
          board,
          'w',
          initialTrust,
          random.nextInt(10_000) / 10_000,
        )
      : [...checkpoint.roster];
  const metrics: MatchMetrics[] =
    checkpoint === undefined ? [] : [...checkpoint.completedMetrics];
  const firstMatch = checkpoint?.nextMatch ?? 1;

  for (let match = firstMatch; match <= options.matches; match += 1) {
    const matchSeed = options.seed ^ (match * 1_000_003);
    roster = mergeCampaignRoster(
      board,
      'w',
      roster,
      initialTrust,
      random.nextInt(10_000) / 10_000,
    );
    const rosterStart = roster;
    const result = await runMatch({
      seed: matchSeed,
      leader: options.leader,
      matchIndex: match,
      campaignMatch: match,
      roster,
      engine,
    });
    const metric = metricsFromMatch(
      match,
      matchSeed,
      options.leader,
      rosterStart,
      result,
      result.refusedGoodMoves,
    );
    metrics.push(metric);
    roster = [...result.roster];
  }

  const resultCheckpoint: CampaignCheckpoint = {
    schemaVersion: SCHEMA_VERSION,
    psychConfigVersion: PSYCH_CONFIG_VERSION,
    determinismId: engine.determinismId,
    seed: options.seed,
    leader: options.leader,
    initialTrust,
    nextMatch: options.matches + 1,
    randomState: random.snapshot(),
    roster: [...roster],
    completedMetrics: [...metrics],
  };
  return {
    metrics,
    summary: aggregateCampaign(options.leader, options.seed, metrics),
    finalRoster: roster,
    determinismId: engine.determinismId,
    checkpoint: resultCheckpoint,
  };
}

function validateCheckpoint(
  checkpoint: CampaignCheckpoint,
  options: CampaignOptions,
  determinismId: string,
  initialTrust: number,
): void {
  if (checkpoint.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Checkpoint schemaVersion mismatch: checkpoint=${checkpoint.schemaVersion}, run=${SCHEMA_VERSION}.`,
    );
  }
  if (checkpoint.psychConfigVersion !== PSYCH_CONFIG_VERSION) {
    throw new Error(
      `Checkpoint psychConfigVersion mismatch: checkpoint=${checkpoint.psychConfigVersion}, run=${PSYCH_CONFIG_VERSION}.`,
    );
  }
  if (checkpoint.determinismId !== determinismId) {
    throw new Error(
      `Checkpoint determinismId mismatch: checkpoint=${checkpoint.determinismId}, run=${determinismId}.`,
    );
  }
  if (checkpoint.leader !== options.leader) {
    throw new Error(
      `Checkpoint leader mismatch: checkpoint=${checkpoint.leader}, run=${options.leader}.`,
    );
  }
  if (checkpoint.seed !== options.seed) {
    throw new Error(
      `Checkpoint seed mismatch: checkpoint=${checkpoint.seed}, run=${options.seed}.`,
    );
  }
  if (checkpoint.initialTrust !== initialTrust) {
    throw new Error(
      `Checkpoint initialTrust mismatch: checkpoint=${checkpoint.initialTrust}, run=${initialTrust}.`,
    );
  }
  if (!Number.isSafeInteger(checkpoint.nextMatch) || checkpoint.nextMatch < 1) {
    throw new Error('Checkpoint nextMatch must be a positive integer.');
  }
  if (options.matches < checkpoint.nextMatch - 1) {
    throw new Error(
      `Checkpoint nextMatch ${checkpoint.nextMatch} is beyond requested match count ${options.matches}.`,
    );
  }
  if (checkpoint.completedMetrics.length !== checkpoint.nextMatch - 1) {
    throw new Error(
      'Checkpoint completedMetrics length does not match nextMatch.',
    );
  }
}

export async function runSimulation(
  options: CampaignOptions,
): Promise<MatchMetrics[]> {
  return [...(await runCampaign(options)).metrics];
}
