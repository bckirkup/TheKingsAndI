import { clampPermille, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import { scalePositiveTrustGain } from './bitterness';
import type { PieceState } from './types';

/** D207: the unearned lift toward the dawn baseline at a match boundary. */
export function applyMorningLift(
  piece: PieceState,
  reliefCount = 0,
): PieceState {
  const permille = clampPermille(ENGINE_CONFIG.MORNING_LIFT_PERMILLE);
  const reliefLift = Math.min(
    clampPermille(ENGINE_CONFIG.RELIEF_LIFT_CAP_PERMILLE),
    Math.max(0, Math.trunc(reliefCount)) *
      clampPermille(ENGINE_CONFIG.RELIEF_LIFT_PERMILLE_PER_EVENT),
  );
  const effectivePermille = Math.min(1_000, permille + reliefLift);
  const baseline = clampTrust(ENGINE_CONFIG.MORNING_LIFT_TRUST_BASELINE);
  if (effectivePermille === 0 || piece.T_i >= baseline) return piece;
  const liftedTrust = clampTrust(
    piece.T_i + Math.trunc(((baseline - piece.T_i) * effectivePermille) / 1000),
  );
  return {
    ...piece,
    T_i: scalePositiveTrustGain(
      piece.T_i,
      liftedTrust,
      piece.bitternessPermille ?? 0,
    ),
  };
}
