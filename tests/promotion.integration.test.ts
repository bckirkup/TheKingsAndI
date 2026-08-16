import { describe, expect, it } from 'vitest';

import { extractMoveFeatures, LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine/fake';
import {
  applyEnemyTurn,
  finishUntrackedMove,
} from '../src/orchestration/enemyTurn';
import { MatchSession } from '../src/orchestration/matchSession';
import { runHeadlessMatch } from '../src/orchestration/headlessMatch';
import type { CandidateMoveEvaluation, PieceState } from '../src/psychology';
import { createStartingRoster } from '../sim/roster';

const WHITE_PROMOTION_FEN = '8/P7/8/8/8/8/8/k6K w - - 0 1';
const BLACK_PROMOTION_FEN = '7k/8/8/8/8/8/p7/7K b - - 0 1';

function promotionChoice(board: LivingBoard, side: 'w' | 'b') {
  const move = board
    .legalMoves()
    .find(
      (candidate) =>
        candidate.from[1] === (side === 'w' ? '7' : '2') &&
        candidate.promotion === 'Q',
    );
  if (move === undefined) throw new Error('expected promotion move');
  const features = extractMoveFeatures(board, move);
  return {
    moverId: board.pieceAt(move.from)?.id ?? '',
    intent: { from: move.from, to: move.to, promotion: 'Q' as const },
    san: features.san,
  };
}

function promotionEvaluation(
  moverId: string,
  moveNotation: string,
): CandidateMoveEvaluation {
  return {
    moveNotation,
    deltaV_board: 1,
    privateScoreCp: 1,
    vLeaderImplied: 1,
    deltaV_capture: 0,
    P_captured: 0,
    peerSafetyDeltas: {},
    promotionProspect: 1000,
  };
}

function rosterFor(board: LivingBoard, side: 'w' | 'b'): PieceState[] {
  return createStartingRoster(board, side, 20, 0.5);
}

describe('promotion orchestration wiring', () => {
  it('records and mutates a player promotion through MatchSession', async () => {
    const board = LivingBoard.fromFen(WHITE_PROMOTION_FEN);
    const roster = rosterFor(board, 'w');
    const session = new MatchSession({
      seed: 3,
      engine: createFakeEnginePort(),
      initialRoster: roster,
      initialEnemyRoster: rosterFor(board, 'b'),
    });
    const internals = session as unknown as {
      board: LivingBoard;
      roster: PieceState[];
      enemyRoster: PieceState[];
    };
    internals.board = board;
    internals.roster = roster;
    internals.enemyRoster = rosterFor(board, 'b');

    const choice = promotionChoice(board, 'w');
    await session.submitPlayerIntent({
      ...choice.intent,
    });

    const snapshot = session.snapshot();
    expect(
      snapshot.events.filter((event) => event.t === 'PROMOTION'),
    ).toHaveLength(1);
    expect(snapshot.roster.find((piece) => piece.id === 'w:P:a7')?.role).toBe(
      'Queen',
    );
  });

  it('records and mutates an overridden promotion through MatchSession', async () => {
    const board = LivingBoard.fromFen(WHITE_PROMOTION_FEN);
    const roster = rosterFor(board, 'w').map((piece) =>
      piece.id === 'w:P:a7' ? { ...piece, T_i: -100, M_i: 0, B_i: 100 } : piece,
    );
    const session = new MatchSession({
      seed: 3,
      engine: createFakeEnginePort(),
      initialRoster: roster,
      initialEnemyRoster: rosterFor(board, 'b'),
    });
    const internals = session as unknown as {
      board: LivingBoard;
      roster: PieceState[];
      enemyRoster: PieceState[];
    };
    internals.board = board;
    internals.roster = roster;
    internals.enemyRoster = rosterFor(board, 'b');

    const choice = promotionChoice(board, 'w');
    await session.submitPlayerIntent(choice.intent);
    expect(session.snapshot().phase).toBe('awaiting_player');
    await session.confirmOverride();

    const snapshot = session.snapshot();
    expect(
      snapshot.events.filter((event) => event.t === 'PROMOTION'),
    ).toHaveLength(1);
    expect(snapshot.roster.find((piece) => piece.id === 'w:P:a7')?.role).toBe(
      'Queen',
    );
  });

  it('records and mutates a player promotion through headlessMatch', async () => {
    const board = LivingBoard.fromFen(WHITE_PROMOTION_FEN);
    const roster = rosterFor(board, 'w');
    const choice = promotionChoice(board, 'w');
    const leader = {
      chooseMove: () => ({
        ...choice,
        moveEval: promotionEvaluation(choice.moverId, choice.san),
      }),
      shouldOverride: () => false,
    };
    const idle = {
      chooseMove: () => undefined,
      shouldOverride: () => false,
    };

    const result = await runHeadlessMatch({
      random: createSeededRandom(4),
      maxPlies: 2,
      playerSide: 'w',
      leader,
      opponent: idle,
      initialBoard: board,
      initialRoster: roster,
      initialEnemyRoster: rosterFor(board, 'b'),
      engine: createFakeEnginePort(),
    });

    expect(
      result.events.filter((event) => event.t === 'PROMOTION'),
    ).toHaveLength(1);
    expect(result.roster.find((piece) => piece.id === 'w:P:a7')?.role).toBe(
      'Queen',
    );
  });

  it('records tracked and untracked enemy promotions on the enemy roster', async () => {
    const board = LivingBoard.fromFen(BLACK_PROMOTION_FEN);
    const enemyRoster = rosterFor(board, 'b').filter(
      (piece) => piece.id === 'b:P:a2',
    );
    const tracked = await applyEnemyTurn({
      board: board.clone(),
      enemyRoster,
      enemySide: 'b',
      random: createSeededRandom(5),
      archetype: 'supportive',
      ply: 1,
      engine: createFakeEnginePort(),
      overrideRefusals: true,
    });
    expect(
      tracked.events.filter((event) => event.t === 'PROMOTION'),
    ).toHaveLength(1);
    expect(tracked.enemyRoster[0]?.role).toBe('Queen');

    const untrackedBoard = board.clone();
    const actor = enemyRoster[0];
    if (actor === undefined) throw new Error('expected enemy pawn');
    const choice = promotionChoice(untrackedBoard, 'b');
    const untracked = finishUntrackedMove(
      untrackedBoard,
      enemyRoster,
      'b',
      choice.san,
      1,
    );
    expect(
      untracked.events.filter((event) => event.t === 'PROMOTION'),
    ).toHaveLength(1);
    expect(untracked.enemyRoster[0]?.role).toBe('Queen');
  });
});
