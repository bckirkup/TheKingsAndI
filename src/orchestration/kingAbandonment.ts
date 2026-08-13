import type { LivingBoard, PieceId, Side } from '../chess';

export interface KingExposure {
  readonly exposedSide: Side;
  readonly attackerSide: Side;
  readonly kingId: PieceId;
}

function opposite(side: Side): Side {
  return side === 'w' ? 'b' : 'w';
}

export function kingExposureAfterWithdrawals(
  board: LivingBoard,
  sideToMove: Side,
): KingExposure | undefined {
  const exposedSide = opposite(sideToMove);
  const king = board.piecesOf(exposedSide).find((piece) => piece.role === 'K');
  if (king === undefined || !board.isAttacked(king.square, sideToMove)) {
    return undefined;
  }
  return {
    exposedSide,
    attackerSide: sideToMove,
    kingId: king.id,
  };
}
