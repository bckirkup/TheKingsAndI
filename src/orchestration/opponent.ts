import type { LivingBoard } from '../chess';
import type { SeededRandom } from '../core/random';

/** Random-control opponent for the vertical slice (no psychology). */
export function chooseRandomOpponentMove(
  board: LivingBoard,
  random: SeededRandom,
): string | undefined {
  const moves = board.legalMovesSan();
  if (moves.length === 0) return undefined;
  return moves[random.nextInt(moves.length)] ?? moves[0];
}
