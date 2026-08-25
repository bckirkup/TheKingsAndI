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
  type DraftPriority,
  type DraftLot,
  minimumBidForCommander,
} from '../src/orchestration';
import { isEligibleForChair } from '../src/core/roleEligibility';
import {
  publicRoleValue,
  type MatchRecord,
  type PublicRegister,
} from '../src/persistence';
import {
  counselOpinionValue,
  type CounselReason,
  type PieceRole,
} from '../src/psychology';
import type { CohortHistory } from '../src/core/cohortHistory';
import { DRAFT_CONFIG } from '../src/core/draftConfig';
import type {
  CohortHistoryCycleObservation,
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
  readonly cohortHistory: CohortHistoryCycleObservation;
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

export function scaledDraftPurses(
  priorities: readonly DraftPriority[],
  lots: readonly DraftLot[],
  ratioPermille: number,
): ReadonlyMap<string, number> {
  const fallback = new Map(
    priorities.map((priority) => [priority.commanderId, priority.purse]),
  );
  if (lots.length === 0) return fallback;
  const askingTotal = lots.reduce(
    (total, lot) => total + Math.max(0, Math.trunc(lot.basePrice)),
    0,
  );
  const ordered = [...priorities].sort((left, right) =>
    left.commanderId.localeCompare(right.commanderId),
  );
  const weightTotal = ordered.reduce(
    (total, priority) => total + Math.max(0, Math.trunc(priority.purse)),
    0,
  );
  if (askingTotal === 0 || weightTotal === 0) return fallback;
  const ratio = Math.max(0, Math.min(1000, Math.trunc(ratioPermille)));
  const target = Math.floor((askingTotal * ratio) / 1000);
  const allocations = ordered.map((priority) => {
    const weight = Math.max(0, Math.trunc(priority.purse));
    const numerator = target * weight;
    return {
      commanderId: priority.commanderId,
      amount: Math.floor(numerator / weightTotal),
      remainder: numerator % weightTotal,
    };
  });
  let remainder =
    target -
    allocations.reduce((total, allocation) => total + allocation.amount, 0);
  allocations.sort(
    (left, right) =>
      right.remainder - left.remainder ||
      left.commanderId.localeCompare(right.commanderId),
  );
  for (const allocation of allocations) {
    if (remainder <= 0) break;
    allocation.amount += 1;
    remainder -= 1;
  }
  return new Map(
    allocations.map((allocation) => [
      allocation.commanderId,
      allocation.amount,
    ]),
  );
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
  readonly cohortHistory?: CohortHistory;
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
      const baseLot: DraftLot = {
        lotId: candidate.state.id,
        basePrice,
      };
      const lot: DraftLot = {
        ...baseLot,
        minimumBidByCommander: Object.fromEntries(
          options.commanders
            .filter((commander) => commander.side === side)
            .map((commander) => [
              commander.id,
              candidateAcceptancePrice(candidate, baseLot, commander.id),
            ]),
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
  const counselReasonCounts: Record<CounselReason, number> = {
    'personal affinity': 0,
    'class prejudice': 0,
    'chair rivalry': 0,
    'mixed evidence': 0,
  };
  let counselOpinionTotal = 0;
  let counselOpinionCount = 0;
  const counselOpinions: number[] = [];
  let sharedIntakeDrafts = 0;
  let consultedAffinityPairs = 0;
  let acquisitionsWithAffinity = 0;
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
  let unfilledNoBids = 0;
  let unfilledBelowReserve = 0;
  for (const side of ['w', 'b'] as const) {
    const lots = lotsBySide.get(side) ?? [];
    const market = sideMarkets.get(side);
    if (market === undefined) continue;
    let remainingMarket = market;
    const sideCommanders = options.commanders.filter(
      (commander) => commander.side === side,
    );
    const sidePriorities = sideCommanders
      .map((commander) => priorityById.get(commander.id))
      .filter((priority): priority is DraftPriority => priority !== undefined);
    const basePurses = scaledDraftPurses(
      sidePriorities,
      lots,
      options.config.DRAFT_PURSE_TO_ASKING_RATIO_PERMILLE,
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
      const holderById = new Map(
        holders.map((member) => [member.state.id, member]),
      );
      for (const consultation of ledger.consultations) {
        const holder = holderById.get(consultation.holderId);
        if (
          holder !== undefined &&
          (holder.state.dyadicAffinity[consultation.candidateId] ?? 0) !== 0
        ) {
          consultedAffinityPairs += 1;
        }
      }
      for (const consultation of ledger.consultations) {
        if (!('opinion' in consultation.counsel)) continue;
        counselOpinionTotal += counselOpinionValue(
          consultation.counsel.opinion,
        );
        counselOpinionCount += 1;
        counselOpinions.push(counselOpinionValue(consultation.counsel.opinion));
        counselReasonCounts[consultation.counsel.reason] += 1;
      }
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
        (basePurses.get(commander.id) ?? priority.purse) +
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
          bid.amount >= minimumBidForCommander(lot, bidder.commanderId) &&
          bid.amount <= bidder.purse
        );
      });
      return eligible.length > 1;
    }).length;
    const clearing = clearDraft(lots, bidders, {
      ...DRAFT_CONFIG,
      DRAFT_CLEARING_RULE: options.config.DRAFT_CLEARING_RULE,
    });
    unfilledNoBids += clearing.unfilledNoBids;
    unfilledBelowReserve += clearing.unfilledBelowReserve;
    for (const [id, purse] of Object.entries(clearing.remainingPurses)) {
      remainingPurses.set(id, purse);
    }
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
      if (
        winnerPool.members.some(
          (member) =>
            (member.state.dyadicAffinity[candidate.state.id] ?? 0) !== 0,
        )
      ) {
        acquisitionsWithAffinity += 1;
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
      if (
        options.cohortHistory !== undefined &&
        options.cohortHistory.intakeByMember[candidate.state.id] !==
          undefined &&
        winnerPool.members.some(
          (member) =>
            options.cohortHistory?.intakeByMember[member.state.id] ===
            options.cohortHistory?.intakeByMember[candidate.state.id],
        )
      ) {
        sharedIntakeDrafts += 1;
      }
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
  const positiveClearingPrices = clearingPrices.filter(
    (entry) => entry.clearingPrice > 0,
  );
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
      declinedLots: unfilledBelowReserve,
      unfilledNoBids,
      unfilledBelowReserve,
      meanClearingPrice:
        positiveClearingPrices.length === 0
          ? 0
          : Math.floor(
              positiveClearingPrices.reduce(
                (total, entry) => total + entry.clearingPrice,
                0,
              ) / positiveClearingPrices.length,
            ),
      totalPurseLeftUnspent: [...remainingPurses.values()].reduce(
        (total, purse) => total + purse,
        0,
      ),
      winsByCommander,
      standingOrder: priorities.map((entry) => entry.commanderId),
      clearingPrices,
    },
    standingSeries,
    remainingPurses,
    willingnessByCommander,
    counselSelections,
    cohortHistory: {
      cycle: options.cycle,
      draftedCandidates: Object.values(winsByCommander).reduce(
        (total, count) => total + count,
        0,
      ),
      sharedIntakeDrafts,
      consultedAffinityPairs,
      acquisitionsWithAffinity,
      counselOpinionTotal,
      counselOpinionCount,
      counselOpinions,
      counselReasonCounts,
      desertions: 0,
      retirements: 0,
      commendationsAwarded: 0,
    },
  };
}
