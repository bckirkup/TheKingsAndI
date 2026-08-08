import type { MoveFeatures } from '../chess';
import type { EngineEvaluation } from '../engine/types';
import type { CandidateMoveEvaluation } from '../psychology';

/**
 * Map a piece's depth-D_i engine view (post-move, mover-side cp) plus geometric
 * capture/peer features into psychology's CandidateMoveEvaluation (ADR 0013).
 */
export function insightToEvaluation(
  features: MoveFeatures,
  insight: EngineEvaluation,
  leaderInsight: EngineEvaluation,
  leaderImpliedBias = 0,
): CandidateMoveEvaluation {
  const deltaV_board = insight.scoreCp / 100;
  const vLeaderImplied = leaderInsight.scoreCp / 100 + leaderImpliedBias;
  return {
    moveNotation: features.san,
    deltaV_board,
    vLeaderImplied,
    deltaV_capture: features.deltaVCapture,
    P_captured: features.pCaptured,
    peerSafetyDeltas: features.peerSafetyDeltas,
  };
}

/**
 * @deprecated Geometric heuristic retained only for comparison fixtures.
 * Play and sim must use insightToEvaluation.
 */
export function featuresToEvaluation(
  features: MoveFeatures,
  leaderImpliedBias = 0,
): CandidateMoveEvaluation {
  const deltaV_board =
    features.materialDelta * 2 +
    features.kingSafetyDelta * 1.5 -
    features.pCaptured * 3;
  const leaderGap = leaderImpliedBias * 0.5;
  return {
    moveNotation: features.san,
    deltaV_board,
    vLeaderImplied: deltaV_board + leaderGap,
    deltaV_capture: features.deltaVCapture,
    P_captured: features.pCaptured,
    peerSafetyDeltas: features.peerSafetyDeltas,
  };
}

/** True when the commanded move's mover-side cp is within tolerance of best. */
export function isObjectivelyGoodMove(
  moveScoreCp: number,
  bestScoreCp: number,
  toleranceCp = 30,
): boolean {
  return moveScoreCp >= bestScoreCp - toleranceCp;
}
