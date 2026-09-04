/**
 * The seminar spine: a week settles matches into a public register and
 * commendations, a semester carries weeks forward into terminal awards.
 *
 * Commander colours are fixed for the semester — white commanders always lead
 * white. Rotating them is a seminar decision this harness does not invent.
 */
import type { EnginePort } from '../src/engine/types';
import {
  assembleMatchRecord,
  foldJudgementSeat,
  foldPlayerCommendations,
  foldPublicRegister,
  publicMatchFactsFromRecord,
  PUBLIC_REGISTER_COLUMNS,
  type CommendationAward,
  type CampaignDebrief,
  type MatchRecord,
  type PlayerCommendationSet,
  type PublicRegister,
} from '../src/persistence';
import { digest } from '../src/core/digest';
import {
  draftPriority,
  type CommanderStanding,
} from '../src/core/draftEconomy';
import {
  classifyMatchResult,
  type HeadlessMatchResult,
} from '../src/orchestration';
import { ENGINE_CONFIG, type PieceState } from '../src/psychology';
import {
  COHORT_HISTORY_CONFIG,
  generateCohortHistory,
  type CohortHistoryConfig,
} from '../src/core/cohortHistory';
import { applyCohortHistory } from '../src/psychology';

import { canonicalJson } from '../src/core/canonicalJson';
import {
  createSimEngine,
  disposeSimEngine,
  type SimEngineKind,
} from './engine';
import {
  createCommanderPool,
  fieldPool,
  foldMatchIntoPools,
  type CommanderPool,
  type FieldedPool,
} from './pool';
import { runMatch } from './match';
import { matchSeedForWorldPairing } from './world';
import { SEMINAR_CONFIG, type SeminarConfig } from './seminarConfig';
import {
  createPriorLeaderObservation,
  updateLeaderObservation,
  type LeaderObservation,
} from './leaders';
import type { Leader } from './cli';
import {
  createSeminarMarkets,
  draftLotsForSide,
  draftStartingPurses,
  publicContributionForRecords,
  runSeminarDraft,
  type SeminarMarket,
} from './seminarDraft';
import {
  decayCaptiveBenevolence,
  ransomCaptives,
  type RansomLedgerEntry,
} from './ransom';
import {
  EMPTY_EXCHANGE_HOPE,
  foldExchangeHope,
  type ExchangeHopeOwnerResult,
} from './exchangeHope';
import {
  EMPTY_GRATITUDE,
  foldGratitude,
  type GratitudeOwnerResult,
  type GratitudeWeek,
} from './gratitude';
import {
  EMPTY_SEMINAR_GRIEF,
  foldSeminarGrief,
  type SeminarGriefOwnerResult,
} from './grief';
  draftEconomyDegeneracyFindings,
  type DegeneracyFinding,
  type DraftEconomyCycleObservation,
  type DraftEconomyObservations,
  type DraftStandingSeriesPoint,
  type CohortHistoryCycleObservation,
  type CohortHistoryObservations,
} from './degeneracy';

export const SEMINAR_WEEK_SEED_STRIDE = 1_000_003;
type CommanderSide = 'w' | 'b';

export interface SeminarCommander {
  readonly id: string;
  readonly side: CommanderSide;
  readonly style: Leader;
}

export interface SeminarWeekResult {
  readonly week: number;
  readonly seed: number;
  readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
  readonly recordDigests: Readonly<Record<string, readonly string[]>>;
  readonly fieldedLineups: Readonly<Record<string, readonly string[][]>>;
  readonly registerDeltas: Readonly<Record<string, PublicRegister>>;
  readonly commendations: Readonly<Record<string, PlayerCommendationSet>>;
  readonly standings: readonly SeminarStanding[];
  readonly poolStates: Readonly<Record<string, CommanderPool>>;
  readonly draftEconomy: DraftEconomyCycleObservation;
  readonly cohortHistory: CohortHistoryCycleObservation;
  readonly ransomLedger: readonly RansomLedgerEntry[];
}

export interface SeminarCommanderResult {
  readonly commander: SeminarCommander;
  readonly register: PublicRegister;
  readonly commendations: PlayerCommendationSet;
  readonly judgementSeat: CampaignDebrief['judgementSeat'];
  readonly exchangeHope: ExchangeHopeOwnerResult;
  readonly gratitude: GratitudeOwnerResult;
  readonly grief: SeminarGriefOwnerResult;
}

export interface SeminarStanding extends CommanderStanding {
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
}

export interface SeminarResult {
  readonly seed: number;
  readonly config: SeminarConfig;
  readonly commanders: readonly SeminarCommanderResult[];
  readonly weeks: readonly SeminarWeekResult[];
  readonly standings: readonly SeminarStanding[];
  readonly finalPools: Readonly<Record<string, CommanderPool>>;
  readonly terminalAwards: Readonly<
    Record<string, readonly CommendationAward[]>
  >;
  readonly draftEconomy: DraftEconomyObservations;
  readonly draftEconomyDegeneracyFindings: readonly DegeneracyFinding[];
  readonly counselCorrelationPairs: readonly {
    readonly leader: string;
    readonly counsel: number;
    readonly realizedContribution: number;
  }[];
  readonly cohortHistoryObservations: CohortHistoryObservations;
}

export function weekSeedForSemester(
  semesterSeed: number,
  week: number,
): number {
  if (!Number.isSafeInteger(semesterSeed) || !Number.isSafeInteger(week)) {
    throw new TypeError('Semester seed and week must be safe integers.');
  }
  if (week < 1) throw new RangeError('Week must be positive.');
  return semesterSeed ^ (week * SEMINAR_WEEK_SEED_STRIDE);
}

function commanderId(side: CommanderSide, index: number): string {
  return `${side}:commander:${String(index).padStart(2, '0')}`;
}

function createCommanders(
  count: number,
  catalogue: readonly Leader[],
): readonly SeminarCommander[] {
  if (catalogue.length === 0) {
    throw new Error('Seminar commander style catalogue is empty.');
  }
  return (['w', 'b'] as const).flatMap((side) =>
    Array.from({ length: count }, (_, index) => {
      const style = catalogue[index % catalogue.length];
      if (style === undefined) {
        throw new Error('Seminar commander style catalogue is empty.');
      }
      return { id: commanderId(side, index), side, style };
    }),
  );
}

function statusForStoredPiece(
  status: CommanderPool['members'][number]['status'],
): 'ACTIVE' | 'BENCHED' | 'CAPTURED' | 'RETIRED' | 'FIRED' {
  switch (status) {
    case 'available':
      return 'ACTIVE';
    case 'recovering':
    case 'benched':
      return 'BENCHED';
    case 'captive':
      return 'CAPTURED';
    case 'retired':
      return 'RETIRED';
    case 'fired':
      return 'FIRED';
  }
}

function digestableMatchRecord(record: MatchRecord): MatchRecord {
  const stripCash = (
    piece: MatchRecord['rosterSnapshot'][number],
  ): MatchRecord['rosterSnapshot'][number] => {
    const { cash, ...withoutCash } = piece;
    void cash;
    return withoutCash;
  };
  return {
    ...record,
    rosterSnapshot: record.rosterSnapshot.map(stripCash),
    rosterEnd: record.rosterEnd.map(stripCash),
  };
}

function storedRoster(fielded: FieldedPool): readonly (PieceState & {
  readonly status: 'ACTIVE' | 'BENCHED' | 'CAPTURED' | 'RETIRED' | 'FIRED';
})[] {
  return fielded.lineup.map((member) => ({
    ...member.state,
    status: statusForStoredPiece(member.status),
  }));
}

function recordForSide(input: {
  readonly commander: SeminarCommander;
  readonly rosterEndPool: CommanderPool;
  readonly fielded: FieldedPool;
  readonly result: HeadlessMatchResult;
  readonly matchIndex: number;
  readonly matchSeed: number;
  readonly campaignId: string;
  readonly actId: string;
  readonly additionalEvents?: readonly MatchRecord['events'][number][];
}): MatchRecord {
  const result = classifySeminarSideResult(input.result, input.commander.side);
  const rosterEnd = input.rosterEndPool.members.map((member) => ({
    ...member.state,
    status: statusForStoredPiece(member.status),
  }));
  return assembleMatchRecord({
    campaignId: input.campaignId,
    actId: input.actId,
    matchIndex: input.matchIndex,
    seed: input.matchSeed,
    rosterSnapshot: storedRoster(input.fielded),
    rosterEnd,
    events: [
      ...input.result.events,
      ...(input.additionalEvents ?? []).filter((event) =>
        input.rosterEndPool.members.some(
          (member) =>
            member.state.id === ('pieceId' in event ? event.pieceId : ''),
        ),
      ),
    ],
    engineAudit: input.result.engineAudit,
    winScore:
      input.commander.side === 'w'
        ? input.result.winScore
        : 100 - input.result.winScore,
    result,
  });
}

/**
 * `runMatch`'s `winScore` is produced by `scoreMatchOutcome` as exactly
 * 0, 50, or 100, so the black perspective is exactly `100 - winScore`.
 */
export function classifySeminarSideResult(
  result: Pick<
    HeadlessMatchResult,
    'rout' | 'enemyRout' | 'winScore' | 'dismissed'
  >,
  side: CommanderSide,
) {
  return classifyMatchResult({
    rout: side === 'w' ? result.rout : result.enemyRout,
    winScore: side === 'w' ? result.winScore : 100 - result.winScore,
    dismissed: side === 'w' ? result.dismissed : false,
  });
}

export function seminarObservableFromResult(
  result: HeadlessMatchResult,
  side: CommanderSide,
  fieldedPieceIds: ReadonlySet<string>,
): LeaderObservation {
  let refusals = 0;
  let executedOrders = 0;
  let desertions = 0;
  const desertionPlies = new Set<number>();
  for (const event of result.events) {
    if (!('pieceId' in event) || !fieldedPieceIds.has(event.pieceId)) {
      continue;
    }
    if (event.t === 'REFUSAL') refusals += 1;
    if (event.t === 'MOVE') executedOrders += 1;
    if (event.t === 'DESERTION') {
      desertions += 1;
      desertionPlies.add(event.ply);
    }
  }
  const refusalRate =
    refusals / Math.max(1, executedOrders + refusals + desertionPlies.size);
  return {
    matchesObserved: 1,
    refusalPermille: Math.max(
      0,
      Math.min(1_000, Math.trunc(refusalRate * 1_000)),
    ),
    desertions: Math.max(0, desertions),
    survivors: Math.max(
      0,
      side === 'w' ? result.roster.length : result.enemyRoster.length,
    ),
    winScore: Math.max(
      0,
      Math.min(
        100,
        Math.trunc(side === 'w' ? result.winScore : 100 - result.winScore),
      ),
    ),
  };
}

function pairingIndex(
  whiteIndex: number,
  blackIndex: number,
  count: number,
): number {
  return whiteIndex * count + blackIndex;
}

function registerForSide(
  records: readonly MatchRecord[],
  side: CommanderSide,
): PublicRegister {
  return foldPublicRegister(
    records.map((record) => publicMatchFactsFromRecord(record, side)),
  );
}

export function standingsFor(
  commanders: readonly SeminarCommander[],
  recordsByCommander: ReadonlyMap<string, readonly MatchRecord[]>,
  config: SeminarConfig,
): readonly SeminarStanding[] {
  return commanders
    .map((commander) => {
      const register = registerForSide(
        recordsByCommander.get(commander.id) ?? [],
        commander.side,
      );
      return {
        commanderId: commander.id,
        standing:
          register.wins * config.STANDING_WIN_WEIGHT +
          register.draws * config.STANDING_DRAW_WEIGHT +
          register.losses * config.STANDING_LOSS_WEIGHT,
        cohortExternality: register.materialTaken - register.materialLost,
        wins: register.wins,
        draws: register.draws,
        losses: register.losses,
      };
    })
    .sort(
      (left, right) =>
        right.standing - left.standing ||
        right.wins - left.wins ||
        left.commanderId.localeCompare(right.commanderId),
    );
}

async function runSeminarMatchPairing(input: {
  readonly white: SeminarCommander;
  readonly black: SeminarCommander;
  readonly whiteIndex: number;
  readonly blackIndex: number;
  readonly cohortSize: number;
  readonly publicCohortSize: number;
  readonly weekSeed: number;
  readonly seminarSeed: number;
  readonly matchesPerWeek: number;
  readonly matchIndex: number;
  readonly pools: Map<string, CommanderPool>;
  readonly weekRecords: Map<string, MatchRecord[]>;
  readonly weekFieldedLineups: Map<string, string[][]>;
  readonly allRecords: Map<string, MatchRecord[]>;
  readonly observations: Map<string, LeaderObservation>;
  readonly week: number;
  readonly weeksPerSemester: number;
  readonly standingRankByCommander: ReadonlyMap<string, number>;
  readonly config: SeminarConfig;
  readonly engine: EnginePort;
}): Promise<number> {
  let matchIndex = input.matchIndex;
  for (let match = 1; match <= input.matchesPerWeek; match += 1) {
    matchIndex += 1;
    const whitePool = input.pools.get(input.white.id);
    const blackPool = input.pools.get(input.black.id);
    if (whitePool === undefined || blackPool === undefined) {
      throw new Error('Seminar pool references an unknown commander.');
    }
    const whiteFielded = fieldPool(whitePool, matchIndex);
    const blackFielded = fieldPool(blackPool, matchIndex);
    const matchSeed = matchSeedForWorldPairing(
      input.weekSeed,
      pairingIndex(input.whiteIndex, input.blackIndex, input.cohortSize),
      match,
    );
    const result = await runMatch({
      seed: matchSeed,
      leader: input.white.style,
      opponent: input.black.style,
      matchIndex,
      campaignMatch: matchIndex,
      roster: whiteFielded.lineup.map((member) => member.state),
      initialLineup: whiteFielded.lineup.map((member) => member.state),
      enemyRoster: blackFielded.lineup.map((member) => member.state),
      initialEnemyLineup: blackFielded.lineup.map((member) => member.state),
      leaderObservation:
        input.observations.get(input.white.id) ??
        createPriorLeaderObservation(),
      opponentObservation:
        input.observations.get(input.black.id) ??
        createPriorLeaderObservation(),
      leaderSeminar: {
        week: input.week,
        weeksPerSemester: input.weeksPerSemester,
        standingRank: input.standingRankByCommander.get(input.white.id) ?? 1,
        cohortSize: input.publicCohortSize,
      },
      opponentSeminar: {
        week: input.week,
        weeksPerSemester: input.weeksPerSemester,
        standingRank: input.standingRankByCommander.get(input.black.id) ?? 1,
        cohortSize: input.publicCohortSize,
      },
      engine: input.engine,
      griefEnabled: false,
    });
    input.observations.set(
      input.white.id,
      updateLeaderObservation(
        input.observations.get(input.white.id) ??
          createPriorLeaderObservation(),
        seminarObservableFromResult(
          result,
          'w',
          new Set(whiteFielded.lineup.map((member) => member.state.id)),
        ),
      ),
    );
    input.observations.set(
      input.black.id,
      updateLeaderObservation(
        input.observations.get(input.black.id) ??
          createPriorLeaderObservation(),
        seminarObservableFromResult(
          result,
          'b',
          new Set(blackFielded.lineup.map((member) => member.state.id)),
        ),
      ),
    );
    const folded = foldMatchIntoPools({
      white: whitePool,
      black: blackPool,
      whiteFielded,
      blackFielded,
      result,
      match: matchIndex,
      ...(input.config.CAPTIVITY_HOLD_ENABLED
        ? {
            captivity: {
              enabled: true,
              whiteCommanderId: input.white.id,
              blackCommanderId: input.black.id,
              week: input.week,
              grief: {
                affinityThreshold: ENGINE_CONFIG.GRIEF_AFFINITY_THRESHOLD,
                loadPerLossPermille: ENGINE_CONFIG.GRIEF_LOAD_PER_LOSS_PERMILLE,
              },
            },
          }
        : {}),
    });
    input.pools.set(input.white.id, folded.white);
    input.pools.set(input.black.id, folded.black);
    const griefEvents = folded.griefEvents ?? [];
    const whiteRecord = recordForSide({
      commander: input.white,
      rosterEndPool: folded.white,
      fielded: whiteFielded,
      result,
      matchIndex,
      matchSeed,
      campaignId: `seminar:${input.seminarSeed}:${input.white.id}`,
      actId: `semester:${input.seminarSeed}`,
      additionalEvents: griefEvents,
    });
    const blackRecord = recordForSide({
      commander: input.black,
      rosterEndPool: folded.black,
      fielded: blackFielded,
      result,
      matchIndex,
      matchSeed,
      campaignId: `seminar:${input.seminarSeed}:${input.black.id}`,
      actId: `semester:${input.seminarSeed}`,
      additionalEvents: griefEvents,
    });
    input.weekRecords.get(input.white.id)?.push(whiteRecord);
    input.weekRecords.get(input.black.id)?.push(blackRecord);
    input.weekFieldedLineups
      .get(input.white.id)
      ?.push(whiteFielded.lineup.map((member) => member.state.id));
    input.weekFieldedLineups
      .get(input.black.id)
      ?.push(blackFielded.lineup.map((member) => member.state.id));
    input.allRecords.get(input.white.id)?.push(whiteRecord);
    input.allRecords.get(input.black.id)?.push(blackRecord);
  }
  return matchIndex;
}

function buildSeminarWeekResult(input: {
  readonly week: number;
  readonly weekSeed: number;
  readonly commanders: readonly SeminarCommander[];
  readonly weekRecords: ReadonlyMap<string, MatchRecord[]>;
  readonly weekFieldedLineups: ReadonlyMap<string, string[][]>;
  readonly allRecords: ReadonlyMap<string, MatchRecord[]>;
  readonly pools: ReadonlyMap<string, CommanderPool>;
  readonly config: SeminarConfig;
  readonly draftEconomy: DraftEconomyCycleObservation;
  readonly cohortHistory: CohortHistoryCycleObservation;
  readonly ransom: readonly RansomLedgerEntry[];
}): SeminarWeekResult {
  const records = Object.fromEntries(
    input.commanders.map((commander) => [
      commander.id,
      input.weekRecords.get(commander.id) ?? [],
    ]),
  );
  const recordDigests = Object.fromEntries(
    input.commanders.map((commander) => [
      commander.id,
      (records[commander.id] ?? []).map((record) =>
        digest(digestableMatchRecord(record)),
      ),
    ]),
  );
  const fieldedLineups = Object.fromEntries(
    input.commanders.map((commander) => [
      commander.id,
      input.weekFieldedLineups.get(commander.id) ?? [],
    ]),
  );
  const registerDeltas = Object.fromEntries(
    input.commanders.map((commander) => [
      commander.id,
      registerForSide(records[commander.id] ?? [], commander.side),
    ]),
  );
  const commendations = Object.fromEntries(
    input.commanders.map((commander) => [
      commander.id,
      foldPlayerCommendations(records[commander.id] ?? []),
    ]),
  );
  return {
    week: input.week,
    seed: input.weekSeed,
    records,
    recordDigests,
    fieldedLineups,
    registerDeltas,
    commendations,
    standings: standingsFor(
      input.commanders,
      new Map(
        input.commanders.map((commander) => [
          commander.id,
          input.allRecords.get(commander.id) ?? [],
        ]),
      ),
      input.config,
    ),
    poolStates: Object.fromEntries(input.pools.entries()),
    draftEconomy: input.draftEconomy,
    cohortHistory: input.cohortHistory,
    ransomLedger: input.ransom,
  };
}

export async function runSeminar(options: {
  readonly seed: number;
  readonly config?: SeminarConfig;
  readonly cohortHistoryConfig?: Partial<CohortHistoryConfig>;
  readonly engine?: EnginePort;
  readonly engineKind?: SimEngineKind;
}): Promise<SeminarResult> {
  const config = options.config ?? SEMINAR_CONFIG;
  if (
    !Number.isSafeInteger(config.WEEKS_PER_SEMESTER) ||
    config.WEEKS_PER_SEMESTER < 1 ||
    !Number.isSafeInteger(config.MATCHES_PER_WEEK) ||
    config.MATCHES_PER_WEEK < 1 ||
    !Number.isSafeInteger(config.COMMANDERS_PER_COHORT) ||
    config.COMMANDERS_PER_COHORT < 1
  ) {
    throw new RangeError('Seminar loop dimensions must be positive integers.');
  }
  const commanders = createCommanders(
    config.COMMANDERS_PER_COHORT,
    config.COMMANDER_STYLE_CATALOGUE,
  );
  const commanderById = new Map(
    commanders.map((commander) => [commander.id, commander]),
  );
  const pools = new Map(
    commanders.map((commander, index) => [
      commander.id,
      createCommanderPool({
        id: commander.id,
        side: commander.side,
        style: commander.style,
        careerSeed: options.seed ^ index,
        randomUnit:
          ((((options.seed + index) % 10_000) + 10_000) % 10_000) / 10_000,
      }),
    ]),
  );
  let currentPools = pools;
  let markets: ReadonlyMap<'w' | 'b', SeminarMarket> = createSeminarMarkets(
    options.seed,
    currentPools,
    config,
  );
  const cohortMemberIds = [
    ...[...currentPools.values()].flatMap((pool) =>
      pool.members.map((member) => member.state.id),
    ),
    ...[...markets.values()].flatMap((market) =>
      market.members.map((member) => member.state.id),
    ),
  ];
  const cohortHistoryConfig = {
    ...COHORT_HISTORY_CONFIG,
    ...options.cohortHistoryConfig,
    RELATIONS_PER_PIECE: config.COHORT_HISTORY_RELATIONS_PER_PIECE,
  };
  const cohortHistory = generateCohortHistory(
    cohortMemberIds,
    options.seed,
    cohortHistoryConfig,
  );
  currentPools = new Map(
    [...currentPools.entries()].map(([id, pool]) => [
      id,
      {
        ...pool,
        members: pool.members.map((member) => ({
          ...member,
          state: applyCohortHistory(
            member.state,
            cohortHistory,
            cohortHistoryConfig,
          ),
        })),
      },
    ]),
  );
  markets = new Map(
    [...markets.entries()].map(([side, market]) => [
      side,
      {
        ...market,
        members: market.members.map((member) => ({
          ...member,
          state: applyCohortHistory(
            member.state,
            cohortHistory,
            cohortHistoryConfig,
          ),
        })),
      },
    ]),
  );
  let previousPurses = new Map<string, number>();
  const allRecords = new Map<string, MatchRecord[]>(
    commanders.map((commander) => [commander.id, []]),
  );
  const observations = new Map<string, LeaderObservation>(
    commanders.map((commander) => [
      commander.id,
      createPriorLeaderObservation(),
    ]),
  );
  const weeks: SeminarWeekResult[] = [];
  const gratitudeWeeks: GratitudeWeek[] = [];
  const draftCycles: DraftEconomyCycleObservation[] = [];
  const standingSeries: DraftStandingSeriesPoint[] = [];
  const counselCorrelationPairs: {
    leader: string;
    counsel: number;
    realizedContribution: number;
  }[] = [];
  const cohortHistoryObservations: CohortHistoryCycleObservation[] = [];
  const engine =
    options.engine ?? (await createSimEngine(options.engineKind ?? 'fake'));
  const ownedEngine = options.engine === undefined;
  let matchIndex = 0;
  try {
    for (let week = 1; week <= config.WEEKS_PER_SEMESTER; week += 1) {
      const weekSeed = weekSeedForSemester(options.seed, week);
      const poolStatusesBeforeWeek = new Map(
        [...currentPools.values()].flatMap((pool) =>
          pool.members.map(
            (member) => [member.state.id, member.status] as const,
          ),
        ),
      );
      const standingsBefore = standingsFor(
        commanders,
        new Map(
          commanders.map((commander) => [
            commander.id,
            allRecords.get(commander.id) ?? [],
          ]),
        ),
        config,
      );
      const registersBefore = new Map(
        commanders.map((commander) => [
          commander.id,
          registerForSide(allRecords.get(commander.id) ?? [], commander.side),
        ]),
      );
      let draftObservation: DraftEconomyCycleObservation = {
        cycle: week,
        contestedLots: 0,
        clearedLots: 0,
        declinedLots: 0,
        unfilledNoBids: 0,
        unfilledBelowReserve: 0,
        meanClearingPrice: 0,
        totalPurseLeftUnspent: 0,
        winsByCommander: {},
        standingOrder: draftPriority(standingsBefore).map(
          (entry) => entry.commanderId,
        ),
        clearingPrices: [],
      };
      let cohortObservation: CohortHistoryCycleObservation = {
        cycle: week,
        draftedCandidates: 0,
        sharedIntakeDrafts: 0,
        consultedAffinityPairs: 0,
        consultedIntakePairs: 0,
        acquisitionsWithAffinity: 0,
        counselOpinionTotal: 0,
        counselOpinionCount: 0,
        counselOpinions: [],
        counselReasonCounts: {
          'personal affinity': 0,
          'class prejudice': 0,
          'chair rivalry': 0,
          'mixed evidence': 0,
        },
        desertions: 0,
        retirements: 0,
        commendationsAwarded: 0,
      };
      const priorities = draftPriority(standingsBefore);
      const draftEnabled = week > 1 || config.DRAFT_AT_CYCLE_ONE;
      let draftPurses = new Map<string, number>(
        priorities.map((entry) => [entry.commanderId, entry.purse]),
      );
      let ransomLedger: readonly RansomLedgerEntry[] = [];
      const gratitudeWeekFirstMatch = matchIndex + 1;
      if (config.CAPTIVITY_HOLD_ENABLED) {
        const trueStartingPurses = new Map<string, number>();
        currentPools = new Map(
          decayCaptiveBenevolence(
            currentPools,
            config.CAPTIVITY_BENEV_DECAY_PER_WEEK,
          ),
        );
        for (const side of ['w', 'b'] as const) {
          const market = markets.get(side);
          if (market === undefined) continue;
          const sidePriorities = priorities.filter((entry) =>
            commanders.some(
              (commander) =>
                commander.id === entry.commanderId && commander.side === side,
            ),
          );
          const { lots } = draftLotsForSide({
            side,
            market,
            commanders,
            pools: currentPools,
            firstMatch: matchIndex + 1,
            config,
          });
          for (const [commanderId, purse] of draftStartingPurses({
            priorities: sidePriorities,
            lots,
            previousPurses,
            ratioPermille: config.DRAFT_PURSE_TO_ASKING_RATIO_PERMILLE,
          })) {
            trueStartingPurses.set(commanderId, purse);
          }
        }
        const ransom = ransomCaptives({
          pools: currentPools,
          purses: trueStartingPurses,
          priorities,
          week,
          firstMatch: matchIndex + 1,
          config,
        });
        currentPools = new Map(ransom.pools);
        draftPurses = new Map(ransom.purses);
        ransomLedger = ransom.ledger;
      }
      let weekDraftSelections: readonly {
        readonly leader: string;
        readonly candidateId: string;
        readonly counsel: number;
      }[] = [];
      if (draftEnabled) {
        const drafted = runSeminarDraft({
          cycle: week,
          seed: weekSeed,
          commanders,
          pools: currentPools,
          markets,
          standings: standingsBefore,
          registers: registersBefore,
          previousPurses,
          ...(config.CAPTIVITY_HOLD_ENABLED
            ? { startingPurses: draftPurses }
            : {}),
          config,
          firstMatch: matchIndex + 1,
          cohortHistory,
        });
        currentPools = new Map(drafted.pools);
        markets = drafted.markets;
        draftObservation = drafted.observation;
        draftPurses = new Map(drafted.remainingPurses);
        standingSeries.push(...drafted.standingSeries);
        weekDraftSelections = drafted.counselSelections;
        cohortObservation = drafted.cohortHistory;
      }
      previousPurses = draftPurses;
      draftCycles.push(draftObservation);
      const weekRecords = new Map<string, MatchRecord[]>(
        commanders.map((commander) => [commander.id, []]),
      );
      const weekFieldedLineups = new Map<string, string[][]>(
        commanders.map((commander) => [commander.id, []]),
      );
      for (
        let whiteIndex = 0;
        whiteIndex < config.COMMANDERS_PER_COHORT;
        whiteIndex += 1
      ) {
        for (
          let blackIndex = 0;
          blackIndex < config.COMMANDERS_PER_COHORT;
          blackIndex += 1
        ) {
          const white = commanderById.get(commanderId('w', whiteIndex));
          const black = commanderById.get(commanderId('b', blackIndex));
          if (white === undefined || black === undefined) {
            throw new Error('Seminar pairing references an unknown commander.');
          }
          matchIndex = await runSeminarMatchPairing({
            white,
            black,
            whiteIndex,
            blackIndex,
            cohortSize: config.COMMANDERS_PER_COHORT,
            publicCohortSize: commanders.length,
            weekSeed,
            seminarSeed: options.seed,
            matchesPerWeek: config.MATCHES_PER_WEEK,
            matchIndex,
            pools: currentPools,
            weekRecords,
            weekFieldedLineups,
            allRecords,
            observations,
            week,
            weeksPerSemester: config.WEEKS_PER_SEMESTER,
            standingRankByCommander: new Map(
              standingsBefore.map((standing, index) => [
                standing.commanderId,
                index + 1,
              ]),
            ),
            config,
            engine,
          });
        }
      }
      counselCorrelationPairs.push(
        ...weekDraftSelections.map((selection) => ({
          leader: selection.leader,
          counsel: selection.counsel,
          realizedContribution: publicContributionForRecords(
            allRecords.get(selection.leader) ?? [],
            selection.candidateId,
          ),
        })),
      );
      const weekRecordsList = [...weekRecords.values()].flat();
      cohortObservation = {
        ...cohortObservation,
        desertions: weekRecordsList.reduce(
          (total, record) =>
            total +
            record.events.filter((event) => event.t === 'DESERTION').length,
          0,
        ),
        commendationsAwarded:
          foldPlayerCommendations(weekRecordsList).awards.length,
        retirements: [...currentPools.values()]
          .flatMap((pool) => pool.members)
          .filter(
            (member) =>
              member.status === 'retired' &&
              poolStatusesBeforeWeek.get(member.state.id) !== 'retired',
          ).length,
      };
      cohortHistoryObservations.push(cohortObservation);
      weeks.push(
        buildSeminarWeekResult({
          week,
          weekSeed,
          commanders,
          weekRecords,
          weekFieldedLineups,
          allRecords,
          pools: currentPools,
          config,
          draftEconomy: draftObservation,
          cohortHistory: cohortObservation,
          ransom: ransomLedger,
        }),
      );
      gratitudeWeeks.push({
        week,
        firstMatch: gratitudeWeekFirstMatch,
        ransomLedger,
      });
    }
  } finally {
    if (ownedEngine) await disposeSimEngine(options.engineKind ?? 'fake');
  }
  const exchangeHopeByOwner = foldExchangeHope(weeks, currentPools);
  const gratitudeByOwner = foldGratitude(gratitudeWeeks, allRecords);
  const griefByOwner = foldSeminarGrief(weeks);
  const terminal = commanders.map((commander) => {
    const records = allRecords.get(commander.id) ?? [];
    return {
      commander,
      register: registerForSide(records, commander.side),
      commendations: foldPlayerCommendations(records),
      judgementSeat: foldJudgementSeat(records),
      exchangeHope: exchangeHopeByOwner[commander.id] ?? EMPTY_EXCHANGE_HOPE,
      gratitude: gratitudeByOwner[commander.id] ?? EMPTY_GRATITUDE,
      grief: griefByOwner[commander.id] ?? EMPTY_SEMINAR_GRIEF,
    };
  });
  const standings = standingsFor(
    commanders,
    new Map(
      commanders.map((commander) => [
        commander.id,
        allRecords.get(commander.id) ?? [],
      ]),
    ),
    config,
  );
  return {
    seed: options.seed,
    config,
    commanders: terminal,
    weeks,
    standings,
    finalPools: Object.fromEntries(currentPools.entries()),
    terminalAwards: Object.fromEntries(
      terminal.map((entry) => [entry.commander.id, entry.commendations.awards]),
    ),
    draftEconomy: {
      cycles: draftCycles,
      standingSeries,
    },
    draftEconomyDegeneracyFindings: draftEconomyDegeneracyFindings({
      cycles: draftCycles,
      standingSeries,
    }),
    counselCorrelationPairs,
    cohortHistoryObservations: { cycles: cohortHistoryObservations },
  };
}

export function seminarPayload(result: SeminarResult): string {
  const config =
    result.config.CAPTIVITY_HOLD_ENABLED ||
    result.config.CAPTIVITY_BENEV_DECAY_PER_WEEK !== 0
      ? result.config
      : (() => {
          const {
            CAPTIVITY_HOLD_ENABLED,
            CAPTIVITY_BENEV_DECAY_PER_WEEK,
            ...withoutCaptivity
          } = result.config;
          void CAPTIVITY_HOLD_ENABLED;
          void CAPTIVITY_BENEV_DECAY_PER_WEEK;
          return withoutCaptivity;
        })();
  return canonicalJson({
    seed: result.seed,
    config,
    commanders: result.commanders.map((commander) => {
      const { exchangeHope, gratitude, grief } = commander;
      const hasGratitude =
        gratitude.formed.length > 0 ||
        gratitude.honored.length > 0 ||
        gratitude.voided.length > 0 ||
        gratitude.owed.length > 0;
      const hasGrief = grief.incidents.length > 0;
      const hasExchangeHope =
        exchangeHope.realized.length > 0 ||
        exchangeHope.selfSprung.length > 0 ||
        exchangeHope.extinguished.length > 0;
      if (!hasExchangeHope && !hasGratitude && !hasGrief) {
        const {
          exchangeHope: _exchangeHope,
          gratitude: _gratitude,
          grief: _grief,
          ...withoutTerminalReadings
        } = commander;
        void _exchangeHope;
        void _gratitude;
        void _grief;
        return withoutTerminalReadings;
      }
      if (!hasExchangeHope && !hasGratitude) {
        const {
          exchangeHope: _exchangeHope,
          gratitude: _gratitude,
          ...withoutExchangeAndGratitude
        } = commander;
        void _exchangeHope;
        void _gratitude;
        return hasGrief
          ? withoutExchangeAndGratitude
          : (() => {
              const { grief: _grief, ...withoutGrief } =
                withoutExchangeAndGratitude;
              void _grief;
              return withoutGrief;
            })();
      }
      if (!hasExchangeHope) {
        const { exchangeHope: _exchangeHope, ...withoutExchangeHope } =
          commander;
        void _exchangeHope;
        if (hasGrief) return withoutExchangeHope;
        const { grief: _grief, ...withoutGrief } = withoutExchangeHope;
        void _grief;
        return withoutGrief;
      }
      if (hasGrief) return commander;
      const { grief: _grief, ...withoutGrief } = commander;
      void _grief;
      return withoutGrief;
    }),
    weeks: result.weeks.map((week) =>
      Object.fromEntries(
        Object.entries(week).filter(
          ([key, value]) =>
            key !== 'records' &&
            key !== 'poolStates' &&
            !(
              key === 'ransomLedger' &&
              Array.isArray(value) &&
              value.length === 0
            ),
        ),
      ),
    ),
    standings: result.standings,
    terminalAwards: result.terminalAwards,
    draftEconomy: result.draftEconomy,
    draftEconomyDegeneracyFindings: result.draftEconomyDegeneracyFindings,
    counselCorrelationPairs: result.counselCorrelationPairs,
    cohortHistoryObservations: result.cohortHistoryObservations,
  });
}

export function seminarSummary(result: SeminarResult): string {
  const lines = [
    `Semester ${result.seed}: ${result.weeks.length} weeks, ${result.commanders.length} commanders`,
  ];
  for (const week of result.weeks) {
    const cleared = week.draftEconomy.clearedLots;
    lines.push(
      `week ${week.week} draft contested=${week.draftEconomy.contestedLots} ` +
        `cleared=${cleared} ` +
        `unfilled-no-bids=${week.draftEconomy.unfilledNoBids} ` +
        `unfilled-below-reserve=${week.draftEconomy.unfilledBelowReserve} ` +
        `declined=${week.draftEconomy.declinedLots} ` +
        `mean-price=${week.draftEconomy.meanClearingPrice} ` +
        `purse-left=${week.draftEconomy.totalPurseLeftUnspent}`,
    );
  }
  for (const entry of result.commanders) {
    const earned = entry.commendations.earnedIds.join(', ') || 'none';
    const columns = PUBLIC_REGISTER_COLUMNS.map(
      (column) => `${column}=${entry.register[column]}`,
    ).join(' ');
    lines.push(
      `${entry.commander.id} (${entry.commander.style}) ` +
        `${columns}; ` +
        `commendations: ${earned}; ` +
        `LI=${entry.judgementSeat.meanLeadershipIndex ?? 'null'}`,
    );
    const realized = entry.exchangeHope.realized.length;
    const selfSprung = entry.exchangeHope.selfSprung.length;
    const extinguished = entry.exchangeHope.extinguished.length;
    if (realized + selfSprung + extinguished > 0) {
      lines.push(
        `${entry.commander.id} exchange-hope: realized=${realized} ` +
          `self=${selfSprung} extinguished=${extinguished}`,
      );
    }
    const formed = entry.gratitude.formed.length;
    const honored = entry.gratitude.honored.length;
    const voided = entry.gratitude.voided.length;
    const owed = entry.gratitude.owed.length;
    if (formed + honored + voided + owed > 0) {
      lines.push(
        `${entry.commander.id} gratitude: formed=${formed} ` +
          `honored=${honored} voided=${voided} owed=${owed}`,
      );
    }
    if (entry.grief.incidents.length > 0) {
      lines.push(
        `${entry.commander.id} grief: incidents=${entry.grief.incidents.length}`,
      );
    }
  }
  return lines.join('\n');
}
