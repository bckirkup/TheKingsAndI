import { LivingBoard } from '../src/chess';
import type { EnginePort } from '../src/engine/types';
import type { OpponentArchetype } from '../src/orchestration/leaderPolicy';
import type { PieceState } from '../src/psychology';

import { createSeededRandom } from '../src/core/random';

import {
  buildHorizonSeries,
  metricsFromMatch,
  type CampaignHorizon,
  type MatchMetrics,
} from './metrics';
import { runMatch } from './match';
import { createStartingRoster, mergeCampaignRoster } from './roster';
import {
  createSimEngine,
  disposeSimEngine,
  type SimEngineKind,
} from './engine';

export const WORLD_COMMANDER_STYLES = [
  'servant',
  'supportive',
  'tyrannical',
  'volatile',
  'random',
] as const satisfies readonly OpponentArchetype[];

export type WorldCommanderStyle = (typeof WORLD_COMMANDER_STYLES)[number];

export interface WorldCommander {
  readonly id: string;
  readonly side: 'w' | 'b';
  readonly style: WorldCommanderStyle;
  readonly roster: readonly PieceState[];
}

export interface World {
  readonly seed: number;
  readonly commanders: readonly WorldCommander[];
  readonly pairingSchedule: readonly WorldPairing[];
}

export interface WorldPairing {
  readonly index: number;
  readonly whiteCommanderId: string;
  readonly blackCommanderId: string;
  readonly whiteStyle: WorldCommanderStyle;
  readonly blackStyle: WorldCommanderStyle;
}

export interface WorldPairingResult {
  readonly pairing: WorldPairing;
  readonly metrics: readonly MatchMetrics[];
  readonly horizon: readonly CampaignHorizon[];
}

export interface WorldRoundRobinResult {
  readonly world: World;
  readonly pairings: readonly WorldPairingResult[];
  readonly matrix: Readonly<Record<string, number>>;
}

function commanderId(side: 'w' | 'b', style: WorldCommanderStyle): string {
  return `${side}:${style}`;
}

function deterministicOrder(
  seed: number,
  pairings: readonly WorldPairing[],
): WorldPairing[] {
  const random = createSeededRandom(seed);
  const ordered = [...pairings];
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swap = random.nextInt(index + 1);
    const current = ordered[index];
    const target = ordered[swap];
    if (current === undefined || target === undefined) {
      throw new Error('Pairing shuffle encountered an invalid index.');
    }
    ordered[index] = target;
    ordered[swap] = current;
  }
  return ordered;
}

function initialTrustForStyle(style: WorldCommanderStyle): number {
  return style === 'supportive' || style === 'servant' ? 40 : -10;
}

export function pairingSchedule(
  seed: number,
  styles: readonly WorldCommanderStyle[] = WORLD_COMMANDER_STYLES,
): readonly WorldPairing[] {
  const base = styles.flatMap((whiteStyle, whiteIndex) =>
    styles.map((blackStyle, blackIndex) => ({
      index: whiteIndex * styles.length + blackIndex,
      whiteCommanderId: commanderId('w', whiteStyle),
      blackCommanderId: commanderId('b', blackStyle),
      whiteStyle,
      blackStyle,
    })),
  );
  return deterministicOrder(seed, base);
}

export function createWorld(
  seed: number,
  styles: readonly WorldCommanderStyle[] = WORLD_COMMANDER_STYLES,
): World {
  const board = LivingBoard.standard();
  const random = createSeededRandom(seed);
  const commanders = styles.flatMap((style) =>
    (['w', 'b'] as const).map((side) => ({
      id: commanderId(side, style),
      side,
      style,
      roster: createStartingRoster(
        board,
        side,
        initialTrustForStyle(style),
        random.nextInt(10_000) / 10_000,
      ),
    })),
  );
  return {
    seed,
    commanders,
    pairingSchedule: pairingSchedule(seed, styles),
  };
}

export async function runWorldRoundRobin(options: {
  readonly seed: number;
  readonly styles?: readonly WorldCommanderStyle[];
  readonly matchesPerPairing?: number;
  readonly engine?: EnginePort;
  readonly engineKind?: SimEngineKind;
  readonly enemyTrackedIdentities?: number;
}): Promise<WorldRoundRobinResult> {
  const world = createWorld(options.seed, options.styles);
  const board = LivingBoard.standard();
  const commanders = new Map(
    world.commanders.map((commander) => [commander.id, commander]),
  );
  const pairings: WorldPairingResult[] = [];
  const engine =
    options.engine ?? (await createSimEngine(options.engineKind ?? 'fake'));
  const ownedEngine = options.engine === undefined;
  try {
    for (const pairing of world.pairingSchedule) {
      const metrics: MatchMetrics[] = [];
      for (
        let match = 1;
        match <= (options.matchesPerPairing ?? 1);
        match += 1
      ) {
        const white = commanders.get(pairing.whiteCommanderId);
        const black = commanders.get(pairing.blackCommanderId);
        if (white === undefined || black === undefined) {
          throw new Error(
            `Pairing references an unknown commander: ${pairing.index}.`,
          );
        }
        const whiteRoster = mergeCampaignRoster(
          board,
          'w',
          white.roster,
          initialTrustForStyle(white.style),
          0.5,
        );
        const blackRoster = mergeCampaignRoster(
          board,
          'b',
          black.roster,
          initialTrustForStyle(black.style),
          0.5,
        );
        const matchSeed =
          options.seed ^ ((pairing.index + 1) * 1_000_003) ^ match;
        const result = await runMatch({
          seed: matchSeed,
          leader: white.style,
          opponent: black.style,
          matchIndex: match,
          campaignMatch: match,
          roster: whiteRoster,
          enemyRoster: blackRoster,
          enemyTrackedIdentities: options.enemyTrackedIdentities ?? 16,
          engine,
        });
        metrics.push(
          metricsFromMatch(
            match,
            matchSeed,
            white.style,
            whiteRoster,
            result,
            result.refusedGoodMoves,
          ),
        );
        commanders.set(pairing.whiteCommanderId, {
          ...white,
          roster: result.roster,
        });
        commanders.set(pairing.blackCommanderId, {
          ...black,
          roster: result.enemyRoster,
        });
      }
      pairings.push({
        pairing,
        metrics,
        horizon: buildHorizonSeries(metrics),
      });
    }
  } finally {
    if (ownedEngine) await disposeSimEngine(options.engineKind ?? 'fake');
  }
  const matrix: Record<string, number> = {};
  for (const result of pairings) {
    const values = result.metrics.map((metric) => metric.winScore);
    matrix[`${result.pairing.whiteStyle}→${result.pairing.blackStyle}`] =
      values.reduce((sum, value) => sum + value, 0) /
      Math.max(1, values.length);
  }
  return {
    world: {
      ...world,
      commanders: [...commanders.values()],
    },
    pairings,
    matrix,
  };
}
