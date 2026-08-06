import type { CandidateMoveEvaluation, PieceState } from './types';

/**
 * Φ(P_i, P_j, m) = w_empathy · ((A_{i,j} + C_{i,role(j)}) / 200) · ΔSafety_j(m)
 */
export function calculateInterPieceProtection(
  wEmpathy: number,
  dyadicAffinityIj: number,
  classPrestigeRoleJ: number,
  peerSafetyDelta: number,
): number {
  const normalizedRelationship = (dyadicAffinityIj + classPrestigeRoleJ) / 200;
  return wEmpathy * normalizedRelationship * peerSafetyDelta;
}

/**
 * U(P_i, m) per docs/psychology_engine.md §4.
 */
export function calculateMoveUtility(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  allActivePieces: readonly PieceState[],
): number {
  const { traits, T_i } = actor;
  const loyaltyTerm = traits.w_loyalty * T_i;
  const honorTerm = traits.w_honor * moveEval.deltaV_board;
  const ambitionTerm = traits.w_ambition * moveEval.deltaV_capture;
  const riskTerm = (1 - traits.w_courage) * moveEval.P_captured;

  let protectionSum = 0;
  for (const peer of allActivePieces) {
    if (peer.id === actor.id) continue;
    const affinityIj = actor.dyadicAffinity[peer.id] ?? 0;
    const classPrestigeJ = actor.classPrestige[peer.role] ?? 0;
    const safetyDeltaJ = moveEval.peerSafetyDeltas[peer.id] ?? 0;
    protectionSum += calculateInterPieceProtection(
      traits.w_empathy,
      affinityIj,
      classPrestigeJ,
      safetyDeltaJ,
    );
  }

  return loyaltyTerm + honorTerm + ambitionTerm - riskTerm + protectionSum;
}

/**
 * Θ_refusal(T_i) = -50 + (100 - T_i) · 0.5 (docs/psychology_engine.md §5).
 */
export function calculateRefusalThreshold(trustLevel: number): number {
  return -50 + (100 - trustLevel) * 0.5;
}
