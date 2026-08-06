import { calculateBenchingTrustPenalties } from '../psychology/events';
import type { MatchEvent, PieceState } from '../psychology';
import type {
  BenchPreview,
  FirePreview,
  StoredPieceState,
} from '../persistence/types';

export function previewBench(
  piece: StoredPieceState,
  activeRoster: readonly StoredPieceState[],
): BenchPreview {
  const activePeers = activeRoster.filter(
    (peer) => peer.id !== piece.id && peer.status === 'ACTIVE',
  );
  const penalties = calculateBenchingTrustPenalties(piece, activePeers);
  return {
    pieceId: piece.id,
    selfTrustDelta: penalties.benchedPieceNewTrust - piece.T_i,
    peerTrustDeltas: penalties.updatedPeers.map((peer) => ({
      pieceId: peer.id,
      delta: peer.T_i - (activePeers.find((p) => p.id === peer.id)?.T_i ?? 0),
    })),
  };
}

export function applyBench(
  piece: StoredPieceState,
  activeRoster: readonly StoredPieceState[],
): {
  readonly roster: StoredPieceState[];
  readonly event: MatchEvent;
} {
  const activePeers = activeRoster.filter(
    (peer) => peer.id !== piece.id && peer.status === 'ACTIVE',
  );
  const penalties = calculateBenchingTrustPenalties(piece, activePeers);
  const roster = activeRoster.map((entry) => {
    if (entry.id === piece.id) {
      return {
        ...entry,
        status: 'BENCHED' as const,
        T_i: penalties.benchedPieceNewTrust,
      };
    }
    const updated = penalties.updatedPeers.find((peer) => peer.id === entry.id);
    return updated === undefined ? entry : { ...entry, T_i: updated.T_i };
  });
  return {
    roster,
    event: { t: 'ROSTER_BENCH', pieceId: piece.id },
  };
}

export function previewFire(piece: StoredPieceState): FirePreview {
  return { pieceId: piece.id, newTrust: -100 };
}

export function applyFire(
  piece: StoredPieceState,
  roster: readonly StoredPieceState[],
): {
  readonly roster: StoredPieceState[];
  readonly event: MatchEvent;
} {
  return {
    roster: roster.map((entry) =>
      entry.id === piece.id
        ? { ...entry, status: 'FIRED' as const, T_i: -100 }
        : entry,
    ),
    event: { t: 'ROSTER_FIRE', pieceId: piece.id },
  };
}

export function activeLineup(
  roster: readonly StoredPieceState[],
): PieceState[] {
  return roster
    .filter((piece) => piece.status === 'ACTIVE')
    .map((piece): PieceState => {
      const { status, ...state } = piece;
      void status;
      return state;
    });
}

/** Merge post-match psychology state back into the full stored roster. */
export function mergeRosterAfterMatch(
  lineupRoster: readonly StoredPieceState[],
  matchRoster: readonly PieceState[],
  events: readonly MatchEvent[],
): StoredPieceState[] {
  const matchById = new Map(matchRoster.map((piece) => [piece.id, piece]));
  const desertedIds = new Set(
    events
      .filter((event) => event.t === 'DESERTION')
      .map((event) => event.pieceId),
  );

  return lineupRoster.map((piece) => {
    if (piece.status === 'BENCHED' || piece.status === 'FIRED') {
      return piece;
    }
    if (desertedIds.has(piece.id)) {
      const updated = matchById.get(piece.id);
      return {
        ...(updated ?? piece),
        status: 'DESERTED' as const,
      };
    }
    const updated = matchById.get(piece.id);
    if (updated === undefined) {
      return { ...piece, status: 'CAPTURED' as const };
    }
    return { ...updated, status: 'ACTIVE' as const };
  });
}
