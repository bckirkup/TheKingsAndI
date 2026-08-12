import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { scoreMatchOutcome } from '../src/orchestration/outcomeScore';

import { legalScoredMoves, leaderPolicy, type LeaderContext } from './leaders';
import { matchSeedForCampaign } from './campaign';
import type { Leader } from './cli';
import type { ControlHorizon } from './metrics';

const MAX_PLIES = 200;

/** Plain-chess control: same move picker as a scripted leader, no psychology. */
export function runPlainChessMatch(options: {
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

export function plainChessMeanWinScore(options: {
  readonly matches: number;
  readonly seed: number;
  readonly whiteLeader: Leader;
}): number {
  const scores = plainChessWinScores(options);
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

export function plainChessWinScores(options: {
  readonly matches: number;
  readonly seed: number;
  readonly whiteLeader: Leader;
}): readonly number[] {
  return Array.from(
    { length: options.matches },
    (_, index) =>
      runPlainChessMatch({
        seed: matchSeedForCampaign(options.seed, index + 1),
        whiteLeader: options.whiteLeader,
      }).winScore,
  );
}

export function plainChessHorizonSeries(options: {
  readonly matches: number;
  readonly seed: number;
  readonly whiteLeader: Leader;
}): readonly ControlHorizon[] {
  const scores = plainChessWinScores(options);
  return scores.map((_, index) => {
    const prefix = scores.slice(0, index + 1);
    const wins = prefix.filter((score) => score === 100).length;
    const draws = prefix.filter((score) => score === 50).length;
    const losses = prefix.filter((score) => score === 0).length;
    return {
      horizon: index + 1,
      meanWinScore:
        prefix.reduce((total, score) => total + score, 0) / prefix.length,
      winRate: wins / prefix.length,
      drawRate: draws / prefix.length,
      lossRate: losses / prefix.length,
    };
  });
}

export function averagePlainChessHorizonSeries(
  campaigns: readonly (readonly ControlHorizon[])[],
): readonly ControlHorizon[] {
  const maxLength = Math.max(...campaigns.map((series) => series.length), 0);
  return Array.from({ length: maxLength }, (_, index) => {
    const selected = campaigns
      .map((series) => series[index])
      .filter((point): point is ControlHorizon => point !== undefined);
    const mean = (pick: (point: ControlHorizon) => number): number =>
      selected.reduce((total, point) => total + pick(point), 0) /
      Math.max(1, selected.length);
    return {
      horizon: index + 1,
      meanWinScore: mean((point) => point.meanWinScore),
      winRate: mean((point) => point.winRate),
      drawRate: mean((point) => point.drawRate),
      lossRate: mean((point) => point.lossRate),
    };
  });
}
