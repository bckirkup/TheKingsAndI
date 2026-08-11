import type { MoveFeatures } from '../src/chess';
import type { CandidateMoveEvaluation } from '../src/psychology';

/** Map geometric board features to psychology evaluation inputs. */
export function featuresToEvaluation(
  features: MoveFeatures,
  leaderImpliedBias: number,
): CandidateMoveEvaluation {
  const deltaV_board =
    features.materialDelta * 2 +
    features.kingSafetyDelta * 1.5 -
    features.pCaptured * 3;
  const leaderGap = leaderImpliedBias * 0.5;
  return {
    moveNotation: features.san,
    deltaV_board,
    privateScoreCp: 0,
    vLeaderImplied: deltaV_board + leaderGap,
    deltaV_capture: features.deltaVCapture,
    P_captured: features.pCaptured,
    peerSafetyDeltas: features.peerSafetyDeltas,
  };
}

export function isObjectivelyGoodMove(features: MoveFeatures): boolean {
  return features.materialDelta > 0 || features.deltaVCapture > 0;
}
