import { clampPermille, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import type { PieceState } from './types';

/** D207: the unearned lift toward the dawn baseline at a match boundary. */
export function applyMorningLift(piece: PieceState): PieceState {
  const permille = clampPermille(ENGINE_CONFIG.MORNING_LIFT_PERMILLE);
  const baseline = clampTrust(ENGINE_CONFIG.MORNING_LIFT_TRUST_BASELINE);
  if (permille === 0 || piece.T_i >= baseline) return piece;
  return {
    ...piece,
    T_i: clampTrust(
      piece.T_i + Math.trunc(((baseline - piece.T_i) * permille) / 1000),
    ),
  };
}
