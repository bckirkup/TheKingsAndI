import { parsePieceId, type Side } from '../src/chess';
import {
  acceptedPrice,
  acceptanceDiscountPermille,
  bidForLot,
  carryPurse,
  clearDraft,
  draftPriority,
  consultWithBudget,
  type CounselConsultation,
  type CommanderStanding,
  type DraftBidder,
  type DraftLot,
} from '../src/orchestration';
import { isEligibleForChair } from '../src/core/roleEligibility';
import {
  publicRoleValue,
  type MatchRecord,
  type PublicRegister,
} from '../src/persistence';
import { counselOpinionValue, type PieceRole } from '../src/psychology';
import { DRAFT_CONFIG } from '../src/core/draftConfig';
import type {
  DraftEconomyCycleObservation,
  DraftStandingSeriesPoint,
} from './degeneracy';
import {
  dispositionForIdentitySeed,
  identityCreationSeed,
  poolRoleCounts,
  poolRoleCountsForReserveDepth,
  reserveDepthForConfig,
  type CredenceIdentity,
  type SquadMember,
} from '../src/orchestration';
import { createFreshPieceState } from './roster';
import type { CommanderPool } from './pool';
import type { SeminarCommander } from './seminar';
import type { SeminarConfig } from './seminarConfig';

const DRAFT_ROLES: readonly PieceRole[] = [
  'Queen',
  'Rook',
  'Bishop',
  'Knight',
  'Pawn',
];

function deterministicUnit(base: number, index: number): number {
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

export interface SeminarMarket {
  readonly side: Side;
  readonly members: readonly SquadMember[];
}

export interface SeminarDraftResult {
  readonly pools: ReadonlyMap<string, CommanderPool>;
  readonly markets: ReadonlyMap<Side, SeminarMarket>;
  readonly observation: DraftEconomyCycleObservation;
  readonly standingSeries: readonly DraftStandingSeriesPoint[];
  readonly remainingPurses: ReadonlyMap<string, number>;
  readonly willingnessByCommander: ReadonlyMap<
    string,
    Readonly<Record<string, number>>
  >;
  readonly counselSelections: readonly {
    readonly leader: string;
    readonly candidateId: string;
    readonly counsel: number;
  }[];
}

function roleFromShortRole(role: 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'): PieceRole {
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

function marketMember(
  side: Side,
  role: PieceRole,
  index: number,
  seed: number,
): SquadMember {
  const id = `${side}:market:${role}:${String(index).padStart(2, '0')}`;
  const identitySeed = identityCreationSeed(seed, id);
  const identity: CredenceIdentity = {
    identityCreationSeed: identitySeed,
    disposition: dispositionForIdentitySeed(identitySeed),
    relationshipAccounts: {},
  };
  const state = createFreshPieceState(
    id,
    role,
    50,
    deterministicUnit((((seed % 10000) + 10000) % 10000) / 10000, index),
  );
  const disposition = identity.disposition ?? state.credence;
  return {
    state: { ...state, credence: disposition },
    originRole: role,
    status: 'available',
    availableAtMatch: 1,
    provenance: 'drafted',
    service: {
      matchesPlayed: 0,
      desertions: 0,
      refusals: 0,
      captures: 0,
      consecutiveNonSelections: 0,
    },
    credenceIdentity: identity,
  };
}

export function createSeminarMarkets(
  seed: number,
  pools: ReadonlyMap<string, CommanderPool>,
): ReadonlyMap<Side, SeminarMarket> {
  const markets = new Map<Side, SeminarMarket>();
  for (const side of ['w', 'b'] as const) {
    const pool = [...pools.values()].find(
      (candidate) => candidate.side === side,
    );
    if (pool === undefined) throw new Error(`Missing ${side} commander pool.`);
    const target = poolRoleCountsForReserveDepth(
      reserveDepthForConfig(pool.config),
    );
    const issued = poolRoleCounts();
    const members = DRAFT_ROLES.flatMap((role) =>
      Array.from(
        { length: Math.max(0, (target[role] ?? 0) - (issued[role] ?? 0)) },
        (_, index) =>
          marketMember(side, role, index, seed ^ (side === 'w' ? 0 : 1)),
      ),
    );
    markets.set(side, { side, members });
  }
  return markets;
}

function draftStyle(style: SeminarCommander['style']): DraftBidder['style'] {
  switch (style) {
    case 'servant':
      return 'cautious';
    case 'tyrannical':
      return 'aggressive';
    case 'supportive':
      return 'balanced';
    case 'volatile':
      return 'aggressive';
    case 'random':
      return 'balanced';
  }
}

function roleShortfall(
  pool: CommanderPool,
): Readonly<Record<PieceRole, number>> {
  const target = poolRoleCountsForReserveDepth(
    reserveDepthForConfig(pool.config),
  );
  return Object.fromEntries(
    DRAFT_ROLES.map((role) => {
      const present = pool.members.filter(
        (member) =>
          member.status !== 'retired' &&
          member.status !== 'fired' &&
          isEligibleForChair(member.originRole, member.attainedRole, role),
      ).length;
      return [role, Math.max(0, (target[role] ?? 0) - present)];
    }),
  ) as Record<PieceRole, number>;
}

function testimony(register: PublicRegister | undefined): number {
  return Math.max(
    0,
    Math.min(100, 50 + (register?.wins ?? 0) * 5 - (register?.losses ?? 0) * 5),
  );
}

export function publicContributionForRecords(
  records: readonly MatchRecord[],
  candidateId: string,
): number {
  let contribution = 0;
  for (const record of records) {
    const starting = record.rosterSnapshot.find(
      (piece) => piece.id === candidateId,
    );
    if (starting === undefined) continue;
    let role = starting.role;
    for (const event of record.events) {
      if (event.t === 'PROMOTION' && event.pieceId === candidateId) {
        role = event.toRole;
      }
      if (event.t !== 'CAPTURE') continue;
      if (event.by === candidateId) {
        const victim = parsePieceId(event.victim);
        if (victim !== null)
          contribution += publicRoleValue(roleFromShortRole(victim.role));
      }
      if (event.victim === candidateId) contribution -= publicRoleValue(role);
    }
  }
  return contribution;
}

function consultationMap(
  consultations: readonly CounselConsultation[],
  weight: number,
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    consultations.map((consultation) => [
      consultation.candidateId,
      Math.max(
        0,
        1000 +
          ('opinion' in consultation.counsel
            ? counselOpinionValue(consultation.counsel.opinion) * weight
            : 0),
      ),
    ]),
  );
}

export function runSeminarDraft(options: {
  readonly cycle: number;
  readonly seed: number;
  readonly commanders: readonly SeminarCommander[];
  readonly pools: ReadonlyMap<string, CommanderPool>;
  readonly markets: ReadonlyMap<Side, SeminarMarket>;
  readonly standings: readonly CommanderStanding[];
  readonly registers: ReadonlyMap<string, PublicRegister>;
  readonly previousPurses: ReadonlyMap<string, number>;
  readonly config: SeminarConfig;
}): SeminarDraftResult {
  const priorities = draftPriority(options.standings);
  const priorityById = new Map(
    priorities.map((entry) => [entry.commanderId, entry]),
  );
  const sideMarkets = new Map<Side, SeminarMarket>(options.markets);
  const nextPools = new Map(options.pools);
  const lotsBySide = new Map<Side, DraftLot[]>();
  const candidatesByLot = new Map<string, SquadMember>();
  for (const side of ['w', 'b'] as const) {
    const market = sideMarkets.get(side);
    if (market === undefined) continue;
    const lots: DraftLot[] = [];
    const shortfalls = new Map(
      options.commanders
        .filter((commander) => commander.side === side)
        .map((commander) => [
          commander.id,
          roleShortfall(options.pools.get(commander.id) as CommanderPool),
        ]),
    );
    for (const candidate of market.members) {
      const demandedRole = DRAFT_ROLES.find((role) =>
        [...shortfalls.entries()].some(
          ([, shortfall]) =>
            (shortfall[role] ?? 0) > 0 &&
            isEligibleForChair(
              candidate.originRole,
              candidate.attainedRole,
              role,
            ),
        ),
      );
      if (demandedRole === undefined) continue;
      const owner = options.commanders.find(
        (commander) => commander.side === side,
      );
      const ownerRegister =
        owner === undefined ? undefined : options.registers.get(owner.id);
      const discount = acceptanceDiscountPermille({
        disposition: candidate.state.credence,
        rosterTestimony: testimony(ownerRegister),
      });
      const lot: DraftLot = {
        lotId: candidate.state.id,
        basePrice: publicRoleValue(candidate.originRole),
        minimumBid: acceptedPrice(
          publicRoleValue(candidate.originRole),
          discount,
        ),
      };
      lots.push(lot);
      candidatesByLot.set(lot.lotId, candidate);
    }
    lotsBySide.set(side, lots);
  }
  const winsByCommander: Record<string, number> = {};
  const clearingPrices: { clearingPrice: number; minimumBid: number }[] = [];
  const standingSeries: DraftStandingSeriesPoint[] = priorities.map(
    (entry) => ({
      policy:
        options.commanders.find(
          (commander) => commander.id === entry.commanderId,
        )?.style ?? entry.commanderId,
      cycle: options.cycle,
      standing: entry.standing,
    }),
  );
  const counselSelections: {
    leader: string;
    candidateId: string;
    counsel: number;
  }[] = [];
  const willingnessByCommander = new Map<
    string,
    Readonly<Record<string, number>>
  >();
  const remainingPurses = new Map<string, number>();
  let contestedLots = 0;
  for (const side of ['w', 'b'] as const) {
    const lots = lotsBySide.get(side) ?? [];
    const market = sideMarkets.get(side);
    if (market === undefined) continue;
    const sideCommanders = options.commanders.filter(
      (commander) => commander.side === side,
    );
    const bidders: DraftBidder[] = [];
    for (const commander of sideCommanders) {
      const pool = options.pools.get(commander.id);
      const priority = priorityById.get(commander.id);
      if (pool === undefined || priority === undefined) continue;
      const requests = lots.flatMap((lot) =>
        pool.members
          .filter(
            (member) =>
              member.status !== 'retired' && member.status !== 'fired',
          )
          .map((member) => ({
            holder: member.state,
            holderOriginRole: member.originRole,
            candidate: {
              id: lot.lotId,
              originRole: candidatesByLot.get(lot.lotId)?.originRole ?? 'Pawn',
            },
          })),
      );
      const ledger = consultWithBudget(requests, {
        ...DRAFT_CONFIG,
        CONSULTATIONS_PER_CYCLE: options.config.DRAFT_CONSULTATIONS_PER_CYCLE,
      });
      const willingness = consultationMap(
        ledger.consultations,
        Math.max(
          0,
          Math.min(
            1000,
            Math.trunc(
              options.config.DRAFT_COUNSEL_WILLINGNESS_WEIGHT_PERMILLE,
            ),
          ),
        ),
      );
      willingnessByCommander.set(commander.id, willingness);
      const purse =
        priority.purse +
        carryPurse(options.previousPurses.get(commander.id) ?? 0);
      bidders.push({
        commanderId: commander.id,
        priorityRank: priority.priorityRank,
        purse,
        style: draftStyle(commander.style),
        acceptanceDiscountPermille: DRAFT_CONFIG.ACCEPTANCE_DISCOUNT_PERMILLE,
        willingnessPermilleByLot: willingness,
      });
    }
    contestedLots += lots.filter((lot) => {
      const eligible = bidders.filter(
        (bidder) => bidForLot(bidder, lot).amount >= (lot.minimumBid ?? 0),
      );
      return eligible.length > 1;
    }).length;
    const clearing = clearDraft(lots, bidders);
    for (const [id, purse] of Object.entries(clearing.remainingPurses)) {
      remainingPurses.set(id, purse);
    }
    for (const cleared of clearing.lots) {
      clearingPrices.push({
        clearingPrice: cleared.clearingPrice,
        minimumBid: cleared.minimumBid,
      });
      if (cleared.winnerId === undefined) continue;
      const candidate = candidatesByLot.get(cleared.lotId);
      const winnerPool = nextPools.get(cleared.winnerId);
      if (candidate === undefined || winnerPool === undefined) continue;
      nextPools.set(cleared.winnerId, {
        ...winnerPool,
        members: [...winnerPool.members, candidate],
      });
      winsByCommander[cleared.winnerId] =
        (winsByCommander[cleared.winnerId] ?? 0) + 1;
      const counsel = bidders.find(
        (bidder) => bidder.commanderId === cleared.winnerId,
      )?.willingnessPermilleByLot?.[cleared.lotId];
      if (counsel !== undefined) {
        counselSelections.push({
          leader: cleared.winnerId,
          candidateId: candidate.state.id,
          counsel: counsel - 1000,
        });
      }
      sideMarkets.set(side, {
        side,
        members: market.members.filter(
          (member) => member.state.id !== candidate.state.id,
        ),
      });
    }
  }
  return {
    pools: nextPools,
    markets: sideMarkets,
    observation: {
      cycle: options.cycle,
      contestedLots,
      winsByCommander,
      standingOrder: priorities.map((entry) => entry.commanderId),
      clearingPrices,
    },
    standingSeries,
    remainingPurses,
    willingnessByCommander,
    counselSelections,
  };
}
