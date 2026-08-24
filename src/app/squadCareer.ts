import type { PieceId, Side } from '../chess';
import { PLAYER_LEADER_ID } from '../core/ids';
import { createFreshPieceState, unitForIndex } from '../orchestration/roster';
import type {
  MatchRecord,
  PieceIdentityRecord,
  StoredPieceState,
} from '../persistence';
import type { MatchEvent, PieceRole, PieceState } from '../psychology';
import {
  availableAt,
  applyLevyStandingCost,
  fieldSquad,
  foldSquadMatch,
  stateForLevy,
  SQUAD_CONFIG,
  type SquadFielded,
  type SquadMember,
  type SquadService,
  type FieldingPolicy,
  type SquadConfig,
} from '../orchestration/squadFielding';
import {
  checkInCredence,
  checkOutCredence,
  dispositionForIdentitySeed,
  identityCreationSeed,
} from '../orchestration';
import { SQUAD_NAMES } from './careerBootstrap';

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
    provenance: piece.id.includes(':market:')
      ? 'drafted'
      : piece.id.includes(':conscript:')
        ? 'conscript'
        : 'original',
    service,
  };
}

function stateMap(
  pieces: readonly StoredPieceState[] | readonly PieceState[],
): Map<PieceId, PieceState> {
  return new Map(
    pieces.map((piece) => {
      if ('status' in piece) {
        return [
          piece.id,
          Object.fromEntries(
            Object.entries(piece).filter(([key]) => key !== 'status'),
          ) as PieceState,
        ];
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
    const { fielded, fieldedIds } = fieldedForMatch(matchMembers, match, side);
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
    const departedRoster = matchMembers
      .filter(
        (member) =>
          fieldedIds.has(member.state.id) && !resultIds.has(member.state.id),
      )
      .map((member) => member.state);
    const folded = foldSquadMatch({
      side,
      members: matchMembers,
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
  const obsolescenceIds = new Set(
    matches
      .flatMap((match) => match.events)
      .filter(
        (event): event is Extract<MatchEvent, { t: 'SQUAD_OBSOLESCENCE' }> =>
          event.t === 'SQUAD_OBSOLESCENCE' && event.side === side,
      )
      .map((event) => event.pieceId),
  );
  const currentById = new Map(initialRoster.map((piece) => [piece.id, piece]));
  return members.map((member) => {
    const current = currentById.get(member.state.id);
    if (current === undefined) return member;
    if (current.status === 'RETIRED') {
      return {
        ...member,
        status: 'retired' as const,
        availableAtMatch: Number.MAX_SAFE_INTEGER,
        ...(member.retirementCause === undefined &&
        obsolescenceIds.has(member.state.id)
          ? { retirementCause: 'obsolescence' as const }
          : {}),
      };
    }
    return {
      ...member,
      ...benchOrFireStatus(current.status),
    };
  });
}

function benchOrFireStatus(
  status: StoredPieceState['status'],
): { readonly status: 'benched' | 'fired' } | Record<string, never> {
  if (status === 'BENCHED') return { status: 'benched' };
  if (status === 'FIRED') return { status: 'fired' };
  return {};
}

function storedStatusAfterFold(
  memberStatus: SquadMember['status'],
  previousStatus: StoredPieceState['status'] | undefined,
): StoredPieceState['status'] {
  if (memberStatus === 'retired') return 'RETIRED';
  if (previousStatus === 'BENCHED' || previousStatus === 'FIRED') {
    return previousStatus;
  }
  return 'ACTIVE';
}

function conscript(
  members: readonly SquadMember[],
  roleName: PieceRole,
  careerSeed: number,
  match: number,
  sequence: number,
  config: SquadConfig,
): SquadMember {
  const id = `w:${roleName}:conscript:${careerSeed}:${match}:${String(sequence).padStart(2, '0')}`;
  const memberUnit = unitForIndex(
    (careerSeed % 1000) / 1000,
    match * 31 + sequence,
  );
  const fresh = createFreshPieceState(
    id,
    roleName,
    20,
    memberUnit,
    Math.trunc(memberUnit * 11) - 5,
  );
  const state = stateForLevy(fresh, members, config);
  return {
    state,
    originRole: roleName,
    status: 'available',
    availableAtMatch: match,
    provenance: 'conscript',
    service: EMPTY_SERVICE,
  };
}

function conscriptName(
  identities: readonly PieceIdentityRecord[],
  match: number,
  sequence: number,
): string {
  const usedNames = new Set(identities.map((identity) => identity.name));
  const baseName =
    SQUAD_NAMES[(match + sequence) % SQUAD_NAMES.length] ?? 'Newcomer';
  let name = baseName;
  let suffix = 2;
  while (usedNames.has(name)) {
    name = `${baseName} ${suffix}`;
    suffix += 1;
  }
  return name;
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
  readonly config?: SquadConfig;
}): PlayerSquadSelection {
  const config = input.config ?? SQUAD_CONFIG;
  const members = foldPlayerSquad(
    input.roster,
    input.identities,
    input.matches,
  );
  const checkedOutMembers = members.map((member) => {
    const identity = input.identities.find(
      (candidate) => candidate.id === member.state.id,
    );
    return identity === undefined
      ? member
      : {
          ...member,
          state: checkOutCredence(identity, PLAYER_LEADER_ID, member.state),
        };
  });
  const fieldingPool =
    input.pinnedMemberIds === undefined
      ? {
          members: checkedOutMembers,
          fieldingPolicy: input.policy ?? 'strongest_available',
        }
      : {
          members: checkedOutMembers,
          fieldingPolicy: input.policy ?? 'strongest_available',
          pinnedMemberIds: input.pinnedMemberIds,
        };
  const conscriptNames = new Map<PieceId, string>();
  const fielded = fieldSquad(
    fieldingPool,
    input.match,
    (roleName, match, sequence) => {
      const member = conscript(
        checkedOutMembers,
        roleName,
        input.careerSeed,
        match,
        sequence,
        config,
      );
      conscriptNames.set(
        member.state.id,
        conscriptName(input.identities, match, sequence),
      );
      return member;
    },
  );
  // Charge the working roster's tauBenev, matching the harness pool debit.
  const chargedMembers = applyLevyStandingCost(
    checkedOutMembers,
    fielded.conscriptsFielded,
    config,
  );
  const chargedById = new Map(
    chargedMembers.map((member) => [member.state.id, member]),
  );
  const chargedFielded = {
    ...fielded,
    lineup: fielded.lineup.map((member) => {
      const charged = chargedById.get(member.state.id);
      return charged === undefined
        ? member
        : {
            ...charged,
            state: { ...charged.state, role: member.state.role },
          };
    }),
  };
  const selectedIds = new Set(
    chargedFielded.lineup.map((member) => member.state.id),
  );
  const chairById = new Map(
    chargedFielded.lineup.map((member) => [member.state.id, member.state.role]),
  );
  const eligibleMembers = chargedMembers.filter((member) =>
    availableAt(member, input.match),
  );
  const events = [
    ...eligibleMembers,
    ...chargedFielded.lineup.filter(
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
  for (const member of chargedMembers) {
    const previous = rosterById.get(member.state.id);
    if (previous !== undefined) {
      rosterById.set(member.state.id, {
        ...member.state,
        status: previous.status,
      });
    }
  }
  for (const member of chargedFielded.lineup) {
    if (!rosterById.has(member.state.id)) {
      rosterById.set(member.state.id, { ...member.state, status: 'ACTIVE' });
    }
  }
  return {
    members: chargedMembers,
    fielded: chargedFielded,
    roster: [...rosterById.values()],
    identities: input.identities
      .map((identity) => {
        const charged = chargedById.get(identity.id);
        const original = members.find(
          (member) => member.state.id === identity.id,
        );
        if (
          charged === undefined ||
          original === undefined ||
          charged.state.credence.tauBenev === original.state.credence.tauBenev
        ) {
          return identity;
        }
        return checkInCredence(identity, PLAYER_LEADER_ID, charged.state);
      })
      .concat(
        chargedFielded.lineup
          .filter(
            (member) =>
              !input.identities.some(
                (identity) => identity.id === member.state.id,
              ),
          )
          .map((member) => ({
            id: member.state.id,
            name:
              conscriptNames.get(member.state.id) ??
              `Newcomer ${member.originRole} ${input.match}`,
            bornInMatch: input.match,
            originRole: member.originRole,
            identityCreationSeed: identityCreationSeed(
              input.careerSeed,
              member.state.id,
            ),
            disposition: dispositionForIdentitySeed(
              identityCreationSeed(input.careerSeed, member.state.id),
            ),
            relationshipAccounts: {},
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
  readonly identities: readonly PieceIdentityRecord[];
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
  const resultById = stateMap(input.matchRoster);
  const lineup = input.fieldedRoster
    .filter((piece) => fieldedIds.has(piece.id))
    .map((piece) => {
      const result = resultById.get(piece.id);
      return {
        ...memberFrom(piece, identityById.get(piece.id)),
        state: {
          ...(result ?? piece),
          role: chairById.get(piece.id) ?? result?.role ?? piece.role,
        },
      };
    });
  const departed = lineup
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
      lineup,
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
    const status = storedStatusAfterFold(member.status, previous?.status);
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
  const checkedInIdentities = input.identities.map((identity) => {
    const result = input.matchRoster.find((piece) => piece.id === identity.id);
    const fallback = input.fieldedRoster.find(
      (piece) => piece.id === identity.id,
    );
    const piece = result ?? fallback;
    return piece === undefined
      ? identity
      : checkInCredence(identity, PLAYER_LEADER_ID, piece);
  });
  return {
    roster: nextRoster,
    events: lifecycleEvents,
    identities: checkedInIdentities,
  };
}
