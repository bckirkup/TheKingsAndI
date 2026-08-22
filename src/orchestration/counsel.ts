import type { CounselCandidate, PieceCounsel, PieceState } from '../psychology';
import { counselForCandidate } from '../psychology';
import { DRAFT_CONFIG, type DraftConfig } from './draftConfig';

export interface CounselConsultationRequest {
  readonly holder: PieceState;
  readonly candidate: CounselCandidate;
}

export interface CounselConsultation {
  readonly holderId: string;
  readonly candidateId: string;
  readonly counsel: PieceCounsel;
}

export interface ConsultationLedger {
  readonly requested: number;
  readonly granted: number;
  readonly consultations: readonly CounselConsultation[];
}

/**
 * Apply the attention budget without adding randomness or persistence. The
 * caller records whether any granted counsel was heeded in harness metrics.
 */
export function consultWithBudget(
  requests: readonly CounselConsultationRequest[],
  config: DraftConfig = DRAFT_CONFIG,
): ConsultationLedger {
  const budget = Math.max(0, Math.trunc(config.CONSULTATIONS_PER_CYCLE));
  const consultations = requests.slice(0, budget).map((request) => ({
    holderId: request.holder.id,
    candidateId: request.candidate.id,
    counsel: {
      ...counselForCandidate(request.holder, request.candidate, config),
    },
  }));
  return {
    requested: requests.length,
    granted: consultations.length,
    consultations,
  };
}
