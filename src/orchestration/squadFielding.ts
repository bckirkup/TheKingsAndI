import type { PieceId, Side } from '../chess';
import { isEligibleForChair } from '../core/roleEligibility';
import type { CredenceIdentity } from './credence';
import type { PieceRole, PieceState } from '../psychology';
import {
  clampCredence,
  clampTrust,
  sharedBondScalar,
  startingAbilityForRole,
} from '../psychology';

export type FieldingPolicy =
  | 'strongest_available'
  | 'rest_traumatised'
  | 'veteran_first';

export const FIELDING_POLICIES: readonly FieldingPolicy[] = [
  'strongest_available',
  'rest_traumatised',
  'veteran_first',
];

export interface SquadConfig {
  readonly POOL_DEPTH_FACTOR: number;
  readonly RESERVE_DEPTH: number;
  readonly LEVY_INHERITED_TRUST_PERMILLE: number;
  readonly LEVY_INHERITED_CREDENCE_PERMILLE: number;
  readonly LEVY_STANDING_COST: number;
  readonly DESERTION_ABSENCE_MATCHES: number;
  readonly RETIREMENT_TRAUMA_THRESHOLD: number;
  readonly NON_SELECTION_TRUST_THRESHOLD: number;
  readonly NON_SELECTION_SELF_TRUST_PENALTY: number;
  readonly NON_SELECTION_PEER_TRUST_PENALTY: number;
  readonly NON_SELECTION_REDEMPTION_TRUST_RECOVERY: number;
  readonly OBSOLESCENCE_NON_SELECTION_THRESHOLD: number;
}

export const SQUAD_CONFIG: SquadConfig = {
  POOL_DEPTH_FACTOR: 2,
  RESERVE_DEPTH: 15,
  LEVY_INHERITED_TRUST_PERMILLE: 1000,
  LEVY_INHERITED_CREDENCE_PERMILLE: 1000,
  LEVY_STANDING_COST: 0,
  DESERTION_ABSENCE_MATCHES: 2,
  RETIREMENT_TRAUMA_THRESHOLD: 100,
  NON_SELECTION_TRUST_THRESHOLD: 2,
  NON_SELECTION_SELF_TRUST_PENALTY: -10,
  NON_SELECTION_PEER_TRUST_PENALTY: -2,
  NON_SELECTION_REDEMPTION_TRUST_RECOVERY: 4,
  OBSOLESCENCE_NON_SELECTION_THRESHOLD: 6,
};

export interface SquadService {
  readonly matchesPlayed: number;
  readonly desertions: number;
  readonly refusals: number;
  readonly captures: number;
  readonly consecutiveNonSelections: number;
}

export interface SquadMember {
  readonly state: PieceState;
  readonly originRole: PieceRole;
  /** Highest role this member has attained through a PROMOTION event. */
  readonly attainedRole?: PieceRole;
  readonly status: 'available' | 'recovering' | 'retired' | 'benched' | 'fired';
  readonly availableAtMatch: number;
  readonly provenance: 'original' | 'conscript';
  readonly service: SquadService;
  readonly retirementCause?: 'trauma' | 'obsolescence';
  readonly credenceIdentity?: CredenceIdentity;
}

export type SquadEvent =
  | {
      readonly t: 'POOL_TRUST_ADJUSTMENT';
      readonly side: Side;
      readonly match: number;
      readonly reason: 'non_selection' | 'selection_redemption';
      readonly pieceId: PieceId;
      readonly selfTrustDelta: number;
      readonly peerTrustDeltas: readonly {
        readonly pieceId: PieceId;
        readonly delta: number;
      }[];
    }
  | {
      readonly t: 'OBSOLESCENCE';
      readonly side: Side;
      readonly match: number;
      readonly pieceId: PieceId;
      readonly nonSelectionStreak: number;
    };

export interface SquadFielded {
  readonly lineup: readonly SquadMember[];
  readonly conscriptsFielded: number;
  readonly veteransRested: number;
}

export interface SquadFieldingPool {
  readonly members: readonly SquadMember[];
  readonly fieldingPolicy: FieldingPolicy;
  readonly pinnedMemberIds?: ReadonlySet<PieceId>;
}

const STARTING_ROLE_COUNTS: Readonly<Record<PieceRole, number>> = {
  Pawn: 8,
  Knight: 2,
  Bishop: 2,
  Rook: 2,
  Queen: 1,
  King: 1,
};

const FIELDING_ORDER: readonly PieceRole[] = [
  'King',
  'Queen',
  'Rook',
  'Bishop',
  'Knight',
  'Pawn',
];

const ATTAINMENT_RANK: Readonly<Record<PieceRole, number>> = {
  Pawn: 1,
  Knight: 2,
  Bishop: 2,
  Rook: 3,
  Queen: 4,
  King: 5,
};

export function poolRoleCounts(): Readonly<Record<PieceRole, number>> {
  return { ...STARTING_ROLE_COUNTS };
}

const RESERVE_ALLOCATION_ORDER: readonly PieceRole[] = [
  'Queen',
  'Rook',
  'Bishop',
  'Knight',
  'Pawn',
];

const ARMY_NON_KING_WEIGHT_TOTAL = 15;

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

/**
 * Convert the legacy doubled-army control into the equivalent reserve depth.
 * A factor of one is one legal army; each further factor adds fifteen spares.
 */
export function reserveDepthForPoolDepthFactor(depthFactor: number): number {
  if (!Number.isSafeInteger(depthFactor) || depthFactor < 1) {
    throw new Error('POOL_DEPTH_FACTOR must be a positive integer.');
  }
  return (depthFactor - 1) * ARMY_NON_KING_WEIGHT_TOTAL;
}

/**
 * The legacy factor remains an override for callers that still provide it.
 * New callers use RESERVE_DEPTH directly when the factor has its default.
 */
export function reserveDepthForConfig(config: SquadConfig): number {
  if (config.POOL_DEPTH_FACTOR !== 2) {
    return reserveDepthForPoolDepthFactor(config.POOL_DEPTH_FACTOR);
  }
  return nonNegativeInteger(config.RESERVE_DEPTH, 'RESERVE_DEPTH');
}

/**
 * Add an apportioned reserve to one legal army. Kings are never reserved.
 * Largest-remainder ties follow the stable role order above.
 */
export function poolRoleCountsForReserveDepth(
  reserveDepth: number = SQUAD_CONFIG.RESERVE_DEPTH,
): Readonly<Record<PieceRole, number>> {
  const depth = nonNegativeInteger(reserveDepth, 'RESERVE_DEPTH');
  const counts: Record<PieceRole, number> = { ...STARTING_ROLE_COUNTS };
  const allocations = RESERVE_ALLOCATION_ORDER.map((role, order) => {
    const weighted = depth * STARTING_ROLE_COUNTS[role];
    return {
      role,
      order,
      whole: Math.floor(weighted / ARMY_NON_KING_WEIGHT_TOTAL),
      remainder: weighted % ARMY_NON_KING_WEIGHT_TOTAL,
    };
  });
  let allocated = 0;
  for (const allocation of allocations) {
    counts[allocation.role] += allocation.whole;
    allocated += allocation.whole;
  }
  const byRemainder = [...allocations].sort(
    (left, right) =>
      right.remainder - left.remainder || left.order - right.order,
  );
  for (const allocation of byRemainder.slice(0, depth - allocated)) {
    counts[allocation.role] += 1;
  }
  return counts;
}

function interpolateInteger(
  baseline: number,
  inherited: number,
  permille: number,
): number {
  const weight = Math.max(0, Math.min(1000, Math.trunc(permille)));
  return baseline + Math.trunc(((inherited - baseline) * weight) / 1000);
}

function averageValue(
  members: readonly SquadMember[],
  value: (member: SquadMember) => number,
): number | undefined {
  if (members.length === 0) return undefined;
  return Math.trunc(
    members.reduce((sum, member) => sum + value(member), 0) / members.length,
  );
}

/**
 * Apply the green levy inheritance rules to a fresh role-baseline state.
 * The helper is shared by the app and harness so their levy cannot diverge.
 */
export function stateForLevy(
  freshState: PieceState,
  members: readonly SquadMember[],
  config: SquadConfig = SQUAD_CONFIG,
): PieceState {
  const living = members.filter((member) => member.status !== 'retired');
  const source = living.length === 0 ? members : living;
  const inheritedTrust = averageValue(source, (member) => member.state.T_i);
  const inheritedCredence = {
    tauAbil: averageValue(source, (member) => member.state.credence.tauAbil),
    tauBenev: averageValue(source, (member) => member.state.credence.tauBenev),
  };
  const baselineCredence = freshState.credence;
  return {
    ...freshState,
    T_i: clampTrust(
      interpolateInteger(
        freshState.T_i,
        inheritedTrust ?? freshState.T_i,
        config.LEVY_INHERITED_TRUST_PERMILLE,
      ),
    ),
    credence: {
      ...baselineCredence,
      tauAbil: clampCredence(
        interpolateInteger(
          baselineCredence.tauAbil,
          inheritedCredence.tauAbil ?? baselineCredence.tauAbil,
          config.LEVY_INHERITED_CREDENCE_PERMILLE,
        ),
      ),
      tauBenev: clampCredence(
        interpolateInteger(
          baselineCredence.tauBenev,
          inheritedCredence.tauBenev ?? baselineCredence.tauBenev,
          config.LEVY_INHERITED_CREDENCE_PERMILLE,
        ),
      ),
      // Observation count is personal evidence; a new levy has none.
      abilityObservationCount: baselineCredence.abilityObservationCount,
    },
  };
}

/**
 * Debit the existing living roster once for each levied chair. A commander
 * standing/register fold belongs to ADR 0061 step 2; this uses the credence
 * state already persisted today instead of introducing that register early.
 */
export function applyLevyStandingCost(
  members: readonly SquadMember[],
  levies: number,
  config: SquadConfig = SQUAD_CONFIG,
): readonly SquadMember[] {
  const count = Math.max(0, Math.trunc(levies));
  const cost = Math.max(0, Math.trunc(config.LEVY_STANDING_COST));
  if (count === 0 || cost === 0) return members;
  const debit = count * cost;
  return members.map((member) =>
    member.status === 'retired'
      ? member
      : {
          ...member,
          state: {
            ...member.state,
            credence: {
              ...member.state.credence,
              tauBenev: clampCredence(member.state.credence.tauBenev - debit),
            },
          },
        },
  );
}

export function highestAttainment(
  current: PieceRole | undefined,
  candidate: PieceRole,
): PieceRole {
  return (ATTAINMENT_RANK[candidate] ?? 0) >
    (ATTAINMENT_RANK[current ?? 'Pawn'] ?? 0)
    ? candidate
    : (current ?? candidate);
}

export function availableAt(member: SquadMember, match: number): boolean {
  return (
    (member.status === 'available' || member.status === 'recovering') &&
    (member.status !== 'recovering' || match >= member.availableAtMatch)
  );
}

export function statusForConscript(
  state: PieceState,
  desertions: ReadonlySet<PieceId>,
  config: SquadConfig,
): SquadMember['status'] {
  if (
    state.role !== 'King' &&
    state.B_i >= config.RETIREMENT_TRAUMA_THRESHOLD
  ) {
    return 'retired';
  }
  if (desertions.has(state.id)) return 'recovering';
  return 'available';
}

export function compareForPolicy(
  policy: FieldingPolicy,
  left: SquadMember,
  right: SquadMember,
): number {
  let values: number[];
  const relativeAbilityDifference =
    right.state.E_i -
    startingAbilityForRole(right.originRole) -
    (left.state.E_i - startingAbilityForRole(left.originRole));
  if (policy === 'strongest_available') {
    values = [relativeAbilityDifference, right.state.B_i - left.state.B_i];
  } else if (policy === 'rest_traumatised') {
    values = [
      left.state.B_i - right.state.B_i,
      left.service.matchesPlayed - right.service.matchesPlayed,
    ];
  } else {
    values = [
      right.service.matchesPlayed - left.service.matchesPlayed,
      relativeAbilityDifference,
    ];
  }
  return (
    values.find((value) => value !== 0) ??
    (left.state.id < right.state.id ? -1 : 1)
  );
}

export function fieldSquad(
  pool: SquadFieldingPool,
  match: number,
  conscriptMember: (
    role: PieceRole,
    match: number,
    sequence: number,
  ) => SquadMember,
): SquadFielded {
  const lineup: SquadMember[] = [];
  const selectedIds = new Set<PieceId>();
  let conscriptsFielded = 0;
  let sequence = 0;
  for (const role of FIELDING_ORDER) {
    const required = STARTING_ROLE_COUNTS[role];
    const available = pool.members
      .filter(
        (member) =>
          isEligibleForChair(member.originRole, member.attainedRole, role) &&
          availableAt(member, match) &&
          !selectedIds.has(member.state.id),
      )
      .sort((left, right) => {
        const leftPinned = pool.pinnedMemberIds?.has(left.state.id) ? 1 : 0;
        const rightPinned = pool.pinnedMemberIds?.has(right.state.id) ? 1 : 0;
        if (leftPinned !== rightPinned) return rightPinned - leftPinned;
        return compareForPolicy(pool.fieldingPolicy, left, right);
      });
    const selected = available.slice(0, required).map((member) => ({
      ...member,
      state: { ...member.state, role },
    }));
    if (role === 'King' && selected.length !== 1) {
      throw new Error('Commander pool must always field its King.');
    }
    lineup.push(...selected);
    selected.forEach((member) => selectedIds.add(member.state.id));
    while (role !== 'King' && selected.length < required) {
      const conscript = conscriptMember(role, match, sequence);
      lineup.push(conscript);
      selected.push(conscript);
      selectedIds.add(conscript.state.id);
      conscriptsFielded += 1;
      sequence += 1;
    }
  }
  const veteransRested = pool.members.filter(
    (member) =>
      availableAt(member, match) &&
      member.service.matchesPlayed > 0 &&
      !selectedIds.has(member.state.id),
  ).length;
  return { lineup, conscriptsFielded, veteransRested };
}

function updateMember(
  member: SquadMember,
  state: PieceState,
  status: SquadMember['status'],
  availableAtMatch: number,
  service: SquadService,
  retirementCause: SquadMember['retirementCause'] = member.retirementCause,
): SquadMember {
  return {
    ...member,
    state,
    status,
    availableAtMatch,
    service,
    ...(retirementCause === undefined ? {} : { retirementCause }),
  };
}

function foldOneSquadMember(input: {
  readonly member: SquadMember;
  readonly side: Side;
  readonly match: number;
  readonly config: SquadConfig;
  readonly wasFielded: boolean;
  readonly eligible: boolean;
  readonly resultState: PieceState;
  readonly attainedRole: PieceRole | undefined;
  readonly desertion: boolean;
  readonly captured: boolean;
  readonly refusalCount: number;
}): {
  readonly member: SquadMember;
  readonly events: SquadEvent[];
  readonly erosionTarget?: { pieceId: PieceId; selfTrustDelta: number };
} {
  const {
    member,
    side,
    match,
    config,
    wasFielded,
    eligible,
    resultState,
    attainedRole,
    desertion,
    captured,
    refusalCount,
  } = input;
  const memberEvents: SquadEvent[] = [];
  let state = resultState;
  let status = member.status;
  let availableAtMatch = member.availableAtMatch;
  let retirementCause = member.retirementCause;
  let consecutiveNonSelections = member.service.consecutiveNonSelections;
  const service: SquadService = {
    ...member.service,
    matchesPlayed: member.service.matchesPlayed + (wasFielded ? 1 : 0),
    desertions: member.service.desertions + (desertion ? 1 : 0),
    refusals: member.service.refusals + refusalCount,
    captures: member.service.captures + (captured ? 1 : 0),
  };
  let erosionTarget: { pieceId: PieceId; selfTrustDelta: number } | undefined;

  if (wasFielded) {
    if (consecutiveNonSelections >= config.NON_SELECTION_TRUST_THRESHOLD) {
      state = {
        ...state,
        T_i: clampTrust(
          state.T_i + config.NON_SELECTION_REDEMPTION_TRUST_RECOVERY,
        ),
      };
      memberEvents.push({
        t: 'POOL_TRUST_ADJUSTMENT',
        side,
        match,
        reason: 'selection_redemption',
        pieceId: member.state.id,
        selfTrustDelta: state.T_i - member.state.T_i,
        peerTrustDeltas: [],
      });
    }
    consecutiveNonSelections = 0;
    if (
      state.role !== 'King' &&
      state.B_i >= config.RETIREMENT_TRAUMA_THRESHOLD
    ) {
      status = 'retired';
      availableAtMatch = Number.MAX_SAFE_INTEGER;
      retirementCause = 'trauma';
    } else if (desertion) {
      status = 'recovering';
      availableAtMatch = match + config.DESERTION_ABSENCE_MATCHES + 1;
    } else {
      status = 'available';
      availableAtMatch = match + 1;
    }
  } else if (eligible) {
    consecutiveNonSelections += 1;
    status = 'available';
    availableAtMatch = match + 1;
    if (consecutiveNonSelections === config.NON_SELECTION_TRUST_THRESHOLD) {
      state = {
        ...state,
        T_i: clampTrust(state.T_i + config.NON_SELECTION_SELF_TRUST_PENALTY),
      };
      erosionTarget = {
        pieceId: member.state.id,
        selfTrustDelta: state.T_i - member.state.T_i,
      };
    }
    if (
      state.role !== 'King' &&
      consecutiveNonSelections >= config.OBSOLESCENCE_NON_SELECTION_THRESHOLD
    ) {
      status = 'retired';
      availableAtMatch = Number.MAX_SAFE_INTEGER;
      retirementCause = 'obsolescence';
      memberEvents.push({
        t: 'OBSOLESCENCE',
        side,
        match,
        pieceId: member.state.id,
        nonSelectionStreak: consecutiveNonSelections,
      });
    }
  }
  const nextService: SquadService = {
    ...service,
    consecutiveNonSelections,
  };
  const nextMember = updateMember(
    attainedRole === undefined
      ? member
      : {
          ...member,
          attainedRole: highestAttainment(member.attainedRole, attainedRole),
        },
    state,
    status,
    availableAtMatch,
    nextService,
    retirementCause,
  );
  return {
    member: nextMember,
    events: memberEvents,
    ...(erosionTarget === undefined ? {} : { erosionTarget }),
  };
}

export function foldSquadMatch(input: {
  readonly side: Side;
  readonly members: readonly SquadMember[];
  readonly fielded: SquadFielded;
  readonly resultRoster: readonly PieceState[];
  readonly departedRoster: readonly PieceState[];
  readonly desertions: ReadonlySet<PieceId>;
  readonly refusals: ReadonlyMap<PieceId, number>;
  readonly fieldedIds: ReadonlySet<PieceId>;
  readonly promotions: ReadonlyMap<PieceId, PieceRole>;
  readonly match: number;
  readonly config?: SquadConfig;
}): {
  readonly members: readonly SquadMember[];
  readonly events: readonly SquadEvent[];
} {
  const config = input.config ?? SQUAD_CONFIG;
  const resultById = new Map(
    [...input.resultRoster, ...input.departedRoster].map((piece) => [
      piece.id,
      piece,
    ]),
  );
  const activeIds = new Set(input.resultRoster.map((piece) => piece.id));
  const erosionTargets: { pieceId: PieceId; selfTrustDelta: number }[] = [];
  const events: SquadEvent[] = [];
  const members = input.members.map((member) => {
    const wasFielded = input.fieldedIds.has(member.state.id);
    const becameAvailable =
      member.status === 'recovering' && input.match >= member.availableAtMatch;
    const eligible = member.status === 'available' || becameAvailable;
    const resultState = wasFielded
      ? (resultById.get(member.state.id) ?? member.state)
      : member.state;
    const folded = foldOneSquadMember({
      member,
      side: input.side,
      match: input.match,
      config,
      wasFielded,
      eligible,
      resultState,
      attainedRole: input.promotions.get(member.state.id),
      desertion: input.desertions.has(member.state.id),
      captured:
        wasFielded &&
        !input.desertions.has(member.state.id) &&
        !activeIds.has(member.state.id),
      refusalCount: input.refusals.get(member.state.id) ?? 0,
    });
    events.push(...folded.events);
    if (folded.erosionTarget !== undefined) {
      erosionTargets.push(folded.erosionTarget);
    }
    return folded.member;
  });
  for (const erosion of erosionTargets) {
    const { pieceId } = erosion;
    const target = members.find((member) => member.state.id === pieceId);
    if (target === undefined) continue;
    const peerTrustDeltas: { pieceId: PieceId; delta: number }[] = [];
    for (let index = 0; index < members.length; index += 1) {
      const peer = members[index];
      if (
        peer === undefined ||
        peer.state.id === pieceId ||
        peer.status === 'retired'
      ) {
        continue;
      }
      const nextTrust = clampTrust(
        peer.state.T_i +
          config.NON_SELECTION_PEER_TRUST_PENALTY *
            (1 + peer.state.traits.w_empathy) *
            sharedBondScalar(peer.state, target.state),
      );
      const delta = nextTrust - peer.state.T_i;
      if (delta === 0) continue;
      peerTrustDeltas.push({ pieceId: peer.state.id, delta });
      members[index] = {
        ...peer,
        state: { ...peer.state, T_i: nextTrust },
      };
    }
    events.push({
      t: 'POOL_TRUST_ADJUSTMENT',
      side: input.side,
      match: input.match,
      reason: 'non_selection',
      pieceId,
      selfTrustDelta: erosion.selfTrustDelta,
      peerTrustDeltas,
    });
  }
  return { members, events };
}
