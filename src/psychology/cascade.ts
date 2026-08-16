import { applyRumorDiffusion } from './belief';
import {
  calculateShadowFactor,
  calculatePivotalityPermille,
  raiseLossEstimatesAfterDesertion,
} from './desertion';
import { ENGINE_CONFIG } from './config';
import { normalizePieceState } from './reducers';
import { evaluateDesertionCascade } from './verdict';
import { appraiseDesertionWitness } from './witness';
import type {
  CandidateMoveEvaluation,
  DesertionContext,
  DesertionDecisionTerms,
  MatchEvent,
  PieceState,
} from './types';

export function desertionContextFor(
  piece: PieceState,
  moveEval: CandidateMoveEvaluation,
  activePeers: readonly PieceState[],
): DesertionContext {
  const score = Math.trunc(moveEval.privateScoreCp);
  const scale = Math.max(1, ENGINE_CONFIG.DESERTION_BOARD_LOSS_SCALE_CP);
  const boardLossPermille = Math.max(
    1,
    Math.min(999, 500 - Math.trunc((500 * score) / (Math.abs(score) + scale))),
  );
  const rumorPermille = Math.max(0, Math.min(1_000, piece.rumor.pLossTeam));
  const boardWeight = Math.max(
    0,
    Math.min(1_000, ENGINE_CONFIG.DESERTION_BOARD_LOSS_WEIGHT_PERMILLE),
  );
  const blendedPermille = Math.trunc(
    (boardLossPermille * boardWeight + rumorPermille * (1_000 - boardWeight)) /
      1_000,
  );
  const captureStressPermille =
    moveEval.P_captured > 0.35 ? Math.trunc(moveEval.P_captured * 300) : 0;
  const pLossIfStayPermille = Math.min(
    1_000,
    blendedPermille + captureStressPermille,
  );
  const pivotalityPermille = calculatePivotalityPermille(piece, activePeers);
  const pivotalityScale = Math.max(
    0,
    Math.min(1_000, ENGINE_CONFIG.DESERTION_PIVOTALITY_SCALE_PERMILLE),
  );
  const pivotalityLossPermille = Math.trunc(
    (pivotalityPermille * pivotalityScale) / 1_000,
  );
  return {
    P_captured: moveEval.P_captured,
    P_lossIfStay: pLossIfStayPermille / 1_000,
    P_lossIfLeave:
      Math.min(1_000, pLossIfStayPermille + pivotalityLossPermille) / 1_000,
    pLossBoard: boardLossPermille / 1_000,
    pivotality: pivotalityLossPermille / 1_000,
    shadowFactor: calculateShadowFactor(pLossIfStayPermille / 1_000),
    promotionProspect: moveEval.promotionProspect,
  };
}

export function buildDesertionContexts(
  roster: readonly PieceState[],
  moveEvalByPiece: Readonly<Record<string, CandidateMoveEvaluation>>,
): Readonly<Record<string, DesertionContext>> {
  const contexts: Record<string, DesertionContext> = {};
  for (const piece of roster) {
    const moveEval = moveEvalByPiece[piece.id];
    if (moveEval === undefined) {
      contexts[piece.id] = desertionContextFor(
        piece,
        {
          moveNotation: '',
          deltaV_board: 0,
          privateScoreCp: 0,
          vLeaderImplied: 0,
          deltaV_capture: 0,
          P_captured: 0,
          promotionProspect: 0,
          peerSafetyDeltas: {},
        },
        roster,
      );
    } else {
      contexts[piece.id] = desertionContextFor(piece, moveEval, roster);
    }
  }
  return contexts;
}

export interface DesertionDeparture {
  readonly actor: PieceState;
  readonly refusedMove: string;
  readonly refusedMoveEval: CandidateMoveEvaluation;
  /**
   * Private evaluations captured before the move's psychology round. The
   * cascade may update collective-loss estimates, but it never asks the
   * engine for a dependent query.
   */
  readonly moveEvalByPiece: Readonly<Record<string, CandidateMoveEvaluation>>;
  readonly uStay: number;
  readonly uDesert: number;
  readonly terms?: DesertionDecisionTerms;
}

export interface CascadeResult {
  readonly roster: PieceState[];
  readonly departed: PieceState[];
  readonly events: MatchEvent[];
  readonly rout: boolean;
  readonly cascadeLength: number;
}

/**
 * Apply one desertion then loop ADR 0011 cascade: witness → raise loss →
 * remove → re-evaluate until stable or only the King remains.
 */
export function applyDesertionWithCascade(
  rosterIn: readonly PieceState[],
  departure: DesertionDeparture,
  ply: number,
): CascadeResult {
  let roster = [...rosterIn];
  const events: MatchEvent[] = [];
  const departed: PieceState[] = [];
  let cascadeLength = 0;
  const queue: DesertionDeparture[] = [departure];

  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) break;
    const actor = roster.find((piece) => piece.id === next.actor.id);
    if (actor === undefined) continue;

    const event: Extract<MatchEvent, { t: 'DESERTION' }> = {
      t: 'DESERTION',
      ply,
      pieceId: actor.id,
      refusedMove: next.refusedMove,
      uStay: next.uStay,
      uDesert: next.uDesert,
      departureKind: cascadeLength === 0 ? 'first' : 'cascade',
      ...(next.terms === undefined ? {} : { terms: next.terms }),
    };
    events.push(event);

    for (const witness of roster) {
      if (witness.id === actor.id || witness.role === 'King') continue;
      const appraisal = appraiseDesertionWitness(
        witness,
        actor,
        next.moveEvalByPiece[witness.id] ?? next.refusedMoveEval,
        ply,
      );
      events.push(appraisal.event);
      roster = roster.map((piece) =>
        piece.id === witness.id
          ? normalizePieceState(appraisal.witness)
          : piece,
      );
    }

    roster = raiseLossEstimatesAfterDesertion(roster, actor.id).map(
      normalizePieceState,
    );
    roster = applyRumorDiffusion(roster, actor.id).map(normalizePieceState);
    const departedState = roster.find((piece) => piece.id === actor.id);
    if (departedState !== undefined) departed.push(departedState);
    roster = roster.filter((piece) => piece.id !== actor.id);
    cascadeLength += 1;

    if (roster.length <= 1) {
      return { roster, departed, events, rout: true, cascadeLength };
    }

    const refreshed = buildDesertionContexts(roster, next.moveEvalByPiece);
    const further = evaluateDesertionCascade(roster, refreshed);
    for (const candidate of further) {
      const piece = roster.find((entry) => entry.id === candidate.pieceId);
      if (piece === undefined) continue;
      if (queue.some((queued) => queued.actor.id === piece.id)) continue;
      const candidateMoveEval =
        next.moveEvalByPiece[piece.id] ?? next.refusedMoveEval;
      queue.push({
        actor: piece,
        refusedMove: next.refusedMove,
        refusedMoveEval: candidateMoveEval,
        moveEvalByPiece: next.moveEvalByPiece,
        uStay: candidate.uStay,
        uDesert: candidate.uDesert,
        terms: candidate.terms,
      });
    }
  }

  return {
    roster,
    departed,
    events,
    rout: roster.length <= 1,
    cascadeLength,
  };
}
