import { clampTrauma } from './clamp';
import { ENGINE_CONFIG } from './config';
import type { PieceState } from './types';

export interface DreadExposure {
  readonly risk: number;
  readonly streak: number;
}

export function applyCaptureInjury(piece: PieceState): PieceState {
  return {
    ...piece,
    B_i: clampTrauma(piece.B_i + ENGINE_CONFIG.CAPTURE_TRAUMA_GAIN),
  };
}

export function applySustainedDread(
  piece: PieceState,
  previous: DreadExposure | undefined,
  currentRisk: number,
): {
  readonly piece: PieceState;
  readonly exposure: DreadExposure;
  readonly injured: boolean;
} {
  const threshold = ENGINE_CONFIG.DREAD_CAPTURE_RISK_THRESHOLD;
  const serious = currentRisk >= threshold;
  const sustained =
    serious && previous !== undefined && previous.risk >= threshold;
  let streak = 0;
  if (serious) {
    if (sustained) streak = previous.streak + 1;
    else streak = 1;
  }
  const required = Math.max(2, Math.trunc(ENGINE_CONFIG.DREAD_REQUIRED_PLIES));
  const injured = streak >= required && (previous?.streak ?? 0) < required;
  return {
    piece: injured
      ? {
          ...piece,
          B_i: clampTrauma(piece.B_i + ENGINE_CONFIG.DREAD_TRAUMA_GAIN),
        }
      : piece,
    exposure: { risk: currentRisk, streak },
    injured,
  };
}
