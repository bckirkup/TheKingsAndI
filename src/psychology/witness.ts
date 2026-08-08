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
  const affinity = clampAffinity(
    (witness.dyadicAffinity[deserter.id] ?? 0) -
      ENGINE_CONFIG.WITNESS_COWARD_AFFINITY_LOSS,
  );
  const updated = {
    ...witness,
    dyadicAffinity: {
      ...witness.dyadicAffinity,
      [deserter.id]: affinity,
    },
    ...(appraisal === 'brave'
      ? {
          T_i: clampTrust(witness.T_i - ENGINE_CONFIG.WITNESS_BRAVE_TRUST_LOSS),
          rumor: {
            ...witness.rumor,
            pLossTeam: Math.min(1_000, witness.rumor.pLossTeam + 80),
          },
        }
      : {}),
  };
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
