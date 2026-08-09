import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { scoreMatchOutcome } from '../src/orchestration/outcomeScore';

import { legalScoredMoves, leaderPolicy, type LeaderContext } from './leaders';
import type { Leader } from './cli';

const MAX_PLIES = 200;

/** Matched-skill control: same leader policy and strength, no psychology. */
export function runMatchedSkillMatch(options: {
  readonly seed: number;
  readonly whiteLeader: Leader;
  readonly blackLeader?: Leader;
}): { readonly plies: number; readonly winScore: number } {
  const board = LivingBoard.standard();
  const random = createSeededRandom(options.seed);
  const contextBase: Omit<LeaderContext, 'ply'> = {
    matchIndex: 1,
    campaignMatch: 1,
    redeemerSwitchMatch: 10,
  };
  const white = leaderPolicy(options.whiteLeader);
  const black = leaderPolicy(options.blackLeader ?? 'random');
  let plies = 0;

  while (plies < MAX_PLIES && !board.isGameOver()) {
    const side = board.turn();
    const policy = side === 'w' ? white : black;
    const moves = legalScoredMoves(board);
    const choice = policy.chooseMove(board, moves, random, {
      ...contextBase,
      ply: plies + 1,
    });
    if (choice === undefined) break;
    board.applyMove(choice.intent);
    plies += 1;
  }

  const winScore = scoreMatchOutcome(board, 'w', false);
  return { plies, winScore };
}

export function matchedSkillMeanWinScore(options: {
  readonly matches: number;
  readonly seed: number;
  readonly whiteLeader: Leader;
}): number {
  let total = 0;
  for (let match = 1; match <= options.matches; match += 1) {
    const matchSeed = options.seed ^ (match * 1_000_003);
    total += runMatchedSkillMatch({
      seed: matchSeed,
      whiteLeader: options.whiteLeader,
    }).winScore;
  }
  return total / options.matches;
}

/** Legacy detector-6 name retained for before/after attribution reports. */
export const plainChessMeanWinScore = matchedSkillMeanWinScore;
