import {
  promotionProspectByPiece,
  type LivingBoard,
  type PieceId,
} from '../chess';
import {
  trackPromotionHope,
  type MatchEvent,
  type PromotionHopeState,
} from '../psychology';

export function initialPromotionHope(board: LivingBoard): PromotionHopeState {
  return {
    prospects: {
      ...promotionProspectByPiece(board, 'w'),
      ...promotionProspectByPiece(board, 'b'),
    },
  };
}

export function advancePromotionHope(
  board: LivingBoard,
  state: PromotionHopeState,
  ply: number,
  capturedPawnIds: readonly PieceId[] = [],
  promotedPieceIds: readonly PieceId[] = [],
): {
  readonly state: PromotionHopeState;
  readonly events: readonly MatchEvent[];
} {
  const current: Readonly<Record<PieceId, number>> = {
    ...promotionProspectByPiece(board, 'w'),
    ...promotionProspectByPiece(board, 'b'),
  };
  return trackPromotionHope(
    state,
    current,
    capturedPawnIds,
    promotedPieceIds,
    ply,
  );
}
