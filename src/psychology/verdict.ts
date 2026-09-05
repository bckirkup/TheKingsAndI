import { ENGINE_CONFIG } from './config';
import { calculateEngineSearchDepth } from './depth';
import {
  calculateFaithGap,
  calculatePerceivedValue,
  effectiveAbilityCredence,
  isExpendableRefusal,
} from './credence';
import { shouldDesert } from './desertion';
import { calculateMoveUtility, calculateRefusalThreshold } from './utility';
import { clampTrust } from './clamp';
import { normalizePieceState } from './reducers';
import type {
  CandidateMoveEvaluation,
  DesertionContext,
  DesertionDecisionTerms,
  MatchEvent,
  MoveDecisionOutcome,
  PieceState,
} from './types';

export function isFatalisticCompliance(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
): boolean {
  return (
    moveEval.P_captured >= ENGINE_CONFIG.FATALISTIC_CAPTURE_RISK &&
    actor.credence.tauAbil <= ENGINE_CONFIG.FATALISTIC_TAU_ABIL_CEILING
  );
}

/**
 * Full verdict ladder (docs/psychology_engine.md §6).
 * Rule 1: desertion via expected-cost comparison (ADR 0011).
 * Rules 2–5: credence-weighted refusal and execution bands.
 * Rule 3b: fatalistic compliance (ADR 0024) — full effort, cost on witnesses.
 */
export function evaluateMoveResponse(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  allActivePieces: readonly PieceState[],
  desertionContext?: DesertionContext,
): MoveDecisionOutcome {
  const utilityScore = calculateMoveUtility(actor, moveEval, allActivePieces);
  const refusalThreshold =
    calculateRefusalThreshold(actor.T_i) +
    Math.trunc(
      (Math.max(0, actor.selfAppraisal ?? 0) *
        Math.max(0, Math.trunc(ENGINE_CONFIG.PRIDE_REFUSAL_SCALE))) /
        1_000,
    );
  const perceivedValue = calculatePerceivedValue(
    moveEval.deltaV_board,
    moveEval.vLeaderImplied,
    effectiveAbilityCredence(
      actor.credence.tauAbil,
      actor.rumor.leaderAppraisal,
    ),
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
      effectiveSearchDepth: calculateEngineSearchDepth(
        actor.E_i,
        engagement,
        undefined,
        undefined,
        undefined,
        actor.panicPermille,
      ),
      engagementFactor: engagement,
    };
  }

  if (utilityScore < 0 || actor.T_i <= 0) {
    if (isFatalisticCompliance(actor, moveEval)) {
      return {
        verdict: 'FATALISTIC_COMPLIANCE',
        utilityScore,
        perceivedValue,
        refusalThreshold,
        effectiveSearchDepth: calculateEngineSearchDepth(
          actor.E_i,
          ENGINE_CONFIG.FULL_ENGAGEMENT,
          ENGINE_CONFIG.MIN_SEARCH_DEPTH,
          ENGINE_CONFIG.MAX_SEARCH_DEPTH,
          actor.griefLoad,
          actor.panicPermille,
        ),
        engagementFactor: ENGINE_CONFIG.FULL_ENGAGEMENT,
      };
    }
    const engagement = ENGINE_CONFIG.QUIET_QUIT_ENGAGEMENT;
    return {
      verdict: 'QUIET_QUITTING',
      utilityScore,
      perceivedValue,
      refusalThreshold,
      effectiveSearchDepth: calculateEngineSearchDepth(
        actor.E_i,
        engagement,
        ENGINE_CONFIG.MIN_SEARCH_DEPTH,
        ENGINE_CONFIG.MAX_SEARCH_DEPTH,
        actor.griefLoad,
        actor.panicPermille,
      ),
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
    effectiveSearchDepth: calculateEngineSearchDepth(
      actor.E_i,
      engagement,
      ENGINE_CONFIG.MIN_SEARCH_DEPTH,
      ENGINE_CONFIG.MAX_SEARCH_DEPTH,
      actor.griefLoad,
      actor.panicPermille,
    ),
    engagementFactor: engagement,
  };
}

/**
 * Cost of fatalistic compliance lands on witnesses and the actor's future
 * willingness — never on the move itself (ADR 0024).
 */
export function applyFatalisticComplianceCosts(
  roster: readonly PieceState[],
  actorId: string,
  ply: number,
): { readonly roster: PieceState[]; readonly events: MatchEvent[] } {
  const events: MatchEvent[] = [];
  const next = roster.map((piece) => {
    if (piece.id === actorId) {
      const engagement = Math.max(
        ENGINE_CONFIG.QUIET_QUIT_ENGAGEMENT,
        piece.engagementFactor -
          ENGINE_CONFIG.FATALISTIC_ACTOR_ENGAGEMENT_PENALTY,
      );
      events.push({
        t: 'PSYCH_DELTA',
        ply,
        pieceId: piece.id,
        field: 'engagementFactor',
        delta: engagement - piece.engagementFactor,
      });
      return normalizePieceState({ ...piece, engagementFactor: engagement });
    }
    const trustDelta = ENGINE_CONFIG.FATALISTIC_WITNESS_TRUST_PENALTY;
    events.push({
      t: 'FATALISTIC_WITNESS',
      ply,
      actorId,
      witnessId: piece.id,
      trustDelta,
    });
    return normalizePieceState({
      ...piece,
      T_i: clampTrust(piece.T_i + trustDelta),
    });
  });
  return { roster: next, events };
}

/**
 * Re-evaluate desertion for every non-King after a departure (ADR 0011).
 * Uses `shouldDesert` directly — never a fake commanded move.
 */
export function evaluateDesertionCascade(
  roster: readonly PieceState[],
  desertionContexts: Readonly<Record<string, DesertionContext>>,
  onEvaluation?: (decision: {
    readonly pieceId: string;
    readonly uStay: number;
    readonly uDesert: number;
    readonly terms: DesertionDecisionTerms;
  }) => void,
): readonly {
  readonly pieceId: string;
  readonly uStay: number;
  readonly uDesert: number;
  readonly terms: DesertionDecisionTerms;
}[] {
  const results: {
    pieceId: string;
    uStay: number;
    uDesert: number;
    terms: DesertionDecisionTerms;
  }[] = [];
  const active = roster.filter((piece) => piece.role !== 'King');
  for (const piece of active) {
    const context = desertionContexts[piece.id];
    if (context === undefined) continue;
    const decision = shouldDesert(piece, context, roster);
    onEvaluation?.({
      pieceId: piece.id,
      uStay: decision.uStay,
      uDesert: decision.uDesert,
      terms: decision.terms,
    });
    if (decision.desert) {
      results.push({
        pieceId: piece.id,
        uStay: decision.uStay,
        uDesert: decision.uDesert,
        terms: decision.terms,
      });
    }
  }
  return results;
}
