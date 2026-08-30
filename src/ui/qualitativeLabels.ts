import type { PieceRole } from '../psychology';
export {
  heatBandWord,
  judgementGapWord,
  moraleBandWord,
  objectionStrengthWord,
  sightBandWord,
  traumaBandWord,
  trustBandWord,
  trustChangeWord,
} from '../core/qualitativeBands';
import {
  moraleBandWord,
  traumaBandWord,
  trustBandWord,
  trustChangeWord,
} from '../core/qualitativeBands';
export type {
  HeatBandWord,
  JudgementGapWord,
  MoraleBandWord,
  ObjectionStrengthWord,
  SightBandWord,
  TraumaBandWord,
  TrustBandWord,
  TrustChangeWord,
} from '../core/qualitativeBands';

export function pieceSubject(name: string | undefined, role: string): string {
  return name ?? role;
}

export function witnessCostWord(delta: number): string {
  return `Each witness experiences ${trustChangeWord(delta)} trust`;
}

export function pieceAccessibleLabel(
  name: string | undefined,
  role: PieceRole,
  trust: number,
  morale: number,
): string {
  const subject = name === undefined ? role : `${name}, ${role}`;
  return `${subject}, ${trustBandWord(trust)} trust, ${moraleBandWord(morale)} morale`;
}

export function moraleTooltip(morale: number): string {
  return `Morale is ${moraleBandWord(morale)}`;
}

export function traumaTooltip(trauma: number): string {
  return `Trauma is ${traumaBandWord(trauma)}`;
}

export function rosterPieceLabel(
  name: string,
  role: string,
  trust: number,
  status: string,
): string {
  return `${name} · ${role} · ${trustBandWord(trust)} trust · ${status}`;
}

export function freeAgentRecruitLabel(
  name: string,
  role: string,
  trust: number,
): string {
  return `Recruit ${name} — ${role} (${trustBandWord(trust)} trust)`;
}

export function firePreviewLabel(newTrust: number): string {
  return `Fire: trust becomes ${trustBandWord(newTrust)}`;
}

export function promotionAttainmentLabel(
  attainedRole: string | undefined,
): string | null {
  return attainedRole === undefined
    ? null
    : `Attained ${attainedRole.toLowerCase()} through promotion`;
}
