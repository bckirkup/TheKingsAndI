import type { PieceId, Side } from '../chess';
import type {
  MatchRecord,
  PieceIdentityRecord,
  StoredPieceState,
} from '../persistence';
import type { MatchEvent, PieceRole, PieceState } from '../psychology';
import {
  fieldSquad,
  foldSquadMatch,
  type SquadFielded,
  type SquadMember,
  type SquadService,
  type FieldingPolicy,
} from '../orchestration/squadFielding';

const EMPTY_SERVICE: SquadService = {
  matchesPlayed: 0,
  desertions: 0,
  refusals: 0,
  captures: 0,
  consecutiveNonSelections: 0,
};

function role(value: string): PieceRole {
  if (
    value === 'Pawn' ||
    value === 'Knight' ||
    value === 'Bishop' ||
    value === 'Rook' ||
    value === 'Queen' ||
    value === 'King'
  ) {
    return value;
  }
  throw new Error(`Unknown piece role: ${value}`);
}

function statusForSquad(piece: StoredPieceState): SquadMember['status'] {
  switch (piece.status) {
    case 'BENCHED':
      return 'benched';
    case 'FIRED':
      return 'fired';
    case 'RETIRED':
      return 'retired';
    default:
      return 'available';
  }
}

function memberFrom(
  piece: StoredPieceState,
  identity: PieceIdentityRecord | undefined,
  service: SquadService = EMPTY_SERVICE,
): SquadMember {
  return {
    state: piece,
    originRole: role(identity?.originRole ?? piece.role),
    ...(identity?.attainedRole === undefined
      ? {}
      : { attainedRole: role(identity.attainedRole) }),
    status: statusForSquad(piece),
    availableAtMatch: 1,
    provenance: piece.id.includes(':conscript:') ? 'conscript' : 'original',
    service,
    ...(piece.status === 'RETIRED' ? { retirementCause: 'trauma' } : {}),
  };
}

function stateMap(
  pieces: readonly StoredPieceState[] | readonly PieceState[],
): Map<PieceId, PieceState> {
  return new Map(
    pieces.map((piece) => {
      if ('status' in piece) {
        const { status, ...state } = piece;
        void status;
        return [piece.id, state];
      }
      return [piece.id, piece];
    }),
  );
}

function decisionEvents(
  match: MatchRecord,
  fallbackSide: Side,
): Extract<MatchEvent, { t: 'SQUAD_FIELDING' }>[] {
  return match.events.filter(
    (event): event is Extract<MatchEvent, { t: 'SQUAD_FIELDING' }> =>
      event.t === 'SQUAD_FIELDING' && event.side === fallbackSide,
  );
}

function membersForMatch(
  members: readonly SquadMember[],
  match: MatchRecord,
  identities: ReadonlyMap<string, PieceIdentityRecord>,
): SquadMember[] {
  const snapshot = stateMap(match.rosterSnapshot);
  const allPieces = [...match.rosterSnapshot, ...match.rosterEnd];
  const byId = new Map<string, StoredPieceState>();
  for (const piece of allPieces) byId.set(piece.id, piece);
  return [
    ...members.map((member) => {
      const piece = byId.get(member.state.id);
      return piece === undefined
        ? member
        : { ...member, state: snapshot.get(member.state.id) ?? member.state };
    }),
    ...[...byId.entries()]
      .filter(([id]) => !members.some((member) => member.state.id === id))
      .map(([, piece]) => memberFrom(piece, identities.get(piece.id))),
  ];
}

function applyLoggedPsychologyDeltas(
  members: readonly SquadMember[],
  match: MatchRecord,
): SquadMember[] {
  const deltas = new Map<PieceId, Partial<Record<string, number>>>();
  for (const event of match.events) {
    if (event.t !== 'PSYCH_DELTA') continue;
    const fields = deltas.get(event.pieceId) ?? {};
    fields[event.field] = (fields[event.field] ?? 0) + (event.delta ?? 0);
    deltas.set(event.pieceId, fields);
  }
  return members.map((member) => {
    const fields = deltas.get(member.state.id);
    if (fields === undefined) return member;
    const state = { ...member.state };
    for (const [field, delta] of Object.entries(fields)) {
      if (field === 'B_i') state.B_i += delta ?? 0;
      else if (field === 'T_i') state.T_i += delta ?? 0;
      else if (field === 'M_i') state.M_i += delta ?? 0;
      else if (field === 'E_i') state.E_i += delta ?? 0;
    }
    return { ...member, state };
  });
}

function fieldedForMatch(
  members: readonly SquadMember[],
  match: MatchRecord,
  side: Side,
): {
  readonly fielded: SquadFielded;
  readonly fieldedIds: ReadonlySet<PieceId>;
} {
  const decisions = decisionEvents(match, side);
  const byId = new Map(members.map((member) => [member.state.id, member]));
  const fieldedMembers = decisions
    .filter((event) => event.decision === 'fielded')
    .map((event) => {
      const member = byId.get(event.pieceId);
      return member === undefined
        ? undefined
        : {
            ...member,
            state: {
              ...member.state,
              ...(event.chair === undefined ? {} : { role: event.chair }),
            },
          };
    })
    .filter((member): member is SquadMember => member !== undefined);
  if (decisions.length === 0) {
    const legacy = match.rosterSnapshot.filter(
      (piece) => piece.status === 'ACTIVE',
    );
    return {
      fielded: {
        lineup: legacy
          .map((piece) => byId.get(piece.id))
          .filter((member): member is SquadMember => member !== undefined),
        conscriptsFielded: 0,
        veteransRested: 0,
      },
      fieldedIds: new Set(legacy.map((piece) => piece.id)),
    };
  }
  return {
    fielded: {
      lineup: fieldedMembers,
      conscriptsFielded: fieldedMembers.filter(
        (member) => member.provenance === 'conscript',
      ).length,
      veteransRested: 0,
    },
    fieldedIds: new Set(fieldedMembers.map((member) => member.state.id)),
  };
}

export function foldPlayerSquad(
  initialRoster: readonly StoredPieceState[],
  identities: readonly PieceIdentityRecord[],
  matches: readonly MatchRecord[],
  side: Side = 'w',
): readonly SquadMember[] {
  const identityMap = new Map(
    identities.map((identity) => [identity.id, identity]),
  );
  const orderedMatches = [...matches].sort(
    (left, right) => left.matchIndex - right.matchIndex,
  );
  const firstSnapshot = orderedMatches[0]?.rosterSnapshot ?? initialRoster;
  let members = firstSnapshot.map((piece) =>
    memberFrom(piece, identityMap.get(piece.id)),
  );
  for (const match of orderedMatches) {
    const matchMembers = membersForMatch(members, match, identityMap);
    const loggedMembers = applyLoggedPsychologyDeltas(matchMembers, match);
    const { fielded, fieldedIds } = fieldedForMatch(loggedMembers, match, side);
    const desertions = new Set(
      match.events
        .filter(
          (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
            event.t === 'DESERTION',
        )
        .map((event) => event.pieceId),
    );
    const refusals = new Map<PieceId, number>();
    for (const event of match.events) {
      if (event.t !== 'REFUSAL') continue;
      refusals.set(event.pieceId, (refusals.get(event.pieceId) ?? 0) + 1);
    }
    const promotions = new Map<PieceId, PieceRole>();
    for (const event of match.events) {
      if (event.t === 'PROMOTION') promotions.set(event.pieceId, event.toRole);
    }
    const resultIds = new Set(match.rosterEnd.map((piece) => piece.id));
    const departedRoster = loggedMembers
      .filter(
        (member) =>
          fieldedIds.has(member.state.id) && !resultIds.has(member.state.id),
      )
      .map((member) => member.state);
    const folded = foldSquadMatch({
      side,
      members: loggedMembers,
      fielded,
      resultRoster: match.rosterEnd,
      departedRoster,
      desertions,
      refusals,
      fieldedIds,
      promotions,
      match: match.matchIndex,
    });
    const resultStates = stateMap(match.rosterEnd);
    members = folded.members.map((member) => ({
      ...member,
      state: resultStates.get(member.state.id) ?? member.state,
    }));
  }
  const knownIds = new Set(members.map((member) => member.state.id));
  members = [
    ...members,
    ...initialRoster
      .filter((piece) => !knownIds.has(piece.id))
      .map((piece) => memberFrom(piece, identityMap.get(piece.id))),
  ];
  const currentById = new Map(initialRoster.map((piece) => [piece.id, piece]));
  return members.map((member) => {
    const current = currentById.get(member.state.id);
    if (current === undefined) return member;
    return {
      ...member,
      ...(current.status === 'BENCHED'
        ? { status: 'benched' as const }
        : current.status === 'FIRED'
          ? { status: 'fired' as const }
          : {}),
    };
  });
}

function conscript(
  members: readonly SquadMember[],
  roleName: PieceRole,
  careerSeed: number,
  match: number,
  sequence: number,
): SquadMember {
  const template = members.find((member) => member.originRole === roleName);
  if (template === undefined) throw new Error(`No template for ${roleName}.`);
  const id = `w:${roleName}:conscript:${careerSeed}:${match}:${String(sequence).padStart(2, '0')}`;
  const state = { ...template.state, id, role: roleName };
  return {
    ...template,
    state,
    originRole: roleName,
    status: 'available',
    availableAtMatch: match,
    provenance: 'conscript',
    service: EMPTY_SERVICE,
  };
}

export interface PlayerSquadSelection {
  readonly members: readonly SquadMember[];
  readonly fielded: SquadFielded;
  readonly roster: readonly StoredPieceState[];
  readonly identities: readonly PieceIdentityRecord[];
  readonly events: readonly Extract<MatchEvent, { t: 'SQUAD_FIELDING' }>[];
}

export function selectPlayerSquad(input: {
  readonly roster: readonly StoredPieceState[];
  readonly identities: readonly PieceIdentityRecord[];
  readonly matches: readonly MatchRecord[];
  readonly match: number;
  readonly careerSeed: number;
  readonly policy?: FieldingPolicy;
  readonly pinnedMemberIds?: ReadonlySet<PieceId>;
}): PlayerSquadSelection {
  const members = foldPlayerSquad(
    input.roster,
    input.identities,
    input.matches,
  );
  const fieldingPool =
    input.pinnedMemberIds === undefined
      ? { members, fieldingPolicy: input.policy ?? 'strongest_available' }
      : {
          members,
          fieldingPolicy: input.policy ?? 'strongest_available',
          pinnedMemberIds: input.pinnedMemberIds,
        };
  const fielded = fieldSquad(
    fieldingPool,
    input.match,
    (roleName, match, sequence) =>
      conscript(members, roleName, input.careerSeed, match, sequence),
  );
  const selectedIds = new Set(fielded.lineup.map((member) => member.state.id));
  const chairById = new Map(
    fielded.lineup.map((member) => [member.state.id, member.state.role]),
  );
  const events = [
    ...members,
    ...fielded.lineup.filter(
      (member) =>
        !members.some((candidate) => candidate.state.id === member.state.id),
    ),
  ].map((member) => {
    const chair = chairById.get(member.state.id);
    return {
      t: 'SQUAD_FIELDING' as const,
      match: input.match,
      side: 'w' as const,
      pieceId: member.state.id,
      decision: selectedIds.has(member.state.id)
        ? ('fielded' as const)
        : ('passed_over' as const),
      ...(chair === undefined ? {} : { chair }),
      originRole: member.originRole,
      provenance: member.provenance,
    };
  });
  const rosterById = new Map(input.roster.map((piece) => [piece.id, piece]));
  for (const member of fielded.lineup) {
    if (!rosterById.has(member.state.id)) {
      rosterById.set(member.state.id, { ...member.state, status: 'ACTIVE' });
    }
  }
  return {
    members,
    fielded,
    roster: [...rosterById.values()],
    identities: input.identities.concat(
      fielded.lineup
        .filter(
          (member) =>
            !input.identities.some(
              (identity) => identity.id === member.state.id,
            ),
        )
        .map((member) => ({
          id: member.state.id,
          name: `Conscript ${member.originRole} ${input.match}-${member.state.id.split(':').at(-1) ?? '0'}`,
          bornInMatch: input.match,
          originRole: member.originRole,
        })),
    ),
    events,
  };
}

export function mergePlayerSquadAfterMatch(input: {
  readonly roster: readonly StoredPieceState[];
  readonly identities: readonly PieceIdentityRecord[];
  readonly fieldedRoster: readonly StoredPieceState[];
  readonly matchRoster: readonly PieceState[];
  readonly events: readonly MatchEvent[];
  readonly matches: readonly MatchRecord[];
  readonly match: number;
}): {
  readonly roster: StoredPieceState[];
  readonly events: readonly MatchEvent[];
} {
  const identityById = new Map(
    input.identities.map((identity) => [identity.id, identity]),
  );
  const members = foldPlayerSquad(
    input.roster,
    input.identities,
    input.matches,
  );
  const fieldedIds = new Set(
    input.events
      .filter(
        (event): event is Extract<MatchEvent, { t: 'SQUAD_FIELDING' }> =>
          event.t === 'SQUAD_FIELDING' && event.decision === 'fielded',
      )
      .map((event) => event.pieceId),
  );
  const chairById = new Map(
    input.events
      .filter(
        (event): event is Extract<MatchEvent, { t: 'SQUAD_FIELDING' }> =>
          event.t === 'SQUAD_FIELDING' &&
          event.decision === 'fielded' &&
          event.chair !== undefined,
      )
      .map((event) => [event.pieceId, event.chair]),
  );
  const lineup = input.fieldedRoster
    .filter((piece) => fieldedIds.has(piece.id))
    .map((piece) => ({
      ...memberFrom(piece, identityById.get(piece.id)),
      state: { ...piece, role: chairById.get(piece.id) ?? piece.role },
    }));
  const deltaById = new Map<PieceId, Partial<Record<string, number>>>();
  for (const event of input.events) {
    if (event.t !== 'PSYCH_DELTA') continue;
    const fields = deltaById.get(event.pieceId) ?? {};
    fields[event.field] = (fields[event.field] ?? 0) + (event.delta ?? 0);
    deltaById.set(event.pieceId, fields);
  }
  const adjustedLineup = lineup.map((member) => {
    const fields = deltaById.get(member.state.id);
    if (fields === undefined) return member;
    const state = { ...member.state };
    for (const [field, delta] of Object.entries(fields)) {
      if (field === 'B_i') state.B_i += delta ?? 0;
      else if (field === 'T_i') state.T_i += delta ?? 0;
      else if (field === 'M_i') state.M_i += delta ?? 0;
      else if (field === 'E_i') state.E_i += delta ?? 0;
    }
    return { ...member, state };
  });
  const resultById = stateMap(input.matchRoster);
  const departed = adjustedLineup
    .filter((member) => !resultById.has(member.state.id))
    .map((member) => member.state);
  const desertions = new Set(
    input.events
      .filter(
        (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
          event.t === 'DESERTION',
      )
      .map((event) => event.pieceId),
  );
  const refusals = new Map<PieceId, number>();
  const promotions = new Map<PieceId, PieceRole>();
  for (const event of input.events) {
    if (event.t === 'REFUSAL') {
      refusals.set(event.pieceId, (refusals.get(event.pieceId) ?? 0) + 1);
    } else if (event.t === 'PROMOTION') {
      promotions.set(event.pieceId, event.toRole);
    }
  }
  const folded = foldSquadMatch({
    side: 'w',
    members,
    fielded: {
      lineup: adjustedLineup,
      conscriptsFielded: 0,
      veteransRested: 0,
    },
    resultRoster: input.matchRoster,
    departedRoster: departed,
    desertions,
    refusals,
    fieldedIds,
    promotions,
    match: input.match,
  });
  const nextRoster = folded.members.map((member) => {
    const state = member.state;
    const previous = input.roster.find((piece) => piece.id === state.id);
    const status: StoredPieceState['status'] =
      member.status === 'retired'
        ? 'RETIRED'
        : previous?.status === 'BENCHED' || previous?.status === 'FIRED'
          ? previous.status
          : 'ACTIVE';
    return { ...state, status };
  });
  const lifecycleEvents: MatchEvent[] = folded.events.flatMap((event) =>
    event.t === 'OBSOLESCENCE'
      ? [
          {
            t: 'SQUAD_OBSOLESCENCE' as const,
            match: event.match,
            side: event.side,
            pieceId: event.pieceId,
            nonSelectionStreak: event.nonSelectionStreak,
          },
        ]
      : [],
  );
  return { roster: nextRoster, events: lifecycleEvents };
}
