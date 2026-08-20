import { describe, expect, it } from 'vitest';

import { extractMoveFeatures, LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine/fake';
import {
  featuresToEvaluation,
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
      privateScoreCp: 0,
      vLeaderImplied: -1,
      deltaV_capture: 0,
      P_captured: 0,
      peerSafetyDeltas: {},
      promotionProspect: 0,
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
    expect(refusals).toHaveLength(20);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.t).toBe('OVERRIDE');
    if (overrides[0]?.t === 'OVERRIDE') {
      expect(overrides[0].implicit).toBe(true);
      expect(overrides[0].pieceTrustDelta).toBe(-35);
    }
    expect(moves).toHaveLength(1);
    expect(result.plies).toBe(1);
    const grades = result.events.filter((event) => event.t === 'ABILITY_GRADE');
    expect(grades.length).toBeGreaterThan(0);
    expect(grades.every((event) => event.delta !== 0)).toBe(true);
    expect(new Set(grades.map((event) => event.channel))).toEqual(
      new Set(['forced', 'heeded']),
    );
    expect(
      result.roster.every((piece) => piece.E_i >= 1 && piece.E_i <= 100),
    ).toBe(true);
    const override = overrides[0];
    if (override?.t === 'OVERRIDE') {
      const overridden = result.roster.find(
        (piece) => piece.id === override.pieceId,
      );
      expect(overridden?.T_i).toBeLessThanOrEqual(-35);
      expect(overridden?.B_i).toBe(0);
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

describe('headless enemy tracking configuration', () => {
  it('uses the default cap and honors an explicit symmetric override', async () => {
    const board = LivingBoard.standard();
    const leader: HeadlessLeaderPort = {
      chooseMove: () => undefined,
      shouldOverride: () => false,
    };
    const enemyRoster = createStartingRoster(board, 'b', 0, 0.5);
    const run = (enemyTrackedIdentities: number | undefined) =>
      runHeadlessMatch({
        random: createSeededRandom(19),
        maxPlies: 0,
        playerSide: 'w',
        leader,
        opponent: leader,
        initialRoster: createStartingRoster(board, 'w', 0, 0.5),
        initialEnemyRoster: enemyRoster,
        ...(enemyTrackedIdentities === undefined
          ? {}
          : { enemyTrackedIdentities }),
        engine: createFakeEnginePort(),
      });
    await expect((await run(undefined)).enemyFieldedPieceIds).toHaveLength(8);
    await expect((await run(16)).enemyFieldedPieceIds).toHaveLength(16);
  });
});

it('records exactly one CAPTURE event per resolved headless capture', async () => {
  const board = LivingBoard.fromFen('4k3/8/8/8/8/3p4/4B3/4K3 w - - 0 1');
  const leader: HeadlessLeaderPort = {
    chooseMove(currentBoard, side) {
      const capture = currentBoard.legalMoves().find((intent) => {
        const mover = currentBoard.pieceAt(intent.from);
        const victim = currentBoard.pieceAt(intent.to);
        return (
          mover?.side === side && victim !== undefined && victim.side !== side
        );
      });
      if (capture === undefined) return undefined;
      const mover = currentBoard.pieceAt(capture.from);
      if (mover === undefined) return undefined;
      const features = extractMoveFeatures(currentBoard, capture);
      return {
        moverId: mover.id,
        intent: capture,
        san: features.san,
        moveEval: featuresToEvaluation(features),
        objectivelyGood: true,
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
    initialBoard: board,
    initialRoster: createStartingRoster(board, 'w', 0, 0.5),
    initialEnemyRoster: createStartingRoster(board, 'b', 0, 0.5),
    engine: createFakeEnginePort(),
  });
  const captures = result.events.filter((event) => event.t === 'CAPTURE');
  expect(captures).toHaveLength(1);
  expect(captures[0]).toMatchObject({
    t: 'CAPTURE',
    victim: 'b:P:d3',
    by: 'w:B:e2',
  });
});
