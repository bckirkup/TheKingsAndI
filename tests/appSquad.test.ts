import { describe, expect, it } from 'vitest';

import { bootstrapRoster } from '../src/app/careerBootstrap';
import {
  foldPlayerSquad,
  mergePlayerSquadAfterMatch,
  selectPlayerSquad,
} from '../src/app/squadCareer';
import { SQUAD_CONFIG } from '../src/orchestration';
import {
  AUDIT_FOLD_VERSION,
  foldPieceServiceRecords,
  type MatchRecord,
  type StoredPieceState,
} from '../src/persistence';
import type { MatchEvent } from '../src/psychology';

function makeMatch(
  roster: readonly StoredPieceState[],
  events: readonly MatchEvent[],
  matchIndex: number,
  rosterEnd = roster,
): MatchRecord {
  return {
    id: `match-${matchIndex}`,
    campaignId: 'campaign',
    actId: 'act',
    matchIndex,
    seed: matchIndex,
    rosterSnapshot: roster,
    rosterEnd,
    events,
    result: 'DRAW',
    audit: {
      boardQuality: 0,
      executionFidelity: 1,
      realizedQuality: 0,
      refusalCount: 0,
      overrideCount: 0,
      desertionCount: 0,
      quietQuitCount: 0,
      promotionCount: 0,
      meanTrustDelta: 0,
      foldVersion: AUDIT_FOLD_VERSION,
    },
    determinismId: 'heuristic-eval-v1',
    psychConfigVersion: 'engine-config-v1',
    schemaVersion: 2,
  };
}

describe('career squad fielding', () => {
  it('bootstraps a deterministic depth-two squad with distinct identities', () => {
    const first = bootstrapRoster(31);
    const second = bootstrapRoster(31);

    expect(first.roster).toHaveLength(31);
    expect(first.identities).toHaveLength(31);
    expect(
      new Set(first.identities.map((identity) => identity.name)).size,
    ).toBe(31);
    expect(first.roster.map((piece) => piece.id)).toEqual(
      second.roster.map((piece) => piece.id),
    );
    expect(first.identities.map((identity) => identity.name)).toEqual(
      second.identities.map((identity) => identity.name),
    );
    const pawns = first.roster.filter((piece) => piece.role === 'Pawn');
    expect(new Set(pawns.map((piece) => piece.E_i)).size).toBeGreaterThan(1);
    expect(
      new Set(pawns.map((piece) => piece.traits.w_courage)).size,
    ).toBeGreaterThan(1);
    const ids = new Set(first.roster.map((piece) => piece.id));
    expect(
      first.roster.every((piece) =>
        Object.keys(piece.dyadicAffinity).every((peerId) => ids.has(peerId)),
      ),
    ).toBe(true);
  });

  it('fields exactly sixteen chairs and lets a crowned pawn fall back', () => {
    const { roster, identities } = bootstrapRoster(32);
    const pawn = roster.find((piece) => piece.id === 'w:Pawn:00');
    const queen = roster.find((piece) => piece.id === 'w:Queen:00');
    if (pawn === undefined || queen === undefined) {
      throw new Error('expected bootstrap crown contestants');
    }
    const crownedRoster = roster.map((piece) =>
      piece.id === pawn.id
        ? { ...piece, E_i: 20 }
        : piece.id === queen.id
          ? { ...piece, E_i: 100 }
          : piece.role === 'Pawn'
            ? { ...piece, E_i: 10 }
            : piece,
    );
    const crownedIdentities = identities.map((identity) =>
      identity.id === pawn.id
        ? { ...identity, attainedRole: 'Queen' as const }
        : identity,
    );

    const selection = selectPlayerSquad({
      roster: crownedRoster,
      identities: crownedIdentities,
      matches: [],
      match: 1,
      careerSeed: 32,
    });
    const selectedPawn = selection.fielded.lineup.find(
      (member) => member.state.id === pawn.id,
    );

    expect(selection.fielded.lineup).toHaveLength(16);
    expect(selectedPawn?.state.role).toBe('Pawn');
    expect(
      new Set(selection.fielded.lineup.map((member) => member.state.id)).size,
    ).toBe(16);
  });

  it('keeps sixteen chairs after benching and a departed fielded member', () => {
    const { roster, identities } = bootstrapRoster(37);
    const benched = roster.find((piece) => piece.id === 'w:Pawn:00');
    const departed = roster.find((piece) => piece.id === 'w:Pawn:01');
    if (benched === undefined || departed === undefined) {
      throw new Error('expected bench contestants');
    }
    const inputRoster = roster.map((piece) =>
      piece.id === benched.id
        ? { ...piece, status: 'BENCHED' as const }
        : piece,
    );
    const first = selectPlayerSquad({
      roster: inputRoster,
      identities,
      matches: [],
      match: 1,
      careerSeed: 37,
    });
    const departedMatch = makeMatch(
      inputRoster,
      first.events,
      1,
      first.roster.filter((piece) => piece.id !== departed.id),
    );
    const next = selectPlayerSquad({
      roster: first.roster,
      identities: first.identities,
      matches: [departedMatch],
      match: 2,
      careerSeed: 37,
    });

    expect(next.fielded.lineup).toHaveLength(16);
  });

  it('persists deterministic conscripts when a chair has no eligible member', () => {
    const { roster, identities } = bootstrapRoster(38);
    const veteran = roster.find((piece) => piece.id === 'w:Pawn:00');
    if (veteran === undefined) throw new Error('expected veteran template');
    const tunedRoster = roster.map((piece) =>
      piece.id === veteran.id
        ? {
            ...piece,
            T_i: 91,
            B_i: 100,
            dyadicAffinity: { 'w:Pawn:01': 80 },
            credence: { ...piece.credence, tauAbil: 99, tauBenev: 99 },
          }
        : piece,
    );
    const retiredRoster = tunedRoster.map((piece) =>
      piece.role === 'King' ? piece : { ...piece, status: 'RETIRED' as const },
    );
    const selection = selectPlayerSquad({
      roster: retiredRoster,
      identities,
      matches: [],
      match: 1,
      careerSeed: 38,
    });

    expect(selection.fielded.lineup).toHaveLength(16);
    expect(selection.fielded.conscriptsFielded).toBe(15);
    expect(selection.roster).toHaveLength(46);
    expect(selection.identities).toHaveLength(46);
    const conscripts = selection.fielded.lineup.filter(
      (member) => member.provenance === 'conscript',
    );
    expect(
      conscripts.every((member) =>
        member.state.id.includes(':conscript:38:1:'),
      ),
    ).toBe(true);
    expect(
      conscripts.every(
        (member) => Object.keys(member.state.dyadicAffinity).length === 0,
      ),
    ).toBe(true);
    expect(conscripts.every((member) => member.state.B_i === 0)).toBe(true);
    expect(conscripts.every((member) => member.state.T_i === 20)).toBe(true);
    expect(
      conscripts.every((member) => member.state.credence.tauAbil === 50),
    ).toBe(true);
    expect(
      conscripts.every((member) =>
        selection.identities.some(
          (identity) =>
            identity.id === member.state.id &&
            !identity.name.startsWith('Conscript '),
        ),
      ),
    ).toBe(true);
  });

  it('does not log a fired member as passed over', () => {
    const { roster, identities } = bootstrapRoster(39);
    const fired = roster.find((piece) => piece.id === 'w:Pawn:00');
    if (fired === undefined) throw new Error('expected fired member');
    const firedRoster = roster.map((piece) =>
      piece.id === fired.id ? { ...piece, status: 'FIRED' as const } : piece,
    );
    const selection = selectPlayerSquad({
      roster: firedRoster,
      identities,
      matches: [],
      match: 1,
      careerSeed: 39,
    });
    expect(selection.events.some((event) => event.pieceId === fired.id)).toBe(
      false,
    );
    const records = foldPieceServiceRecords([
      makeMatch(firedRoster, selection.events, 1),
    ]).records.get(fired.id);
    expect(records?.timesPassedOver).toBe(0);
  });

  it('pinned members win an eligible chair and fallback policy is sensitive', () => {
    const { roster, identities } = bootstrapRoster(33);
    const strong = roster.find((piece) => piece.id === 'w:Pawn:00');
    const rested = roster.find((piece) => piece.id === 'w:Pawn:01');
    if (strong === undefined || rested === undefined) {
      throw new Error('expected bootstrap pawn pair');
    }
    const tunedRoster = roster.map((piece) =>
      piece.id === strong.id
        ? { ...piece, E_i: 100, B_i: 100 }
        : piece.id === rested.id
          ? { ...piece, E_i: 20, B_i: 0 }
          : piece,
    );
    const strongest = selectPlayerSquad({
      roster: tunedRoster,
      identities,
      matches: [],
      match: 1,
      policy: 'strongest_available',
      careerSeed: 33,
    });
    const restedSelection = selectPlayerSquad({
      roster: tunedRoster,
      identities,
      matches: [],
      match: 1,
      policy: 'rest_traumatised',
      careerSeed: 33,
    });
    const pinned = selectPlayerSquad({
      roster: tunedRoster,
      identities,
      matches: [],
      match: 1,
      pinnedMemberIds: new Set([rested.id]),
      careerSeed: 33,
    });

    expect(
      strongest.fielded.lineup.map((member) => member.state.id),
    ).not.toEqual(
      restedSelection.fielded.lineup.map((member) => member.state.id),
    );
    expect(
      pinned.fielded.lineup.some((member) => member.state.id === rested.id),
    ).toBe(true);
  });

  it('changing pool depth changes the bootstrapped squad size', () => {
    const originalDepth = SQUAD_CONFIG.POOL_DEPTH_FACTOR;
    try {
      (SQUAD_CONFIG as { POOL_DEPTH_FACTOR: number }).POOL_DEPTH_FACTOR = 1;
      expect(bootstrapRoster(34).roster).toHaveLength(16);
      (SQUAD_CONFIG as { POOL_DEPTH_FACTOR: number }).POOL_DEPTH_FACTOR = 2;
      expect(bootstrapRoster(34).roster).toHaveLength(31);
    } finally {
      (SQUAD_CONFIG as { POOL_DEPTH_FACTOR: number }).POOL_DEPTH_FACTOR =
        originalDepth;
    }
  });

  it('folds passed-over streaks, redemption, and obsolescence from events', () => {
    const { roster, identities } = bootstrapRoster(35);
    const target = roster.find((piece) => piece.id === 'w:Pawn:00');
    if (target === undefined) throw new Error('expected target pawn');
    const passedOver = (match: number): MatchEvent => ({
      t: 'SQUAD_FIELDING',
      match,
      side: 'w',
      pieceId: target.id,
      decision: 'passed_over',
      originRole: 'Pawn',
      provenance: 'original',
    });
    const fielded: MatchEvent = {
      t: 'SQUAD_FIELDING',
      match: 3,
      side: 'w',
      pieceId: target.id,
      decision: 'fielded',
      chair: 'Pawn',
      originRole: 'Pawn',
      provenance: 'original',
    };
    const matches = [
      makeMatch(roster, [passedOver(1)], 1),
      makeMatch(
        roster,
        [passedOver(2)],
        2,
        roster.map((piece) =>
          piece.id === target.id ? { ...piece, T_i: piece.T_i - 10 } : piece,
        ),
      ),
      makeMatch(
        roster,
        [fielded],
        3,
        roster.map((piece) =>
          piece.id === target.id ? { ...piece, T_i: piece.T_i - 6 } : piece,
        ),
      ),
    ];
    const folded = foldPlayerSquad(roster, identities, matches);
    const member = folded.find((candidate) => candidate.state.id === target.id);
    expect(member?.service.consecutiveNonSelections).toBe(0);
    expect(member?.state.T_i).toBeGreaterThan(target.T_i - 10);
    expect(member?.state.T_i).toBe(target.T_i - 6);

    const retired = foldPlayerSquad(
      roster,
      identities,
      Array.from({ length: 6 }, (_, index) =>
        makeMatch(roster, [passedOver(index + 1)], index + 1),
      ),
    ).find((candidate) => candidate.state.id === target.id);
    expect(retired?.status).toBe('retired');
    const next = selectPlayerSquad({
      roster,
      identities,
      matches: Array.from({ length: 6 }, (_, index) =>
        makeMatch(roster, [passedOver(index + 1)], index + 1),
      ),
      match: 7,
      careerSeed: 35,
    });
    expect(
      next.fielded.lineup.some((candidate) => candidate.state.id === target.id),
    ).toBe(false);
  });

  it('returns a captured fielded member to the next roster', () => {
    const { roster, identities } = bootstrapRoster(36);
    const selection = selectPlayerSquad({
      roster,
      identities,
      matches: [],
      match: 1,
      careerSeed: 36,
    });
    const target = selection.fielded.lineup[0];
    if (target === undefined) throw new Error('expected fielded member');
    const matchRoster = selection.fielded.lineup
      .filter((member) => member.state.id !== target.state.id)
      .map((member) => ({ ...member.state, status: 'ACTIVE' as const }));
    const events: readonly MatchEvent[] = selection.events;
    const merged = mergePlayerSquadAfterMatch({
      roster: selection.roster,
      identities: selection.identities,
      fieldedRoster: selection.fielded.lineup.map((member) => ({
        ...member.state,
        status: 'ACTIVE' as const,
      })),
      matchRoster,
      events,
      matches: [],
      match: 1,
    });
    expect(merged.roster.some((piece) => piece.id === target.state.id)).toBe(
      true,
    );
    const next = selectPlayerSquad({
      roster: merged.roster,
      identities: selection.identities,
      matches: [],
      match: 2,
      careerSeed: 36,
    });
    expect(
      next.fielded.lineup.some((member) => member.state.id === target.state.id),
    ).toBe(true);
  });
});
