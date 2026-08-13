import type { LivingBoard, PieceId, Side } from '../chess';

export interface KingAbandonment {
  readonly abandonedSide: Side;
  readonly attackerSide: Side;
  readonly kingId: PieceId;
}

function opposite(side: Side): Side {
  return side === 'w' ? 'b' : 'w';
}

export function kingAbandonmentAfterWithdrawals(
  board: LivingBoard,
  sideToMove: Side,
): KingAbandonment | undefined {
  const abandonedSide = opposite(sideToMove);
  const king = board
    .piecesOf(abandonedSide)
    .find((piece) => piece.role === 'K');
  if (king === undefined || !board.isAttacked(king.square, sideToMove)) {
    return undefined;
  }
  return {
    abandonedSide,
    attackerSide: sideToMove,
    kingId: king.id,
  };
}
