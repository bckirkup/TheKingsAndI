import type { PieceRole } from '../psychology';

export type TrustBandWord = 'hostile' | 'wary' | 'loyal';
export type MoraleBandWord = 'low' | 'steady' | 'strong';
export type TraumaBandWord = 'clear' | 'strained' | 'wounded';
export type TrustChangeWord =
  | 'deeply damaging'
  | 'damaging'
  | 'unchanged'
  | 'restoring'
  | 'strongly restoring';
export type HeatBandWord = 'cold' | 'neutral' | 'warm';

export function trustBandWord(trust: number): TrustBandWord {
  if (trust < 0) return 'hostile';
  if (trust < 40) return 'wary';
  return 'loyal';
}

export function moraleBandWord(morale: number): MoraleBandWord {
  if (morale < 40) return 'low';
  if (morale < 70) return 'steady';
  return 'strong';
}

export function traumaBandWord(trauma: number): TraumaBandWord {
  if (trauma < 20) return 'clear';
  if (trauma < 60) return 'strained';
  return 'wounded';
}

export function trustChangeWord(delta: number): TrustChangeWord {
  if (delta <= -50) return 'deeply damaging';
  if (delta < 0) return 'damaging';
  if (delta === 0) return 'unchanged';
  if (delta <= 50) return 'restoring';
  return 'strongly restoring';
}

export function heatBandWord(value: number): HeatBandWord {
  if (value <= -20) return 'cold';
  if (value >= 20) return 'warm';
  return 'neutral';
}

export function pieceAccessibleLabel(
  name: string,
  role: PieceRole,
  trust: number,
  morale: number,
): string {
  return `${name}, ${role}, ${trustBandWord(trust)} trust, ${moraleBandWord(morale)} morale`;
}

export function moraleTooltip(morale: number): string {
  return `Morale is ${moraleBandWord(morale)}`;
}

export function traumaTooltip(trauma: number): string {
  return `Trauma is ${traumaBandWord(trauma)}`;
}
