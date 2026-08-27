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

export function applyRegardSignal(
  credence: CredenceState,
  streakLength: number,
): CredenceState {
  if (Math.trunc(streakLength) < ENGINE_CONFIG.BENEV_REGARD_STREAK_PLIES) {
    return credence;
  }
  return {
    ...credence,
    tauBenev: clampCredence(
      credence.tauBenev + ENGINE_CONFIG.BENEV_REGARD_STEP,
    ),
  };
}

export function isRegardEligible(
  capturedRisk: number,
  boardDelta: number,
): boolean {
  return (
    capturedRisk <= ENGINE_CONFIG.BENEV_REGARD_RISK_CEILING && boardDelta >= 0
  );
}

export function applyRepairSignal(credence: CredenceState): {
  readonly credence: CredenceState;
  readonly repaid: number;
} {
  const debt = clampCredence(credence.ruptureDebt);
  const repaid = Math.min(
    debt,
    Math.max(0, Math.trunc(ENGINE_CONFIG.BENEV_REPAIR_STEP)),
  );
  if (repaid === 0) {
    return {
      credence: { ...credence, ruptureDebt: debt },
      repaid,
    };
  }
  return {
    credence: {
      ...credence,
      tauBenev: clampCredence(credence.tauBenev + repaid),
      ruptureDebt: debt - repaid,
    },
    repaid,
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
    ruptureDebt: clampCredence(credence.ruptureDebt + drop),
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

export function applyAuthorityGain(
  credence: CredenceState,
  gain: number,
): CredenceState {
  return {
    ...credence,
    tauAbil: clampCredence(credence.tauAbil + Math.max(0, Math.trunc(gain))),
  };
}

export function applyAbilityDrip(
  credence: CredenceState,
  gain: number,
  curvature: number = ENGINE_CONFIG.ABIL_DRIP_CURVATURE,
): CredenceState {
  const adjustedGain = calculateCurvedAbilityGain(
    gain,
    credence.tauAbil,
    curvature,
  );
  if (adjustedGain === 0) return credence;
  return {
    ...credence,
    tauAbil: clampCredence(credence.tauAbil + adjustedGain),
  };
}

function calculateCurvedAbilityGain(
  rawGain: number,
  tauAbil: number,
  curvature: number,
): number {
  const gain = Math.max(0, Math.trunc(rawGain));
  if (gain === 0) return 0;
  const tau = clampCredence(tauAbil);
  const strength = Math.max(0, Math.trunc(curvature));
  const denominator = 100 * (strength + 1);
  const gainNumerator = 100 + strength * (100 - tau);
  return Math.max(1, Math.trunc((gain * gainNumerator) / denominator));
}

export function applyAbilityObservation(
  credence: CredenceState,
  vindicated: boolean,
): CredenceState {
  const observationCount = Math.max(
    0,
    Math.trunc(credence.abilityObservationCount),
  );
  const n = Math.max(1, observationCount + ENGINE_CONFIG.ABIL_PRIOR_STRENGTH);
  const baseStep = Math.max(
    1,
    Math.trunc(ENGINE_CONFIG.ABIL_BAYES_NUMERATOR / n),
  );
  const tau = clampCredence(credence.tauAbil);
  const curvature = Math.max(
    0,
    Math.trunc(ENGINE_CONFIG.ABIL_VINDICATION_CURVATURE),
  );
  const gainStep = calculateCurvedAbilityGain(baseStep, tau, curvature);
  const lossStep = Math.max(
    1,
    Math.trunc((baseStep * (100 + curvature * tau)) / 100),
  );
  const lossMultiplier = Math.max(
    1,
    Math.trunc(ENGINE_CONFIG.ABIL_VINDICATION_LOSS_MULTIPLIER),
  );
  const delta = vindicated ? gainStep : -lossStep * lossMultiplier;
  return {
    ...credence,
    tauAbil: clampCredence(credence.tauAbil + delta),
    abilityObservationCount: observationCount + 1,
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
