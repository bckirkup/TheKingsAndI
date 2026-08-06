import { quantizeBoardValue } from '../core/math';
import { ENGINE_CONFIG } from './config';
import type {
  CandidateMoveEvaluation,
  MatchEvent,
  PieceState,
  SacrificeAttribution,
} from './types';
import { clampAffinity, clampTrust } from './clamp';

export function isWitnessedSacrifice(
  attribution: SacrificeAttribution,
): boolean {
  return attribution.removedThreatToPeer || attribution.enabledForcedWin;
}

export function appraiseDesertionWitness(
  witness: PieceState,
  deserter: PieceState,
  refusedMoveEval: CandidateMoveEvaluation,
  ply: number,
): { readonly witness: PieceState; readonly event: MatchEvent } {
  const witnessOwn = refusedMoveEval.deltaV_board;
  const appraisal: 'brave' | 'coward' = witnessOwn < 0 ? 'brave' : 'coward';
  let updated = { ...witness };
  if (appraisal === 'brave') {
    updated = {
      ...updated,
      dyadicAffinity: {
        ...updated.dyadicAffinity,
        [deserter.id]: clampAffinity(
          (updated.dyadicAffinity[deserter.id] ?? 0) +
            ENGINE_CONFIG.WITNESS_BRAVE_AFFINITY_GAIN,
        ),
      },
      T_i: clampTrust(updated.T_i - ENGINE_CONFIG.WITNESS_BRAVE_TRUST_LOSS),
      rumor: {
        ...updated.rumor,
        pLossTeam: Math.min(1_000, updated.rumor.pLossTeam + 80),
      },
    };
  } else {
    updated = {
      ...updated,
      dyadicAffinity: {
        ...updated.dyadicAffinity,
        [deserter.id]: clampAffinity(
          (updated.dyadicAffinity[deserter.id] ?? 0) -
            ENGINE_CONFIG.WITNESS_COWARD_AFFINITY_LOSS,
        ),
      },
    };
  }
  const event: MatchEvent = {
    t: 'DESERTION_WITNESS',
    ply,
    witnessId: witness.id,
    deserterId: deserter.id,
    appraisal,
    witnessOwnValue: quantizeBoardValue(witnessOwn) / 1_000,
  };
  return { witness: updated, event };
}

export function sharedBondScalar(
  observer: PieceState,
  subject: PieceState,
): number {
  const affinity = observer.dyadicAffinity[subject.id] ?? 0;
  const classPrestige = observer.classPrestige[subject.role] ?? 0;
  return Math.max(0, (affinity + classPrestige) / 200);
}
