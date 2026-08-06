import { extractMoveFeatures, type LivingBoard } from '../chess';
import type { SeededRandom } from '../core/random';

/** Broad-and-shallow King command: cautious material-seeking moves (ADR 0022 §4). */
export function chooseKingCommandMove(
  board: LivingBoard,
  random: SeededRandom,
): string | undefined {
  const moves = board.legalMoves();
  if (moves.length === 0) return undefined;

  const scored = moves.map((intent) => {
    const features = extractMoveFeatures(board, intent);
    return {
      san: features.san,
      score:
        features.materialDelta * 10 +
        features.kingSafetyDelta * 2 -
        features.pCaptured * 8,
    };
  });
  scored.sort((left, right) => right.score - left.score);
  const best = scored[0]?.score ?? Number.NEGATIVE_INFINITY;
  const candidates = scored.filter((entry) => entry.score >= best - 0.01);
  const pick = candidates[random.nextInt(candidates.length)];
  return pick?.san ?? scored[0]?.san;
}
