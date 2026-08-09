import {
  extractMoveFeatures,
  type LivingBoard,
  type MoveFeatures,
  type MoveIntent,
} from '../src/chess';
import type { SeededRandom } from '../src/core/random';

import type { Leader } from './cli';

export interface LeaderContext {
  readonly matchIndex: number;
  readonly campaignMatch: number;
  readonly ply: number;
  readonly redeemerSwitchMatch: number;
}

export interface LeaderChoice {
  readonly intent: MoveIntent;
  readonly features: MoveFeatures;
  readonly leaderImpliedBias: number;
}

export interface ScoredMove {
  readonly intent: MoveIntent;
  readonly features: MoveFeatures;
}

export function legalScoredMoves(board: LivingBoard): ScoredMove[] {
  return board.legalMoves().map((intent) => ({
    intent,
    features: extractMoveFeatures(board, intent),
  }));
}

export interface LeaderPolicy {
  readonly style: Leader;
  chooseMove(
    board: LivingBoard,
    moves: readonly ScoredMove[],
    random: SeededRandom,
    context: LeaderContext,
  ): LeaderChoice | undefined;
  shouldOverride(random: SeededRandom, context: LeaderContext): boolean;
}

function pickByScore(
  moves: readonly ScoredMove[],
  scorer: (feature: MoveFeatures) => number,
): ScoredMove | undefined {
  if (moves.length === 0) return undefined;
  const first = moves[0];
  if (first === undefined) return undefined;
  let best = first;
  let bestScore = scorer(best.features);
  for (const move of moves.slice(1)) {
    const score = scorer(move.features);
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

function tacticalScore(feature: MoveFeatures, riskWeight: number): number {
  return (
    feature.materialDelta * 10 +
    feature.deltaVCapture * 3 +
    feature.kingSafetyDelta * 2 -
    feature.pCaptured * riskWeight
  );
}

function createPolicy(style: Leader): LeaderPolicy {
  switch (style) {
    case 'tyrannical':
      return {
        style,
        chooseMove: (_board, moves) => {
          const chosen = pickByScore(moves, (feature) =>
            tacticalScore(feature, 2),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 1.5,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 85,
      };
    case 'supportive':
      return {
        style,
        chooseMove: (_board, moves) => {
          const chosen = pickByScore(moves, (feature) =>
            tacticalScore(feature, 25),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0,
          };
        },
        shouldOverride: () => false,
      };
    case 'volatile':
      return {
        style,
        chooseMove: (_board, moves, random) => {
          if (moves.length === 0) return undefined;
          const chosen = moves[random.nextInt(moves.length)];
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: random.nextInt(200) / 100 - 1,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 45,
      };
    case 'servant':
      return {
        style,
        chooseMove: (_board, moves) => {
          const chosen = pickByScore(moves, (feature) => -feature.pCaptured);
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0,
          };
        },
        shouldOverride: () => false,
      };
    case 'pure_tactician':
      return {
        style,
        chooseMove: (_board, moves) => {
          const chosen = pickByScore(moves, (feature) =>
            tacticalScore(feature, 0),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 2,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 70,
      };
    case 'redeemer':
      return {
        style,
        chooseMove: (board, moves, random, context) => {
          const phase =
            context.campaignMatch < context.redeemerSwitchMatch
              ? createPolicy('pure_tactician')
              : createPolicy('supportive');
          return phase.chooseMove(board, moves, random, context);
        },
        shouldOverride: (random, context) => {
          if (context.campaignMatch < context.redeemerSwitchMatch) {
            return createPolicy('pure_tactician').shouldOverride(
              random,
              context,
            );
          }
          return createPolicy('supportive').shouldOverride(random, context);
        },
      };
    case 'cold_winner':
      // High ability, low benevolence — overrides freely while winning (ADR 0024).
      return {
        style,
        chooseMove: (_board, moves) => {
          const chosen = pickByScore(moves, (feature) =>
            tacticalScore(feature, 0.25),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 2.5,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 90,
      };
    case 'rebuilder':
      // Patient restoration — avoid burns, accept refusals (ADR 0030 oracle).
      return {
        style,
        chooseMove: (_board, moves) => {
          const chosen = pickByScore(
            moves,
            (feature) =>
              tacticalScore(feature, 3) +
              feature.kingSafetyDelta * 4 -
              feature.pCaptured * 8,
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: -0.5,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 15,
      };
    case 'random':
    default:
      return {
        style: 'random',
        chooseMove: (_board, moves, random) => {
          if (moves.length === 0) return undefined;
          const chosen = moves[random.nextInt(moves.length)];
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 10,
      };
  }
}

const POLICIES: Record<Leader, LeaderPolicy> = {
  tyrannical: createPolicy('tyrannical'),
  supportive: createPolicy('supportive'),
  volatile: createPolicy('volatile'),
  servant: createPolicy('servant'),
  random: createPolicy('random'),
  pure_tactician: createPolicy('pure_tactician'),
  redeemer: createPolicy('redeemer'),
  cold_winner: createPolicy('cold_winner'),
  rebuilder: createPolicy('rebuilder'),
};

export function leaderPolicy(style: Leader): LeaderPolicy {
  return POLICIES[style];
}

export function opponentPolicy(): LeaderPolicy {
  return createPolicy('random');
}
