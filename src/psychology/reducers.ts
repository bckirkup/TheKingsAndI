import {
  clampAffinity,
  clampCredence,
  clampMorale,
  clampPermille,
  clampTrauma,
  clampTrust,
} from './clamp';
import type { CredenceState, PieceState, RumorState } from './types';

export function defaultCredence(): CredenceState {
  return { tauBenev: 50, tauAbil: 50, abilityObservationCount: 0 };
}

export function defaultRumor(): RumorState {
  return { pLossTeam: 100, leaderAppraisal: 0 };
}

export function normalizePieceState(piece: PieceState): PieceState {
  const classPrestige = {
    Pawn: clampAffinity(piece.classPrestige.Pawn),
    Knight: clampAffinity(piece.classPrestige.Knight),
    Bishop: clampAffinity(piece.classPrestige.Bishop),
    Rook: clampAffinity(piece.classPrestige.Rook),
    Queen: clampAffinity(piece.classPrestige.Queen),
    King: clampAffinity(piece.classPrestige.King),
  };
  const dyadicAffinity: Record<string, number> = {};
  for (const [peerId, value] of Object.entries(piece.dyadicAffinity)) {
    dyadicAffinity[peerId] = clampAffinity(value);
  }
  return {
    ...piece,
    E_i: Math.max(1, Math.min(100, piece.E_i)),
    T_i: clampTrust(piece.T_i),
    M_i: clampMorale(piece.M_i),
    B_i: clampTrauma(piece.B_i),
    engagementFactor: Math.max(0.1, Math.min(1, piece.engagementFactor)),
    credence: {
      tauBenev: clampCredence(piece.credence.tauBenev),
      tauAbil: clampCredence(piece.credence.tauAbil),
      abilityObservationCount: Math.max(
        0,
        Math.trunc(piece.credence.abilityObservationCount ?? 0),
      ),
    },
    rumor: {
      pLossTeam: clampPermille(piece.rumor.pLossTeam),
      leaderAppraisal: clampTrust(piece.rumor.leaderAppraisal),
    },
    classPrestige,
    dyadicAffinity,
  };
}

export function updatePieceInRoster(
  roster: readonly PieceState[],
  pieceId: string,
  updater: (piece: PieceState) => PieceState,
): PieceState[] {
  return roster.map((piece) =>
    piece.id === pieceId
      ? normalizePieceState(updater(piece))
      : normalizePieceState(piece),
  );
}

export function removePieceFromRoster(
  roster: readonly PieceState[],
  pieceId: string,
): PieceState[] {
  return roster.filter((piece) => piece.id !== pieceId);
}
