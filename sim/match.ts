import { LivingBoard } from '../src/chess';
import { createSeededRandom, type SeededRandom } from '../src/core/random';
import type { EnginePort } from '../src/engine/types';
import type { OpponentArchetype } from '../src/orchestration/leaderPolicy';
import {
  runHeadlessMatch,
  type HeadlessLeaderPort,
  type HeadlessMatchResult,
  type OverrideAskContext,
} from '../src/orchestration';
import type { EnemyMoveChooser } from '../src/orchestration/enemyTurn';
import type { PieceState } from '../src/psychology';

import type { Leader } from './cli';
import {
  leaderPolicy,
  legalScoredMoves,
  type LeaderContext,
  type LeaderObservation,
} from './leaders';
import { createStartingRoster } from './roster';
import {
  createJournallingLeader,
  scriptedAgent,
  type JournalAgent,
  type JournalEntry,
} from './journal';

const MAX_PLIES = 200;
const REDEEMER_SWITCH_MATCH = 10;

const ZERO_LEADER_OBSERVATION = {
  matchesObserved: 0,
  refusalPermilleLast: 0,
  desertionsLast: 0,
  survivorsLast: 0,
  winScoreLast: 0,
} as const;

function leaderPort(
  style: Leader,
  contextBase: Omit<LeaderContext, 'ply'>,
): HeadlessLeaderPort {
  const policy = leaderPolicy(style);
  return {
    chooseMove(board, side, random, ply, refusedSans) {
      const moves = legalScoredMoves(board).filter(
        (move) => refusedSans?.has(move.features.san) !== true,
      );
      if (moves.length === 0) return undefined;
      const context: LeaderContext = { ...contextBase, ply };
      const choice = policy.chooseMove(board, moves, random, context);
      if (choice === undefined) return undefined;
      const mover = board.pieceAt(choice.intent.from);
      if (mover?.side !== side) return undefined;
      return {
        moverId: mover.id,
        intent: choice.intent,
        san: choice.features.san,
        leaderImpliedBias: choice.leaderImpliedBias,
      };
    },
    shouldOverride(random, ply) {
      return policy.shouldOverride(random, { ...contextBase, ply });
    },
  };
}

export interface RunMatchOptions {
  readonly seed: number;
  readonly leader: Leader;
  readonly matchIndex: number;
  readonly campaignMatch: number;
  readonly roster: readonly PieceState[];
  readonly initialLineup?: readonly PieceState[];
  readonly enemyRoster?: readonly PieceState[];
  readonly initialEnemyLineup?: readonly PieceState[];
  readonly opponent?: Leader;
  readonly leaderObservation?: LeaderObservation;
  readonly opponentObservation?: LeaderObservation;
  readonly enemyTrackedIdentities?: number;
  readonly engine: EnginePort;
  readonly journalEntries?: JournalEntry[];
  readonly journalAgent?: JournalAgent;
}

export async function runMatch(
  options: RunMatchOptions,
): Promise<HeadlessMatchResult> {
  const random = createSeededRandom(options.seed);
  const contextBase = {
    matchIndex: options.matchIndex,
    campaignMatch: options.campaignMatch,
    redeemerSwitchMatch: REDEEMER_SWITCH_MATCH,
  };
  const playerContextBase = {
    ...contextBase,
    observation: options.leaderObservation ?? ZERO_LEADER_OBSERVATION,
  };
  const opponentContextBase = {
    ...contextBase,
    observation: options.opponentObservation ?? ZERO_LEADER_OBSERVATION,
  };
  const opponent = options.opponent ?? 'random';
  const rawOpponentPort = leaderPort(opponent, opponentContextBase);
  const rawLeaderPort = leaderPort(options.leader, playerContextBase);
  const journalConfig =
    options.journalEntries === undefined
      ? undefined
      : {
          entries: options.journalEntries,
          agent: options.journalAgent ?? scriptedAgent(rawLeaderPort),
        };
  const opponentPort =
    journalConfig === undefined
      ? rawOpponentPort
      : createJournallingLeader(rawOpponentPort, {
          ...journalConfig,
          match: options.matchIndex,
        });
  const playerPort =
    journalConfig === undefined
      ? rawLeaderPort
      : createJournallingLeader(rawLeaderPort, {
          ...journalConfig,
          match: options.matchIndex,
        });
  const adaptiveOpponent =
    opponent === 'chastened' ||
    opponent === 'escalator' ||
    opponent === 'roster_first';
  const opponentArchetype: OpponentArchetype = adaptiveOpponent
    ? 'random'
    : (opponent as OpponentArchetype);
  const opponentMoveChooser: EnemyMoveChooser | undefined = adaptiveOpponent
    ? async (board, side, random, ply, refusedSans, context) =>
        (
          await opponentPort.chooseMove(
            board,
            side,
            random,
            ply,
            refusedSans,
            context,
          )
        )?.san
    : undefined;
  return runHeadlessMatch({
    random,
    maxPlies: MAX_PLIES,
    playerSide: 'w',
    leader: playerPort,
    opponent: opponentPort,
    initialRoster: options.roster,
    ...(options.initialLineup === undefined
      ? {}
      : { initialLineup: options.initialLineup }),
    engine: options.engine,
    opponentArchetype,
    ...(opponentMoveChooser === undefined ? {} : { opponentMoveChooser }),
    ...(adaptiveOpponent
      ? {
          opponentOverrideChooser: (
            random: SeededRandom,
            ply: number,
            context?: OverrideAskContext,
          ) => opponentPort.shouldOverride(random, ply, context),
        }
      : {}),
    ...(options.enemyRoster === undefined
      ? {}
      : { initialEnemyRoster: options.enemyRoster }),
    ...(options.initialEnemyLineup === undefined
      ? {}
      : { initialEnemyLineup: options.initialEnemyLineup }),
    ...(options.enemyTrackedIdentities === undefined
      ? {}
      : { enemyTrackedIdentities: options.enemyTrackedIdentities }),
  });
}

export async function runMatchFromFreshRoster(
  options: Omit<RunMatchOptions, 'roster'> & {
    readonly initialTrust?: number;
  },
): Promise<HeadlessMatchResult> {
  const board = LivingBoard.standard();
  const random = createSeededRandom(options.seed);
  const roster = createStartingRoster(
    board,
    'w',
    options.initialTrust ?? 20,
    random.nextInt(10_000) / 10_000,
  );
  return runMatch({ ...options, roster });
}
