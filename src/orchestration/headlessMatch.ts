import { extractMoveFeatures, LivingBoard, type MoveIntent } from '../chess';
import type { Side } from '../chess';
import type { SeededRandom } from '../core/random';
import type { EnginePort } from '../engine/types';
import {
  applyMatchOutcomeTrust,
  applyNeglectSignal,
  evaluateMoveResponse,
  normalizePieceState,
  shouldDesert,
  type CandidateMoveEvaluation,
  type MatchEvent,
  type PieceState,
} from '../psychology';

import { insightToEvaluation, isObjectivelyGoodMove } from './evaluation';
import {
  createInsightRoundHandle,
  resolveAuditMoveScore,
  resolveMoverInsights,
} from './insight';
import {
  applyCostlySignalsToRoster,
  applyDeclinedSacrificeSignal,
  applyDesertionWithCascade,
  applyPostMoveCredence,
  applyRefusalAuthorityCost,
  applySacrificeWitnesses,
  attributeSacrifice,
  detectDeclinedSacrificeCostlySignal,
  desertionContextFor,
  detectKingEndangermentCostlySignal,
  isAvengedCapture,
} from './psychologyHooks';
import { scoreMatchOutcome } from './outcomeScore';

export interface HeadlessMoveChoice {
  readonly moverId: string;
  readonly intent: MoveIntent;
  readonly san: string;
  /** When omitted, orchestration resolves engine insight for the mover. */
  readonly moveEval?: CandidateMoveEvaluation;
  readonly leaderImpliedBias?: number;
  readonly objectivelyGood?: boolean;
}

export interface HeadlessLeaderPort {
  chooseMove(
    board: LivingBoard,
    side: Side,
    random: SeededRandom,
    ply: number,
  ): HeadlessMoveChoice | undefined | Promise<HeadlessMoveChoice | undefined>;
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
  readonly engine: EnginePort;
}

export interface HeadlessMatchResult {
  readonly events: readonly MatchEvent[];
  readonly roster: readonly PieceState[];
  readonly plies: number;
  readonly winScore: number;
  readonly rout: boolean;
  readonly refusedGoodMoves: number;
  /** Initial desertions whose true post-move audit score was materially winning. */
  readonly winningPositionDesertions: number;
  readonly determinismId: string;
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

export async function runHeadlessMatch(
  config: HeadlessMatchConfig,
): Promise<HeadlessMatchResult> {
  const board = LivingBoard.standard();
  let roster = config.initialRoster.map(normalizePieceState);
  const events: MatchEvent[] = [];
  let ply = 1;
  let rout = false;
  let refusedGoodMoves = 0;
  let winningPositionDesertions = 0;
  const insight = createInsightRoundHandle();
  let lastFriendlyCapturePly: number | undefined;
  let abilityObservations = 0;

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

    const choice = await leader.chooseMove(board, side, config.random, ply);
    if (choice === undefined) break;

    if (side !== config.playerSide) {
      const beforeIds = new Set(playerActiveIds);
      board.applySan(choice.san);
      const afterIds = new Set(activePlayerPieceIds(board, config.playerSide));
      for (const id of beforeIds) {
        if (!afterIds.has(id)) {
          lastFriendlyCapturePly = ply;
          break;
        }
      }
      ply += 1;
      continue;
    }

    const actor = roster.find((piece) => piece.id === choice.moverId);
    if (actor === undefined) {
      ply += 1;
      continue;
    }

    const features = extractMoveFeatures(board, choice.intent);
    const moverInsights = await resolveMoverInsights(
      config.engine,
      board,
      choice.intent,
      actor,
      insight,
      roster,
      features,
      choice.leaderImpliedBias ?? 0,
    );
    const moveEval =
      choice.moveEval ??
      insightToEvaluation(
        features,
        moverInsights.actor,
        moverInsights.leader,
        choice.leaderImpliedBias ?? 0,
      );
    const moveEvalByPiece = {
      ...moverInsights.desertionMoveEvals,
      [actor.id]: moveEval,
    };
    const auditScore = await resolveAuditMoveScore(
      config.engine,
      board,
      choice.intent,
      insight,
    );
    const bestAudit = Math.max(auditScore, moverInsights.actor.scoreCp);
    const objectivelyGood =
      choice.objectivelyGood ??
      isObjectivelyGoodMove(moverInsights.actor.scoreCp, bestAudit);
    const justifiedRefusal = moveEval.deltaV_board < 0 && auditScore < 0;

    const desertionContext = desertionContextFor(actor, moveEval);
    const desertionDecision = shouldDesert(actor, desertionContext, roster);
    let outcome = evaluateMoveResponse(
      actor,
      moveEval,
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
        const refusalEvent: Extract<MatchEvent, { t: 'REFUSAL' }> = {
          t: 'REFUSAL',
          ply,
          pieceId: actor.id,
          utility: outcome.utilityScore,
          threshold: outcome.refusalThreshold,
          perceivedValue: outcome.perceivedValue,
          authorityLoss: 0,
          justified: justifiedRefusal,
        };
        events.push(refusalEvent);
        const authority = applyRefusalAuthorityCost(
          roster,
          actor.id,
          moveEval.deltaV_board,
          justifiedRefusal,
        );
        roster = authority.roster;
        if (authority.authorityLoss > 0) {
          events[events.length - 1] = {
            ...refusalEvent,
            authorityLoss: authority.authorityLoss,
          };
        }
        if (objectivelyGood) {
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
      if (auditScore >= 100) winningPositionDesertions += 1;
      const cascade = applyDesertionWithCascade(
        roster,
        {
          actor,
          refusedMove: choice.san,
          refusedMoveEval: moveEval,
          moveEvalByPiece,
          uStay: desertionDecision.uStay,
          uDesert: desertionDecision.uDesert,
        },
        ply,
      );
      events.push(...cascade.events);
      for (const event of cascade.events) {
        if (event.t === 'DESERTION') {
          board.withdrawPiece(event.pieceId);
        }
      }
      roster = cascade.roster;
      if (cascade.rout) {
        rout = true;
        break;
      }
      ply += 1;
      continue;
    }

    const applied = board.applySan(choice.san);
    events.push({
      t: 'MOVE',
      ply,
      san: choice.san,
      pieceId: actor.id,
      verdict: outcome.verdict,
    });
    abilityObservations += 1;
    roster = updatePiece(roster, actor.id, (piece) =>
      applyPostMoveCredence(
        { ...piece, engagementFactor: outcome.engagementFactor },
        moveEval,
        objectivelyGood,
        abilityObservations,
      ),
    );

    const attribution = attributeSacrifice(features, auditScore);
    const hero = roster.find((piece) => piece.id === actor.id) ?? actor;
    const sacrifice = applySacrificeWitnesses(roster, hero, attribution, ply);
    roster = sacrifice.roster;
    events.push(...sacrifice.events);
    if (
      detectDeclinedSacrificeCostlySignal(
        moverInsights.declinedSacrificeOpportunity,
        choice.san,
        auditScore,
      )
    ) {
      const costly = applyDeclinedSacrificeSignal(
        roster,
        moverInsights.declinedSacrificeOpportunity?.sacrificedPieceId ?? '',
        ply,
      );
      roster = costly.roster;
      events.push(...costly.events);
    }

    const kinds: Array<
      'king_endangerment' | 'declined_sacrifice' | 'avenged_capture'
    > = [];
    if (detectKingEndangermentCostlySignal(features)) {
      kinds.push('king_endangerment');
    }
    if (
      applied.capture !== undefined &&
      isAvengedCapture(lastFriendlyCapturePly, ply)
    ) {
      kinds.push('avenged_capture');
      lastFriendlyCapturePly = undefined;
    }
    const costly = applyCostlySignalsToRoster(roster, kinds, ply);
    roster = costly.roster;
    events.push(...costly.events);

    ply += 1;
  }

  const winScore = scoreMatchOutcome(board, config.playerSide, rout);
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
    winningPositionDesertions,
    determinismId: config.engine.determinismId,
  };
}
