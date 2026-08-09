import { logistic, quantizeBoardValue } from '../core/math';
import { clampCredence } from './clamp';
import { ENGINE_CONFIG } from './config';
import type { CredenceState } from './types';

const REFUSAL_AUTHORITY_OBVIOUSNESS_RANGE = 2.5;

/** Blend the piece's own view with inferred leader judgment (ADR 0015). */
export function calculatePerceivedValue(
  vOwn: number,
  vLeaderImplied: number,
  tauAbil: number,
): number {
  const weight = clampCredence(tauAbil) / 100;
  const perceived = (1 - weight) * vOwn + weight * vLeaderImplied;
  return quantizeBoardValue(perceived) / 1_000;
}

export function calculateFaithGap(
  vOwn: number,
  vLeaderImplied: number,
): number {
  return quantizeBoardValue(vLeaderImplied - vOwn) / 1_000;
}

export function applyHeardSignal(
  credence: CredenceState,
  surrenderedRealValue: boolean,
): CredenceState {
  if (!surrenderedRealValue) return credence;
  return {
    ...credence,
    tauBenev: clampCredence(credence.tauBenev + ENGINE_CONFIG.BENEV_HEARD_STEP),
  };
}

export function applyBetrayalSignal(
  credence: CredenceState,
  severity: number,
): CredenceState {
  const cliff = logistic(severity * ENGINE_CONFIG.BENEV_BETRAYAL_CLIFF_SCALE);
  const drop = Math.trunc(cliff * ENGINE_CONFIG.BENEV_BETRAYAL_CLIFF_DROP);
  return {
    ...credence,
    tauBenev: clampCredence(credence.tauBenev - drop),
  };
}

export function applyNeglectSignal(credence: CredenceState): CredenceState {
  return {
    ...credence,
    tauBenev: clampCredence(
      credence.tauBenev - ENGINE_CONFIG.BENEV_NEGLECT_EROSION,
    ),
  };
}

export function justifiedRefusalAuthorityLoss(
  actorView: number,
  justified: boolean,
): number {
  const obviousness = justifiedRefusalObviousness(actorView, justified);
  return Math.trunc(obviousness * ENGINE_CONFIG.REFUSAL_AUTHORITY_LOSS_SCALE);
}

export function justifiedRefusalObviousness(
  actorView: number,
  justified: boolean,
): number {
  if (!justified || actorView >= 0) return 0;
  return Math.min(1, -actorView / REFUSAL_AUTHORITY_OBVIOUSNESS_RANGE);
}

export function applyAuthorityLoss(
  credence: CredenceState,
  loss: number,
): CredenceState {
  return {
    ...credence,
    tauAbil: clampCredence(credence.tauAbil - Math.max(0, Math.trunc(loss))),
  };
}

export function applyAbilityObservation(
  credence: CredenceState,
  vindicated: boolean,
  observationCount: number,
): CredenceState {
  const n = Math.max(1, observationCount);
  const step = Math.trunc(ENGINE_CONFIG.ABIL_BAYES_NUMERATOR / n);
  const delta = vindicated ? step : -step;
  return {
    ...credence,
    tauAbil: clampCredence(credence.tauAbil + delta),
  };
}

export function isExpendableRefusal(
  vOwn: number,
  gap: number,
  tauBenev: number,
): boolean {
  return (
    clampCredence(tauBenev) < ENGINE_CONFIG.BENEV_EXPENDABLE_FLOOR &&
    gap >= ENGINE_CONFIG.BENEV_EXPENDABLE_GAP &&
    vOwn < 0
  );
}
