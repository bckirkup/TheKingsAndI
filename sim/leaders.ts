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
  /**
   * Retained behavioral belief updated at campaign boundaries. This
   * deliberately excludes piece psychology and engine truth.
   */
  readonly observation: LeaderObservation;
}

export interface LeaderObservation {
  readonly matchesObserved: number;
  readonly refusalPermille: number;
  readonly desertions: number;
  readonly survivors: number;
  readonly winScore: number;
}

export interface AdaptiveMemoryConfig {
  /** Maximum number of matches used to reduce the next observation's weight. */
  readonly memoryCapMatches: number;
  /** Relative weight for worse news, where 1000 is symmetric. */
  readonly badNewsWeightPermille: number;
  /** Prior refusal rate in integer permille. */
  readonly priorRefusalPermille: number;
  /** Prior desertion count. */
  readonly priorDesertions: number;
  /** Prior surviving roster size. */
  readonly priorSurvivors: number;
  /** Prior win score in the 0..100 range. */
  readonly priorWinScore: number;
}

export const ADAPTIVE_MEMORY_CONFIG: AdaptiveMemoryConfig = {
  memoryCapMatches: 5,
  badNewsWeightPermille: 1_000,
  priorRefusalPermille: 0,
  priorDesertions: 0,
  priorSurvivors: 16,
  priorWinScore: 50,
} as const;

function clampObservationValue(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

export function createPriorLeaderObservation(): LeaderObservation {
  return {
    matchesObserved: 0,
    refusalPermille: clampObservationValue(
      ADAPTIVE_MEMORY_CONFIG.priorRefusalPermille,
      0,
      1_000,
    ),
    desertions: Math.max(0, Math.trunc(ADAPTIVE_MEMORY_CONFIG.priorDesertions)),
    survivors: clampObservationValue(
      ADAPTIVE_MEMORY_CONFIG.priorSurvivors,
      0,
      16,
    ),
    winScore: clampObservationValue(
      ADAPTIVE_MEMORY_CONFIG.priorWinScore,
      0,
      100,
    ),
  };
}

function updateObservationField(
  belief: number,
  observed: number,
  matchesObserved: number,
  minimum: number,
  maximum: number,
  worseNews: boolean,
): number {
  const cappedMatches = Math.min(
    Math.max(0, Math.trunc(matchesObserved)),
    Math.max(0, Math.trunc(ADAPTIVE_MEMORY_CONFIG.memoryCapMatches)),
  );
  const baseWeight = Math.trunc(1_000 / (cappedMatches + 1));
  const weight = worseNews
    ? Math.min(
        1_000,
        Math.trunc(
          (baseWeight * ADAPTIVE_MEMORY_CONFIG.badNewsWeightPermille) / 1_000,
        ),
      )
    : baseWeight;
  const delta = observed - belief;
  let step = Math.trunc((delta * weight) / 1_000);
  if (step === 0 && delta !== 0) step = delta > 0 ? 1 : -1;
  return clampObservationValue(belief + step, minimum, maximum);
}

export function updateLeaderObservation(
  belief: LeaderObservation,
  observation: LeaderObservation,
): LeaderObservation {
  const refusalPermille = clampObservationValue(
    belief.refusalPermille,
    0,
    1_000,
  );
  const observedRefusalPermille = clampObservationValue(
    observation.refusalPermille,
    0,
    1_000,
  );
  const desertions = Math.max(0, Math.trunc(belief.desertions));
  const observedDesertions = Math.max(0, Math.trunc(observation.desertions));
  const survivors = clampObservationValue(belief.survivors, 0, 16);
  const observedSurvivors = clampObservationValue(observation.survivors, 0, 16);
  const winScore = clampObservationValue(belief.winScore, 0, 100);
  const observedWinScore = clampObservationValue(observation.winScore, 0, 100);
  return {
    matchesObserved: Math.max(0, Math.trunc(belief.matchesObserved)) + 1,
    refusalPermille: updateObservationField(
      refusalPermille,
      observedRefusalPermille,
      belief.matchesObserved,
      0,
      1_000,
      observedRefusalPermille > refusalPermille,
    ),
    desertions: updateObservationField(
      desertions,
      observedDesertions,
      belief.matchesObserved,
      0,
      Number.MAX_SAFE_INTEGER,
      observedDesertions > desertions,
    ),
    survivors: updateObservationField(
      survivors,
      observedSurvivors,
      belief.matchesObserved,
      0,
      16,
      observedSurvivors < survivors,
    ),
    winScore: updateObservationField(
      winScore,
      observedWinScore,
      belief.matchesObserved,
      0,
      100,
      observedWinScore < winScore,
    ),
  };
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

export interface AdaptivePolicyConfig {
  /** Base override probability shared by the adaptive styles. */
  readonly baseInsistence: number;
  /** Base tactical sacrifice penalty shared by the adaptive styles. */
  readonly baseRisk: number;
  /** Chastened override reduction per refusal-rate permille. */
  readonly chastenedGain: number;
  /** Chastened sacrifice penalty increase per desertion. */
  readonly chastenedRiskGain: number;
  /** Upper bound on chastened sacrifice penalty. */
  readonly chastenedRiskCeiling: number;
  /** Escalator override increase per refusal-rate permille. */
  readonly escalatorGain: number;
  /** Upper bound on escalator override probability. */
  readonly escalatorCeiling: number;
  /** Roster scarcity threshold below which insistence falls. */
  readonly thinRoster: number;
  /** Sacrifice penalty increase per missing survivor. */
  readonly scarcityGain: number;
}

export const ADAPTIVE_POLICY_CONFIG: AdaptivePolicyConfig = {
  /** Base override probability shared by the adaptive styles. */
  baseInsistence: 40,
  /** Base tactical sacrifice penalty shared by the adaptive styles. */
  baseRisk: 8,
  /** Chastened override reduction per refusal-rate permille. */
  chastenedGain: 500,
  /** Chastened sacrifice penalty increase per desertion. */
  chastenedRiskGain: 8,
  /** Upper bound on chastened sacrifice penalty. */
  chastenedRiskCeiling: 72,
  /** Escalator override increase per refusal-rate permille. */
  escalatorGain: 55,
  /** Upper bound on escalator override probability. */
  escalatorCeiling: 95,
  /** Roster scarcity threshold below which insistence falls. */
  thinRoster: 12,
  /** Sacrifice penalty increase per missing survivor. */
  scarcityGain: 4,
} as const;

export interface ExploitPolicyConfig {
  /** Win-maxer override probability while the room complies. */
  readonly winMaxerInsistence: number;
  /** Refusal-permille ceiling above which the win-maxer stops overriding. */
  readonly winMaxerCompliancePermille: number;
  /** Generation cycler override probability while desertions are below the ceiling. */
  readonly cyclerInsistence: number;
  /** Observed-desertion ceiling at which the cycler enters its lull. */
  readonly cyclerDesertionCeiling: number;
  /** Cycler override probability during the lull. */
  readonly cyclerLullInsistence: number;
  /** Cycler tactical risk weight while aggressive. */
  readonly cyclerRisk: number;
  /** Cascade dodger override probability while the roster is healthy. */
  readonly dodgerInsistence: number;
  /** Observed-survivor floor below which the dodger goes passive. */
  readonly dodgerSurvivorFloor: number;
}

export const EXPLOIT_POLICY_CONFIG: ExploitPolicyConfig = {
  winMaxerInsistence: 90,
  winMaxerCompliancePermille: 150,
  cyclerInsistence: 90,
  cyclerDesertionCeiling: 1,
  cyclerLullInsistence: 5,
  cyclerRisk: 0,
  dodgerInsistence: 90,
  dodgerSurvivorFloor: 12,
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

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
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
    case 'chastened':
      return {
        style,
        chooseMove: (board, moves, random, context) => {
          const riskWeight = Math.min(
            ADAPTIVE_POLICY_CONFIG.chastenedRiskCeiling,
            ADAPTIVE_POLICY_CONFIG.baseRisk +
              context.observation.desertions *
                ADAPTIVE_POLICY_CONFIG.chastenedRiskGain,
          );
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(feature, riskWeight),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0.5,
          };
        },
        shouldOverride: (random, context) => {
          const chance = clampInteger(
            ADAPTIVE_POLICY_CONFIG.baseInsistence -
              Math.trunc(
                (context.observation.refusalPermille *
                  ADAPTIVE_POLICY_CONFIG.chastenedGain) /
                  1_000,
              ),
            0,
            100,
          );
          return random.nextInt(100) < chance;
        },
      };
    case 'escalator':
      return {
        style,
        chooseMove: (board, moves, random) => {
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(feature, ADAPTIVE_POLICY_CONFIG.baseRisk),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0.5,
          };
        },
        shouldOverride: (random, context) => {
          const chance = clampInteger(
            ADAPTIVE_POLICY_CONFIG.baseInsistence +
              Math.trunc(
                (context.observation.refusalPermille *
                  ADAPTIVE_POLICY_CONFIG.escalatorGain) /
                  1_000,
              ),
            0,
            ADAPTIVE_POLICY_CONFIG.escalatorCeiling,
          );
          return random.nextInt(100) < chance;
        },
      };
    case 'roster_first':
      return {
        style,
        chooseMove: (board, moves, random, context) => {
          const missing = 16 - Math.min(16, context.observation.survivors);
          const riskWeight =
            ADAPTIVE_POLICY_CONFIG.baseRisk +
            missing * ADAPTIVE_POLICY_CONFIG.scarcityGain;
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(feature, riskWeight),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0.5,
          };
        },
        shouldOverride: (random, context) => {
          const chance =
            context.observation.survivors < ADAPTIVE_POLICY_CONFIG.thinRoster
              ? 10
              : ADAPTIVE_POLICY_CONFIG.baseInsistence;
          return random.nextInt(100) < chance;
        },
      };
    case 'win_maxer':
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
            leaderImpliedBias: 0.5,
          };
        },
        shouldOverride: (random, context) => {
          const chance =
            context.observation.refusalPermille <=
            EXPLOIT_POLICY_CONFIG.winMaxerCompliancePermille
              ? EXPLOIT_POLICY_CONFIG.winMaxerInsistence
              : 0;
          return random.nextInt(100) < chance;
        },
      };
    case 'generation_cycler':
      return {
        style,
        chooseMove: (board, moves, random, context) => {
          const aggressive =
            context.observation.desertions <
            EXPLOIT_POLICY_CONFIG.cyclerDesertionCeiling;
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(
              feature,
              aggressive
                ? EXPLOIT_POLICY_CONFIG.cyclerRisk
                : ADAPTIVE_POLICY_CONFIG.baseRisk,
            ),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0.5,
          };
        },
        shouldOverride: (random, context) => {
          const aggressive =
            context.observation.desertions <
            EXPLOIT_POLICY_CONFIG.cyclerDesertionCeiling;
          const chance = aggressive
            ? EXPLOIT_POLICY_CONFIG.cyclerInsistence
            : EXPLOIT_POLICY_CONFIG.cyclerLullInsistence;
          return random.nextInt(100) < chance;
        },
      };
    case 'cascade_dodger':
      return {
        style,
        chooseMove: (board, moves, random, context) => {
          const healthy =
            context.observation.survivors >=
            EXPLOIT_POLICY_CONFIG.dodgerSurvivorFloor;
          const chosen = pickByScore(board, moves, random, (feature) =>
            tacticalScore(
              feature,
              healthy ? 0 : ADAPTIVE_POLICY_CONFIG.baseRisk,
            ),
          );
          if (chosen === undefined) return undefined;
          return {
            intent: chosen.intent,
            features: chosen.features,
            leaderImpliedBias: 0.5,
          };
        },
        shouldOverride: (random, context) => {
          const healthy =
            context.observation.survivors >=
            EXPLOIT_POLICY_CONFIG.dodgerSurvivorFloor;
          const chance = healthy ? EXPLOIT_POLICY_CONFIG.dodgerInsistence : 0;
          return random.nextInt(100) < chance;
        },
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
  chastened: createPolicy('chastened'),
  escalator: createPolicy('escalator'),
  roster_first: createPolicy('roster_first'),
  win_maxer: createPolicy('win_maxer'),
  generation_cycler: createPolicy('generation_cycler'),
  cascade_dodger: createPolicy('cascade_dodger'),
};

export function leaderPolicy(style: Leader): LeaderPolicy {
  return POLICIES[style];
}

export function opponentPolicy(): LeaderPolicy {
  return createPolicy('random');
}
