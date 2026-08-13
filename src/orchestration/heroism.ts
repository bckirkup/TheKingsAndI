import type { EngineAuditEntry } from '../engine';
import type {
  CandidateMoveEvaluation,
  MatchEvent,
  MoveResponseVerdict,
} from '../psychology';

import { HEROISM_CONFIG } from './heroismConfig';

const DUTY_VERDICTS = new Set<MoveResponseVerdict>([
  'HEROIC_EXECUTION',
  'COMPLIANT_EXECUTION',
  'FATALISTIC_COMPLIANCE',
]);

export function engineAuditEntry(input: {
  readonly ply: number;
  readonly pieceId: string;
  readonly san: string;
  readonly scoreCp: number;
  readonly bestScoreCp: number;
  readonly preMoveScoreCp: number;
  readonly preMoveDepth: number;
  readonly scoreDepth: number;
  readonly bestScoreDepth: number;
}): EngineAuditEntry {
  return Object.freeze({ ...input });
}

function privateConcernCp(moveEval: CandidateMoveEvaluation): number {
  return Math.max(
    0,
    Math.trunc(
      Math.max(-moveEval.deltaV_board * 100, moveEval.P_captured * 100),
    ),
  );
}

/**
 * A nomination is a record of a compliant act, not an honour. The audit
 * stream is passed in as a plain value and is never imported by psychology.
 */
export function heroismNomination(
  events: readonly MatchEvent[],
  moveEval: CandidateMoveEvaluation,
  audit: EngineAuditEntry,
): Extract<MatchEvent, { t: 'HEROISM_NOMINATION' }> | undefined {
  const move = events.find(
    (event) => event.t === 'MOVE' && 'ply' in event && event.ply === audit.ply,
  );
  if (move?.t !== 'MOVE') return undefined;
  if (!DUTY_VERDICTS.has(move.verdict)) return undefined;
  if (
    events.some(
      (event) =>
        'ply' in event &&
        event.ply === audit.ply &&
        (event.t === 'OVERRIDE' || event.t === 'REFUSAL'),
    )
  ) {
    return undefined;
  }

  const privateConcern = privateConcernCp(moveEval);
  const privateDisagreed =
    privateConcern >= HEROISM_CONFIG.PRIVATE_DISAGREEMENT_THRESHOLD_CP;
  const trueGainCp = audit.scoreCp - audit.preMoveScoreCp;
  const trueDecisive =
    trueGainCp >= HEROISM_CONFIG.DECISIVE_MARGIN_CP &&
    audit.bestScoreCp - audit.scoreCp <= HEROISM_CONFIG.NEAR_BEST_TOLERANCE_CP;
  if (!privateDisagreed || !trueDecisive) return undefined;

  return {
    t: 'HEROISM_NOMINATION',
    ply: audit.ply,
    pieceId: move.pieceId,
    san: move.san,
  };
}
