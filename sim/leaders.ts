import {
  extractMoveFeatures,
  promotionProspectByPiece,
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

export interface LeaderPolicyConfig {
  readonly repetitionPenalty: number;
  readonly pawnAdvanceWeight: number;
}

export const LEADER_POLICY_CONFIG: LeaderPolicyConfig = {
  /** Penalize moves that recreate an already-seen position. */
  repetitionPenalty: -1_000,
  /** Small reward per permille of friendly promotion prospect gained. */
  pawnAdvanceWeight: 0.02,
} as const;

function prospectTotal(prospect: Readonly<Record<string, number>>): number {
  return Object.values(prospect).reduce((total, value) => total + value, 0);
}

export function scoreLeaderMove(
  board: LivingBoard,
  move: ScoredMove,
  tactical: (feature: MoveFeatures) => number,
  config: LeaderPolicyConfig = LEADER_POLICY_CONFIG,
  beforeProspectTotal?: number,
): number {
  const mover = board.pieceOf(move.features.moverId);
  const before =
    beforeProspectTotal ??
    (mover === undefined
      ? 0
      : prospectTotal(promotionProspectByPiece(board, mover.side)));
  const after = prospectTotal(move.features.promotionProspectByPiece);
  const repetitions = board.repetitionCountAfter(move.intent);
  return (
    tactical(move.features) +
    (after - before) * config.pawnAdvanceWeight +
    Math.max(0, repetitions - 1) * config.repetitionPenalty
  );
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

export function pickByScore(
  board: LivingBoard,
  moves: readonly ScoredMove[],
  random: SeededRandom,
  scorer: (feature: MoveFeatures) => number,
  config: LeaderPolicyConfig = LEADER_POLICY_CONFIG,
): ScoredMove | undefined {
  if (moves.length === 0) return undefined;
  const mover = board.pieceOf(moves[0]?.features.moverId ?? '');
  const beforeProspectTotal =
    mover === undefined
      ? 0
      : prospectTotal(promotionProspectByPiece(board, mover.side));
  let bestScore = Number.NEGATIVE_INFINITY;
  const best: ScoredMove[] = [];
  for (const move of moves) {
    const score = scoreLeaderMove(
      board,
      move,
      scorer,
      config,
      beforeProspectTotal,
    );
    if (score > bestScore) {
      best.length = 0;
      best.push(move);
      bestScore = score;
    } else if (score === bestScore) {
      best.push(move);
    }
  }
  const first = best[0];
  if (first === undefined) return undefined;
  return best.length === 1 ? first : best[random.nextInt(best.length)];
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
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
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
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
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
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(
            board,
            moves,
            random,
            (feature) => -feature.pCaptured,
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
    case 'pure_tactician':
      return {
        style,
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
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
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
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
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(
            board,
            moves,
            random,
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
    case 'exacting':
      // Warm and demanding — protects pieces, then insists (D164 quadrant).
      return {
        style,
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(feature, 20),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 80,
      };
    case 'absentee':
      // Cold and indifferent — asks for the sharp move, then shrugs (D164 quadrant).
      return {
        style,
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(feature, 0.25),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 2,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 5,
      };
    case 'steady':
      // Middle care and insistence — neither protects nor shrugs (D164 quadrant).
      return {
        style,
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(feature, 8),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0.5,
          };
        },
        shouldOverride: (random) => random.nextInt(100) < 40,
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
  exacting: createPolicy('exacting'),
  absentee: createPolicy('absentee'),
  steady: createPolicy('steady'),
};

export function leaderPolicy(style: Leader): LeaderPolicy {
  return POLICIES[style];
}

export function opponentPolicy(): LeaderPolicy {
  return createPolicy('random');
}
