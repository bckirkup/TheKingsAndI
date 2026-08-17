import type { LivingBoard, Side } from '../chess';

/**
 * Score a match from the player's perspective.
 *
 * A rout is a loss even when the board is not checkmate. Dismissal continues
 * under King command to a board result per ADR 0022. Enemy cohesion collapse
 * is a legitimate win (ADR 0025 §2). Only checkmate decides a board result;
 * every draw or unfinished position remains a draw for calibration purposes.
 */
export function scoreMatchOutcome(
  board: LivingBoard,
  playerSide: Side,
  rout: boolean,
  enemyRout = false,
): number {
  if (rout) return 0;
  if (enemyRout) return 100;
  if (board.isCheckmate()) return board.turn() === playerSide ? 0 : 100;
  return 50;
}
