import { describe, expect, it } from 'vitest';

import { extractMoveFeatures, LivingBoard } from '../src/chess';
import { digest } from '../src/core/digest';
import { objectionStrengthWord } from '../src/core/qualitativeBands';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine/fake';
import {
  projectMoveObservation,
  projectOverrideObservation,
  runHeadlessMatch,
  type HeadlessLeaderPort,
} from '../src/orchestration';
import {
  DISENGAGE,
  humanAgent,
  OVERRIDE_OPTIONS,
  optionsForMove,
} from '../src/orchestration/journal';
import { MatchSession } from '../src/orchestration/matchSession';
import { createStartingRoster } from '../src/orchestration/roster';
import {
  createJournallingLeader,
  journalMetrics,
  scriptedAgent,
  type JournalEntry,
} from '../sim/journal';

function firstLegalLeader(): HeadlessLeaderPort {
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

function intentForSan(board: LivingBoard, san: string) {
  const intent = board
    .legalMoves()
    .find((candidate) => extractMoveFeatures(board, candidate).san === san);
  if (intent === undefined) throw new Error(`no legal intent for ${san}`);
  return intent;
}

function lowTrustRoster(board: LivingBoard, pieceId: string) {
  return createStartingRoster(board, 'w', 20, 0.5).map((piece) =>
    piece.id === pieceId ? { ...piece, T_i: -100, M_i: 0, B_i: 100 } : piece,
  );
}

describe('interactive match journal (ADR 0062 / D219)', () => {
  it('writes nothing when no journal sink is configured', async () => {
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
    });
    await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    expect(session.snapshot().journal).toEqual([]);
  });

  it('records the human move ask with the harness option set', async () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 20, 0.5);
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
      initialRoster: roster,
      journal: { match: 2 },
    });

    const expectedOptions = optionsForMove(board, 'w');
    const e4Index = expectedOptions.findIndex((option) => option.san === 'e4');

    await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    const journal = session.snapshot().journal;
    expect(journal).toHaveLength(1);
    const entry = journal[0];
    expect(entry?.decisionIndex).toBe(0);
    expect(entry?.at).toEqual({ match: 2, ply: 1, kind: 'move', side: 'w' });
    expect(entry?.agent).toEqual(humanAgent());
    expect(entry?.resolvedBy).toBe('agent');
    expect(entry?.chosen).toBe(e4Index);
    expect(entry?.options).toEqual(expectedOptions);
    expect(entry?.options[entry.chosen]).toEqual({
      kind: 'move',
      san: 'e4',
      from: 'e2',
      to: 'e4',
    });
    expect(entry?.options[entry.options.length - 1]).toEqual(DISENGAGE);
    expect(entry?.observationDigest).toBe(
      digest(projectMoveObservation({ board, side: 'w', ply: 1, roster })),
    );
    expect(journalMetrics(journal).decisionCount).toBe(1);
    expect(journalMetrics(journal).abstentionRate).toBe(0);
  });

  it('matches the headless journal byte-for-byte on observation and options', async () => {
    const board = LivingBoard.standard();
    const roster = createStartingRoster(board, 'w', 20, 0.5);
    const enemyRoster = createStartingRoster(board, 'b', 20, 0.5);

    const headlessEntries: JournalEntry[] = [];
    await runHeadlessMatch({
      random: createSeededRandom(11),
      maxPlies: 1,
      playerSide: 'w',
      leader: createJournallingLeader(firstLegalLeader(), {
        agent: scriptedAgent('scripted:leader'),
        entries: headlessEntries,
        match: 1,
      }),
      opponent: firstLegalLeader(),
      initialRoster: roster,
      initialEnemyRoster: enemyRoster,
      engine: createFakeEnginePort(),
    });
    const harnessEntry = headlessEntries[0];
    const harnessSan = harnessEntry?.options[harnessEntry.chosen]?.san;
    expect(harnessSan).toBeDefined();

    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
      initialRoster: roster,
      initialEnemyRoster: enemyRoster,
      journal: { match: 1 },
    });
    await session.submitPlayerIntent(intentForSan(board, harnessSan ?? ''));
    const sessionEntry = session.snapshot().journal[0];

    expect(sessionEntry?.observationDigest).toBe(
      harnessEntry?.observationDigest,
    );
    expect(sessionEntry?.options).toEqual(harnessEntry?.options);
    expect(sessionEntry?.chosen).toBe(harnessEntry?.chosen);
    expect(sessionEntry?.at).toEqual(harnessEntry?.at);
  });

  it('records the override decision at chosen 0 when the player overrides', async () => {
    const board = LivingBoard.standard();
    const roster = lowTrustRoster(board, 'w:P:e2');
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
      initialRoster: roster,
      journal: { match: 1 },
    });

    await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    const pending = session.snapshot().pending;
    expect(pending?.verdict).toBe('MORAL_REFUSAL');
    await session.confirmOverride();

    const journal = session.snapshot().journal;
    expect(journal).toHaveLength(2);
    const entry = journal[1];
    expect(entry?.at).toEqual({
      match: 1,
      ply: 1,
      kind: 'override',
      side: 'w',
    });
    expect(entry?.options).toEqual(OVERRIDE_OPTIONS);
    expect(entry?.chosen).toBe(0);
    expect(entry?.observation.kind).toBe('override');
    if (entry?.observation.kind === 'override' && pending !== null) {
      expect(entry.observation.refusingPieceId).toBe('w:P:e2');
      expect(entry.observation.candidateSan).toBe('e4');
      expect(entry.observationDigest).toBe(
        digest(
          projectOverrideObservation({
            board,
            side: 'w',
            ply: 1,
            roster,
            refusingPieceId: 'w:P:e2',
            candidateSan: 'e4',
            objectionStrength: objectionStrengthWord(
              pending.outcome.refusalThreshold - pending.outcome.utilityScore,
            ),
          }),
        ),
      );
    }
  });

  it('records the override decision at chosen 1 when the player replans', async () => {
    const board = LivingBoard.standard();
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
      initialRoster: lowTrustRoster(board, 'w:P:e2'),
      journal: { match: 1 },
    });

    await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    expect(session.snapshot().pending?.verdict).toBe('MORAL_REFUSAL');
    session.replanAfterRefusal();

    const journal = session.snapshot().journal;
    expect(journal).toHaveLength(2);
    expect(journal[1]?.at.kind).toBe('override');
    expect(journal[1]?.chosen).toBe(1);

    await session.submitPlayerIntent({ from: 'd2', to: 'd4' });
    const after = session.snapshot().journal;
    expect(after).toHaveLength(3);
    expect(after[2]?.at).toEqual({
      match: 1,
      ply: 1,
      kind: 'move',
      side: 'w',
    });
    expect(after[2]?.options[after[2].chosen]?.san).toBe('d4');
  });

  it('stamps a supplied agent identity instead of the human default', async () => {
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
      journal: {
        match: 4,
        agent: {
          id: 'facilitator:alice',
          promptVersion: 'human',
          optionSetVersion: 'v1',
        },
      },
    });
    await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    expect(session.snapshot().journal[0]?.agent.id).toBe('facilitator:alice');
  });
});
