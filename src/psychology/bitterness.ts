import { clampPermille, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import type { MatchEvent, PieceState } from './types';

export type BitternessTrigger = 'rupture_floor' | 'not_ransomed';

export interface BitternessFormation {
  readonly piece: PieceState;
  readonly event: Extract<MatchEvent, { t: 'BITTERNESS_FORMED' }> | undefined;
}

export function bitternessPermille(piece: PieceState): number {
  return clampPermille(piece.bitternessPermille ?? 0);
}

export function discountPositiveGain(
  gain: number,
  bitterness: number,
  discount: number,
): number {
  const boundedGain = Math.max(0, Math.trunc(gain));
  if (boundedGain === 0) return 0;
  const effectiveBitterness = clampPermille(bitterness);
  const effectiveDiscount = clampPermille(discount);
  const multiplier = Math.max(
    0,
    1_000_000 - effectiveBitterness * effectiveDiscount,
  );
  return Math.trunc((boundedGain * multiplier) / 1_000_000);
}

export function scalePositiveTrustGain(
  current: number,
  next: number,
  bitterness: number,
): number {
  const baseline = clampTrust(current);
  const rawGain = Math.max(0, clampTrust(next) - baseline);
  const gain = discountPositiveGain(
    rawGain,
    bitterness,
    ENGINE_CONFIG.BITTERNESS_MORNING_DISCOUNT_PERMILLE,
  );
  return clampTrust(baseline + gain);
}

export function formBitterness(
  piece: PieceState,
  trigger: BitternessTrigger,
  point: { readonly ply?: number; readonly week?: number },
): BitternessFormation {
  const amount = clampPermille(ENGINE_CONFIG.BITTERNESS_PER_TRIGGER_PERMILLE);
  if (amount === 0) return { piece, event: undefined };
  const before = bitternessPermille(piece);
  const after = clampPermille(before + amount);
  if (after === before) return { piece, event: undefined };
  const next = { ...piece, bitternessPermille: after };
  return {
    piece: next,
    event: {
      t: 'BITTERNESS_FORMED',
      pieceId: piece.id,
      trigger,
      bitternessPermille: after,
      ...(point.ply === undefined ? {} : { ply: Math.trunc(point.ply) }),
      ...(point.week === undefined ? {} : { week: Math.trunc(point.week) }),
    },
  };
}

export function shouldFormRuptureBitterness(piece: PieceState): boolean {
  const threshold = Math.max(
    0,
    Math.trunc(ENGINE_CONFIG.BITTERNESS_RUPTURE_THRESHOLD_PERMILLE),
  );
  const ceiling = Math.max(
    1,
    Math.trunc(ENGINE_CONFIG.BENEV_RUPTURE_DEBT_CEILING),
  );
  return (
    piece.credence.tauBenev <= 0 &&
    piece.credence.ruptureDebt >=
      Math.trunc((ceiling * Math.min(1_000, threshold)) / 1_000)
  );
}

export function decayBitterness(piece: PieceState): PieceState {
  const before = bitternessPermille(piece);
  const decay = clampPermille(
    ENGINE_CONFIG.BITTERNESS_DECAY_PERMILLE_PER_MATCH,
  );
  const after = Math.max(0, before - decay);
  if (after === before) return piece;
  return { ...piece, bitternessPermille: after };
}
