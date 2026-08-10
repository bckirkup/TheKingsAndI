import { describe, expect, it } from 'vitest';

import { extractMoveFeatures, LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine/fake';
import {
  runHeadlessMatch,
  type HeadlessLeaderPort,
} from '../src/orchestration';
import type { CandidateMoveEvaluation } from '../src/psychology';
import { createStartingRoster } from '../sim/roster';

describe('headless player refusal replanning', () => {
  it('replans without advancing ply and implicitly overrides after exhausting candidates', async () => {
    const board = LivingBoard.standard();
    const refusalEvaluation: CandidateMoveEvaluation = {
      moveNotation: 'refused',
      deltaV_board: -1,
      vLeaderImplied: -1,
      deltaV_capture: 0,
      P_captured: 0,
      peerSafetyDeltas: {},
    };
    const leader: HeadlessLeaderPort = {
      chooseMove(currentBoard, side, _random, _ply, refusedSans) {
        const choice = currentBoard
          .legalMoves()
          .map((intent) => ({
            intent,
            features: extractMoveFeatures(currentBoard, intent),
          }))
          .find(({ features }) => refusedSans?.has(features.san) !== true);
        if (choice === undefined) return undefined;
        const mover = currentBoard.pieceAt(choice.intent.from);
        if (mover === undefined || mover.side !== side) return undefined;
        return {
          moverId: mover.id,
          intent: choice.intent,
          san: choice.features.san,
          moveEval: refusalEvaluation,
          objectivelyGood: false,
        };
      },
      shouldOverride: () => false,
    };

    const result = await runHeadlessMatch({
      random: createSeededRandom(7),
      maxPlies: 1,
      playerSide: 'w',
      leader,
      opponent: leader,
      initialRoster: createStartingRoster(board, 'w', 0, 0.5),
      engine: createFakeEnginePort(),
    });

    const refusals = result.events.filter((event) => event.t === 'REFUSAL');
    const overrides = result.events.filter((event) => event.t === 'OVERRIDE');
    const moves = result.events.filter((event) => event.t === 'MOVE');
    expect(refusals.length).toBe(20);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.t).toBe('OVERRIDE');
    if (overrides[0]?.t === 'OVERRIDE') {
      expect(overrides[0].implicit).toBe(true);
      expect(overrides[0].pieceTrustDelta).toBe(-35);
      expect(overrides[0].traumaGain).toBe(20);
    }
    expect(moves).toHaveLength(1);
    expect(result.plies).toBe(1);
    const override = overrides[0];
    if (override?.t === 'OVERRIDE') {
      const overridden = result.roster.find(
        (piece) => piece.id === override.pieceId,
      );
      expect(overridden?.T_i).toBeLessThanOrEqual(-35);
      expect(overridden?.B_i).toBe(20);
    }
    expect(
      new Set(refusals.map((event) => event.t === 'REFUSAL' && event.san)),
    ).toHaveLength(20);

    const repeated = await runHeadlessMatch({
      random: createSeededRandom(7),
      maxPlies: 1,
      playerSide: 'w',
      leader,
      opponent: leader,
      initialRoster: createStartingRoster(board, 'w', 0, 0.5),
      engine: createFakeEnginePort(),
    });
    const observableEvents = (events: typeof result.events) =>
      events.map((event) => {
        if (event.t !== 'DESERTION') return event;
        return {
          t: event.t,
          ply: event.ply,
          pieceId: event.pieceId,
          refusedMove: event.refusedMove,
          uStay: event.uStay,
          uDesert: event.uDesert,
        };
      });
    expect(observableEvents(repeated.events)).toEqual(
      observableEvents(result.events),
    );
    expect(repeated.winScore).toBe(result.winScore);
  });
});
