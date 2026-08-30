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
export type JudgementGapWord =
  | 'the same reading'
  | 'a doubtful reading'
  | 'a wholly different reading';
export type ObjectionStrengthWord =
  | 'barely beyond the limit'
  | 'clearly beyond the limit'
  | 'unthinkable to the piece';
export type SightBandWord = 'short sight' | 'working sight' | 'far sight';

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

export function judgementGapWord(gap: number): JudgementGapWord {
  const distance = Math.abs(gap);
  if (distance <= 0.5) return 'the same reading';
  if (distance <= 1.5) return 'a doubtful reading';
  return 'a wholly different reading';
}

export function objectionStrengthWord(distance: number): ObjectionStrengthWord {
  if (distance <= 0.5) return 'barely beyond the limit';
  if (distance <= 2) return 'clearly beyond the limit';
  return 'unthinkable to the piece';
}

export function sightBandWord(depth: number): SightBandWord {
  if (depth <= 5) return 'short sight';
  if (depth <= 10) return 'working sight';
  return 'far sight';
}
