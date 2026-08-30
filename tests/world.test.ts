import { describe, expect, it } from 'vitest';

import {
  createWorld,
  matchSeedForWorldPairing,
  pairingSchedule,
  runWorldRoundRobin,
  WORLD_COMMANDER_STYLES,
} from '../sim/world';
import { opponentArchetypeForLeader } from '../sim/cli';
import { LivingBoard } from '../src/chess';
import { startingAbilityForRole } from '../src/psychology';
import { createStartingRoster, mergeCampaignRoster } from '../sim/roster';

describe('world pairing layer', () => {
  it('produces a deterministic complete schedule', () => {
    const first = pairingSchedule(7);
    expect(first).toEqual(pairingSchedule(7));
    expect(first).not.toEqual(pairingSchedule(8));
    expect(first).toHaveLength(WORLD_COMMANDER_STYLES.length ** 2);
    expect(new Set(first.map((pairing) => pairing.index)).size).toBe(
      first.length,
    );
  });

  it('derives distinct seeds for every pairing and match', () => {
    const seeds = new Set<number>();
    for (let pairing = 0; pairing < 25; pairing += 1) {
      for (let match = 1; match <= 4; match += 1) {
        seeds.add(matchSeedForWorldPairing(19, pairing, match));
      }
    }
    expect(seeds).toHaveLength(100);
    expect(matchSeedForWorldPairing(19, 0, 1)).toBe(
      matchSeedForWorldPairing(19, 0, 1),
    );
  });

  it('preserves carried traits while restoring fresh traits for new identities', () => {
    const board = LivingBoard.standard();
    const original = createStartingRoster(board, 'w', 40, 0.1);
    const carried = original.slice(0, 2).map((piece, index) => ({
      ...piece,
      E_i: index === 0 ? 90 : 7,
    }));
    const restored = mergeCampaignRoster(board, 'w', carried, 40, 0.9);
    expect(restored[0]?.traits).toEqual(original[0]?.traits);
    expect(restored[0]?.E_i).toBe(90);
    expect(restored[1]?.E_i).toBe(7);
    expect(restored[1]?.traits).toEqual(original[1]?.traits);
    expect(restored[1]?.traits).not.toEqual(
      createStartingRoster(board, 'w', 40, 0.9)[1]?.traits,
    );
    const fresh = restored[2];
    expect(fresh).toBeDefined();
    if (fresh === undefined) return;
    expect(fresh.E_i).toBe(startingAbilityForRole(fresh.role));
  });

  it('keeps fixed-side commander rosters owned by their identities', () => {
    const world = createWorld(7);
    expect(world.commanders).toHaveLength(WORLD_COMMANDER_STYLES.length * 2);
    for (const commander of world.commanders) {
      expect(commander.id).toBe(`${commander.side}:${commander.style}`);
      expect(commander.roster).toHaveLength(16);
    }
  });

  it('rejects harness styles without an opposing commander archetype', () => {
    expect(opponentArchetypeForLeader('supportive')).toBe('supportive');
    for (const leader of [
      'redeemer',
      'exacting',
      'absentee',
      'steady',
    ] as const) {
      expect(() => opponentArchetypeForLeader(leader)).toThrow(
        /no opposing commander archetype/,
      );
    }
  });

  it('returns per-pairing metrics and a style matrix', async () => {
    const result = await runWorldRoundRobin({
      seed: 7,
      styles: ['servant', 'supportive'],
      matchesPerPairing: 1,
      engineKind: 'fake',
      enemyTrackedIdentities: 16,
    });
    expect(result.pairings).toHaveLength(4);
    expect(Object.keys(result.matrix).sort()).toEqual([
      'servant→servant',
      'servant→supportive',
      'supportive→servant',
      'supportive→supportive',
    ]);
    expect(result.pairings.every((pairing) => pairing.metrics.length > 0)).toBe(
      true,
    );
    expect(result.pairings.every((pairing) => pairing.horizon.length > 0)).toBe(
      true,
    );
  });

  it('carries both commanders psychological state into the next match', async () => {
    const result = await runWorldRoundRobin({
      seed: 7,
      styles: ['servant'],
      matchesPerPairing: 2,
      engineKind: 'fake',
      enemyTrackedIdentities: 16,
    });
    const pairing = result.pairings[0];
    expect(pairing).toBeDefined();
    if (pairing === undefined) return;
    const whiteFirst = pairing.startingWhiteRosters[0];
    const whiteSecond = pairing.startingWhiteRosters[1];
    const blackFirst = pairing.startingBlackRosters[0];
    const blackSecond = pairing.startingBlackRosters[1];
    expect(whiteFirst).toBeDefined();
    expect(whiteSecond).toBeDefined();
    expect(blackFirst).toBeDefined();
    expect(blackSecond).toBeDefined();
    if (
      whiteFirst === undefined ||
      whiteSecond === undefined ||
      blackFirst === undefined ||
      blackSecond === undefined
    ) {
      return;
    }
    const whiteEndedRoster = pairing.endingWhiteRosters[0] ?? [];
    const blackEndedRoster = pairing.endingBlackRosters[0] ?? [];
    const whiteCarriedId = whiteFirst.find(
      (piece) =>
        whiteSecond.some((candidate) => candidate.id === piece.id) &&
        whiteEndedRoster.some((candidate) => candidate.id === piece.id),
    )?.id;
    const blackCarriedId = blackFirst.find(
      (piece) =>
        blackSecond.some((candidate) => candidate.id === piece.id) &&
        blackEndedRoster.some((candidate) => candidate.id === piece.id),
    )?.id;
    expect(whiteCarriedId).toBeDefined();
    expect(blackCarriedId).toBeDefined();
    const whiteAfter = whiteSecond.find((piece) => piece.id === whiteCarriedId);
    const blackAfter = blackSecond.find((piece) => piece.id === blackCarriedId);
    const whiteEnded = whiteEndedRoster.find(
      (piece) => piece.id === whiteCarriedId,
    );
    const blackEnded = blackEndedRoster.find(
      (piece) => piece.id === blackCarriedId,
    );
    expect(whiteAfter?.traits).toEqual(whiteEnded?.traits);
    expect(blackAfter?.traits).toEqual(blackEnded?.traits);
    expect(whiteAfter?.credence).toEqual(whiteEnded?.credence);
    expect(blackAfter?.credence).toEqual(blackEnded?.credence);
  });
});
