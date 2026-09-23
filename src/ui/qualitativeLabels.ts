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
import { trustBandWord, trustChangeWord } from '../core/qualitativeBands';
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
import type {
  MoraleBandWord,
  TraumaBandWord,
  TrustBandWord,
} from '../core/qualitativeBands';

export function pieceSubject(name: string | undefined, role: string): string {
  return name ?? role;
}

export function witnessCostWord(delta: number): string {
  return `Each witness experiences ${trustChangeWord(delta)} trust`;
}

export function pieceAccessibleLabel(
  name: string | undefined,
  role: string,
  trust: TrustBandWord,
  morale: MoraleBandWord,
): string {
  const subject = name === undefined ? role : `${name}, ${role}`;
  return `${subject}, ${trust} trust, ${morale} morale`;
}

export function moraleTooltip(morale: MoraleBandWord): string {
  return `Morale is ${morale}`;
}

export function traumaTooltip(trauma: TraumaBandWord): string {
  return `Trauma is ${trauma}`;
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
