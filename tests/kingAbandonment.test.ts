import { extractMoveFeatures, LivingBoard } from '../src/chess';
import { describe, expect, it } from 'vitest';
import {
  endpointFor,
  kingExposureAfterWithdrawals,
  runHeadlessMatch,
  type HeadlessLeaderPort,
} from '../src/orchestration';
import { createFakeEnginePort } from '../src/engine/fake';
import { createSeededRandom } from '../src/core/random';
import type { CandidateMoveEvaluation } from '../src/psychology';
import { createStartingRoster } from '../sim/roster';

describe('King exposure', () => {
  it('cedes the turn when white d2 exposes the black King', async () => {
    const board = LivingBoard.fromFen(
      'r4bnr/2n1p1p1/2N1bp1k/3p3p/8/8/2QPP2P/2B2BKR w - - 0 22',
    );
    const move = board
      .legalMoves()
      .find((candidate) => candidate.from === 'd2');
    if (move === undefined) throw new Error('expected d2 to have a legal move');
    const moveEval: CandidateMoveEvaluation = {
      moveNotation: move.to,
      deltaV_board: -1,
      privateScoreCp: -29_000,
      vLeaderImplied: -1,
      deltaV_capture: 0,
      P_captured: 0,
      peerSafetyDeltas: {},
    };
    let d2Chosen = false;
    const leader: HeadlessLeaderPort = {
      chooseMove(currentBoard, side) {
        const choice =
          side === 'w' && !d2Chosen
            ? currentBoard
                .legalMoves()
                .find((candidate) => candidate.from === 'd2')
            : currentBoard.legalMoves()[0];
        if (choice === undefined) return undefined;
        if (side === 'w' && choice.from === 'd2') d2Chosen = true;
        return {
          moverId: currentBoard.pieceAt(choice.from)?.id ?? 'w:P:d2',
          intent: choice,
          san: extractMoveFeatures(currentBoard, choice).san,
          moveEval,
        };
      },
      shouldOverride: () => false,
    };
    const initialRoster = createStartingRoster(board, 'w', -100, 0.5).map(
      (piece) => ({
        ...piece,
        M_i: 0,
        credence: { ...piece.credence, tauBenev: 0 },
      }),
    );

    const result = await runHeadlessMatch({
      random: createSeededRandom(7),
      maxPlies: 3,
      playerSide: 'w',
      leader,
      opponent: leader,
      initialBoard: board,
      initialRoster,
      engine: createFakeEnginePort(),
    });

    expect(
      result.events.filter((event) => event.t === 'KING_EXPOSED_TURN_CEDED'),
    ).toHaveLength(1);
    expect(
      result.events.some(
        (event) =>
          event.t === 'MOVE' && event.ply > 1 && event.pieceId.startsWith('b:'),
      ),
    ).toBe(true);
    expect(
      result.events.some(
        (event) => event.t === 'CAPTURE' && event.victim === 'b:K:h6',
      ),
    ).toBe(false);
    expect(result.winScore).toBe(50);
    expect(result.rout).toBe(false);
    expect(result.enemyRout).toBe(false);
  });

  it('detects an exposed King after a withdrawal', () => {
    const board = LivingBoard.fromFen('4k3/8/8/8/8/6b1/5p2/4K3 b - - 0 1');

    board.withdrawPiece('b:P:f2');

    expect(kingExposureAfterWithdrawals(board, 'b')).toMatchObject({
      exposedSide: 'w',
      attackerSide: 'b',
    });
    board.cedeTurn();
    expect(board.turn()).toBe('w');
    expect(board.fen().split(' ').slice(1, 4)).toEqual(['w', '-', '-']);
  });

  it('filters a PV that captures either King', () => {
    const board = LivingBoard.fromFen(
      'r4bnr/2n1p1p1/2N1bp1k/3p3p/8/8/2Q5/2B2BKR w - - 0 22',
    );

    expect(endpointFor(board, ['c1h6'])).toBeUndefined();
  });

  it('never returns a kingless board from the evaluation endpoint', () => {
    const board = LivingBoard.fromFen(
      'r4bnr/2n1p1p1/2N1bp1k/3p3p/8/8/2QPP2P/2B2BKR w - - 0 22',
    );

    expect(endpointFor(board, ['c1h6'])).toBeUndefined();
  });
});
