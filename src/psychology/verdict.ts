import { ENGINE_CONFIG } from './config';
import { calculateEngineSearchDepth } from './depth';
import { calculateMoveUtility, calculateRefusalThreshold } from './utility';
import type {
  CandidateMoveEvaluation,
  MoveDecisionOutcome,
  PieceState,
} from './types';

/**
 * Verdict ladder rules 2–5 from docs/psychology_engine.md §6.
 * Rule 1 (desertion) is Milestone 2.3b — it requires U_desert vs U_stay.
 */
export function evaluateMoveResponse(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  allActivePieces: readonly PieceState[],
): MoveDecisionOutcome {
  const utilityScore = calculateMoveUtility(actor, moveEval, allActivePieces);
  const refusalThreshold = calculateRefusalThreshold(actor.T_i);

  if (utilityScore < refusalThreshold) {
    const engagement = ENGINE_CONFIG.QUIET_QUIT_ENGAGEMENT;
    return {
      verdict: 'MORAL_REFUSAL',
      utilityScore,
      refusalThreshold,
      effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, engagement),
      engagementFactor: engagement,
    };
  }

  if (utilityScore < 0 || actor.T_i <= 0) {
    const engagement = ENGINE_CONFIG.QUIET_QUIT_ENGAGEMENT;
    return {
      verdict: 'QUIET_QUITTING',
      utilityScore,
      refusalThreshold,
      effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, engagement),
      engagementFactor: engagement,
    };
  }

  const isHeroic =
    actor.T_i > ENGINE_CONFIG.HEROIC_TRUST_FLOOR &&
    (moveEval.P_captured > ENGINE_CONFIG.HEROIC_CAPTURE_RISK ||
      moveEval.deltaV_board > ENGINE_CONFIG.HEROIC_BOARD_DELTA);
  const engagement = ENGINE_CONFIG.FULL_ENGAGEMENT;

  return {
    verdict: isHeroic ? 'HEROIC_EXECUTION' : 'COMPLIANT_EXECUTION',
    utilityScore,
    refusalThreshold,
    effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, engagement),
    engagementFactor: engagement,
  };
}
