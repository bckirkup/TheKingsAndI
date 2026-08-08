import { quantizeBoardValue } from '../core/math';
import { clampMorale, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import type { DesertionContext, PieceState } from './types';

export function calculatePain(piece: PieceState): number {
  return (
    ENGINE_CONFIG.DESERTION_PAIN_BASE +
    piece.B_i * ENGINE_CONFIG.DESERTION_PAIN_TRAUMA_SCALE
  );
}

export function calculateLambda(
  piece: PieceState,
  activePeers: readonly PieceState[],
): number {
  const trustTerm =
    ((piece.T_i + 100) / 200) * ENGINE_CONFIG.DESERTION_LAMBDA_TRUST_SCALE;
  const moraleTerm =
    (piece.M_i / 100) * ENGINE_CONFIG.DESERTION_LAMBDA_MORALE_SCALE;
  const loyaltyTerm =
    piece.traits.w_loyalty * ENGINE_CONFIG.DESERTION_LAMBDA_LOYALTY_SCALE;
  let affinitySum = 0;
  for (const peer of activePeers) {
    if (peer.id === piece.id) continue;
    affinitySum += piece.dyadicAffinity[peer.id] ?? 0;
  }
  const affinityTerm =
    (Math.max(-100, Math.min(100, affinitySum)) / 100) *
    ENGINE_CONFIG.DESERTION_LAMBDA_AFFINITY_SCALE;
  return trustTerm + moraleTerm + loyaltyTerm + affinityTerm;
}

export function calculateUStay(
  piece: PieceState,
  context: DesertionContext,
  lambda: number,
): number {
  const pain = calculatePain(piece);
  const collectiveStake =
    context.P_lossIfStay * lambda * ENGINE_CONFIG.DESERTION_COLLECTIVE_STAKE;
  const stayCost = -context.P_captured * pain - collectiveStake;
  return quantizeBoardValue(stayCost) / 1_000;
}

export function calculateUDesert(
  context: DesertionContext,
  lambda: number,
): number {
  const desertCost =
    -context.P_lossIfLeave *
    lambda *
    ENGINE_CONFIG.DESERTION_COLLECTIVE_STAKE *
    ENGINE_CONFIG.DESERTION_RESIDUAL_STAKE;
  return quantizeBoardValue(desertCost) / 1_000;
}

export function shouldDesert(
  piece: PieceState,
  context: DesertionContext,
  activePeers: readonly PieceState[],
): {
  readonly desert: boolean;
  readonly uStay: number;
  readonly uDesert: number;
} {
  const lambda = calculateLambda(piece, activePeers);
  const uStay = calculateUStay(piece, context, lambda);
  const uDesert = calculateUDesert(context, lambda);
  const desert =
    uDesert > uStay + ENGINE_CONFIG.DESERTION_HYSTERESIS &&
    piece.role !== 'King';
  return { desert, uStay, uDesert };
}

export function isKingExempt(role: PieceState['role']): boolean {
  return role === 'King';
}

export function raiseLossEstimatesAfterDesertion(
  roster: readonly PieceState[],
  departedId: string,
): PieceState[] {
  return roster.map((piece) => {
    if (piece.id === departedId) return piece;
    const bump = Math.min(150, Math.trunc(piece.rumor.pLossTeam * 0.1) + 50);
    return {
      ...piece,
      rumor: {
        ...piece.rumor,
        pLossTeam: Math.min(1_000, piece.rumor.pLossTeam + bump),
      },
      M_i: clampMorale(piece.M_i - 5),
      T_i: clampTrust(piece.T_i - 3),
    };
  });
}
