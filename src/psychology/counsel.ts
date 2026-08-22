import type { PieceRole, PieceState } from './types';

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
  | 'rumour appraisal'
  | 'low credence'
  | 'chair rivalry'
  | 'mixed evidence';

export type CounselVolunteering =
  | 'forthcoming'
  | 'guarded'
  | 'reluctant'
  | 'silent';

export interface PieceCounsel {
  readonly opinion: CounselOpinion;
  readonly reason: CounselReason;
  readonly volunteering: CounselVolunteering;
}

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

function isChairRival(
  holder: PieceState,
  candidate: CounselCandidate,
): boolean {
  return (
    candidate.originRole === holder.role ||
    candidate.attainedRole === holder.role
  );
}

function volunteeringForCredence(tauBenev: number): CounselVolunteering {
  if (tauBenev >= 75) return 'forthcoming';
  if (tauBenev >= 50) return 'guarded';
  if (tauBenev >= 25) return 'reluctant';
  return 'silent';
}

function opinionForSignal(signal: number): CounselOpinion {
  if (signal >= 50) return 'strongly_recommend';
  if (signal >= 10) return 'recommend';
  if (signal >= -20) return 'caution';
  return 'discourage';
}

/**
 * Give deterministic, qualitative counsel from the holder's private state.
 * Credence in the commander attenuates what the holder volunteers; rivalry is
 * structural because origin-inclusive chair eligibility makes the candidate a
 * direct competitor.
 */
export function counselForCandidate(
  holder: PieceState,
  candidate: CounselCandidate,
): PieceCounsel {
  const affinity = holder.dyadicAffinity[candidate.id] ?? 0;
  const classBias = holder.classPrestige[candidate.originRole];
  const rumour = holder.rumor.leaderAppraisal;
  const credence = Math.max(0, Math.min(100, holder.credence.tauBenev));
  const informedSignal = Math.trunc(
    ((affinity + classBias + rumour) * credence) / 100,
  );
  const rivalryPenalty = isChairRival(holder, candidate) ? 60 : 0;
  const signal = informedSignal - rivalryPenalty;
  const opinion = opinionForSignal(signal);
  const credibilityLoss = Math.abs(
    affinity + classBias + rumour - informedSignal,
  );
  let reason: CounselReason = 'mixed evidence';
  if (
    rivalryPenalty > 0 &&
    rivalryPenalty >= Math.max(Math.abs(classBias), Math.abs(informedSignal))
  ) {
    reason = 'chair rivalry';
  } else if (credibilityLoss >= 25 && credence < 50) {
    reason = 'low credence';
  } else {
    const magnitudes: readonly [CounselReason, number][] = [
      ['personal affinity', Math.abs(affinity)],
      ['class prejudice', Math.abs(classBias)],
      ['rumour appraisal', Math.abs(rumour)],
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
    volunteering: volunteeringForCredence(credence),
  };
}
