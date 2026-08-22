import { LivingBoard, type PieceId, type Side } from '../src/chess';
import {
  FIELDING_POLICIES,
  fieldSquad,
  checkInCredence,
  checkOutCredence,
  dispositionForIdentitySeed,
  identityCreationSeed,
  foldSquadMatch,
  highestAttainment,
  poolRoleCounts as squadRoleCounts,
  statusForConscript,
  type FieldingPolicy as SquadFieldingPolicy,
  type SquadEvent,
  type SquadMember,
  type SquadService,
  type CredenceIdentity,
} from '../src/orchestration';
import type { HeadlessMatchResult } from '../src/orchestration';
import type {
  MatchEvent,
  PieceRole,
  PieceState,
  CredenceState,
} from '../src/psychology';

import { leaderTrustBias } from './campaign';
import type { Leader } from './cli';
import { SEASON_CONFIG, type SeasonConfig } from './seasonConfig';
import { createFreshPieceState } from './roster';

export type FieldingPolicy = SquadFieldingPolicy;
export { FIELDING_POLICIES };
export type PoolService = SquadService;
export type PoolMember = SquadMember;
export type PoolEvent = SquadEvent;

export interface CommanderPool {
  readonly id: string;
  readonly side: Side;
  readonly style: Leader;
  readonly fieldingPolicy: FieldingPolicy;
  readonly careerSeed: number;
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
  careerSeed: number,
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
  const roleCounts = squadRoleCounts();
  for (const role of Object.keys(roleCounts) as PieceRole[]) {
    const count = role === 'King' ? 1 : roleCounts[role] * depthFactor;
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
      const memberId = `${side}:${role}:${String(index).padStart(2, '0')}`;
      const credenceIdentity: CredenceIdentity = {
        identityCreationSeed: identityCreationSeed(careerSeed, memberId),
        disposition: dispositionForIdentitySeed(
          identityCreationSeed(careerSeed, memberId),
        ),
        relationshipAccounts: {},
      };
      members.push({
        state: stateWithId(
          {
            ...template,
            credence: credenceIdentity.disposition ?? template.credence,
          },
          memberId,
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
        credenceIdentity,
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
  readonly careerSeed?: number;
}): CommanderPool {
  const careerSeed = options.careerSeed ?? 0;
  return {
    id: options.id,
    side: options.side,
    style: options.style,
    fieldingPolicy: fieldingPolicyForStyle(options.style),
    careerSeed,
    members: initialPoolMembers(
      options.side,
      options.style,
      options.depthFactor ?? SEASON_CONFIG.POOL_DEPTH_FACTOR,
      options.randomUnit ?? 0.5,
      careerSeed,
    ),
  };
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
    credenceIdentity: {
      identityCreationSeed: identityCreationSeed(pool.careerSeed, id),
      disposition: dispositionForIdentitySeed(
        identityCreationSeed(pool.careerSeed, id),
      ),
      relationshipAccounts: {},
    },
  };
}

export function fieldPool(pool: CommanderPool, match: number): FieldedPool {
  const members = pool.members.map((member) => {
    const identity = member.credenceIdentity;
    return identity === undefined
      ? member
      : {
          ...member,
          state: checkOutCredence(identity, pool.id, member.state),
        };
  });
  return fieldSquad(
    {
      ...pool,
      members,
    },
    match,
    (role, conscriptionMatch, sequence) =>
      conscriptMember(pool, role, conscriptionMatch, sequence),
  );
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
  const folded = foldSquadMatch({
    side: pool.side,
    members: pool.members,
    fielded,
    resultRoster,
    departedRoster,
    desertions,
    refusals,
    fieldedIds,
    promotions,
    match,
    config,
  });
  const resultById = new Map(
    [...resultRoster, ...departedRoster].map((piece) => [piece.id, piece]),
  );
  const members = [...folded.members].map((member) => {
    const identity = member.credenceIdentity;
    return identity === undefined
      ? member
      : {
          ...member,
          credenceIdentity: checkInCredence(identity, pool.id, member.state),
        };
  });
  for (const conscript of fielded.lineup.filter(
    (member) => member.provenance === 'conscript',
  )) {
    if (members.some((member) => member.state.id === conscript.state.id))
      continue;
    const state = resultById.get(conscript.state.id) ?? conscript.state;
    const attainedRole = promotions.get(conscript.state.id);
    const checkedInIdentity =
      conscript.credenceIdentity === undefined
        ? undefined
        : checkInCredence(conscript.credenceIdentity, pool.id, state);
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
      ...(checkedInIdentity === undefined
        ? {}
        : { credenceIdentity: checkedInIdentity }),
    });
  }
  return { pool: { ...pool, members }, events: folded.events };
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
  return squadRoleCounts();
}
