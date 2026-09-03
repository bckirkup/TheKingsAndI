import {
  clampAffinity,
  clampCredence,
  clampMorale,
  clampPermille,
  clampRuptureDebt,
  clampTrauma,
  clampTrust,
} from './clamp';
import { ENGINE_CONFIG } from './config';
import type { CredenceState, PieceRole, PieceState, RumorState } from './types';

export function defaultCredence(): CredenceState {
  return {
    tauBenev: 50,
    tauAbil: 50,
    ruptureDebt: 0,
    abilityObservationCount: 0,
  };
}

export function defaultRumor(): RumorState {
  return { pLossTeam: 100, leaderAppraisal: 0 };
}

export function normalizePieceState(piece: PieceState): PieceState {
  const classPrestige = {
    Pawn: clampAffinity(piece.classPrestige.Pawn),
    Knight: clampAffinity(piece.classPrestige.Knight),
    Bishop: clampAffinity(piece.classPrestige.Bishop),
    Rook: clampAffinity(piece.classPrestige.Rook),
    Queen: clampAffinity(piece.classPrestige.Queen),
    King: clampAffinity(piece.classPrestige.King),
  };
  const dyadicAffinity: Record<string, number> = {};
  for (const [peerId, value] of Object.entries(piece.dyadicAffinity)) {
    dyadicAffinity[peerId] = clampAffinity(value);
  }
  return {
    ...piece,
    cash: Math.max(0, Math.trunc(piece.cash ?? 0)),
    E_i: Math.max(1, Math.min(100, piece.E_i)),
    T_i: clampTrust(piece.T_i),
    M_i: clampMorale(piece.M_i),
    B_i: clampTrauma(piece.B_i),
    engagementFactor: Math.max(0.1, Math.min(1, piece.engagementFactor)),
    credence: {
      tauBenev: clampCredence(piece.credence.tauBenev),
      tauAbil: clampCredence(piece.credence.tauAbil),
      ruptureDebt: clampRuptureDebt(piece.credence.ruptureDebt),
      abilityObservationCount: Math.max(
        0,
        Math.trunc(piece.credence.abilityObservationCount ?? 0),
      ),
    },
    rumor: {
      pLossTeam: clampPermille(piece.rumor.pLossTeam),
      leaderAppraisal: clampTrust(piece.rumor.leaderAppraisal),
    },
    classPrestige,
    dyadicAffinity,
  };
}

export function startingAbilityForRole(role: PieceRole): number {
  switch (role) {
    case 'Pawn':
      return 20;
    case 'King':
      return 80;
    case 'Knight':
    case 'Bishop':
    case 'Rook':
    case 'Queen':
      return 55;
  }
}

/**
 * Apply one demonstrated judgment to a piece's earnable ability.
 *
 * The integer-rational curve is deliberately asymmetric: gains diminish near
 * the ceiling while losses grow with the current level and are multiplied.
 */
export function applyEarnedAbilityObservation(
  ability: number,
  wasRight: boolean,
  stepScale: number = ENGINE_CONFIG.ABIL_EARNED_STEP_SCALE,
  curvature: number = ENGINE_CONFIG.ABIL_EARNED_CURVATURE,
  lossMultiplier: number = ENGINE_CONFIG.ABIL_EARNED_LOSS_MULTIPLIER,
  gainMultiplier = 1,
): number {
  const current = Math.max(1, Math.min(100, Math.trunc(ability)));
  const scale = Math.max(0, Math.trunc(stepScale));
  if (scale === 0) return current;
  const strength = Math.max(0, Math.trunc(curvature));
  const multiplier = Math.max(1, Math.trunc(lossMultiplier));
  const heededMultiplier = Math.max(1, Math.trunc(gainMultiplier));
  const denominator = 100 * (strength + 1);
  const gainStep = Math.max(
    1,
    Math.trunc(
      (scale * heededMultiplier * (100 + strength * (100 - current))) /
        denominator,
    ),
  );
  const lossStep =
    Math.max(1, Math.trunc((scale * (100 + strength * current)) / 100)) *
    multiplier;
  const delta = wasRight ? gainStep : -lossStep;
  return Math.max(1, Math.min(100, current + delta));
}

export function updatePieceInRoster(
  roster: readonly PieceState[],
  pieceId: string,
  updater: (piece: PieceState) => PieceState,
): PieceState[] {
  return roster.map((piece) =>
    piece.id === pieceId
      ? normalizePieceState(updater(piece))
      : normalizePieceState(piece),
  );
}

export function removePieceFromRoster(
  roster: readonly PieceState[],
  pieceId: string,
): PieceState[] {
  return roster.filter((piece) => piece.id !== pieceId);
}
