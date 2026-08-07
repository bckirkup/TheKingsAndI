import { applyRumorDiffusion } from './belief';
import { raiseLossEstimatesAfterDesertion } from './desertion';
import { normalizePieceState } from './reducers';
import { evaluateDesertionCascade } from './verdict';
import { appraiseDesertionWitness } from './witness';
import type {
  CandidateMoveEvaluation,
  DesertionContext,
  MatchEvent,
  PieceState,
} from './types';

export function desertionContextFor(
  piece: PieceState,
  moveEval: CandidateMoveEvaluation,
): DesertionContext {
  const pLossBase = piece.rumor.pLossTeam / 1000;
  const captureStress =
    moveEval.P_captured > 0.35 ? moveEval.P_captured * 0.3 : 0;
  return {
    P_captured: moveEval.P_captured,
    P_lossIfStay: Math.min(1, pLossBase + captureStress),
    P_lossIfLeave: Math.min(1, pLossBase + 0.5),
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
      contexts[piece.id] = desertionContextFor(piece, {
        moveNotation: '',
        deltaV_board: 0,
        vLeaderImplied: 0,
        deltaV_capture: 0,
        P_captured: 0,
        peerSafetyDeltas: {},
      });
    } else {
      contexts[piece.id] = desertionContextFor(piece, moveEval);
    }
  }
  return contexts;
}

export interface DesertionDeparture {
  readonly actor: PieceState;
  readonly refusedMove: string;
  readonly refusedMoveEval: CandidateMoveEvaluation;
  readonly uStay: number;
  readonly uDesert: number;
}

export interface CascadeResult {
  readonly roster: PieceState[];
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
  let cascadeLength = 0;
  const queue: DesertionDeparture[] = [departure];

  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) break;
    const actor = roster.find((piece) => piece.id === next.actor.id);
    if (actor === undefined) continue;

    events.push({
      t: 'DESERTION',
      ply,
      pieceId: actor.id,
      refusedMove: next.refusedMove,
      uStay: next.uStay,
      uDesert: next.uDesert,
    });

    for (const witness of roster) {
      if (witness.id === actor.id || witness.role === 'King') continue;
      const appraisal = appraiseDesertionWitness(
        witness,
        actor,
        next.refusedMoveEval,
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
    roster = roster.filter((piece) => piece.id !== actor.id);
    cascadeLength += 1;

    if (roster.length <= 1) {
      return { roster, events, rout: true, cascadeLength };
    }

    const refreshed = buildDesertionContexts(
      roster,
      Object.fromEntries(
        roster.map((piece) => [
          piece.id,
          {
            moveNotation: next.refusedMove,
            deltaV_board: next.refusedMoveEval.deltaV_board,
            vLeaderImplied: next.refusedMoveEval.vLeaderImplied,
            deltaV_capture: 0,
            P_captured: piece.rumor.pLossTeam / 1000,
            peerSafetyDeltas: {},
          } satisfies CandidateMoveEvaluation,
        ]),
      ),
    );
    const further = evaluateDesertionCascade(roster, refreshed);
    for (const candidate of further) {
      const piece = roster.find((entry) => entry.id === candidate.pieceId);
      if (piece === undefined) continue;
      if (queue.some((queued) => queued.actor.id === piece.id)) continue;
      queue.push({
        actor: piece,
        refusedMove: next.refusedMove,
        refusedMoveEval: next.refusedMoveEval,
        uStay: candidate.uStay,
        uDesert: candidate.uDesert,
      });
    }
  }

  return {
    roster,
    events,
    rout: roster.length <= 1,
    cascadeLength,
  };
}
