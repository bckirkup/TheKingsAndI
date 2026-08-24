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
  type CounselConsultationRequest,
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
  poolRoleCountsForReserveDepth,
  reserveDepthForConfig,
  type CredenceIdentity,
  type SquadMember,
} from '../src/orchestration';
import { createFreshPieceState, unitForIndex } from './roster';
import type { CommanderPool } from './pool';
import type { SeminarCommander } from './seminar';
import { SEMINAR_CONFIG, type SeminarConfig } from './seminarConfig';

const DRAFT_ROLES: readonly PieceRole[] = [
  'Queen',
  'Rook',
  'Bishop',
  'Knight',
  'Pawn',
];

const NEUTRAL_ROSTER_TESTIMONY = 50;

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
  initialTrust: number,
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
    initialTrust,
    unitForIndex((((seed % 10000) + 10000) % 10000) / 10000, index),
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
  config: SeminarConfig = SEMINAR_CONFIG,
): ReadonlyMap<Side, SeminarMarket> {
  const markets = new Map<Side, SeminarMarket>();
  for (const side of ['w', 'b'] as const) {
    const pool = [...pools.values()].find(
      (candidate) => candidate.side === side,
    );
    if (pool === undefined) throw new Error(`Missing ${side} commander pool.`);
    const marketTarget = poolRoleCountsForReserveDepth(
      Math.max(0, Math.trunc(config.DRAFT_MARKET_DEPTH_PER_SIDE)),
    );
    const issued = poolRoleCountsForReserveDepth(0);
    const members = DRAFT_ROLES.flatMap((role) =>
      Array.from(
        {
          length: Math.max(0, (marketTarget[role] ?? 0) - (issued[role] ?? 0)),
        },
        (_, index) =>
          marketMember(
            side,
            role,
            index,
            seed ^ (side === 'w' ? 0 : 1),
            config.DRAFT_MARKET_INITIAL_TRUST,
          ),
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
  firstMatch: number,
  countUnavailableAsPresent: boolean,
): Readonly<Record<PieceRole, number>> {
  const target = poolRoleCountsForReserveDepth(
    reserveDepthForConfig(pool.config),
  );
  return Object.fromEntries(
    DRAFT_ROLES.map((role) => {
      const present = pool.members.filter(
        (member) =>
          (countUnavailableAsPresent
            ? member.status !== 'retired' && member.status !== 'fired'
            : member.status === 'available' &&
              member.availableAtMatch <= firstMatch) &&
          isEligibleForChair(member.originRole, member.attainedRole, role),
      ).length;
      return [role, Math.max(0, (target[role] ?? 0) - present)];
    }),
  ) as Record<PieceRole, number>;
}

function publicServiceValue(service: SquadMember['service']): number {
  return service.captures - service.desertions - service.refusals;
}

export function publicLotBasePrice(
  candidate: SquadMember,
  config: SeminarConfig,
): number {
  const rolePrice =
    (publicRoleValue(candidate.originRole) *
      Math.trunc(config.DRAFT_LOT_ROLE_WEIGHT_PERMILLE)) /
    1000;
  const servicePrice =
    (publicServiceValue(candidate.service) *
      Math.trunc(config.DRAFT_LOT_SERVICE_WEIGHT_PERMILLE)) /
    1000;
  return Math.max(
    0,
    Math.trunc(config.DRAFT_LOT_BASE_PRICE + rolePrice + servicePrice),
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

function candidateAcceptancePrice(
  candidate: SquadMember,
  lot: DraftLot,
  commanderId: string,
): number {
  const relationshipAccount =
    candidate.credenceIdentity?.relationshipAccounts?.[commanderId];
  const acceptanceDiscount = acceptanceDiscountPermille({
    ...(relationshipAccount === undefined ? {} : { relationshipAccount }),
    disposition: candidate.state.credence,
    rosterTestimony: NEUTRAL_ROSTER_TESTIMONY,
  });
  return acceptedPrice(lot.basePrice, acceptanceDiscount);
}

export function bidderAcceptanceDiscountPermille(
  candidate: SquadMember,
  commanderId: string,
  config: SeminarConfig,
): number {
  const relationshipAccount =
    candidate.credenceIdentity?.relationshipAccounts?.[commanderId];
  if (relationshipAccount === undefined) {
    return Math.max(
      0,
      Math.min(1000, Math.trunc(config.DRAFT_BIDDER_ASSUMED_DISCOUNT_PERMILLE)),
    );
  }
  return acceptanceDiscountPermille({
    relationshipAccount,
    disposition: { tauBenev: NEUTRAL_ROSTER_TESTIMONY },
    rosterTestimony: NEUTRAL_ROSTER_TESTIMONY,
  });
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
  readonly firstMatch?: number;
}): SeminarDraftResult {
  const firstMatch = options.firstMatch ?? 1;
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
          (() => {
            const pool = options.pools.get(commander.id);
            if (pool === undefined)
              throw new Error(`Missing pool for ${commander.id}.`);
            return roleShortfall(
              pool,
              firstMatch,
              options.config.DRAFT_COUNT_UNAVAILABLE_AS_PRESENT,
            );
          })(),
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
      const basePrice = publicLotBasePrice(candidate, options.config);
      const lot: DraftLot = {
        lotId: candidate.state.id,
        basePrice,
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
  const counselSignalsByCommander = new Map<
    string,
    ReadonlyMap<string, number>
  >();
  const remainingPurses = new Map<string, number>();
  let contestedLots = 0;
  let declinedLots = 0;
  for (const side of ['w', 'b'] as const) {
    const lots = lotsBySide.get(side) ?? [];
    const market = sideMarkets.get(side);
    if (market === undefined) continue;
    let remainingMarket = market;
    const sideCommanders = options.commanders.filter(
      (commander) => commander.side === side,
    );
    const bidders: DraftBidder[] = [];
    for (const commander of sideCommanders) {
      const pool = options.pools.get(commander.id);
      const priority = priorityById.get(commander.id);
      if (pool === undefined || priority === undefined) continue;
      const holders = pool.members
        .filter(
          (member) => member.status !== 'retired' && member.status !== 'fired',
        )
        .sort((left, right) => left.state.id.localeCompare(right.state.id));
      // Rotate lot order for each holder round so a small budget reaches
      // multiple candidates; holders remain sorted by stable piece id.
      const requests: CounselConsultationRequest[] = [];
      for (let holderIndex = 0; holderIndex < holders.length; holderIndex++) {
        for (let lotOffset = 0; lotOffset < lots.length; lotOffset++) {
          const lot = lots[(holderIndex + lotOffset) % lots.length];
          const holder = holders[holderIndex];
          if (lot === undefined || holder === undefined) continue;
          const candidate = candidatesByLot.get(lot.lotId);
          if (candidate === undefined)
            throw new Error(`Missing candidate for lot ${lot.lotId}.`);
          requests.push({
            holder: holder.state,
            holderOriginRole: holder.originRole,
            candidate: {
              id: lot.lotId,
              originRole: candidate.originRole,
            },
          });
        }
      }
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
      const counselSignals = new Map(
        ledger.consultations.map((consultation) => [
          consultation.candidateId,
          'opinion' in consultation.counsel
            ? counselOpinionValue(consultation.counsel.opinion)
            : 0,
        ]),
      );
      counselSignalsByCommander.set(commander.id, counselSignals);
      willingnessByCommander.set(commander.id, willingness);
      const purse =
        priority.purse +
        carryPurse(options.previousPurses.get(commander.id) ?? 0);
      bidders.push({
        commanderId: commander.id,
        priorityRank: priority.priorityRank,
        purse,
        style: draftStyle(commander.style),
        acceptanceDiscountPermille:
          options.config.DRAFT_BIDDER_ASSUMED_DISCOUNT_PERMILLE,
        acceptanceDiscountPermilleByLot: Object.fromEntries(
          lots.map((lot) => {
            const candidate = candidatesByLot.get(lot.lotId);
            if (candidate === undefined)
              throw new Error(`Missing candidate for lot ${lot.lotId}.`);
            return [
              lot.lotId,
              bidderAcceptanceDiscountPermille(
                candidate,
                commander.id,
                options.config,
              ),
            ];
          }),
        ),
        willingnessPermilleByLot: willingness,
      });
    }
    // This is an observation approximation: bids are recomputed independently
    // for each lot and do not model purse depletion across the lot sequence.
    contestedLots += lots.filter((lot) => {
      const candidate = candidatesByLot.get(lot.lotId);
      if (candidate === undefined)
        throw new Error(`Missing candidate for lot ${lot.lotId}.`);
      const eligible = bidders.filter((bidder) => {
        const bid = bidForLot(bidder, lot);
        return (
          bid.amount >=
          candidateAcceptancePrice(candidate, lot, bidder.commanderId)
        );
      });
      return eligible.length > 1;
    }).length;
    const clearing = clearDraft(lots, bidders);
    for (const [id, purse] of Object.entries(clearing.remainingPurses)) {
      remainingPurses.set(id, purse);
    }
    // A decline refunds after clearDraft has priced later lots against the
    // depleted purse, so the committed bid still crowds out this pass.
    for (const cleared of clearing.lots) {
      if (cleared.winnerId === undefined) {
        clearingPrices.push({
          clearingPrice: cleared.clearingPrice,
          minimumBid: cleared.minimumBid,
        });
        continue;
      }
      const candidate = candidatesByLot.get(cleared.lotId);
      const winnerPool = nextPools.get(cleared.winnerId);
      if (candidate === undefined)
        throw new Error(`Missing candidate for lot ${cleared.lotId}.`);
      if (winnerPool === undefined)
        throw new Error(`Missing winner pool for ${cleared.winnerId}.`);
      const lot = lots.find(
        (candidateLot) => candidateLot.lotId === cleared.lotId,
      );
      if (lot === undefined)
        throw new Error(`Missing lot for clearing ${cleared.lotId}.`);
      const candidateMinimum = candidateAcceptancePrice(
        candidate,
        lot,
        cleared.winnerId,
      );
      if (cleared.clearingPrice < candidateMinimum) {
        const remaining = remainingPurses.get(cleared.winnerId) ?? 0;
        remainingPurses.set(
          cleared.winnerId,
          remaining + cleared.clearingPrice,
        );
        declinedLots += 1;
        clearingPrices.push({
          clearingPrice: 0,
          minimumBid: cleared.minimumBid,
        });
        continue;
      }
      clearingPrices.push({
        clearingPrice: cleared.clearingPrice,
        minimumBid: cleared.minimumBid,
      });
      nextPools.set(cleared.winnerId, {
        ...winnerPool,
        members: [
          ...winnerPool.members,
          {
            ...candidate,
            availableAtMatch: firstMatch,
          },
        ],
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
          counsel:
            counselSignalsByCommander
              .get(cleared.winnerId)
              ?.get(cleared.lotId) ?? 0,
        });
      }
      remainingMarket = {
        side,
        members: remainingMarket.members.filter(
          (member) => member.state.id !== candidate.state.id,
        ),
      };
    }
    sideMarkets.set(side, remainingMarket);
  }
  return {
    pools: nextPools,
    markets: sideMarkets,
    observation: {
      cycle: options.cycle,
      contestedLots,
      clearedLots: Object.values(winsByCommander).reduce(
        (total, count) => total + count,
        0,
      ),
      declinedLots,
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
