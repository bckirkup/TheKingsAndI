import type { Square } from 'chess.js';

/** Chess-layer types. `psychology/` may import these as types only (ADR 0013). */

export type Side = 'w' | 'b';

/** Current role. A promoted pawn's `originRole` is an identity-layer concern. */
export type Role = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export type PromotionRole = 'Q' | 'R' | 'B' | 'N';

/** Stable for the piece's whole life; minted by the roster layer. */
export type PieceId = string;

export type { Square };

export interface MoveIntent {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: PromotionRole;
}

export interface BoardPiece {
  readonly id: PieceId;
  readonly side: Side;
  readonly role: Role;
  readonly square: Square;
}

export interface AppliedCapture {
  readonly pieceId: PieceId;
  readonly role: Role;
  /** Differs from the move's destination for en passant. */
  readonly square: Square;
}

export interface AppliedPromotion {
  readonly pieceId: PieceId;
  readonly fromRole: Role;
  readonly toRole: PromotionRole;
}

export interface AppliedCastle {
  readonly rookId: PieceId;
  readonly rookFrom: Square;
  readonly rookTo: Square;
  readonly wing: 'king' | 'queen';
}

export interface AppliedMove {
  /** 1-based index of this move within the match. */
  readonly ply: number;
  readonly side: Side;
  readonly san: string;
  readonly lan: string;
  readonly moverId: PieceId;
  readonly moverRole: Role;
  readonly from: Square;
  readonly to: Square;
  readonly fenBefore: string;
  readonly fenAfter: string;
  readonly capture?: AppliedCapture;
  readonly promotion?: AppliedPromotion;
  readonly castle?: AppliedCastle;
}

export interface PieceSeed {
  readonly side: Side;
  readonly role: Role;
  readonly square: Square;
}

/** Mints the identity of a piece read off a starting position. */
export type PieceIdFactory = (seed: PieceSeed) => PieceId;
