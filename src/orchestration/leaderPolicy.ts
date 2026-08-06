import {
  extractMoveFeatures,
  type LivingBoard,
  type MoveFeatures,
  type MoveIntent,
} from '../chess';
import type { SeededRandom } from '../core/random';

export type OpponentArchetype =
  | 'tyrannical'
  | 'supportive'
  | 'volatile'
  | 'servant'
  | 'random';

export interface ScoredMove {
  readonly intent: MoveIntent;
  readonly features: MoveFeatures;
  readonly san: string;
}

function tacticalScore(feature: MoveFeatures, riskWeight: number): number {
  return (
    feature.materialDelta * 10 +
    feature.deltaVCapture * 3 +
    feature.kingSafetyDelta * 2 -
    feature.pCaptured * riskWeight
  );
}

function pickByScore(
  moves: readonly ScoredMove[],
  scorer: (feature: MoveFeatures) => number,
): ScoredMove | undefined {
  if (moves.length === 0) return undefined;
  let best = moves[0];
  if (best === undefined) return undefined;
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

export function legalScoredMoves(board: LivingBoard): ScoredMove[] {
  return board.legalMoves().map((intent) => {
    const features = extractMoveFeatures(board, intent);
    return { intent, features, san: features.san };
  });
}

/** Opposing commander policy — difficulty selects archetype, never depth (ADR 0025). */
export function chooseOpponentMove(
  board: LivingBoard,
  random: SeededRandom,
  archetype: OpponentArchetype = 'random',
): string | undefined {
  const moves = legalScoredMoves(board);
  if (moves.length === 0) return undefined;

  let chosen: ScoredMove | undefined;
  switch (archetype) {
    case 'tyrannical':
      chosen = pickByScore(moves, (f) => tacticalScore(f, 0.5));
      break;
    case 'supportive':
      chosen = pickByScore(moves, (f) => tacticalScore(f, 2.5));
      break;
    case 'volatile':
      chosen = moves[random.nextInt(moves.length)];
      break;
    case 'servant':
      chosen = pickByScore(
        moves,
        (f) => f.materialDelta * 5 + f.kingSafetyDelta,
      );
      break;
    case 'random':
    default:
      chosen = moves[random.nextInt(moves.length)];
      break;
  }
  return chosen?.san ?? moves[0]?.san;
}
