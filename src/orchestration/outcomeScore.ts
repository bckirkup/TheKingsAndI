import type { LivingBoard, Side } from '../chess';

/**
 * Score a match from the player's perspective.
 *
 * A rout or dismissal is a loss even when the board is not checkmate. An
 * unfinished non-terminal board remains a draw for calibration purposes.
 */
export function scoreMatchOutcome(
  board: LivingBoard,
  playerSide: Side,
  terminalLoss: boolean,
): number {
  if (terminalLoss) return 0;
  if (!board.isGameOver()) return 50;
  return board.turn() === playerSide ? 0 : 100;
}
