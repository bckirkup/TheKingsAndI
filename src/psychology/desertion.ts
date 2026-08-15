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

export function calculateShadowFactor(pLossIfStay: number): number {
  const lossPermille = Math.max(
    0,
    Math.min(1_000, Math.trunc(pLossIfStay * 1_000)),
  );
  const shadowScale = Math.max(
    0,
    Math.min(1_000, ENGINE_CONFIG.DESERTION_SHADOW_SCALE_PERMILLE),
  );
  return 1 - Math.trunc((lossPermille * shadowScale) / 1_000) / 1_000;
}

export function calculatePivotalityPermille(
  piece: PieceState,
  activePeers: readonly PieceState[],
): number {
  const weights = ENGINE_CONFIG.DESERTION_ROLE_FORCE_WEIGHTS;
  const pieceWeight = piece.role === 'King' ? 0 : weights[piece.role];
  let totalWeight = 0;
  for (const peer of activePeers) {
    if (peer.role !== 'King') totalWeight += weights[peer.role];
  }
  if (pieceWeight === 0 || totalWeight === 0) return 0;
  return Math.trunc((pieceWeight * 1_000) / totalWeight);
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

export function calculateAttachmentPermille(
  piece: PieceState,
  activePeers: readonly PieceState[],
): number {
  const floorPermille = Math.max(
    1,
    Math.min(1_000, Math.trunc(ENGINE_CONFIG.DESERTION_RESIDUAL_STAKE * 1_000)),
  );
  const loyaltyPermille = Math.max(
    0,
    Math.min(1_000, Math.trunc(piece.traits.w_loyalty * 1_000)),
  );
  let negativeAffinitySum = 0;
  let peerCount = 0;
  for (const peer of activePeers) {
    if (peer.id === piece.id) continue;
    negativeAffinitySum += Math.max(
      0,
      Math.min(100, -(piece.dyadicAffinity[peer.id] ?? 0)),
    );
    peerCount += 1;
  }
  const negativeAffinityPermille =
    peerCount === 0
      ? 0
      : Math.trunc((negativeAffinitySum * 1_000) / (peerCount * 100));
  const distrustPermille = Math.trunc(
    Math.max(0, Math.min(100, -piece.T_i)) * 10,
  );
  const benevolenceGapPermille = Math.max(
    0,
    Math.min(1_000, Math.max(0, 50 - piece.credence.tauBenev) * 20),
  );
  const traumaPermille = Math.max(0, Math.min(1_000, piece.B_i * 10));
  const alienationPermille = Math.trunc(
    (distrustPermille +
      benevolenceGapPermille +
      traumaPermille +
      negativeAffinityPermille) /
      4,
  );
  const effectiveAlienationPermille = Math.trunc(
    (alienationPermille * (1_000 - loyaltyPermille)) / 1_000,
  );
  return Math.max(
    floorPermille,
    1_000 -
      Math.trunc(
        ((1_000 - floorPermille) * effectiveAlienationPermille) / 1_000,
      ),
  );
}

export function calculateAttachment(
  piece: PieceState,
  activePeers: readonly PieceState[],
): number {
  return calculateAttachmentPermille(piece, activePeers) / 1_000;
}

export function calculateStayAttachmentWeightPermille(
  attachmentPermille: number,
  k: number = ENGINE_CONFIG.DESERTION_STAY_ATTACHMENT_PERMILLE,
): number {
  const attachment = Math.max(
    0,
    Math.min(1_000, Math.trunc(attachmentPermille)),
  );
  const clampedK = Math.max(0, Math.min(1_000, Math.trunc(k)));
  return 1_000 - clampedK + Math.trunc((clampedK * attachment) / 1_000);
}

export function calculateUStay(
  piece: PieceState,
  context: DesertionContext,
  lambda: number,
  stayAttachmentWeightPermille = 1_000,
): number {
  const shadowFactor = calculateShadowFactor(context.P_lossIfStay);
  const pain = calculatePain(piece) * shadowFactor;
  const weight = Math.max(0, Math.min(1_000, stayAttachmentWeightPermille));
  const collectiveStake =
    weight === 1_000
      ? context.P_lossIfStay * lambda * ENGINE_CONFIG.DESERTION_COLLECTIVE_STAKE
      : (context.P_lossIfStay *
          lambda *
          ENGINE_CONFIG.DESERTION_COLLECTIVE_STAKE *
          weight) /
        1_000;
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
  const shadowFactor = calculateShadowFactor(context.P_lossIfStay);
  const attachment = calculateAttachment(piece, activePeers);
  const exitPermanencePermille = Math.max(
    0,
    Math.min(
      1_000,
      Math.trunc(ENGINE_CONFIG.DESERTION_EXIT_PERMANENCE_PERMILLE),
    ),
  );
  const residualCost =
    -context.P_lossIfLeave *
    lambda *
    ENGINE_CONFIG.DESERTION_COLLECTIVE_STAKE *
    attachment;
  const quantizedResidualCost = quantizeBoardValue(residualCost);
  const quantizedStandingCost = quantizeBoardValue(
    -standing.anticipatedStandingCost * shadowFactor,
  );
  const exitSelfCost =
    (calculatePain(piece) *
      attachment *
      exitPermanencePermille *
      shadowFactor) /
    1_000;
  const quantizedExitSelfCost = quantizeBoardValue(exitSelfCost);
  return (
    (quantizedResidualCost + quantizedStandingCost - quantizedExitSelfCost) /
    1_000
  );
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
  const attachment = calculateAttachment(piece, activePeers);
  const attachmentPermille = Math.max(
    0,
    Math.min(1_000, Math.trunc(attachment * 1_000)),
  );
  const stayAttachmentWeightPermille =
    calculateStayAttachmentWeightPermille(attachmentPermille);
  const uStay = calculateUStay(
    piece,
    context,
    lambda,
    stayAttachmentWeightPermille,
  );
  const uDesert = calculateUDesert(piece, context, lambda, activePeers);
  const standing = calculateStandingCostComponents(piece, activePeers);
  const exitPermanencePermille = Math.max(
    0,
    Math.min(
      1_000,
      Math.trunc(ENGINE_CONFIG.DESERTION_EXIT_PERMANENCE_PERMILLE),
    ),
  );
  const exitSelfCost =
    quantizeBoardValue(
      (calculatePain(piece) *
        attachment *
        exitPermanencePermille *
        calculateShadowFactor(context.P_lossIfStay)) /
        1_000,
    ) / 1_000;
  const pivotality =
    (calculatePivotalityPermille(piece, activePeers) *
      ENGINE_CONFIG.DESERTION_PIVOTALITY_SCALE_PERMILLE) /
    1_000_000;
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
      pLossBoard: context.pLossBoard,
      pivotality,
      shadowFactor: calculateShadowFactor(context.P_lossIfStay),
      attachment,
      lambda,
      lambdaTrust: lambdaComponents.trust,
      lambdaMorale: lambdaComponents.morale,
      lambdaLoyalty: lambdaComponents.loyalty,
      lambdaAffinity: lambdaComponents.affinity,
      standingCost:
        quantizeBoardValue(standing.anticipatedStandingCost) / 1_000,
      exitSelfCost,
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
