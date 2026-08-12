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
import { leaderTrustBias, matchSeedForCampaign } from './campaign';

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
  readonly startingWhiteRosters: readonly (readonly PieceState[])[];
  readonly startingBlackRosters: readonly (readonly PieceState[])[];
  readonly endingWhiteRosters: readonly (readonly PieceState[])[];
  readonly endingBlackRosters: readonly (readonly PieceState[])[];
}

export interface WorldRoundRobinResult {
  readonly world: World;
  readonly pairings: readonly WorldPairingResult[];
  readonly matrix: Readonly<Record<string, number>>;
}

function commanderId(side: 'w' | 'b', style: WorldCommanderStyle): string {
  return `${side}:${style}`;
}

const WORLD_MATCH_INDEX_STRIDE = 10_000;

/**
 * Derive a stable seed for one world pairing and match.
 * The stride keeps pairing and match coordinates distinct before the
 * campaign's multiplicative seed derivation is applied.
 */
export function matchSeedForWorldPairing(
  worldSeed: number,
  pairingIndex: number,
  match: number,
): number {
  if (
    !Number.isSafeInteger(pairingIndex) ||
    pairingIndex < 0 ||
    !Number.isSafeInteger(match) ||
    match < 1 ||
    match >= WORLD_MATCH_INDEX_STRIDE
  ) {
    throw new Error('World pairing and match coordinates are out of range.');
  }
  return matchSeedForCampaign(
    worldSeed,
    (pairingIndex + 1) * WORLD_MATCH_INDEX_STRIDE + match,
  );
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
        leaderTrustBias(style),
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
      const startingWhiteRosters: PieceState[][] = [];
      const startingBlackRosters: PieceState[][] = [];
      const endingWhiteRosters: PieceState[][] = [];
      const endingBlackRosters: PieceState[][] = [];
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
          leaderTrustBias(white.style),
          0.5,
        );
        const blackRoster = mergeCampaignRoster(
          board,
          'b',
          black.roster,
          leaderTrustBias(black.style),
          0.5,
        );
        const matchSeed = matchSeedForWorldPairing(
          options.seed,
          pairing.index,
          match,
        );
        startingWhiteRosters.push(whiteRoster.map((piece) => ({ ...piece })));
        startingBlackRosters.push(blackRoster.map((piece) => ({ ...piece })));
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
        endingWhiteRosters.push(result.roster.map((piece) => ({ ...piece })));
        endingBlackRosters.push(
          result.enemyRoster.map((piece) => ({ ...piece })),
        );
      }
      pairings.push({
        pairing,
        metrics,
        horizon: buildHorizonSeries(metrics),
        startingWhiteRosters,
        startingBlackRosters,
        endingWhiteRosters,
        endingBlackRosters,
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
