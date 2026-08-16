import type { AppliedPromotion } from '../chess';
import {
  ENGINE_CONFIG,
  type MatchEvent,
  type PieceRole,
  type PieceState,
} from '../psychology';

const ROLE_BY_CHESS_ROLE: Readonly<Record<string, PieceRole>> = {
  P: 'Pawn',
  N: 'Knight',
  B: 'Bishop',
  R: 'Rook',
  Q: 'Queen',
  K: 'King',
};

function psychologyRole(role: string): PieceRole {
  const mapped = ROLE_BY_CHESS_ROLE[role];
  if (mapped === undefined) throw new Error(`Unknown promotion role: ${role}`);
  return mapped;
}

function shiftedPrestige(value: number, shift: number): number {
  return Math.max(-100, Math.min(100, Math.trunc(value + shift)));
}

/**
 * Apply one board promotion to the psychological roster and emit its truth.
 * The promoted piece changes role; every other roster member witnesses the
 * origin-class news. No promoted-piece psychology field is changed.
 */
export function applyPromotion(
  roster: readonly PieceState[],
  promotion: AppliedPromotion,
  ply: number,
): { readonly roster: PieceState[]; readonly event: MatchEvent } {
  const fromRole = psychologyRole(promotion.fromRole);
  const toRole = psychologyRole(promotion.toRole);
  const shift = ENGINE_CONFIG.PROMOTION_CLASS_PRESTIGE_SHIFT;
  const next = roster.map((piece) => {
    if (piece.id === promotion.pieceId) {
      return { ...piece, role: toRole };
    }
    if (shift === 0) return piece;
    return {
      ...piece,
      classPrestige: {
        ...piece.classPrestige,
        [fromRole]: shiftedPrestige(piece.classPrestige[fromRole], shift),
      },
    };
  });
  return {
    roster: next,
    event: {
      t: 'PROMOTION',
      ply,
      pieceId: promotion.pieceId,
      fromRole,
      toRole,
    },
  };
}
