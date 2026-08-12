import { describe, expect, it } from 'vitest';

import {
  createWorld,
  pairingSchedule,
  runWorldRoundRobin,
  WORLD_COMMANDER_STYLES,
} from '../sim/world';
import { opponentArchetypeForLeader } from '../sim/cli';

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
    expect(() => opponentArchetypeForLeader('redeemer')).toThrow(
      /no opposing commander archetype/,
    );
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
});
