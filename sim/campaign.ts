import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import type { EnginePort } from '../src/engine/types';
import type { PieceState } from '../src/psychology';

import type { Leader } from './cli';
import { createSimEngine, type SimEngineKind } from './engine';
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
}

export interface CampaignResult {
  readonly metrics: readonly MatchMetrics[];
  readonly summary: CampaignMetrics;
  readonly finalRoster: readonly PieceState[];
  readonly determinismId: string;
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
  const random = createSeededRandom(options.seed);
  let roster = createStartingRoster(
    board,
    'w',
    options.initialTrust ?? leaderTrustBias(options.leader),
    random.nextInt(10_000) / 10_000,
  );
  const metrics: MatchMetrics[] = [];
  const engine =
    options.engine ??
    (await createSimEngine(options.engineKind ?? 'stockfish'));

  for (let match = 1; match <= options.matches; match += 1) {
    const matchSeed = options.seed ^ (match * 1_000_003);
    roster = mergeCampaignRoster(
      board,
      'w',
      roster,
      options.initialTrust ?? leaderTrustBias(options.leader),
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

  return {
    metrics,
    summary: aggregateCampaign(options.leader, options.seed, metrics),
    finalRoster: roster,
    determinismId: engine.determinismId,
  };
}

export async function runSimulation(
  options: CampaignOptions,
): Promise<MatchMetrics[]> {
  return [...(await runCampaign(options)).metrics];
}
