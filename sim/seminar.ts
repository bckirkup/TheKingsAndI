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
  foldPlayerCommendations,
  foldPublicRegister,
  publicMatchFactsFromRecord,
  PUBLIC_REGISTER_COLUMNS,
  type CommendationAward,
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
import type { PieceState } from '../src/psychology';
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
  createSeminarMarkets,
  publicContributionForRecords,
  runSeminarDraft,
  type SeminarMarket,
} from './seminarDraft';
import {
  draftEconomyDegeneracyFindings,
  type DegeneracyFinding,
  type DraftEconomyCycleObservation,
  type DraftEconomyObservations,
  type DraftStandingSeriesPoint,
  type CohortHistoryCycleObservation,
  type CohortHistoryObservations,
} from './degeneracy';

export const SEMINAR_WEEK_SEED_STRIDE = 1_000_003;
const COMMANDER_STYLES = [
  'servant',
  'supportive',
  'tyrannical',
  'volatile',
  'random',
] as const;

type CommanderSide = 'w' | 'b';

export interface SeminarCommander {
  readonly id: string;
  readonly side: CommanderSide;
  readonly style: (typeof COMMANDER_STYLES)[number];
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
}

export interface SeminarCommanderResult {
  readonly commander: SeminarCommander;
  readonly register: PublicRegister;
  readonly commendations: PlayerCommendationSet;
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

function createCommanders(count: number): readonly SeminarCommander[] {
  return (['w', 'b'] as const).flatMap((side) =>
    Array.from({ length: count }, (_, index) => {
      const style = COMMANDER_STYLES[index % COMMANDER_STYLES.length];
      if (style === undefined) {
        throw new Error('Seminar commander style catalogue is empty.');
      }
      return { id: commanderId(side, index), side, style };
    }),
  );
}

function statusForStoredPiece(
  status: CommanderPool['members'][number]['status'],
): 'ACTIVE' | 'BENCHED' | 'RETIRED' | 'FIRED' {
  switch (status) {
    case 'available':
      return 'ACTIVE';
    case 'recovering':
    case 'benched':
      return 'BENCHED';
    case 'retired':
      return 'RETIRED';
    case 'fired':
      return 'FIRED';
  }
}

function storedRoster(fielded: FieldedPool): readonly (PieceState & {
  readonly status: 'ACTIVE' | 'BENCHED' | 'RETIRED' | 'FIRED';
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
    events: input.result.events,
    engineAudit: input.result.engineAudit,
    result,
  });
}

/**
 * `runMatch`'s `winScore` is produced by `scoreMatchOutcome` as exactly
 * 0, 50, or 100, so the black perspective is exactly `100 - winScore`.
 */
export function classifySeminarSideResult(
  result: Pick<HeadlessMatchResult, 'rout' | 'enemyRout' | 'winScore'>,
  side: CommanderSide,
) {
  return classifyMatchResult({
    rout: side === 'w' ? result.rout : result.enemyRout,
    winScore: side === 'w' ? result.winScore : 100 - result.winScore,
    dismissed: false,
  });
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
  readonly weekSeed: number;
  readonly seminarSeed: number;
  readonly matchesPerWeek: number;
  readonly matchIndex: number;
  readonly pools: Map<string, CommanderPool>;
  readonly weekRecords: Map<string, MatchRecord[]>;
  readonly weekFieldedLineups: Map<string, string[][]>;
  readonly allRecords: Map<string, MatchRecord[]>;
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
      engine: input.engine,
    });
    const folded = foldMatchIntoPools({
      white: whitePool,
      black: blackPool,
      whiteFielded,
      blackFielded,
      result,
      match: matchIndex,
    });
    input.pools.set(input.white.id, folded.white);
    input.pools.set(input.black.id, folded.black);
    const whiteRecord = recordForSide({
      commander: input.white,
      rosterEndPool: folded.white,
      fielded: whiteFielded,
      result,
      matchIndex,
      matchSeed,
      campaignId: `seminar:${input.seminarSeed}:${input.white.id}`,
      actId: `semester:${input.seminarSeed}`,
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
      (records[commander.id] ?? []).map((record) => digest(record)),
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
  const commanders = createCommanders(config.COMMANDERS_PER_COHORT);
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
  const weeks: SeminarWeekResult[] = [];
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
      let draftPurses = new Map<string, number>(
        draftPriority(standingsBefore).map((entry) => [
          entry.commanderId,
          entry.purse,
        ]),
      );
      let weekDraftSelections: readonly {
        readonly leader: string;
        readonly candidateId: string;
        readonly counsel: number;
      }[] = [];
      const draftEnabled = week > 1 || config.DRAFT_AT_CYCLE_ONE;
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
            weekSeed,
            seminarSeed: options.seed,
            matchesPerWeek: config.MATCHES_PER_WEEK,
            matchIndex,
            pools: currentPools,
            weekRecords,
            weekFieldedLineups,
            allRecords,
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
        }),
      );
    }
  } finally {
    if (ownedEngine) await disposeSimEngine(options.engineKind ?? 'fake');
  }
  const terminal = commanders.map((commander) => {
    const records = allRecords.get(commander.id) ?? [];
    return {
      commander,
      register: registerForSide(records, commander.side),
      commendations: foldPlayerCommendations(records),
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
  return canonicalJson({
    seed: result.seed,
    config: result.config,
    commanders: result.commanders,
    weeks: result.weeks.map((week) =>
      Object.fromEntries(
        Object.entries(week).filter(
          ([key]) => key !== 'records' && key !== 'poolStates',
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
        `commendations: ${earned}`,
    );
  }
  return lines.join('\n');
}
