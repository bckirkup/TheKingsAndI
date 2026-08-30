import { describe, expect, it } from 'vitest';

import { LivingBoard, extractMoveFeatures } from '../src/chess';
import { digest } from '../src/core/digest';
import { createFakeEnginePort } from '../src/engine/fake';
import {
  projectMoveObservation,
  projectOverrideObservation,
  runHeadlessMatch,
  type HeadlessLeaderPort,
} from '../src/orchestration';
import { createSeededRandom } from '../src/core/random';
import { createStartingRoster } from '../sim/roster';
import {
  createJournallingLeader,
  journalMetrics,
  replayJournal,
  scriptedAgent,
  type JournalEntry,
} from '../sim/journal';

function simpleLeader(): HeadlessLeaderPort {
  return {
    chooseMove(board, side) {
      const intent = board
        .legalMoves()
        .find((candidate) => board.pieceAt(candidate.from)?.side === side);
      if (intent === undefined) return undefined;
      const mover = board.pieceAt(intent.from);
      if (mover === undefined) return undefined;
      return {
        moverId: mover.id,
        intent,
        san: extractMoveFeatures(board, intent).san,
      };
    },
    shouldOverride: () => false,
  };
}

function leaves(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(leaves);
  }
  return [value];
}

describe('decision journal observations', () => {
  it('emits only qualitative own-roster observations', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', -40, 0.5);
    const observation = projectMoveObservation({
      board,
      side: 'w',
      ply: 7,
      roster,
    });
    expect(leaves(observation)).not.toContain(-40);
    expect(leaves(observation)).not.toContain(100);
    expect(
      observation.roster.every((piece) => typeof piece.trust === 'string'),
    ).toBe(true);
    expect(
      observation.roster.every((piece) => typeof piece.morale === 'string'),
    ).toBe(true);
    expect(
      observation.roster.every((piece) => typeof piece.trauma === 'string'),
    ).toBe(true);
  });

  it('projects override context without private refusal values', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 20, 0.5);
    const observation = projectOverrideObservation({
      board,
      side: 'w',
      ply: 3,
      roster,
      refusingPieceId: roster[0]?.id ?? 'w:P:a2',
      candidateSan: 'e4',
      objectionStrength: 'clearly beyond the limit',
    });
    expect(observation.objectionStrength).toBe('clearly beyond the limit');
    expect(leaves(observation)).not.toContain(17.25);
  });

  it('keeps a scripted journal byte-equivalent to the inner line', async () => {
    const entries: JournalEntry[] = [];
    const inner = simpleLeader();
    const journalled = createJournallingLeader(inner, {
      agent: scriptedAgent(inner),
      entries,
      match: 1,
    });
    const board = LivingBoard.standard();
    const base = await runHeadlessMatch({
      random: createSeededRandom(11),
      maxPlies: 2,
      playerSide: 'w',
      leader: inner,
      opponent: inner,
      initialRoster: createStartingRoster(board, 'w', 20, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 20, 0.5),
      engine: createFakeEnginePort(),
    });
    const repeated = await runHeadlessMatch({
      random: createSeededRandom(11),
      maxPlies: 2,
      playerSide: 'w',
      leader: journalled,
      opponent: journalled,
      initialRoster: createStartingRoster(board, 'w', 20, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 20, 0.5),
      engine: createFakeEnginePort(),
    });
    expect(repeated.events).toEqual(base.events);
    expect(repeated.roster).toEqual(base.roster);
    expect(digest(repeated.events)).toBe(digest(base.events));
    expect(entries.length).toBeGreaterThan(0);
    expect(journalMetrics(entries).abstentionRate).toBeLessThan(1);
  });

  it('records abstention as fallback rather than disengagement', async () => {
    const entries: JournalEntry[] = [];
    const inner = simpleLeader();
    const abstaining = createJournallingLeader(inner, {
      agent: {
        identity: { id: 'empty', promptVersion: 'v1', optionSetVersion: 'v1' },
        decide: () => undefined,
      },
      entries,
      match: 1,
    });
    const board = LivingBoard.standard();
    await runHeadlessMatch({
      random: createSeededRandom(13),
      maxPlies: 1,
      playerSide: 'w',
      leader: abstaining,
      opponent: abstaining,
      initialRoster: createStartingRoster(board, 'w', 20, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 20, 0.5),
      engine: createFakeEnginePort(),
    });
    expect(entries.some((entry) => entry.chosen === -1)).toBe(true);
    expect(entries.every((entry) => entry.resolvedBy === 'fallback')).toBe(
      true,
    );
    expect(
      entries.some(
        (entry) => entry.options[entry.chosen]?.kind === 'disengage',
      ),
    ).toBe(false);
  });

  it('orders move options canonically and appends disengagement', async () => {
    let captured:
      | {
          readonly options: readonly {
            readonly kind: 'move' | 'override' | 'disengage';
            readonly san?: string;
          }[];
        }
      | undefined;
    const inner = simpleLeader();
    const leader = createJournallingLeader(inner, {
      agent: {
        identity: {
          id: 'capture',
          promptVersion: 'v1',
          optionSetVersion: 'v1',
        },
        decide: (request) => {
          captured = request;
          return 0;
        },
      },
      entries: [],
      match: 1,
    });
    const board = LivingBoard.standard();
    await leader.chooseMove(board, 'w', createSeededRandom(17), 0, new Set(), {
      roster: createStartingRoster(board, 'w', 20, 0.5),
      ply: 0,
      side: 'w',
    });
    const options = captured?.options ?? [];
    expect(options.at(-1)).toEqual({ kind: 'disengage' });
    const sans = options
      .filter((option) => option.san !== undefined)
      .map((option) => option.san as string);
    expect(sans).toEqual([...sans].sort());
  });

  it('uses the canonical override options with disengagement appended', () => {
    let captured:
      | {
          readonly options: readonly {
            readonly kind: 'move' | 'override' | 'disengage';
            readonly san?: string;
          }[];
        }
      | undefined;
    const inner = simpleLeader();
    const leader = createJournallingLeader(inner, {
      agent: {
        identity: {
          id: 'override-capture',
          promptVersion: 'v1',
          optionSetVersion: 'v1',
        },
        decide: (request) => {
          captured = request;
          return 0;
        },
      },
      entries: [],
      match: 1,
    });
    const board = LivingBoard.standard();
    leader.shouldOverride(createSeededRandom(19), 2, {
      pieceId: 'w:P:a2',
      san: 'a3',
      objectionStrength: 'clearly beyond the limit',
      board,
      roster: createStartingRoster(board, 'w', 20, 0.5),
    });
    expect(captured?.options).toEqual([
      { kind: 'override' },
      { kind: 'disengage' },
    ]);
  });

  it('keeps rationale outside the observation digest', async () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 20, 0.5);
    const run = async (rationale: string) => {
      const entries: JournalEntry[] = [];
      const leader = createJournallingLeader(simpleLeader(), {
        agent: {
          identity: {
            id: 'rationale',
            promptVersion: 'v1',
            optionSetVersion: 'v1',
          },
          decide: () => 0,
        },
        entries,
        match: 1,
        rationale,
      });
      await leader.chooseMove(board, 'w', createSeededRandom(2), 0, new Set(), {
        roster,
        ply: 0,
        side: 'w',
      });
      return entries[0]?.observationDigest;
    };
    await expect(run('first')).resolves.toBe(await run('second'));
  });

  it('treats an out-of-range response as fallback without changing the line', async () => {
    const board = LivingBoard.standard();
    const inner = simpleLeader();
    const entries: JournalEntry[] = [];
    const leader = createJournallingLeader(inner, {
      agent: {
        identity: {
          id: 'invalid',
          promptVersion: 'v1',
          optionSetVersion: 'v1',
        },
        decide: () => Number.MAX_SAFE_INTEGER,
      },
      entries,
      match: 1,
    });
    const base = await runHeadlessMatch({
      random: createSeededRandom(23),
      maxPlies: 1,
      playerSide: 'w',
      leader: inner,
      opponent: inner,
      initialRoster: createStartingRoster(board, 'w', 20, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 20, 0.5),
      engine: createFakeEnginePort(),
    });
    const repeated = await runHeadlessMatch({
      random: createSeededRandom(23),
      maxPlies: 1,
      playerSide: 'w',
      leader,
      opponent: leader,
      initialRoster: createStartingRoster(board, 'w', 20, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 20, 0.5),
      engine: createFakeEnginePort(),
    });
    expect(repeated.events).toEqual(base.events);
    expect(entries.some((entry) => entry.chosen === -1)).toBe(true);
  });

  it('replays matching digests and rejects a corrupted observation', async () => {
    const board = LivingBoard.standard();
    const inner = simpleLeader();
    const entries: JournalEntry[] = [];
    const journalled = createJournallingLeader(inner, {
      agent: scriptedAgent(inner),
      entries,
      match: 1,
    });
    const run = (leader: HeadlessLeaderPort) =>
      runHeadlessMatch({
        random: createSeededRandom(29),
        maxPlies: 1,
        playerSide: 'w' as const,
        leader,
        opponent: leader,
        initialRoster: createStartingRoster(board, 'w', 20, 0.5),
        initialEnemyRoster: createStartingRoster(board, 'b', 20, 0.5),
        engine: createFakeEnginePort(),
      });
    await run(journalled);
    await expect(
      replayJournal(entries, async (agent) => {
        const replayLeader = createJournallingLeader(inner, {
          agent,
          entries: [],
          match: 1,
        });
        return run(replayLeader);
      }),
    ).resolves.toBeDefined();
    const corrupted = entries.map((entry, index) =>
      index === 0
        ? { ...entry, observationDigest: `${entry.observationDigest}corrupt` }
        : entry,
    );
    await expect(
      replayJournal(corrupted, async (agent) => {
        const replayLeader = createJournallingLeader(inner, {
          agent,
          entries: [],
          match: 1,
        });
        return run(replayLeader);
      }),
    ).rejects.toThrow(/decisionIndex=0/);
  });

  it('walks emitted observations without exposing enemy or refusal scalars', async () => {
    const board = LivingBoard.standard();
    const entries: JournalEntry[] = [];
    const inner = simpleLeader();
    const journalled = createJournallingLeader(inner, {
      agent: scriptedAgent(inner),
      entries,
      match: 1,
    });
    const result = await runHeadlessMatch({
      random: createSeededRandom(31),
      maxPlies: 4,
      playerSide: 'w',
      leader: journalled,
      opponent: journalled,
      initialRoster: createStartingRoster(board, 'w', -37, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 23, 0.5),
      engine: createFakeEnginePort(),
    });
    const forbidden = new Set<number>();
    for (const piece of result.enemyRoster) {
      for (const value of Object.values(piece)) {
        if (typeof value === 'number' && Math.abs(value) > 10) {
          forbidden.add(value);
        }
      }
    }
    for (const event of result.events) {
      if (event.t !== 'REFUSAL') continue;
      for (const key of ['utility', 'threshold', 'perceivedValue'] as const) {
        const value = event[key];
        if (typeof value === 'number' && Math.abs(value) > 10) {
          forbidden.add(value);
        }
      }
    }
    for (const entry of entries) {
      for (const leaf of leaves(entry.observation)) {
        if (typeof leaf === 'number' && Math.abs(leaf) > 10) {
          expect(forbidden.has(leaf)).toBe(false);
        }
      }
    }
  });
});
