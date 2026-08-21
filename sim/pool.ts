import { LivingBoard, type PieceId, type Side } from '../src/chess';
import type { HeadlessMatchResult } from '../src/orchestration';
import type {
  MatchEvent,
  PieceRole,
  PieceState,
  CredenceState,
} from '../src/psychology';
import {
  clampTrust,
  sharedBondScalar,
  startingAbilityForRole,
} from '../src/psychology';

import { leaderTrustBias } from './campaign';
import type { Leader } from './cli';
import { SEASON_CONFIG, type SeasonConfig } from './seasonConfig';
import { createFreshPieceState } from './roster';

export type FieldingPolicy =
  | 'strongest_available'
  | 'rest_traumatised'
  | 'veteran_first';

export const FIELDING_POLICIES: readonly FieldingPolicy[] = [
  'strongest_available',
  'rest_traumatised',
  'veteran_first',
];

export interface PoolService {
  readonly matchesPlayed: number;
  readonly desertions: number;
  readonly refusals: number;
  readonly captures: number;
  readonly consecutiveNonSelections: number;
}

export interface PoolMember {
  readonly state: PieceState;
  readonly originRole: PieceRole;
  /** Highest role this member has attained through a PROMOTION event. */
  readonly attainedRole?: PieceRole;
  readonly status: 'available' | 'recovering' | 'retired';
  readonly availableAtMatch: number;
  readonly provenance: 'original' | 'conscript';
  readonly service: PoolService;
  readonly retirementCause?: 'trauma' | 'obsolescence';
}

export type PoolEvent =
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

export interface CommanderPool {
  readonly id: string;
  readonly side: Side;
  readonly style: Leader;
  readonly fieldingPolicy: FieldingPolicy;
  readonly members: readonly PoolMember[];
}

export interface FieldedPool {
  readonly lineup: readonly PoolMember[];
  readonly conscriptsFielded: number;
  readonly veteransRested: number;
}

export interface PoolSnapshot {
  readonly total: number;
  readonly available: number;
  readonly recovering: number;
  readonly retired: number;
  readonly conscriptsFielded: number;
  readonly veteransRested: number;
  readonly passedOverDistribution: Readonly<Record<string, number>>;
  readonly obsolescenceCount: number;
  readonly fieldedMemberCount: number;
  readonly benchUtilisation: number;
  readonly lineupChurn: number;
}

export interface PoolSeasonMetrics {
  readonly squadSize: number;
  readonly distinctMembersFielded: number;
  readonly benchUtilisation: number;
  readonly meanLineupChurn: number;
  readonly postPromotionSelectionRate: number;
  readonly unpromotedOriginControlRate: number;
  readonly crownedNeverFieldedAgain: number;
  readonly crownedRetiredForObsolescence: number;
  readonly promotions: number;
  readonly promotionsWithRemainingWindow: number;
  readonly crownedSelectionRate: number;
}

export function poolSeasonMetrics(input: {
  readonly initialPool: CommanderPool;
  readonly finalPool: CommanderPool;
  readonly lineups: readonly (readonly PieceId[])[];
  readonly promotionMatches: ReadonlyMap<PieceId, number>;
}): PoolSeasonMetrics {
  const fieldedById = new Map<PieceId, Set<number>>();
  input.lineups.forEach((lineup, index) => {
    for (const pieceId of lineup) {
      const matches = fieldedById.get(pieceId) ?? new Set<number>();
      matches.add(index + 1);
      fieldedById.set(pieceId, matches);
    }
  });
  const distinctMembersFielded = fieldedById.size;
  const promotions = input.promotionMatches.size;
  let postSelections = 0;
  let postOpportunities = 0;
  let crownedSelections = 0;
  let crownedOpportunities = 0;
  let promotionsWithRemainingWindow = 0;
  let controlSelections = 0;
  let controlOpportunities = 0;
  let crownedNeverFieldedAgain = 0;
  for (const [pieceId, promotionMatch] of input.promotionMatches) {
    const member = input.initialPool.members.find(
      (candidate) => candidate.state.id === pieceId,
    );
    const fieldedMatches = fieldedById.get(pieceId) ?? new Set<number>();
    const laterMatches = input.lineups.length - promotionMatch;
    const laterSelections = [...fieldedMatches].filter(
      (match) => match > promotionMatch,
    ).length;
    postSelections += laterSelections;
    postOpportunities += Math.max(0, laterMatches);
    crownedSelections += laterSelections;
    crownedOpportunities += Math.max(0, laterMatches);
    if (laterMatches > 0) {
      promotionsWithRemainingWindow += 1;
      if (laterSelections === 0) crownedNeverFieldedAgain += 1;
    }
    if (member !== undefined) {
      const controls = input.initialPool.members.filter(
        (candidate) =>
          candidate.originRole === member.originRole &&
          !input.promotionMatches.has(candidate.state.id),
      );
      for (const control of controls) {
        const controlMatches = fieldedById.get(control.state.id) ?? new Set();
        for (
          let match = promotionMatch + 1;
          match <= input.lineups.length;
          match += 1
        ) {
          controlOpportunities += 1;
          if (controlMatches.has(match)) controlSelections += 1;
        }
      }
    }
  }
  const retiredForObsolescence = new Set(
    input.finalPool.members
      .filter(
        (member) =>
          member.attainedRole !== undefined &&
          member.retirementCause === 'obsolescence',
      )
      .map((member) => member.state.id),
  );
  const squadSize = input.initialPool.members.length;
  const meanLineupChurn =
    input.lineups.length < 2
      ? 0
      : input.lineups.slice(1).reduce((total, lineup, index) => {
          const previous = new Set(input.lineups[index] ?? []);
          return (
            total +
            lineup.filter((pieceId) => !previous.has(pieceId)).length /
              Math.max(1, lineup.length)
          );
        }, 0) /
        (input.lineups.length - 1);
  return {
    squadSize,
    distinctMembersFielded,
    benchUtilisation: distinctMembersFielded / Math.max(1, squadSize),
    meanLineupChurn,
    postPromotionSelectionRate: postSelections / Math.max(1, postOpportunities),
    unpromotedOriginControlRate:
      controlSelections / Math.max(1, controlOpportunities),
    crownedNeverFieldedAgain,
    crownedRetiredForObsolescence: [...retiredForObsolescence].filter((id) =>
      input.promotionMatches.has(id),
    ).length,
    promotions,
    promotionsWithRemainingWindow,
    crownedSelectionRate: crownedSelections / Math.max(1, crownedOpportunities),
  };
}

const STARTING_ROLE_COUNTS: Readonly<Record<PieceRole, number>> = {
  Pawn: 8,
  Knight: 2,
  Bishop: 2,
  Rook: 2,
  Queen: 1,
  King: 1,
};

function fieldingPolicyForStyle(style: Leader): FieldingPolicy {
  switch (style) {
    case 'tyrannical':
      return 'strongest_available';
    case 'servant':
    case 'supportive':
      return 'rest_traumatised';
    case 'volatile':
    case 'random':
    default:
      return 'veteran_first';
  }
}

function stateWithId(state: PieceState, id: PieceId): PieceState {
  return { ...state, id };
}

function pieceRoleName(role: 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'): PieceRole {
  switch (role) {
    case 'P':
      return 'Pawn';
    case 'N':
      return 'Knight';
    case 'B':
      return 'Bishop';
    case 'R':
      return 'Rook';
    case 'Q':
      return 'Queen';
    case 'K':
      return 'King';
  }
}

function initialPoolMembers(
  side: Side,
  style: Leader,
  depthFactor: number,
  randomUnit: number,
): PoolMember[] {
  if (!Number.isSafeInteger(depthFactor) || depthFactor < 1) {
    throw new Error('POOL_DEPTH_FACTOR must be a positive integer.');
  }
  const board = LivingBoard.standard();
  const trust = leaderTrustBias(style);
  const roleTemplates = new Map<PieceRole, PieceState['id']>();
  for (const piece of board.piecesOf(side)) {
    const role = pieceRoleName(piece.role);
    if (!roleTemplates.has(role)) roleTemplates.set(role, piece.id);
  }
  const members: PoolMember[] = [];
  let sequence = 0;
  for (const role of Object.keys(STARTING_ROLE_COUNTS) as PieceRole[]) {
    const count =
      role === 'King' ? 1 : STARTING_ROLE_COUNTS[role] * depthFactor;
    for (let index = 0; index < count; index += 1) {
      const templateId = roleTemplates.get(role);
      if (templateId === undefined) {
        throw new Error(`Unable to create pool template for role ${role}.`);
      }
      const memberUnit = unitForIndex(randomUnit, sequence);
      const template = createFreshPieceState(
        templateId,
        role,
        trust,
        memberUnit,
      );
      members.push({
        state: stateWithId(
          template,
          `${side}:${role}:${String(index).padStart(2, '0')}`,
        ),
        originRole: role,
        status: 'available',
        availableAtMatch: 1,
        provenance: 'original',
        service: {
          matchesPlayed: 0,
          desertions: 0,
          refusals: 0,
          captures: 0,
          consecutiveNonSelections: 0,
        },
      });
      sequence += 1;
    }
  }
  return members;
}

function unitForIndex(base: number, index: number): number {
  let value = index + 1;
  let denominator = 1;
  let reflected = 0;
  while (value > 0) {
    denominator *= 2;
    reflected += (value % 2) / denominator;
    value = Math.floor(value / 2);
  }
  return (base + reflected) % 1;
}

export function createCommanderPool(options: {
  readonly id: string;
  readonly side: Side;
  readonly style: Leader;
  readonly depthFactor?: number;
  readonly randomUnit?: number;
}): CommanderPool {
  return {
    id: options.id,
    side: options.side,
    style: options.style,
    fieldingPolicy: fieldingPolicyForStyle(options.style),
    members: initialPoolMembers(
      options.side,
      options.style,
      options.depthFactor ?? SEASON_CONFIG.POOL_DEPTH_FACTOR,
      options.randomUnit ?? 0.5,
    ),
  };
}

function availableAt(member: PoolMember, match: number): boolean {
  return (
    member.status !== 'retired' &&
    (member.status !== 'recovering' || match >= member.availableAtMatch)
  );
}

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

function highestAttainment(
  current: PieceRole | undefined,
  candidate: PieceRole,
): PieceRole {
  return (ATTAINMENT_RANK[candidate] ?? 0) >
    (ATTAINMENT_RANK[current ?? 'Pawn'] ?? 0)
    ? candidate
    : (current ?? candidate);
}

function statusForConscript(
  state: PieceState,
  desertions: ReadonlySet<PieceId>,
  config: SeasonConfig,
): PoolMember['status'] {
  if (
    state.role !== 'King' &&
    state.B_i >= config.RETIREMENT_TRAUMA_THRESHOLD
  ) {
    return 'retired';
  }
  if (desertions.has(state.id)) return 'recovering';
  return 'available';
}

function compareForPolicy(
  policy: FieldingPolicy,
  left: PoolMember,
  right: PoolMember,
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

function meanCredence(members: readonly PoolMember[]): CredenceState {
  const available = members.filter((member) => member.status !== 'retired');
  if (available.length === 0)
    return { tauAbil: 50, tauBenev: 50, abilityObservationCount: 0 };
  return {
    tauAbil: Math.trunc(
      available.reduce(
        (sum, member) => sum + member.state.credence.tauAbil,
        0,
      ) / available.length,
    ),
    tauBenev: Math.trunc(
      available.reduce(
        (sum, member) => sum + member.state.credence.tauBenev,
        0,
      ) / available.length,
    ),
    abilityObservationCount: 0,
  };
}

function conscriptMember(
  pool: CommanderPool,
  role: PieceRole,
  match: number,
  sequence: number,
): PoolMember {
  const appraisal = meanCredence(pool.members);
  const existingIds = new Set(pool.members.map((member) => member.state.id));
  let suffix = sequence;
  let id = `${pool.side}:${role}:conscript:${match}:${pool.members.length}:${String(suffix).padStart(2, '0')}`;
  while (existingIds.has(id)) {
    suffix += 1;
    id = `${pool.side}:${role}:conscript:${match}:${pool.members.length}:${String(suffix).padStart(2, '0')}`;
  }
  const fresh = createFreshPieceState(
    id,
    role,
    leaderTrustBias(pool.style),
    unitForIndex(match * 0.173 + pool.members.length * 0.011, sequence),
  );
  return {
    state: {
      ...fresh,
      credence: {
        ...fresh.credence,
        tauAbil: appraisal.tauAbil,
        tauBenev: appraisal.tauBenev,
      },
    },
    originRole: role,
    status: 'available',
    availableAtMatch: match,
    provenance: 'conscript',
    service: {
      matchesPlayed: 0,
      desertions: 0,
      refusals: 0,
      captures: 0,
      consecutiveNonSelections: 0,
    },
  };
}

export function fieldPool(pool: CommanderPool, match: number): FieldedPool {
  const lineup: PoolMember[] = [];
  const selectedIds = new Set<PieceId>();
  let conscriptsFielded = 0;
  let sequence = 0;
  for (const role of FIELDING_ORDER) {
    const required = STARTING_ROLE_COUNTS[role];
    const available = pool.members
      .filter(
        (member) =>
          (member.originRole === role || member.attainedRole === role) &&
          availableAt(member, match) &&
          !selectedIds.has(member.state.id),
      )
      .sort((left, right) =>
        compareForPolicy(pool.fieldingPolicy, left, right),
      );
    const selected = available.slice(0, required).map((member) => ({
      ...member,
      state: { ...member.state, role },
    }));
    if (role === 'King' && selected.length !== 1) {
      throw new Error('Commander pool must always field its King.');
    }
    lineup.push(...selected);
    selected.forEach((member) => selectedIds.add(member.state.id));
    while (
      role !== 'King' &&
      selected.filter((member) => member.state.role === role).length < required
    ) {
      const conscript = conscriptMember(pool, role, match, sequence);
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
  member: PoolMember,
  state: PieceState,
  status: PoolMember['status'],
  availableAtMatch: number,
  service: PoolService,
  retirementCause: PoolMember['retirementCause'] = member.retirementCause,
): PoolMember {
  return {
    ...member,
    state,
    status,
    availableAtMatch,
    service,
    ...(retirementCause === undefined ? {} : { retirementCause }),
  };
}

function foldSide(
  pool: CommanderPool,
  fielded: FieldedPool,
  resultRoster: readonly PieceState[],
  departedRoster: readonly PieceState[],
  desertions: ReadonlySet<PieceId>,
  refusals: ReadonlyMap<PieceId, number>,
  fieldedIds: ReadonlySet<PieceId>,
  promotions: ReadonlyMap<PieceId, PieceRole>,
  match: number,
  config: SeasonConfig,
): { readonly pool: CommanderPool; readonly events: readonly PoolEvent[] } {
  const resultById = new Map(
    [...resultRoster, ...departedRoster].map((piece) => [piece.id, piece]),
  );
  const activeIds = new Set(resultRoster.map((piece) => piece.id));
  const erosionTargets: { pieceId: PieceId; selfTrustDelta: number }[] = [];
  const events: PoolEvent[] = [];
  const members = pool.members.map((member) => {
    const wasFielded = fieldedIds.has(member.state.id);
    const becameAvailable =
      member.status === 'recovering' && match >= member.availableAtMatch;
    const eligible = member.status === 'available' || becameAvailable;
    let state = wasFielded
      ? (resultById.get(member.state.id) ?? member.state)
      : member.state;
    const attainedRole = promotions.get(member.state.id);
    let status = member.status;
    let availableAtMatch = member.availableAtMatch;
    let retirementCause = member.retirementCause;
    const desertion = desertions.has(member.state.id);
    const captured =
      wasFielded && !desertion && !activeIds.has(member.state.id);
    let consecutiveNonSelections = member.service.consecutiveNonSelections;
    const service: PoolService = {
      ...member.service,
      matchesPlayed: member.service.matchesPlayed + (wasFielded ? 1 : 0),
      desertions: member.service.desertions + (desertion ? 1 : 0),
      refusals: member.service.refusals + (refusals.get(member.state.id) ?? 0),
      captures: member.service.captures + (captured ? 1 : 0),
    };

    if (wasFielded) {
      if (consecutiveNonSelections >= config.NON_SELECTION_TRUST_THRESHOLD) {
        state = {
          ...state,
          T_i: clampTrust(
            state.T_i + config.NON_SELECTION_REDEMPTION_TRUST_RECOVERY,
          ),
        };
        events.push({
          t: 'POOL_TRUST_ADJUSTMENT',
          side: pool.side,
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
        erosionTargets.push({
          pieceId: member.state.id,
          selfTrustDelta: state.T_i - member.state.T_i,
        });
      }
      if (
        state.role !== 'King' &&
        consecutiveNonSelections >= config.OBSOLESCENCE_NON_SELECTION_THRESHOLD
      ) {
        status = 'retired';
        availableAtMatch = Number.MAX_SAFE_INTEGER;
        retirementCause = 'obsolescence';
        events.push({
          t: 'OBSOLESCENCE',
          side: pool.side,
          match,
          pieceId: member.state.id,
          nonSelectionStreak: consecutiveNonSelections,
        });
      }
    }
    const nextService: PoolService = {
      ...service,
      consecutiveNonSelections,
    };
    return updateMember(
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
      side: pool.side,
      match,
      reason: 'non_selection',
      pieceId,
      selfTrustDelta: erosion.selfTrustDelta,
      peerTrustDeltas,
    });
  }
  const conscripts = fielded.lineup.filter(
    (member) => member.provenance === 'conscript',
  );
  for (const conscript of conscripts) {
    if (members.some((member) => member.state.id === conscript.state.id))
      continue;
    const state = resultById.get(conscript.state.id) ?? conscript.state;
    const attainedRole = promotions.get(conscript.state.id);
    members.push({
      ...conscript,
      state,
      ...(attainedRole === undefined
        ? {}
        : {
            attainedRole: highestAttainment(
              conscript.attainedRole,
              attainedRole,
            ),
          }),
      status: statusForConscript(state, desertions, config),
      availableAtMatch: desertions.has(state.id)
        ? match + config.DESERTION_ABSENCE_MATCHES + 1
        : match + 1,
      service: {
        ...conscript.service,
        matchesPlayed: 1,
        refusals: refusals.get(conscript.state.id) ?? 0,
        consecutiveNonSelections: 0,
      },
    });
  }
  return { pool: { ...pool, members }, events };
}

export function foldMatchIntoPools(input: {
  readonly white: CommanderPool;
  readonly black: CommanderPool;
  readonly whiteFielded: FieldedPool;
  readonly blackFielded: FieldedPool;
  readonly result: HeadlessMatchResult;
  readonly match: number;
  readonly config?: SeasonConfig;
}): {
  readonly white: CommanderPool;
  readonly black: CommanderPool;
  readonly events: readonly PoolEvent[];
} {
  const config = input.config ?? SEASON_CONFIG;
  const playerIds = new Set(
    input.whiteFielded.lineup.map((member) => member.state.id),
  );
  const enemyIds = new Set(
    input.blackFielded.lineup.map((member) => member.state.id),
  );
  const playerDesertions = new Set(
    input.result.events
      .filter(
        (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
          event.t === 'DESERTION' && playerIds.has(event.pieceId),
      )
      .map((event) => event.pieceId),
  );
  const enemyDesertions = new Set(
    input.result.events
      .filter(
        (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
          event.t === 'DESERTION' && enemyIds.has(event.pieceId),
      )
      .map((event) => event.pieceId),
  );
  const playerRefusals = new Map<PieceId, number>();
  const enemyRefusals = new Map<PieceId, number>();
  const playerPromotions = new Map<PieceId, PieceRole>();
  const enemyPromotions = new Map<PieceId, PieceRole>();
  for (const event of input.result.events) {
    if (event.t === 'PROMOTION') {
      if (playerIds.has(event.pieceId)) {
        playerPromotions.set(
          event.pieceId,
          highestAttainment(playerPromotions.get(event.pieceId), event.toRole),
        );
      } else if (enemyIds.has(event.pieceId)) {
        enemyPromotions.set(
          event.pieceId,
          highestAttainment(enemyPromotions.get(event.pieceId), event.toRole),
        );
      }
    }
    if (event.t !== 'REFUSAL') continue;
    let counts: Map<PieceId, number> | undefined;
    if (playerIds.has(event.pieceId)) {
      counts = playerRefusals;
    } else if (enemyIds.has(event.pieceId)) {
      counts = enemyRefusals;
    }
    if (counts === undefined) continue;
    counts.set(event.pieceId, (counts.get(event.pieceId) ?? 0) + 1);
  }
  const whiteFold = foldSide(
    input.white,
    input.whiteFielded,
    input.result.roster,
    input.result.departedRoster,
    playerDesertions,
    playerRefusals,
    playerIds,
    playerPromotions,
    input.match,
    config,
  );
  const blackFold = foldSide(
    input.black,
    input.blackFielded,
    input.result.enemyRoster,
    input.result.departedEnemyRoster,
    enemyDesertions,
    enemyRefusals,
    enemyIds,
    enemyPromotions,
    input.match,
    config,
  );
  return {
    white: whiteFold.pool,
    black: blackFold.pool,
    events: [...whiteFold.events, ...blackFold.events],
  };
}

export function poolSnapshot(
  pool: CommanderPool,
  fielded: FieldedPool,
  previousLineupIds: readonly PieceId[] = [],
): PoolSnapshot {
  const lineupIds = fielded.lineup.map((member) => member.state.id);
  const previous = new Set(previousLineupIds);
  const lineupChurn =
    previousLineupIds.length === 0
      ? 0
      : lineupIds.filter((id) => !previous.has(id)).length /
        Math.max(1, lineupIds.length);
  return {
    total: pool.members.length,
    available: pool.members.filter((member) => member.status === 'available')
      .length,
    recovering: pool.members.filter((member) => member.status === 'recovering')
      .length,
    retired: pool.members.filter((member) => member.status === 'retired')
      .length,
    conscriptsFielded: fielded.conscriptsFielded,
    veteransRested: fielded.veteransRested,
    passedOverDistribution: Object.fromEntries(
      pool.members.reduce((distribution, member) => {
        const key = String(member.service.consecutiveNonSelections);
        distribution.set(key, (distribution.get(key) ?? 0) + 1);
        return distribution;
      }, new Map<string, number>()),
    ),
    obsolescenceCount: pool.members.filter(
      (member) => member.retirementCause === 'obsolescence',
    ).length,
    fieldedMemberCount: new Set(lineupIds).size,
    benchUtilisation:
      new Set(lineupIds).size / Math.max(1, pool.members.length),
    lineupChurn,
  };
}

export function poolRoleCounts(): Readonly<Record<PieceRole, number>> {
  return { ...STARTING_ROLE_COUNTS };
}
