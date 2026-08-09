import type { LivingBoard, Side } from '../chess';

/**
 * Score a match from the player's perspective.
 *
 * A rout is a loss even when the board is not checkmate. Dismissal continues
 * under King command to a board result per ADR 0022. An unfinished
 * non-terminal board remains a draw for calibration purposes.
 * Enemy cohesion collapse is a legitimate win (ADR 0025 §2).
 */
export function scoreMatchOutcome(
  board: LivingBoard,
  playerSide: Side,
  terminalLoss: boolean,
  enemyRout = false,
): number {
  if (terminalLoss) return 0;
  if (enemyRout) return 100;
  if (!board.isGameOver()) return 50;
  return board.turn() === playerSide ? 0 : 100;
}
