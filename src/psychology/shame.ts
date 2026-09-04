import type { PieceId } from '../chess';
import { clampPermille, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import { witnessAttachmentPermille } from './standing';
import type { PieceState } from './types';

export interface ShameOptions {
  readonly perWitnessPermille?: number;
  readonly standingPermille?: number;
  readonly capPermille?: number;
}

export interface ShameExposure {
  readonly ply: number;
  readonly pieceId: PieceId;
  readonly witnesses: number;
  readonly shamePermille: number;
}

export function calculateShamePermille(
  piece: PieceState,
  witnesses: readonly PieceState[],
  options: ShameOptions = {},
): number {
  const perWitness = Math.max(
    0,
    Math.trunc(
      options.perWitnessPermille ?? ENGINE_CONFIG.SHAME_PER_WITNESS_PERMILLE,
    ),
  );
  const standingScale = Math.max(
    0,
    Math.trunc(
      options.standingPermille ?? ENGINE_CONFIG.SHAME_STANDING_PERMILLE,
    ),
  );
  const cap = clampPermille(
    options.capPermille ?? ENGINE_CONFIG.SHAME_CAP_PERMILLE,
  );
  const sumWitnessStanding = witnesses.reduce(
    (sum, witness) => sum + witnessAttachmentPermille(witness, piece),
    0,
  );
  return Math.min(
    cap,
    witnesses.length * perWitness +
      Math.trunc((sumWitnessStanding * standingScale) / 1_000),
  );
}

export function scaleOwnLoss(
  current: number,
  next: number,
  shamePermille: number,
): number {
  const loss = Math.min(0, Math.trunc(next) - Math.trunc(current));
  if (loss === 0) return Math.trunc(current);
  const scale = 1_000 + clampPermille(shamePermille);
  return clampTrust(Math.trunc(current) + Math.trunc((loss * scale) / 1_000));
}
