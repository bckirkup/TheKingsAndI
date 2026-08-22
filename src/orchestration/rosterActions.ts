import { calculateBenchingTrustPenalties } from '../psychology/events';
import {
  applyCostlySignal,
  type MatchEvent,
  type PieceState,
} from '../psychology';
import type {
  BenchPreview,
  FirePreview,
  PieceIdentityRecord,
  StoredPieceState,
} from '../persistence/types';
import type { LeaderId } from '../core/ids';

import {
  applyReputationTransfer,
  rosterBenevolenceAppraisal,
  rosterLaunderingRisk,
} from './campaignPolicy';
import { ENGINE_CONFIG } from '../psychology';

function chairRole(
  piece: StoredPieceState,
  identities: ReadonlyMap<string, PieceIdentityRecord>,
): PieceState['role'] {
  return identities.get(piece.id)?.originRole ?? piece.role;
}

/** Keep a failing piece — costly signal `retained_piece` (trust_dynamics §3). */
export function applyRetainFailingPiece(
  _piece: StoredPieceState,
  roster: readonly StoredPieceState[],
  ply: number,
): {
  readonly roster: StoredPieceState[];
  readonly events: MatchEvent[];
} {
  const events: MatchEvent[] = [];
  const next = roster.map((entry) => {
    const applied = applyCostlySignal(entry, 'retained_piece', ply);
    events.push(applied.event);
    return { ...entry, T_i: applied.piece.T_i };
  });
  return { roster: next, events };
}

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

export function applyRecruit(input: {
  readonly freeAgent: StoredPieceState;
  readonly roster: readonly StoredPieceState[];
  readonly leaderAbilityTrust: number;
  readonly identity: PieceIdentityRecord;
  readonly leaderId: LeaderId;
}): {
  readonly roster: StoredPieceState[];
  readonly event: MatchEvent;
  readonly launderingRisk: boolean;
} {
  const benevolence = rosterBenevolenceAppraisal(
    input.roster.filter((piece) => piece.status === 'ACTIVE'),
  );
  const recruited = applyReputationTransfer(
    { ...input.freeAgent, status: 'ACTIVE' as const },
    input.leaderAbilityTrust,
    benevolence,
    input.identity,
    input.leaderId,
  );
  const roster = [...input.roster, recruited];
  const benchDepth = roster.filter(
    (piece) => piece.status === 'BENCHED',
  ).length;
  return {
    roster,
    event: { t: 'ROSTER_RECRUIT', pieceId: input.freeAgent.id },
    launderingRisk: rosterLaunderingRisk([recruited], benchDepth),
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

export function mergeRosterAfterMatch(
  lineupRoster: readonly StoredPieceState[],
  matchRoster: readonly PieceState[],
  events: readonly MatchEvent[],
  identities: readonly PieceIdentityRecord[] = [],
): StoredPieceState[] {
  const matchById = new Map(matchRoster.map((piece) => [piece.id, piece]));
  const identitiesById = new Map(
    identities.map((identity) => [identity.id, identity]),
  );
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
        ...(updated === undefined ||
        ENGINE_CONFIG.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES
          ? {}
          : { role: chairRole(piece, identitiesById) }),
        status: 'DESERTED' as const,
      };
    }
    const updated = matchById.get(piece.id);
    if (updated === undefined) {
      return { ...piece, status: 'CAPTURED' as const };
    }
    return {
      ...updated,
      role: ENGINE_CONFIG.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES
        ? updated.role
        : chairRole(piece, identitiesById),
      status: 'ACTIVE' as const,
    };
  });
}
