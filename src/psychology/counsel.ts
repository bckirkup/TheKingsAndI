import type { PieceRole, PieceState } from './types';
import { DRAFT_CONFIG, type DraftConfig } from '../core/draftConfig';
import { isEligibleForChair } from '../core/roleEligibility';

export interface CounselCandidate {
  readonly id: string;
  readonly originRole: PieceRole;
  readonly attainedRole?: PieceRole;
}

export type CounselOpinion =
  | 'strongly_recommend'
  | 'recommend'
  | 'caution'
  | 'discourage';

export type CounselReason =
  | 'personal affinity'
  | 'class prejudice'
  | 'chair rivalry'
  | 'mixed evidence';

export type CounselVolunteering =
  | 'forthcoming'
  | 'guarded'
  | 'reluctant'
  | 'silent';

export type PieceCounsel =
  | {
      readonly volunteering: 'silent';
    }
  | {
      readonly opinion: CounselOpinion;
      readonly reason: CounselReason;
      readonly volunteering: Exclude<CounselVolunteering, 'silent'>;
    };

const OPINION_VALUES: Readonly<Record<CounselOpinion, number>> = {
  strongly_recommend: 2,
  recommend: 1,
  caution: 0,
  discourage: -1,
};

/**
 * Convert the qualitative opinion to a private harness signal. The number is
 * for detector inputs only and is never part of the spoken counsel.
 */
export function counselOpinionValue(opinion: CounselOpinion): number {
  return OPINION_VALUES[opinion];
}

function volunteeringForCredence(
  tauBenev: number,
  config: DraftConfig,
): CounselVolunteering {
  if (tauBenev >= config.COUNSEL_FORTHCOMING_CREDENCE) return 'forthcoming';
  if (tauBenev >= config.COUNSEL_GUARDED_CREDENCE) return 'guarded';
  if (tauBenev >= config.COUNSEL_RELUCTANT_CREDENCE) return 'reluctant';
  return 'silent';
}

function opinionForSignal(signal: number, config: DraftConfig): CounselOpinion {
  if (signal >= config.COUNSEL_STRONGLY_RECOMMEND_THRESHOLD)
    return 'strongly_recommend';
  if (signal >= config.COUNSEL_RECOMMEND_THRESHOLD) return 'recommend';
  if (signal >= config.COUNSEL_CAUTION_THRESHOLD) return 'caution';
  return 'discourage';
}

/**
 * Give deterministic, qualitative counsel from the holder's private state.
 * Credence in the commander controls disclosure only; rivalry is structural
 * because origin-inclusive chair eligibility makes the candidate a competitor.
 */
export function counselForCandidate(
  holder: PieceState,
  candidate: CounselCandidate,
  config: DraftConfig = DRAFT_CONFIG,
): PieceCounsel {
  const affinity = holder.dyadicAffinity[candidate.id] ?? 0;
  const classBias = holder.classPrestige[candidate.originRole];
  const credence = Math.max(0, Math.min(100, holder.credence.tauBenev));
  const rivalryPenalty = isEligibleForChair(
    candidate.originRole,
    candidate.attainedRole,
    holder.role,
  )
    ? config.COUNSEL_RIVALRY_PENALTY
    : 0;
  const signal = affinity + classBias - rivalryPenalty;
  const volunteering = volunteeringForCredence(credence, config);
  if (volunteering === 'silent') return { volunteering };
  const opinion = opinionForSignal(signal, config);
  let reason: CounselReason = 'mixed evidence';
  if (
    rivalryPenalty > 0 &&
    rivalryPenalty >= Math.max(Math.abs(classBias), Math.abs(affinity))
  ) {
    reason = 'chair rivalry';
  } else {
    const magnitudes: readonly [CounselReason, number][] = [
      ['personal affinity', Math.abs(affinity)],
      ['class prejudice', Math.abs(classBias)],
    ];
    const strongest = magnitudes.reduce(
      (best, current) => (current[1] > best[1] ? current : best),
      ['mixed evidence', 0] as [CounselReason, number],
    );
    reason = strongest[1] === 0 ? 'mixed evidence' : strongest[0];
  }
  return {
    opinion,
    reason,
    volunteering,
  };
}
