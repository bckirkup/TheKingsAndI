import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine';
import {
  createStartingRoster,
  runHeadlessMatch,
  type HeadlessLeaderPort,
  type HeadlessMatchResult,
  type HeadlessMoveChoice,
} from '../src/orchestration';
import type { CandidateMoveEvaluation } from '../src/psychology';

/** An order every piece reads as a loss, so refusal is certain. */
const HATED_ORDER: Omit<CandidateMoveEvaluation, 'moveNotation'> = {
  deltaV_board: -3,
  vLeaderImplied: -3,
  deltaV_capture: 0,
  P_captured: 0.05,
  peerSafetyDeltas: {},
};

function orderFor(
  board: LivingBoard,
  refusedSans: ReadonlySet<string>,
  honourRefusals: boolean,
): HeadlessMoveChoice | undefined {
  for (const intent of board.legalMoves()) {
    const probe = board.clone();
    const san = probe.applyMove(intent).san;
    if (honourRefusals && refusedSans.has(san)) continue;
    return {
      moverId: board.pieceAt(intent.from)?.id ?? '',
      intent,
      san,
      moveEval: { ...HATED_ORDER, moveNotation: san },
      objectivelyGood: false,
    };
  }
  return undefined;
}

function hatefulLeader(options: {
  readonly honourRefusals: boolean;
  readonly seen: Set<string>[];
}): HeadlessLeaderPort {
  return {
    chooseMove(board, side, _random, _ply, refusedSans) {
      if (board.turn() !== side) return undefined;
      options.seen.push(new Set(refusedSans));
      return orderFor(board, refusedSans, options.honourRefusals);
    },
    shouldOverride() {
      return false;
    },
  };
}

const compliantOpponent: HeadlessLeaderPort = {
  chooseMove(board, side) {
    if (board.turn() !== side) return undefined;
    const intent = board.legalMoves()[0];
    if (intent === undefined) return undefined;
    const probe = board.clone();
    return {
      moverId: board.pieceAt(intent.from)?.id ?? '',
      intent,
      san: probe.applyMove(intent).san,
    };
  },
  shouldOverride() {
    return false;
  },
};

async function runWith(honourRefusals: boolean): Promise<{
  readonly seen: Set<string>[];
  readonly result: HeadlessMatchResult;
}> {
  const seen: Set<string>[] = [];
  const board = LivingBoard.standard();
  const result = await runHeadlessMatch({
    random: createSeededRandom(4),
    maxPlies: 12,
    playerSide: 'w',
    leader: hatefulLeader({ honourRefusals, seen }),
    opponent: compliantOpponent,
    initialRoster: createStartingRoster(board, 'w', 45, 0.5),
    engine: createFakeEnginePort(),
  });
  return { seen, result };
}

function refusalsByPly(result: HeadlessMatchResult): Map<number, number> {
  const counts = new Map<number, number>();
  for (const event of result.events) {
    if (event.t !== 'REFUSAL') continue;
    counts.set(event.ply, (counts.get(event.ply) ?? 0) + 1);
  }
  return counts;
}

describe('headless refusal re-plan (ADR 0002, ADR 0014)', () => {
  it('re-plans refused orders at the same ply and hands them back as refused', async () => {
    const { seen, result } = await runWith(true);
    const counts = refusalsByPly(result);
    const firstPlyRefusals = counts.get(1) ?? 0;
    expect(firstPlyRefusals).toBeGreaterThan(1);
    // Refusal costs no turn, so a re-plan happens at the same ply...
    expect(
      result.events.filter((event) => event.t === 'MOVE'),
    ).not.toHaveLength(0);
    // ...and each re-plan sees every order refused so far at this position.
    const growth = seen.slice(0, firstPlyRefusals).map((set) => set.size);
    expect(growth).toStrictEqual(growth.map((_value, index) => index));
  });

  it('always resolves the ply: the last unrefused order is overridden', async () => {
    const { result } = await runWith(true);
    const resolved = new Set(
      result.events
        .filter((event) => event.t === 'MOVE' || event.t === 'DESERTION')
        .map((event) => event.ply),
    );
    for (const ply of refusalsByPly(result).keys()) {
      expect(resolved.has(ply)).toBe(true);
    }
    expect(
      result.events.filter((event) => event.t === 'OVERRIDE').length,
    ).toBeGreaterThan(0);
  });

  it('overrides immediately when a leader re-issues an order already refused', async () => {
    const { result } = await runWith(false);
    for (const count of refusalsByPly(result).values()) {
      expect(count).toBe(1);
    }
    expect(
      result.events.filter((event) => event.t === 'OVERRIDE').length,
    ).toBeGreaterThan(0);
  });
});
