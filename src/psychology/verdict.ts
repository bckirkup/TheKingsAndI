import { ENGINE_CONFIG } from './config';
import { calculateEngineSearchDepth } from './depth';
import {
  calculateFaithGap,
  calculatePerceivedValue,
  isExpendableRefusal,
} from './credence';
import { shouldDesert } from './desertion';
import { calculateMoveUtility, calculateRefusalThreshold } from './utility';
import type {
  CandidateMoveEvaluation,
  DesertionContext,
  MoveDecisionOutcome,
  PieceState,
} from './types';

/**
 * Full verdict ladder (docs/psychology_engine.md §6).
 * Rule 1: desertion via expected-cost comparison (ADR 0011).
 * Rules 2–5: credence-weighted refusal and execution bands.
 */
export function evaluateMoveResponse(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  allActivePieces: readonly PieceState[],
  desertionContext?: DesertionContext,
): MoveDecisionOutcome {
  const utilityScore = calculateMoveUtility(actor, moveEval, allActivePieces);
  const refusalThreshold = calculateRefusalThreshold(actor.T_i);
  const perceivedValue = calculatePerceivedValue(
    moveEval.deltaV_board,
    moveEval.vLeaderImplied,
    actor.credence.tauAbil,
  );
  const faithGap = calculateFaithGap(
    moveEval.deltaV_board,
    moveEval.vLeaderImplied,
  );

  if (desertionContext !== undefined && actor.role !== 'King') {
    const desertion = shouldDesert(actor, desertionContext, allActivePieces);
    if (desertion.desert) {
      const engagement = ENGINE_CONFIG.DESERTION_ENGAGEMENT;
      return {
        verdict: 'DESERTION_MUTINY',
        utilityScore,
        perceivedValue,
        refusalThreshold,
        effectiveSearchDepth: 1,
        engagementFactor: engagement,
      };
    }
  }

  if (
    isExpendableRefusal(
      moveEval.deltaV_board,
      faithGap,
      actor.credence.tauBenev,
    ) ||
    perceivedValue < refusalThreshold
  ) {
    const engagement = ENGINE_CONFIG.QUIET_QUIT_ENGAGEMENT;
    return {
      verdict: 'MORAL_REFUSAL',
      utilityScore,
      perceivedValue,
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
      perceivedValue,
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
    perceivedValue,
    refusalThreshold,
    effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, engagement),
    engagementFactor: engagement,
  };
}

export function evaluateDesertionCascade(
  roster: readonly PieceState[],
  desertionContexts: Readonly<Record<string, DesertionContext>>,
): readonly {
  readonly pieceId: string;
  readonly outcome: MoveDecisionOutcome;
}[] {
  const results: { pieceId: string; outcome: MoveDecisionOutcome }[] = [];
  const active = roster.filter((piece) => piece.role !== 'King');
  const dummyMove: CandidateMoveEvaluation = {
    moveNotation: '',
    deltaV_board: 0,
    vLeaderImplied: 0,
    deltaV_capture: 0,
    P_captured: 0,
    peerSafetyDeltas: {},
  };
  for (const piece of active) {
    const context = desertionContexts[piece.id];
    if (context === undefined) continue;
    const outcome = evaluateMoveResponse(piece, dummyMove, roster, context);
    if (outcome.verdict === 'DESERTION_MUTINY') {
      results.push({ pieceId: piece.id, outcome });
    }
  }
  return results;
}
