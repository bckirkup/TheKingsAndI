import type { PieceId } from '../core/ids';
import { ENGINE_CONFIG } from './config';
import type { PieceState, RumorState } from './types';
import { clampPermille, clampTrust } from './clamp';

/** Geometric attention weight by board distance (docs/belief_model.md §3). */
export function attentionWeight(distanceSquares: number): number {
  const decay = ENGINE_CONFIG.ATTENTION_DISTANCE_DECAY;
  const weight = 1 - decay * Math.max(0, distanceSquares);
  return Math.max(0.1, weight);
}

/**
 * Leader prior memory feeding V_leader_implied (ADR 0016 channel 2).
 * Simplified: track-record scalar blended with the ordered move value.
 */
export function calculateLeaderImpliedValue(
  moveLeaderValue: number,
  leaderTrackRecord: number,
): number {
  const priorWeight = Math.max(0, Math.min(1, leaderTrackRecord / 100));
  return moveLeaderValue * (0.5 + priorWeight * 0.5);
}

/** Diffuse rumor scalars across the affinity graph (ADR 0016 channel 3). */
export function diffuseRumor(
  listener: PieceState,
  speaker: PieceState,
): RumorState {
  const affinity = listener.dyadicAffinity[speaker.id] ?? 0;
  const classBias = listener.classPrestige[speaker.role] ?? 0;
  const credibility = Math.max(
    0,
    Math.min(1, (affinity + classBias + 100) / 200),
  );
  const pLossRate = ENGINE_CONFIG.RUMOR_P_LOSS_RATE * credibility;
  const leaderRate = ENGINE_CONFIG.RUMOR_LEADER_RATE * credibility;
  return {
    pLossTeam: clampPermille(
      listener.rumor.pLossTeam +
        Math.trunc(
          (speaker.rumor.pLossTeam - listener.rumor.pLossTeam) * pLossRate,
        ),
    ),
    leaderAppraisal: clampTrust(
      listener.rumor.leaderAppraisal +
        Math.trunc(
          (speaker.rumor.leaderAppraisal - listener.rumor.leaderAppraisal) *
            leaderRate,
        ),
    ),
  };
}

export function applyRumorDiffusion(
  roster: readonly PieceState[],
  speakerId: PieceId,
): PieceState[] {
  const speaker = roster.find((piece) => piece.id === speakerId);
  if (speaker === undefined) return [...roster];
  return roster.map((piece) => {
    if (piece.id === speakerId) return piece;
    return { ...piece, rumor: diffuseRumor(piece, speaker) };
  });
}
