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
import type { CommanderStanding } from '../src/core/draftEconomy';
import {
  classifyMatchResult,
  type HeadlessMatchResult,
} from '../src/orchestration';
import type { PieceState } from '../src/psychology';

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

/**
 * Slice 1 deliberately keeps commander colours fixed for the semester:
 * white commanders always lead white. A later seminar decision may rotate
 * colours, but this harness does not invent that policy.
 */
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

export async function runSeminar(options: {
  readonly seed: number;
  readonly config?: SeminarConfig;
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
  const allRecords = new Map<string, MatchRecord[]>(
    commanders.map((commander) => [commander.id, []]),
  );
  const weeks: SeminarWeekResult[] = [];
  const engine =
    options.engine ?? (await createSimEngine(options.engineKind ?? 'fake'));
  const ownedEngine = options.engine === undefined;
  let matchIndex = 0;
  try {
    for (let week = 1; week <= config.WEEKS_PER_SEMESTER; week += 1) {
      const weekSeed = weekSeedForSemester(options.seed, week);
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
          for (let match = 1; match <= config.MATCHES_PER_WEEK; match += 1) {
            matchIndex += 1;
            const whitePool = pools.get(white.id);
            const blackPool = pools.get(black.id);
            if (whitePool === undefined || blackPool === undefined) {
              throw new Error('Seminar pool references an unknown commander.');
            }
            const whiteFielded = fieldPool(whitePool, matchIndex);
            const blackFielded = fieldPool(blackPool, matchIndex);
            const matchSeed = matchSeedForWorldPairing(
              weekSeed,
              pairingIndex(
                whiteIndex,
                blackIndex,
                config.COMMANDERS_PER_COHORT,
              ),
              match,
            );
            const result = await runMatch({
              seed: matchSeed,
              leader: white.style,
              opponent: black.style,
              matchIndex,
              campaignMatch: matchIndex,
              roster: whiteFielded.lineup.map((member) => member.state),
              initialLineup: whiteFielded.lineup.map((member) => member.state),
              enemyRoster: blackFielded.lineup.map((member) => member.state),
              initialEnemyLineup: blackFielded.lineup.map(
                (member) => member.state,
              ),
              engine,
            });
            const folded = foldMatchIntoPools({
              white: whitePool,
              black: blackPool,
              whiteFielded,
              blackFielded,
              result,
              match: matchIndex,
            });
            pools.set(white.id, folded.white);
            pools.set(black.id, folded.black);
            const whiteRecord = recordForSide({
              commander: white,
              rosterEndPool: folded.white,
              fielded: whiteFielded,
              result,
              matchIndex,
              matchSeed,
              campaignId: `seminar:${options.seed}:${white.id}`,
              actId: `semester:${options.seed}`,
            });
            const blackRecord = recordForSide({
              commander: black,
              rosterEndPool: folded.black,
              fielded: blackFielded,
              result,
              matchIndex,
              matchSeed,
              campaignId: `seminar:${options.seed}:${black.id}`,
              actId: `semester:${options.seed}`,
            });
            weekRecords.get(white.id)?.push(whiteRecord);
            weekRecords.get(black.id)?.push(blackRecord);
            weekFieldedLineups
              .get(white.id)
              ?.push(whiteFielded.lineup.map((member) => member.state.id));
            weekFieldedLineups
              .get(black.id)
              ?.push(blackFielded.lineup.map((member) => member.state.id));
            allRecords.get(white.id)?.push(whiteRecord);
            allRecords.get(black.id)?.push(blackRecord);
          }
        }
      }
      const records = Object.fromEntries(
        commanders.map((commander) => [
          commander.id,
          weekRecords.get(commander.id) ?? [],
        ]),
      );
      const recordDigests = Object.fromEntries(
        commanders.map((commander) => [
          commander.id,
          (records[commander.id] ?? []).map((record) => digest(record)),
        ]),
      );
      const fieldedLineups = Object.fromEntries(
        commanders.map((commander) => [
          commander.id,
          weekFieldedLineups.get(commander.id) ?? [],
        ]),
      );
      const registerDeltas = Object.fromEntries(
        commanders.map((commander) => [
          commander.id,
          registerForSide(records[commander.id] ?? [], commander.side),
        ]),
      );
      const commendations = Object.fromEntries(
        commanders.map((commander) => [
          commander.id,
          foldPlayerCommendations(records[commander.id] ?? []),
        ]),
      );
      weeks.push({
        week,
        seed: weekSeed,
        records,
        recordDigests,
        fieldedLineups,
        registerDeltas,
        commendations,
        standings: standingsFor(
          commanders,
          new Map(
            commanders.map((commander) => [
              commander.id,
              allRecords.get(commander.id) ?? [],
            ]),
          ),
          config,
        ),
        poolStates: Object.fromEntries(pools.entries()),
      });
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
    finalPools: Object.fromEntries(pools.entries()),
    terminalAwards: Object.fromEntries(
      terminal.map((entry) => [entry.commander.id, entry.commendations.awards]),
    ),
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
  });
}

export function seminarSummary(result: SeminarResult): string {
  const lines = [
    `Semester ${result.seed}: ${result.weeks.length} weeks, ${result.commanders.length} commanders`,
  ];
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
