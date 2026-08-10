import { quantizeBoardValue } from '../core/math';
import { clampMorale, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import type {
  DesertionContext,
  DesertionDecisionTerms,
  PieceState,
} from './types';

const STANDARD_ROSTER_SIZE = 16;

export function calculatePain(piece: PieceState): number {
  return (
    ENGINE_CONFIG.DESERTION_PAIN_BASE +
    piece.B_i * ENGINE_CONFIG.DESERTION_PAIN_TRAUMA_SCALE
  );
}

export interface LambdaComponents {
  readonly trust: number;
  readonly morale: number;
  readonly loyalty: number;
  readonly affinity: number;
  readonly total: number;
}

export function calculateLambdaComponents(
  piece: PieceState,
  activePeers: readonly PieceState[],
): LambdaComponents {
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
  return {
    trust: trustTerm,
    morale: moraleTerm,
    loyalty: loyaltyTerm,
    affinity: affinityTerm,
    total: trustTerm + moraleTerm + loyaltyTerm + affinityTerm,
  };
}

export function calculateLambda(
  piece: PieceState,
  activePeers: readonly PieceState[],
): number {
  return calculateLambdaComponents(piece, activePeers).total;
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
  piece: PieceState,
  context: DesertionContext,
  lambda: number,
  activePeers: readonly PieceState[],
): number {
  const standing = calculateStandingCostComponents(piece, activePeers);
  const residualCost =
    -context.P_lossIfLeave *
    lambda *
    ENGINE_CONFIG.DESERTION_COLLECTIVE_STAKE *
    ENGINE_CONFIG.DESERTION_RESIDUAL_STAKE;
  const quantizedResidualCost = quantizeBoardValue(residualCost);
  const quantizedStandingCost = quantizeBoardValue(
    -standing.anticipatedStandingCost,
  );
  return (quantizedResidualCost + quantizedStandingCost) / 1_000;
}

function calculateStandingCostComponents(
  piece: PieceState,
  activePeers: readonly PieceState[],
): {
  readonly anticipatedStandingCost: number;
  readonly gloryWeight: number;
} {
  let standing = 0;
  for (const peer of activePeers) {
    if (peer.id === piece.id) continue;
    const affinity = peer.dyadicAffinity[piece.id] ?? 0;
    const prestige = peer.classPrestige[piece.role] ?? 0;
    standing += Math.max(0, (affinity + prestige) / 200);
  }
  const audienceStanding = standing / Math.max(1, STANDARD_ROSTER_SIZE - 1);
  const gloryWeight = (piece.traits.w_ambition + piece.traits.w_prestige) / 2;
  const anticipatedStandingCost =
    audienceStanding * gloryWeight * ENGINE_CONFIG.DESERTION_STANDING_STAKE;
  return {
    anticipatedStandingCost,
    gloryWeight,
  };
}

export function shouldDesert(
  piece: PieceState,
  context: DesertionContext,
  activePeers: readonly PieceState[],
): {
  readonly desert: boolean;
  readonly uStay: number;
  readonly uDesert: number;
  readonly terms: DesertionDecisionTerms;
} {
  const lambdaComponents = calculateLambdaComponents(piece, activePeers);
  const lambda = lambdaComponents.total;
  const uStay = calculateUStay(piece, context, lambda);
  const uDesert = calculateUDesert(piece, context, lambda, activePeers);
  const standing = calculateStandingCostComponents(piece, activePeers);
  const desert =
    uDesert > uStay + ENGINE_CONFIG.DESERTION_HYSTERESIS &&
    piece.role !== 'King';
  return {
    desert,
    uStay,
    uDesert,
    terms: {
      P_captured: context.P_captured,
      pain: calculatePain(piece),
      P_lossIfStay: context.P_lossIfStay,
      P_lossIfLeave: context.P_lossIfLeave,
      lambda,
      lambdaTrust: lambdaComponents.trust,
      lambdaMorale: lambdaComponents.morale,
      lambdaLoyalty: lambdaComponents.loyalty,
      lambdaAffinity: lambdaComponents.affinity,
      standingCost:
        quantizeBoardValue(standing.anticipatedStandingCost) / 1_000,
      gloryWeight: standing.gloryWeight,
      tauBenev: piece.credence.tauBenev,
      tauAbil: piece.credence.tauAbil,
    },
  };
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
