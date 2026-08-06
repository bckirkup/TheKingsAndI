import { clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import type { CostlySignalKind, MatchEvent, PieceState } from './types';

export function applyMatchOutcomeTrust(
  roster: readonly PieceState[],
  winScore: number,
): PieceState[] {
  const lossFactor = 1 - winScore / 100;
  const delta = -Math.trunc(
    ENGINE_CONFIG.OUTCOME_TRUST_LOSS_SCALE * lossFactor,
  );
  if (delta === 0) return [...roster];
  return roster.map((piece) => ({
    ...piece,
    T_i: clampTrust(piece.T_i + delta),
  }));
}

export function costlySignalCredit(kind: CostlySignalKind): number {
  switch (kind) {
    case 'king_endangerment':
      return ENGINE_CONFIG.COSTLY_SIGNAL_KING_DANGER;
    case 'declined_sacrifice':
      return ENGINE_CONFIG.COSTLY_SIGNAL_DECLINED_SACRIFICE;
    case 'retained_piece':
      return ENGINE_CONFIG.COSTLY_SIGNAL_RETAINED_PIECE;
    case 'avenged_capture':
      return ENGINE_CONFIG.COSTLY_SIGNAL_AVENGED_CAPTURE;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function applyCostlySignal(
  piece: PieceState,
  kind: CostlySignalKind,
  ply: number,
): { readonly piece: PieceState; readonly event: MatchEvent } {
  const credit = costlySignalCredit(kind);
  return {
    piece: { ...piece, T_i: clampTrust(piece.T_i + credit) },
    event: {
      t: 'COSTLY_SIGNAL',
      ply,
      pieceId: piece.id,
      kind,
      trustCredit: credit,
    },
  };
}
