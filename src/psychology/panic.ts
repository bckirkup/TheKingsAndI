import type { PieceId } from '../chess';
import { ENGINE_CONFIG } from './config';
import type { MatchEvent } from './types';
import type { PieceState } from './types';

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function panicOnsetForPly(
  input: {
    readonly ply: number;
    readonly side: 'w' | 'b';
    /** P_captured (0..1) per fielded piece of the moving side, post-move. */
    readonly captureRiskByPiece: Readonly<Record<PieceId, number>>;
    readonly kingDanger: boolean;
  },
  rosterFloor: number = ENGINE_CONFIG.PANIC_ROSTER_FLOOR,
  riskPermille: number = ENGINE_CONFIG.PANIC_CAPTURE_RISK_PERMILLE,
): Extract<MatchEvent, { t: 'PANIC_ONSET' }> | undefined {
  const floor = Math.trunc(rosterFloor);
  if (floor <= 0) return undefined;
  const risk = clamp(Math.trunc(riskPermille), 1, 1_000);
  const dreading = Object.keys(input.captureRiskByPiece)
    .filter((pieceId) => {
      const captureRisk = input.captureRiskByPiece[pieceId] ?? 0;
      return Math.trunc(captureRisk * 1_000) >= risk;
    })
    .sort((left, right) => left.localeCompare(right));
  const trigger =
    dreading.length >= floor
      ? 'dread'
      : input.kingDanger
        ? 'king_danger'
        : undefined;
  if (trigger === undefined) return undefined;
  return {
    t: 'PANIC_ONSET',
    ply: input.ply,
    side: input.side,
    trigger,
    dreading,
    fielded: Object.keys(input.captureRiskByPiece).length,
  };
}

export function applyPanicCollapse(
  roster: readonly PieceState[],
  collapsePermille: number = ENGINE_CONFIG.PANIC_COLLAPSE_PERMILLE,
): PieceState[] {
  const collapse = Math.max(0, Math.min(1_000, Math.trunc(collapsePermille)));
  if (collapse === 0) return [...roster];
  return roster.map((piece) => ({ ...piece, panicPermille: collapse }));
}

export function decayPanic(
  roster: readonly PieceState[],
  decayPermille: number = ENGINE_CONFIG.PANIC_DECAY_PERMILLE_PER_PLY,
): PieceState[] {
  const decay = Math.max(0, Math.min(1_000, Math.trunc(decayPermille)));
  if (decay === 0) return [...roster];
  return roster.map((piece) => {
    if (piece.panicPermille === undefined) return piece;
    const panic = Math.max(0, piece.panicPermille - decay);
    return panic === 0
      ? withoutPanic(piece)
      : { ...piece, panicPermille: panic };
  });
}

export function withoutPanic(piece: PieceState): PieceState {
  const { panicPermille, ...cleared } = piece;
  void panicPermille;
  return cleared;
}
