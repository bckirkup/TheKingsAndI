import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import {
  runHeadlessMatch,
  type HeadlessLeaderPort,
  type HeadlessMatchResult,
} from '../src/orchestration';
import type { CandidateMoveEvaluation, PieceState } from '../src/psychology';

import type { Leader } from './cli';
import { featuresToEvaluation, isObjectivelyGoodMove } from './eval';
import { leaderPolicy, legalScoredMoves, type LeaderContext } from './leaders';
import { createStartingRoster } from './roster';

const MAX_PLIES = 200;
const REDEEMER_SWITCH_MATCH = 10;

function leaderPort(
  style: Leader,
  contextBase: Omit<LeaderContext, 'ply'>,
): HeadlessLeaderPort {
  const policy = leaderPolicy(style);
  return {
    chooseMove(board, side, random, ply) {
      const moves = legalScoredMoves(board);
      if (moves.length === 0) return undefined;
      const context: LeaderContext = { ...contextBase, ply };
      const choice = policy.chooseMove(board, moves, random, context);
      if (choice === undefined) return undefined;
      const mover = board.pieceAt(choice.intent.from);
      if (mover === undefined || mover.side !== side) return undefined;
      const moveEval: CandidateMoveEvaluation = featuresToEvaluation(
        choice.features,
        choice.leaderImpliedBias,
      );
      return {
        moverId: mover.id,
        san: choice.features.san,
        moveEval,
        objectivelyGood: isObjectivelyGoodMove(choice.features),
      };
    },
    shouldOverride(random, ply) {
      return policy.shouldOverride(random, { ...contextBase, ply });
    },
  };
}

export interface RunMatchOptions {
  readonly seed: number;
  readonly leader: Leader;
  readonly matchIndex: number;
  readonly campaignMatch: number;
  readonly roster: readonly PieceState[];
}

export function runMatch(options: RunMatchOptions): HeadlessMatchResult {
  const random = createSeededRandom(options.seed);
  const contextBase = {
    matchIndex: options.matchIndex,
    campaignMatch: options.campaignMatch,
    redeemerSwitchMatch: REDEEMER_SWITCH_MATCH,
  };
  return runHeadlessMatch({
    random,
    maxPlies: MAX_PLIES,
    playerSide: 'w',
    leader: leaderPort(options.leader, contextBase),
    opponent: leaderPort('random', contextBase),
    initialRoster: options.roster,
  });
}

export function runMatchFromFreshRoster(
  options: Omit<RunMatchOptions, 'roster'> & {
    readonly initialTrust?: number;
  },
): HeadlessMatchResult {
  const board = LivingBoard.standard();
  const random = createSeededRandom(options.seed);
  const roster = createStartingRoster(
    board,
    'w',
    options.initialTrust ?? 20,
    random.nextInt(10_000) / 10_000,
  );
  return runMatch({ ...options, roster });
}
