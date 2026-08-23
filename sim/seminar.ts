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
  readonly registerDeltas: Readonly<Record<string, PublicRegister>>;
  readonly commendations: Readonly<Record<string, PlayerCommendationSet>>;
  readonly standings: readonly SeminarStanding[];
}

export interface SeminarCommanderResult {
  readonly commander: SeminarCommander;
  readonly register: PublicRegister;
  readonly commendations: PlayerCommendationSet;
}

export interface SeminarStanding {
  readonly commanderId: string;
  readonly points: number;
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
    Array.from({ length: count }, (_, index) => ({
      id: commanderId(side, index),
      side,
      style: COMMANDER_STYLES[index % COMMANDER_STYLES.length]!,
    })),
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

function storedRoster(
  pool: CommanderPool,
  fielded?: FieldedPool,
): readonly (PieceState & {
  readonly status: 'ACTIVE' | 'BENCHED' | 'RETIRED' | 'FIRED';
})[] {
  const fieldedById = new Map(
    fielded?.lineup.map((member) => [member.state.id, member.state]) ?? [],
  );
  return pool.members.map((member) => ({
    ...(fieldedById.get(member.state.id) ?? member.state),
    status: statusForStoredPiece(member.status),
  }));
}

function recordForSide(input: {
  readonly commander: SeminarCommander;
  readonly rosterStartPool: CommanderPool;
  readonly rosterEndPool: CommanderPool;
  readonly fielded: FieldedPool;
  readonly result: HeadlessMatchResult;
  readonly matchIndex: number;
  readonly matchSeed: number;
  readonly campaignId: string;
  readonly actId: string;
}): MatchRecord {
  const whitePerspective = input.commander.side === 'w';
  const result = classifyMatchResult({
    rout: whitePerspective ? input.result.rout : input.result.enemyRout,
    winScore: whitePerspective
      ? input.result.winScore
      : 100 - input.result.winScore,
    dismissed: false,
  });
  const rosterEnd = input.rosterEndPool.members.map((member) => ({
    ...member.state,
    status: statusForStoredPiece(member.status),
  }));
  return assembleMatchRecord({
    campaignId: input.campaignId,
    actId: input.actId,
    matchIndex: input.matchIndex,
    seed: input.matchSeed,
    rosterSnapshot: storedRoster(input.rosterStartPool, input.fielded),
    rosterEnd,
    events: input.result.events,
    engineAudit: input.result.engineAudit,
    result,
  });
}

function pairingIndex(whiteIndex: number, blackIndex: number, count: number) {
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

function standingsFor(
  commanders: readonly SeminarCommander[],
  recordsByCommander: ReadonlyMap<string, readonly MatchRecord[]>,
): readonly SeminarStanding[] {
  return commanders
    .map((commander) => {
      const register = registerForSide(
        recordsByCommander.get(commander.id) ?? [],
        commander.side,
      );
      return {
        commanderId: commander.id,
        points: register.wins * 3 + register.draws - register.losses,
        wins: register.wins,
        draws: register.draws,
        losses: register.losses,
      };
    })
    .sort(
      (left, right) =>
        right.points - left.points ||
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
          const white = commanders.find(
            (commander) =>
              commander.side === 'w' &&
              commander.id === commanderId('w', whiteIndex),
          );
          const black = commanders.find(
            (commander) =>
              commander.side === 'b' &&
              commander.id === commanderId('b', blackIndex),
          );
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
              rosterStartPool: whitePool,
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
              rosterStartPool: blackPool,
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
        ),
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
  );
  return {
    seed: options.seed,
    config,
    commanders: terminal,
    weeks,
    standings,
    terminalAwards: Object.fromEntries(
      terminal.map((entry) => [entry.commander.id, entry.commendations.awards]),
    ),
  };
}

export function seminarPayload(result: SeminarResult): string {
  return canonicalJson(result);
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
