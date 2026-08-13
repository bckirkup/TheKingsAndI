import type { EnginePort } from '../src/engine/types';
import type { OpponentArchetype } from '../src/orchestration/leaderPolicy';

import { matchSeedForCampaign } from './campaign';
import {
  createSimEngine,
  disposeSimEngine,
  type SimEngineKind,
} from './engine';
import {
  metricsFromMatch,
  buildHorizonSeries,
  type CampaignHorizon,
  type MatchMetrics,
} from './metrics';
import { runMatch } from './match';
import {
  createCommanderPool,
  fieldPool,
  foldMatchIntoPools,
  poolSnapshot,
  type CommanderPool,
  type PoolEvent,
  type PoolSnapshot,
} from './pool';
import { SEASON_CONFIG, type SeasonConfig } from './seasonConfig';

export interface SeasonOptions {
  readonly seed: number;
  readonly matches: number;
  readonly whiteStyle: OpponentArchetype;
  readonly blackStyle: OpponentArchetype;
  readonly depthFactor?: number;
  readonly config?: SeasonConfig;
  readonly engine?: EnginePort;
  readonly engineKind?: SimEngineKind;
}

export interface SeasonResult {
  readonly metrics: readonly MatchMetrics[];
  readonly horizon: readonly CampaignHorizon[];
  readonly whiteSnapshots: readonly PoolSnapshot[];
  readonly blackSnapshots: readonly PoolSnapshot[];
  readonly poolEvents: readonly PoolEvent[];
  readonly finalWhitePool: CommanderPool;
  readonly finalBlackPool: CommanderPool;
}

export async function runSeason(options: SeasonOptions): Promise<SeasonResult> {
  const config = options.config ?? SEASON_CONFIG;
  const whiteRandomUnit =
    (((options.seed % 10_000) + 10_000) % 10_000) / 10_000;
  const blackRandomUnit =
    ((((options.seed + 1) % 10_000) + 10_000) % 10_000) / 10_000;
  const white = createCommanderPool({
    id: 'white-commander',
    side: 'w',
    style: options.whiteStyle,
    depthFactor: options.depthFactor ?? config.POOL_DEPTH_FACTOR,
    randomUnit: whiteRandomUnit,
  });
  const black = createCommanderPool({
    id: 'black-commander',
    side: 'b',
    style: options.blackStyle,
    depthFactor: options.depthFactor ?? config.POOL_DEPTH_FACTOR,
    randomUnit: blackRandomUnit,
  });
  let whitePool = white;
  let blackPool = black;
  const metrics: MatchMetrics[] = [];
  const whiteSnapshots: PoolSnapshot[] = [];
  const blackSnapshots: PoolSnapshot[] = [];
  const poolEvents: PoolEvent[] = [];
  const engine =
    options.engine ?? (await createSimEngine(options.engineKind ?? 'fake'));
  const ownedEngine = options.engine === undefined;
  try {
    for (let match = 1; match <= options.matches; match += 1) {
      const whiteFielded = fieldPool(whitePool, match);
      const blackFielded = fieldPool(blackPool, match);
      const whiteLineup = whiteFielded.lineup.map((member) => member.state);
      const blackLineup = blackFielded.lineup.map((member) => member.state);
      const matchSeed = matchSeedForCampaign(options.seed, match);
      const result = await runMatch({
        seed: matchSeed,
        leader: options.whiteStyle,
        opponent: options.blackStyle,
        matchIndex: match,
        campaignMatch: match,
        roster: whiteLineup,
        initialLineup: whiteLineup,
        enemyRoster: blackLineup,
        initialEnemyLineup: blackLineup,
        enemyTrackedIdentities: 16,
        engine,
      });
      const matchMetric = metricsFromMatch(
        match,
        matchSeed,
        options.whiteStyle,
        whiteLineup,
        result,
        result.refusedGoodMoves,
      );
      const folded = foldMatchIntoPools({
        white: whitePool,
        black: blackPool,
        whiteFielded,
        blackFielded,
        result,
        match,
        config,
      });
      const whiteSnapshot = poolSnapshot(folded.white, whiteFielded);
      const blackSnapshot = poolSnapshot(folded.black, blackFielded);
      poolEvents.push(...folded.events);
      metrics.push({
        ...matchMetric,
        passedOverDistribution: whiteSnapshot.passedOverDistribution,
        enemyPassedOverDistribution: blackSnapshot.passedOverDistribution,
        obsolescenceCount: folded.events.filter(
          (event) => event.t === 'OBSOLESCENCE' && event.side === 'w',
        ).length,
        enemyObsolescenceCount: folded.events.filter(
          (event) => event.t === 'OBSOLESCENCE' && event.side === 'b',
        ).length,
      });
      whiteSnapshots.push(whiteSnapshot);
      blackSnapshots.push(blackSnapshot);
      whitePool = folded.white;
      blackPool = folded.black;
    }
  } finally {
    if (ownedEngine) await disposeSimEngine(options.engineKind ?? 'fake');
  }
  return {
    metrics,
    horizon: buildHorizonSeries(metrics),
    whiteSnapshots,
    blackSnapshots,
    poolEvents,
    finalWhitePool: whitePool,
    finalBlackPool: blackPool,
  };
}
