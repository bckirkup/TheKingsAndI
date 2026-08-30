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
import { runMatch } from '../sim/match';
import {
  createJournallingLeader,
  journalMetrics,
  recordedAgent,
  replayJournal,
  scriptedAgent,
  type JournalEntry,
  type Option,
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
      agent: scriptedAgent(),
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

  it('separates leader and opponent journal identities and sides', async () => {
    const board = LivingBoard.standard();
    const entries: JournalEntry[] = [];
    const leader = createJournallingLeader(simpleLeader(), {
      agent: {
        ...scriptedAgent(),
        identity: {
          ...scriptedAgent().identity,
          id: 'scripted:leader',
        },
      },
      entries,
      match: 1,
    });
    const opponent = createJournallingLeader(simpleLeader(), {
      agent: {
        ...scriptedAgent(),
        identity: {
          ...scriptedAgent().identity,
          id: 'scripted:opponent',
        },
      },
      entries,
      match: 1,
    });
    await runHeadlessMatch({
      random: createSeededRandom(12),
      maxPlies: 2,
      playerSide: 'w',
      leader,
      opponent,
      initialRoster: createStartingRoster(board, 'w', 20, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 20, 0.5),
      engine: createFakeEnginePort(),
      opponentMoveChooser: async (
        currentBoard,
        side,
        random,
        ply,
        refusedSans,
        context,
      ) =>
        (
          await opponent.chooseMove(
            currentBoard,
            side,
            random,
            ply,
            refusedSans,
            context,
          )
        )?.san,
      opponentOverrideChooser: (random, ply, context) =>
        opponent.shouldOverride(random, ply, context),
    });
    expect(new Set(entries.map((entry) => entry.at.side))).toEqual(
      new Set(['w', 'b']),
    );
    expect(new Set(entries.map((entry) => entry.agent.id))).toEqual(
      new Set(['scripted:leader', 'scripted:opponent']),
    );
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
          readonly options: readonly Option[];
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
          readonly options: readonly Option[];
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
      side: 'w',
    });
    expect(captured?.options).toEqual([
      { kind: 'override' },
      { kind: 'stand' },
      { kind: 'disengage' },
    ]);
  });

  it('separates insist, stand, disengage, and abstain override decisions', () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 20, 0.5);
    const context = {
      pieceId: 'w:P:a2',
      san: 'a3',
      objectionStrength: 'clearly beyond the limit' as const,
      board,
      roster,
      side: 'w' as const,
    };
    const run = (
      decide: (request: {
        readonly options: readonly Option[];
      }) => number | undefined,
      innerOverride: boolean,
    ) => {
      const entries: JournalEntry[] = [];
      const leader = createJournallingLeader(
        {
          ...simpleLeader(),
          shouldOverride: () => innerOverride,
        },
        {
          agent: {
            identity: {
              id: 'case',
              promptVersion: 'v1',
              optionSetVersion: 'v1',
            },
            decide,
          },
          entries,
          match: 1,
        },
      );
      const result = leader.shouldOverride(createSeededRandom(3), 1, context);
      return { entries, result };
    };
    const insist = run(() => 0, false);
    expect(insist.result).toBe(true);
    expect(insist.entries[0]?.chosen).toBe(0);
    const stand = run(() => 1, true);
    expect(stand.result).toBe(false);
    expect(stand.entries[0]?.chosen).toBe(1);
    const disengageObservation = projectOverrideObservation({
      board,
      side: 'w',
      ply: 1,
      roster,
      refusingPieceId: context.pieceId,
      candidateSan: context.san,
      objectionStrength: context.objectionStrength,
    });
    const recordedEntries: JournalEntry[] = [];
    const recorded = createJournallingLeader(
      {
        ...simpleLeader(),
        shouldOverride: () => true,
      },
      {
        agent: recordedAgent(
          { [`${digest(disengageObservation)}+recorded`]: 2 },
          'recorded',
        ),
        entries: recordedEntries,
        match: 1,
      },
    );
    const recordedResult = recorded.shouldOverride(
      createSeededRandom(3),
      1,
      context,
    );
    const disengage = {
      entries: recordedEntries,
      result: recordedResult,
    };
    expect(disengage.result).toBe(false);
    expect(disengage.entries[0]?.chosen).toBe(2);
    expect(journalMetrics(disengage.entries).disengageSelectionRate).toBe(1);
    const abstain = run(() => undefined, true);
    expect(abstain.result).toBe(true);
    expect(abstain.entries[0]?.chosen).toBe(-1);
    expect(abstain.entries[0]?.resolvedBy).toBe('fallback');
    expect(journalMetrics(abstain.entries).disengageSelectionRate).toBe(0);
    const scripted = (innerOverride: boolean) => {
      const entries: JournalEntry[] = [];
      const leader = createJournallingLeader(
        {
          ...simpleLeader(),
          shouldOverride: () => innerOverride,
        },
        {
          agent: scriptedAgent(),
          entries,
          match: 1,
        },
      );
      const result = leader.shouldOverride(createSeededRandom(3), 1, context);
      return { entries, result };
    };
    expect(scripted(true).result).toBe(true);
    expect(scripted(true).entries[0]?.chosen).toBe(0);
    expect(scripted(false).result).toBe(false);
    expect(scripted(false).entries[0]?.chosen).toBe(1);
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

  it('preserves scripted bias only when the agent selects the scripted SAN', async () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 20, 0.5);
    const inner: HeadlessLeaderPort = {
      ...simpleLeader(),
      chooseMove: (currentBoard, side) => {
        const choice = simpleLeader().chooseMove(
          currentBoard,
          side,
          createSeededRandom(0),
          0,
        );
        if (choice === undefined || choice instanceof Promise) return choice;
        return { ...choice, leaderImpliedBias: 7 };
      },
    };
    const run = (
      choose: (request: {
        readonly scriptedChoice?: number;
        readonly options: readonly Option[];
      }) => number | undefined,
    ) => {
      const entries: JournalEntry[] = [];
      const leader = createJournallingLeader(inner, {
        agent: {
          identity: { id: 'bias', promptVersion: 'v1', optionSetVersion: 'v1' },
          decide: choose,
        },
        entries,
        match: 1,
      });
      return leader.chooseMove(
        board,
        'w',
        createSeededRandom(41),
        0,
        new Set(),
        {
          roster,
          ply: 0,
          side: 'w',
        },
      );
    };
    await expect(
      run((request) => request.scriptedChoice),
    ).resolves.toMatchObject({ leaderImpliedBias: 7 });
    const modelChoice = await run((request) =>
      request.options.length > 1 ? 1 : undefined,
    );
    expect(modelChoice).not.toHaveProperty('leaderImpliedBias');
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
      agent: scriptedAgent(),
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
    const recordedResult = await run(journalled);
    const replayedResult = await replayJournal(entries, async (agent) => {
      const replayLeader = createJournallingLeader(inner, {
        agent,
        entries: [],
        match: 1,
      });
      return run(replayLeader);
    });
    expect(digest(replayedResult.events)).toBe(digest(recordedResult.events));
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
      agent: scriptedAgent(),
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
        if (typeof leaf === 'number' && Math.abs(leaf) > 10)
          expect(forbidden.has(leaf)).toBe(false);
      }
    }
  });

  it('restricts every observation numeric leaf to ply', async () => {
    const board = LivingBoard.standard();
    const entries: JournalEntry[] = [];
    await runMatch({
      seed: 37,
      leader: 'chastened',
      opponent: 'escalator',
      matchIndex: 1,
      campaignMatch: 1,
      roster: createStartingRoster(board, 'w', -37, 0.5),
      enemyRoster: createStartingRoster(board, 'b', 23, 0.5),
      engine: createFakeEnginePort(),
      journalEntries: entries,
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.at.kind === 'override')).toBe(true);
    for (const entry of entries) {
      for (const leaf of leaves(entry.observation)) {
        if (typeof leaf === 'number') {
          expect(leaf).toBe(entry.observation.ply);
        } else {
          expect(typeof leaf).toBe('string');
        }
      }
    }
  });
});
