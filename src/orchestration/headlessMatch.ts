import { LivingBoard } from '../chess';
import type { Side } from '../chess';
import type { SeededRandom } from '../core/random';
import {
  applyMatchOutcomeTrust,
  applyNeglectSignal,
  evaluateMoveResponse,
  normalizePieceState,
  raiseLossEstimatesAfterDesertion,
  type CandidateMoveEvaluation,
  type DesertionContext,
  type MatchEvent,
  type PieceState,
} from '../psychology';

export interface HeadlessMoveChoice {
  readonly moverId: string;
  readonly san: string;
  readonly moveEval: CandidateMoveEvaluation;
  readonly objectivelyGood: boolean;
}

export interface HeadlessLeaderPort {
  chooseMove(
    board: LivingBoard,
    side: Side,
    random: SeededRandom,
    ply: number,
  ): HeadlessMoveChoice | undefined;
  shouldOverride(random: SeededRandom, ply: number): boolean;
  onMatchEnd?(roster: readonly PieceState[], winScore: number): PieceState[];
}

export interface HeadlessMatchConfig {
  readonly random: SeededRandom;
  readonly maxPlies: number;
  readonly playerSide: Side;
  readonly leader: HeadlessLeaderPort;
  readonly opponent: HeadlessLeaderPort;
  readonly initialRoster: readonly PieceState[];
}

export interface HeadlessMatchResult {
  readonly events: readonly MatchEvent[];
  readonly roster: readonly PieceState[];
  readonly plies: number;
  readonly winScore: number;
  readonly rout: boolean;
  readonly refusedGoodMoves: number;
}

function desertionContextFor(
  piece: PieceState,
  moveEval: CandidateMoveEvaluation,
): DesertionContext {
  const pLossBase = piece.rumor.pLossTeam / 1000;
  const captureStress =
    moveEval.P_captured > 0.35 ? moveEval.P_captured * 0.3 : 0;
  return {
    P_captured: moveEval.P_captured,
    P_lossIfStay: Math.min(1, pLossBase + captureStress),
    P_lossIfLeave: Math.min(1, pLossBase + 0.5),
  };
}

function updatePiece(
  roster: PieceState[],
  pieceId: string,
  updater: (piece: PieceState) => PieceState,
): PieceState[] {
  return roster.map((piece) =>
    piece.id === pieceId ? normalizePieceState(updater(piece)) : piece,
  );
}

function activePlayerPieceIds(board: LivingBoard, playerSide: Side): string[] {
  return board.piecesOf(playerSide).map((piece) => piece.id);
}

function winScoreFor(board: LivingBoard, playerSide: Side): number {
  if (!board.isGameOver()) return 50;
  return board.turn() === playerSide ? 0 : 100;
}

export function runHeadlessMatch(
  config: HeadlessMatchConfig,
): HeadlessMatchResult {
  const board = LivingBoard.standard();
  let roster = config.initialRoster.map(normalizePieceState);
  const events: MatchEvent[] = [];
  let ply = 1;
  let rout = false;
  let refusedGoodMoves = 0;

  while (ply <= config.maxPlies) {
    if (board.isGameOver()) break;
    const side = board.turn();
    const leader = side === config.playerSide ? config.leader : config.opponent;
    const playerActiveIds = activePlayerPieceIds(board, config.playerSide);
    roster = roster.filter((piece) => playerActiveIds.includes(piece.id));

    if (playerActiveIds.length <= 1) {
      rout = true;
      break;
    }

    const choice = leader.chooseMove(board, side, config.random, ply);
    if (choice === undefined) break;

    if (side !== config.playerSide) {
      board.applySan(choice.san);
      ply += 1;
      continue;
    }

    const actor = roster.find((piece) => piece.id === choice.moverId);
    if (actor === undefined) {
      ply += 1;
      continue;
    }

    const desertionContext = desertionContextFor(actor, choice.moveEval);
    let outcome = evaluateMoveResponse(
      actor,
      choice.moveEval,
      roster,
      desertionContext,
    );

    if (outcome.verdict === 'MORAL_REFUSAL') {
      if (leader.shouldOverride(config.random, ply)) {
        events.push({
          t: 'OVERRIDE',
          ply,
          pieceId: actor.id,
          san: choice.san,
          pieceTrustDelta: -35,
          traumaGain: 20,
        });
        roster = updatePiece(roster, actor.id, (piece) => ({
          ...piece,
          T_i: piece.T_i - 35,
          B_i: Math.min(100, piece.B_i + 20),
          credence: applyNeglectSignal(piece.credence),
        }));
        outcome = { ...outcome, verdict: 'COMPLIANT_EXECUTION' };
      } else {
        events.push({
          t: 'REFUSAL',
          ply,
          pieceId: actor.id,
          utility: outcome.utilityScore,
          threshold: outcome.refusalThreshold,
          perceivedValue: outcome.perceivedValue,
        });
        if (choice.objectivelyGood) {
          refusedGoodMoves += 1;
          roster = updatePiece(roster, actor.id, (piece) => ({
            ...piece,
            credence: applyNeglectSignal(piece.credence),
          }));
        }
        ply += 1;
        continue;
      }
    }

    if (outcome.verdict === 'DESERTION_MUTINY') {
      events.push({
        t: 'DESERTION',
        ply,
        pieceId: actor.id,
        refusedMove: choice.san,
        uStay: 0,
        uDesert: 0,
      });
      board.withdrawPiece(actor.id);
      roster = roster.filter((piece) => piece.id !== actor.id);
      roster = raiseLossEstimatesAfterDesertion(roster, actor.id).map(
        normalizePieceState,
      );
      if (roster.length <= 1) {
        rout = true;
        break;
      }
      ply += 1;
      continue;
    }

    board.applySan(choice.san);
    events.push({
      t: 'MOVE',
      ply,
      san: choice.san,
      pieceId: actor.id,
      verdict: outcome.verdict,
    });
    roster = updatePiece(roster, actor.id, (piece) => ({
      ...piece,
      engagementFactor: outcome.engagementFactor,
    }));
    ply += 1;
  }

  const winScore = winScoreFor(board, config.playerSide);
  roster =
    config.leader.onMatchEnd?.(roster, winScore) ??
    applyMatchOutcomeTrust(roster, winScore);

  return {
    events: Object.freeze(events),
    roster: roster.map(normalizePieceState),
    plies: ply - 1,
    winScore,
    rout,
    refusedGoodMoves,
  };
}
