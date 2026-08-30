import { LivingBoard } from '../src/chess';
import {
  createSeededRandom,
  createSeededRandomFromState,
  type RandomState,
} from '../src/core/random';
import type { EnginePort } from '../src/engine/types';
import { PSYCH_CONFIG_VERSION, SCHEMA_VERSION } from '../src/persistence/types';
import { applyGrace, ENGINE_CONFIG, type PieceState } from '../src/psychology';
import type { PieceId } from '../src/core/ids';
import type { Leader } from './cli';
import { capEngineDepth, createSimEngine, type SimEngineKind } from './engine';
import { runMatch } from './match';
import {
  aggregateCampaign,
  metricsFromMatch,
  type CampaignMetrics,
  type MatchMetrics,
} from './metrics';
import { createStartingRoster, mergeCampaignRoster } from './roster';
import { CostTracker, instrumentEngine, type CampaignCost } from './cost';
import {
  createPriorLeaderObservation,
  updateLeaderObservation,
  type LeaderObservation,
} from './leaders';

export interface CampaignOptions {
  readonly matches: number;
  readonly leader: Leader;
  readonly opponent?: Leader;
  readonly enemyTrackedIdentities?: number;
  readonly seed: number;
  readonly initialTrust?: number;
  readonly engine?: EnginePort;
  readonly engineKind?: SimEngineKind;
  readonly coldSearch?: boolean | undefined;
  /** Harness-only tractability cap; does not alter psychology depth allocation. */
  readonly depthCap?: number | undefined;
  readonly checkpoint?: CampaignCheckpoint;
  readonly onCheckpoint?: (
    checkpoint: CampaignCheckpoint,
  ) => void | Promise<void>;
}

export interface CampaignCheckpoint {
  readonly checkpointVersion: number;
  readonly schemaVersion: number;
  readonly psychConfigVersion: string;
  readonly determinismId: string;
  readonly seed: number;
  readonly leader: Leader;
  readonly opponent: Leader;
  readonly enemyTrackedIdentities: number;
  readonly initialTrust: number;
  readonly nextMatch: number;
  readonly randomState: RandomState;
  readonly roster: readonly PieceState[];
  readonly enemyRoster: readonly PieceState[];
  readonly generations: Readonly<Record<PieceId, number>>;
  readonly enemyGenerations: Readonly<Record<PieceId, number>>;
  readonly retiredCareerIds: readonly string[];
  readonly enemyRetiredCareerIds: readonly string[];
  readonly leaderObservation: LeaderObservation;
  readonly opponentObservation: LeaderObservation;
  readonly completedMetrics: readonly MatchMetrics[];
}

export interface CampaignResult {
  readonly metrics: readonly MatchMetrics[];
  readonly summary: CampaignMetrics;
  readonly finalRoster: readonly PieceState[];
  readonly finalEnemyRoster: readonly PieceState[];
  readonly determinismId: string;
  readonly checkpoint: CampaignCheckpoint;
  readonly justifiedRefusalObviousness: readonly number[];
  readonly justifiedRefusalPrivateViewLosses: readonly number[];
  readonly cost?: CampaignCost;
}

const MATCH_SEED_MULTIPLIER = 1_000_003;

export function observableFromMatch(
  metric: MatchMetrics | undefined,
  enemy: boolean,
): LeaderObservation {
  if (metric === undefined) return createPriorLeaderObservation();
  const refusalRate = enemy ? metric.enemyRefusalRate : metric.refusalRate;
  const desertions = enemy ? metric.enemyDesertions : metric.desertions;
  const survivors = enemy
    ? metric.enemySurvivingRosterSize
    : metric.survivingRosterSize;
  const winScore = enemy ? 100 - metric.winScore : metric.winScore;
  return {
    matchesObserved: 1,
    refusalPermille: Math.max(
      0,
      Math.min(1_000, Math.trunc(refusalRate * 1_000)),
    ),
    desertions: Math.max(0, Math.trunc(desertions)),
    survivors: Math.max(0, Math.trunc(survivors)),
    winScore: Math.max(0, Math.min(100, Math.trunc(winScore))),
  };
}

function carryMatchRoster(
  survivingRoster: readonly PieceState[],
  departedRoster: readonly PieceState[],
): PieceState[] {
  const carriedById = new Map(
    survivingRoster.map((piece) => [piece.id, piece]),
  );
  for (const piece of departedRoster) {
    carriedById.set(piece.id, piece);
  }
  return [...carriedById.values()];
}

export function careerIdFor(seatId: PieceId, generation: number): string {
  return `${seatId}#${generation}`;
}

function generationsForRoster(
  roster: readonly PieceState[],
): Record<PieceId, number> {
  return Object.fromEntries(roster.map((piece) => [piece.id, 1]));
}

export interface CampaignBoundaryFold {
  readonly roster: readonly PieceState[];
  readonly generations: Readonly<Record<PieceId, number>>;
  readonly retiredCareerIds: readonly string[];
  readonly graceCareerIds: readonly string[];
  readonly retirements: number;
  readonly graceEvents: number;
}

/**
 * Apply campaign-only grace and retirement after match state has been carried.
 *
 * This boundary has no match event-log seam: grace and retirement are derived
 * campaign metrics, while the match event log remains the source of match
 * truth.
 */
export function applyCampaignBoundary(
  carriedRoster: readonly PieceState[],
  generations: Readonly<Record<PieceId, number>>,
  retiredCareerIds: readonly string[],
  random: { nextInt(maxExclusive: number): number },
): CampaignBoundaryFold {
  const currentGenerations: Record<PieceId, number> = { ...generations };
  let roster = [...carriedRoster];
  const graceCareerIds: string[] = [];
  const rate = Math.max(
    0,
    Math.min(1_000, Math.trunc(ENGINE_CONFIG.GRACE_RATE_PERMILLE)),
  );
  if (rate > 0) {
    roster = [...roster]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((piece) => {
        if (piece.role === 'King' || piece.B_i <= 0) return piece;
        const generation = currentGenerations[piece.id] ?? 1;
        if (random.nextInt(1_000) >= rate) return piece;
        graceCareerIds.push(careerIdFor(piece.id, generation));
        return applyGrace(piece, ENGINE_CONFIG.GRACE_RELIEF);
      });
  }

  const retiredIds = new Set(retiredCareerIds);
  const nextRoster: PieceState[] = [];
  let retirements = 0;
  for (const piece of roster) {
    if (
      piece.role !== 'King' &&
      piece.B_i >= ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD
    ) {
      const generation = currentGenerations[piece.id] ?? 1;
      retiredIds.add(careerIdFor(piece.id, generation));
      currentGenerations[piece.id] = generation + 1;
      retirements += 1;
      continue;
    }
    nextRoster.push(piece);
  }
  return {
    roster: nextRoster,
    generations: currentGenerations,
    retiredCareerIds: [...retiredIds],
    graceCareerIds,
    retirements,
    graceEvents: graceCareerIds.length,
  };
}

export function matchSeedForCampaign(
  campaignSeed: number,
  match: number,
): number {
  return campaignSeed ^ (match * MATCH_SEED_MULTIPLIER);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

export function parseCampaignCheckpoint(value: unknown): CampaignCheckpoint {
  if (!isRecord(value)) {
    throw new Error('Campaign checkpoint must be a JSON object.');
  }
  const randomState = value.randomState;
  if (!isRecord(randomState)) {
    throw new Error('Campaign checkpoint randomState is missing.');
  }
  const requiredKeys = [
    'checkpointVersion',
    'schemaVersion',
    'psychConfigVersion',
    'determinismId',
    'seed',
    'leader',
    'opponent',
    'enemyTrackedIdentities',
    'initialTrust',
    'nextMatch',
    'roster',
    'enemyRoster',
    'generations',
    'enemyGenerations',
    'retiredCareerIds',
    'enemyRetiredCareerIds',
    'completedMetrics',
  ] as const;
  for (const key of requiredKeys) {
    if (!(key in value)) {
      throw new Error(`Campaign checkpoint is missing ${key}.`);
    }
  }
  for (const key of ['s0', 's1', 's2', 's3'] as const) {
    if (!(key in randomState)) {
      throw new Error(`Campaign checkpoint randomState is missing ${key}.`);
    }
  }
  if (
    !Array.isArray(value.roster) ||
    !Array.isArray(value.enemyRoster) ||
    !isPlainRecord(value.generations) ||
    !isPlainRecord(value.enemyGenerations) ||
    !Array.isArray(value.retiredCareerIds) ||
    !Array.isArray(value.enemyRetiredCareerIds) ||
    !Array.isArray(value.completedMetrics)
  ) {
    throw new TypeError(
      'Campaign checkpoint roster and completedMetrics must be arrays.',
    );
  }
  for (const [generationName, generationMap] of [
    ['generations', value.generations],
    ['enemyGenerations', value.enemyGenerations],
  ] as const) {
    for (const [pieceId, generation] of Object.entries(generationMap)) {
      if (
        typeof pieceId !== 'string' ||
        typeof generation !== 'number' ||
        !Number.isSafeInteger(generation) ||
        generation < 1
      ) {
        throw new Error(
          `Campaign checkpoint ${generationName}.${pieceId} must be a positive integer.`,
        );
      }
    }
  }
  for (const [careerName, careerIds] of [
    ['retiredCareerIds', value.retiredCareerIds],
    ['enemyRetiredCareerIds', value.enemyRetiredCareerIds],
  ] as const) {
    if (
      !careerIds.every(
        (careerId): careerId is string => typeof careerId === 'string',
      )
    ) {
      throw new Error(
        `Campaign checkpoint ${careerName} must contain strings.`,
      );
    }
  }
  for (const [rosterName, roster] of [
    ['roster', value.roster],
    ['enemyRoster', value.enemyRoster],
  ] as const) {
    roster.forEach((piece, index) => {
      if (
        !isPlainRecord(piece) ||
        typeof piece.id !== 'string' ||
        typeof piece.role !== 'string'
      ) {
        throw new Error(
          `Campaign checkpoint ${rosterName}[${index}] must be a plain object with string id and role.`,
        );
      }
    });
  }
  if (value.checkpointVersion === 3) {
    return {
      ...(value as unknown as Omit<
        CampaignCheckpoint,
        'checkpointVersion' | 'leaderObservation' | 'opponentObservation'
      >),
      checkpointVersion: 4,
      leaderObservation: createPriorLeaderObservation(),
      opponentObservation: createPriorLeaderObservation(),
    };
  }
  if (value.checkpointVersion !== 4) {
    throw new Error(
      `Campaign checkpoint checkpointVersion mismatch: checkpoint=${String(value.checkpointVersion)}, run=4.`,
    );
  }
  for (const [observationName, observation] of [
    ['leaderObservation', value.leaderObservation],
    ['opponentObservation', value.opponentObservation],
  ] as const) {
    if (
      !isPlainRecord(observation) ||
      typeof observation.matchesObserved !== 'number' ||
      typeof observation.refusalPermille !== 'number' ||
      typeof observation.desertions !== 'number' ||
      typeof observation.survivors !== 'number' ||
      typeof observation.winScore !== 'number'
    ) {
      throw new Error(
        `Campaign checkpoint ${observationName} must be a complete observation.`,
      );
    }
  }
  return value as unknown as CampaignCheckpoint;
}

export function leaderTrustBias(leader: Leader): number {
  switch (leader) {
    case 'supportive':
    case 'servant':
    case 'exacting':
      return 40;
    case 'tyrannical':
    case 'pure_tactician':
    case 'absentee':
      return -10;
    case 'volatile':
    case 'steady':
    case 'chastened':
    case 'escalator':
    case 'roster_first':
      return 10;
    case 'redeemer':
      return 0;
    case 'random':
    default:
      return 20;
  }
}

function createCampaignCheckpoint(options: {
  readonly determinismId: string;
  readonly seed: number;
  readonly leader: Leader;
  readonly opponent: Leader;
  readonly enemyTrackedIdentities: number;
  readonly initialTrust: number;
  readonly nextMatch: number;
  readonly randomState: RandomState;
  readonly roster: readonly PieceState[];
  readonly enemyRoster: readonly PieceState[];
  readonly generations: Readonly<Record<PieceId, number>>;
  readonly enemyGenerations: Readonly<Record<PieceId, number>>;
  readonly retiredCareerIds: readonly string[];
  readonly enemyRetiredCareerIds: readonly string[];
  readonly leaderObservation: LeaderObservation;
  readonly opponentObservation: LeaderObservation;
  readonly completedMetrics: readonly MatchMetrics[];
}): CampaignCheckpoint {
  return {
    checkpointVersion: 4,
    schemaVersion: SCHEMA_VERSION,
    psychConfigVersion: PSYCH_CONFIG_VERSION,
    determinismId: options.determinismId,
    seed: options.seed,
    leader: options.leader,
    opponent: options.opponent,
    enemyTrackedIdentities: options.enemyTrackedIdentities,
    initialTrust: options.initialTrust,
    nextMatch: options.nextMatch,
    randomState: options.randomState,
    roster: [...options.roster],
    enemyRoster: [...options.enemyRoster],
    generations: { ...options.generations },
    enemyGenerations: { ...options.enemyGenerations },
    retiredCareerIds: [...options.retiredCareerIds],
    enemyRetiredCareerIds: [...options.enemyRetiredCareerIds],
    leaderObservation: options.leaderObservation,
    opponentObservation: options.opponentObservation,
    completedMetrics: [...options.completedMetrics],
  };
}

export async function runCampaign(
  options: CampaignOptions,
): Promise<CampaignResult> {
  const baseEngine =
    options.engine ??
    (await createSimEngine(
      options.engineKind ?? 'lozza',
      options.coldSearch === undefined
        ? {}
        : { coldSearch: options.coldSearch },
    ));
  const costTracker = new CostTracker(baseEngine);
  const board = LivingBoard.standard();
  const instrumentedBaseEngine = instrumentEngine(baseEngine, costTracker);
  const engine = capEngineDepth(instrumentedBaseEngine, options.depthCap);
  const initialTrust = options.initialTrust ?? leaderTrustBias(options.leader);
  const opponent = options.opponent ?? 'random';
  const enemyTrackedIdentities = options.enemyTrackedIdentities ?? 16;
  const enemyInitialTrust = leaderTrustBias(opponent);
  const checkpoint = options.checkpoint;
  if (checkpoint !== undefined) {
    validateCheckpoint(checkpoint, options, engine.determinismId, initialTrust);
  }
  const random =
    checkpoint === undefined
      ? createSeededRandom(options.seed)
      : createSeededRandomFromState(checkpoint.randomState);
  let roster =
    checkpoint === undefined
      ? createStartingRoster(
          board,
          'w',
          initialTrust,
          random.nextInt(10_000) / 10_000,
        )
      : [...checkpoint.roster];
  let enemyRoster =
    checkpoint === undefined
      ? createStartingRoster(
          board,
          'b',
          enemyInitialTrust,
          random.nextInt(10_000) / 10_000,
        )
      : [...checkpoint.enemyRoster];
  let generations =
    checkpoint === undefined
      ? generationsForRoster(roster)
      : { ...checkpoint.generations };
  let enemyGenerations =
    checkpoint === undefined
      ? generationsForRoster(enemyRoster)
      : { ...checkpoint.enemyGenerations };
  let retiredCareerIds =
    checkpoint === undefined ? [] : [...checkpoint.retiredCareerIds];
  let enemyRetiredCareerIds =
    checkpoint === undefined ? [] : [...checkpoint.enemyRetiredCareerIds];
  let leaderObservation =
    checkpoint?.leaderObservation ?? createPriorLeaderObservation();
  let opponentObservation =
    checkpoint?.opponentObservation ?? createPriorLeaderObservation();
  const metrics: MatchMetrics[] =
    checkpoint === undefined ? [] : [...checkpoint.completedMetrics];
  const justifiedRefusalObviousness: number[] = [];
  const justifiedRefusalPrivateViewLosses: number[] = [];
  const firstMatch = checkpoint?.nextMatch ?? 1;

  for (let match = firstMatch; match <= options.matches; match += 1) {
    costTracker.startMatch();
    const matchSeed = matchSeedForCampaign(options.seed, match);
    roster = mergeCampaignRoster(
      board,
      'w',
      roster,
      initialTrust,
      random.nextInt(10_000) / 10_000,
    );
    enemyRoster = mergeCampaignRoster(
      board,
      'b',
      enemyRoster,
      enemyInitialTrust,
      random.nextInt(10_000) / 10_000,
    );
    const rosterStart = roster;
    const playerGenerationsAtMatchStart = generations;
    const enemyGenerationsAtMatchStart = enemyGenerations;
    const result = await runMatch({
      seed: matchSeed,
      leader: options.leader,
      matchIndex: match,
      campaignMatch: match,
      roster,
      enemyRoster,
      opponent,
      leaderObservation,
      opponentObservation,
      enemyTrackedIdentities,
      engine,
    });
    costTracker.endMatch(match, result.plies);
    const metric = metricsFromMatch(
      match,
      matchSeed,
      options.leader,
      rosterStart,
      result,
      result.refusedGoodMoves,
    );
    leaderObservation = updateLeaderObservation(
      leaderObservation,
      observableFromMatch(metric, false),
    );
    opponentObservation = updateLeaderObservation(
      opponentObservation,
      observableFromMatch(metric, true),
    );
    roster = carryMatchRoster(result.roster, result.departedRoster);
    enemyRoster = carryMatchRoster(
      result.enemyRoster,
      result.departedEnemyRoster,
    );
    const playerRetiredCareerCountBefore = retiredCareerIds.length;
    const enemyRetiredCareerCountBefore = enemyRetiredCareerIds.length;
    const playerBoundary = applyCampaignBoundary(
      roster,
      generations,
      retiredCareerIds,
      random,
    );
    const enemyBoundary = applyCampaignBoundary(
      enemyRoster,
      enemyGenerations,
      enemyRetiredCareerIds,
      random,
    );
    roster = [...playerBoundary.roster];
    generations = playerBoundary.generations;
    retiredCareerIds = [...playerBoundary.retiredCareerIds];
    enemyRoster = [...enemyBoundary.roster];
    enemyGenerations = enemyBoundary.generations;
    enemyRetiredCareerIds = [...enemyBoundary.retiredCareerIds];
    metrics.push({
      ...metric,
      fieldedCareerIds: rosterStart.map((piece) =>
        careerIdFor(piece.id, playerGenerationsAtMatchStart[piece.id] ?? 1),
      ),
      enemyFieldedCareerIds: result.enemyFieldedPieceIds.map((pieceId) =>
        careerIdFor(pieceId, enemyGenerationsAtMatchStart[pieceId] ?? 1),
      ),
      retiredCareerIds: [
        ...playerBoundary.retiredCareerIds.slice(
          playerRetiredCareerCountBefore,
        ),
      ],
      enemyRetiredCareerIds: [
        ...enemyBoundary.retiredCareerIds.slice(enemyRetiredCareerCountBefore),
      ],
      graceCareerIds: playerBoundary.graceCareerIds,
      enemyGraceCareerIds: enemyBoundary.graceCareerIds,
      retirements: playerBoundary.retirements,
      enemyRetirements: enemyBoundary.retirements,
      graceEvents: playerBoundary.graceEvents,
      enemyGraceEvents: enemyBoundary.graceEvents,
    });
    justifiedRefusalObviousness.push(...result.justifiedRefusalObviousness);
    justifiedRefusalPrivateViewLosses.push(
      ...result.justifiedRefusalPrivateViewLosses,
    );
    const checkpointAtBoundary = createCampaignCheckpoint({
      determinismId: engine.determinismId,
      seed: options.seed,
      leader: options.leader,
      opponent,
      enemyTrackedIdentities,
      initialTrust,
      nextMatch: match + 1,
      randomState: random.snapshot(),
      roster,
      enemyRoster,
      generations,
      enemyGenerations,
      retiredCareerIds,
      enemyRetiredCareerIds,
      leaderObservation,
      opponentObservation,
      completedMetrics: metrics,
    });
    await options.onCheckpoint?.(checkpointAtBoundary);
  }

  const resultCheckpoint = createCampaignCheckpoint({
    determinismId: engine.determinismId,
    seed: options.seed,
    leader: options.leader,
    opponent,
    enemyTrackedIdentities,
    initialTrust,
    nextMatch: options.matches + 1,
    randomState: random.snapshot(),
    roster,
    enemyRoster,
    generations,
    enemyGenerations,
    retiredCareerIds,
    enemyRetiredCareerIds,
    leaderObservation,
    opponentObservation,
    completedMetrics: metrics,
  });
  return {
    metrics,
    summary: aggregateCampaign(options.leader, options.seed, metrics),
    finalRoster: roster,
    finalEnemyRoster: enemyRoster,
    determinismId: engine.determinismId,
    checkpoint: resultCheckpoint,
    justifiedRefusalObviousness: Object.freeze(justifiedRefusalObviousness),
    justifiedRefusalPrivateViewLosses: Object.freeze(
      justifiedRefusalPrivateViewLosses,
    ),
    cost: costTracker.finish(),
  };
}

function validateCheckpoint(
  checkpoint: CampaignCheckpoint,
  options: CampaignOptions,
  determinismId: string,
  initialTrust: number,
): void {
  if (checkpoint.checkpointVersion !== 4) {
    throw new Error(
      `Checkpoint checkpointVersion mismatch: checkpoint=${checkpoint.checkpointVersion}, run=4.`,
    );
  }
  if (checkpoint.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Checkpoint schemaVersion mismatch: checkpoint=${checkpoint.schemaVersion}, run=${SCHEMA_VERSION}.`,
    );
  }
  if (checkpoint.psychConfigVersion !== PSYCH_CONFIG_VERSION) {
    throw new Error(
      `Checkpoint psychConfigVersion mismatch: checkpoint=${checkpoint.psychConfigVersion}, run=${PSYCH_CONFIG_VERSION}.`,
    );
  }
  if (checkpoint.determinismId !== determinismId) {
    throw new Error(
      `Checkpoint determinismId mismatch: checkpoint=${checkpoint.determinismId}, run=${determinismId}.`,
    );
  }
  if (checkpoint.leader !== options.leader) {
    throw new Error(
      `Checkpoint leader mismatch: checkpoint=${checkpoint.leader}, run=${options.leader}.`,
    );
  }
  if (checkpoint.opponent !== (options.opponent ?? 'random')) {
    throw new Error(
      `Checkpoint opponent mismatch: checkpoint=${checkpoint.opponent}, run=${options.opponent ?? 'random'}.`,
    );
  }
  if (
    checkpoint.enemyTrackedIdentities !== (options.enemyTrackedIdentities ?? 16)
  ) {
    throw new Error(
      `Checkpoint enemyTrackedIdentities mismatch: checkpoint=${checkpoint.enemyTrackedIdentities}, run=${options.enemyTrackedIdentities ?? 16}.`,
    );
  }
  if (checkpoint.seed !== options.seed) {
    throw new Error(
      `Checkpoint seed mismatch: checkpoint=${checkpoint.seed}, run=${options.seed}.`,
    );
  }
  if (checkpoint.initialTrust !== initialTrust) {
    throw new Error(
      `Checkpoint initialTrust mismatch: checkpoint=${checkpoint.initialTrust}, run=${initialTrust}.`,
    );
  }
  if (!Number.isSafeInteger(checkpoint.nextMatch) || checkpoint.nextMatch < 1) {
    throw new Error('Checkpoint nextMatch must be a positive integer.');
  }
  if (options.matches < checkpoint.nextMatch - 1) {
    throw new Error(
      `Checkpoint nextMatch ${checkpoint.nextMatch} is beyond requested match count ${options.matches}.`,
    );
  }
  if (checkpoint.completedMetrics.length !== checkpoint.nextMatch - 1) {
    throw new Error(
      'Checkpoint completedMetrics length does not match nextMatch.',
    );
  }
}

export async function runSimulation(
  options: CampaignOptions,
): Promise<MatchMetrics[]> {
  return [...(await runCampaign(options)).metrics];
}
