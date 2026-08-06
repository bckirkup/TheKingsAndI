import type { CandidateMoveEvaluation, PieceState } from './types';

/**
 * Φ(P_i, P_j, m) = w_empathy · ((A_{i,j} + w_prestige·C_{i,role(j)}) / 200) · ΔSafety_j(m)
 * (docs/psychology_engine.md §10.2 intended fix)
 */
export function calculateInterPieceProtection(
  wEmpathy: number,
  wPrestige: number,
  dyadicAffinityIj: number,
  classPrestigeRoleJ: number,
  peerSafetyDelta: number,
): number {
  const normalizedRelationship =
    (dyadicAffinityIj + wPrestige * classPrestigeRoleJ) / 200;
  return wEmpathy * normalizedRelationship * peerSafetyDelta;
}

/**
 * Tactical utility without additive trust (ADR 0015 invariant 14).
 * Trust enters through credence-weighted perception in the verdict layer.
 */
export function calculateMoveUtility(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  allActivePieces: readonly PieceState[],
): number {
  const { traits } = actor;
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
      traits.w_prestige,
      affinityIj,
      classPrestigeJ,
      safetyDeltaJ,
    );
  }

  return honorTerm + ambitionTerm - riskTerm + protectionSum;
}

/**
 * Θ_refusal(T_i) = -50 + (100 - T_i) · 0.5 (docs/psychology_engine.md §5).
 */
export function calculateRefusalThreshold(trustLevel: number): number {
  return -50 + (100 - trustLevel) * 0.5;
}
