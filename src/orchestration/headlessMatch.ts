import {
  extractMoveFeatures,
  LivingBoard,
  type MoveFeatures,
  type MoveIntent,
  type PieceId,
  type PieceIdFactory,
  type Role,
  type Side,
  type Square,
} from '../chess';
import type { SeededRandom } from '../core/random';
import { SHARED_SEARCH_D_MAX } from '../engine';
import type { EngineAuditEntry, EnginePort } from '../engine/types';
import {
  applyFatalisticComplianceCosts,
  applyMatchOutcomeTrust,
  applyNeglectSignal,
  applyOverride,
  evaluateMoveResponse,
  justifiedRefusalObviousness,
  normalizePieceState,
  shouldDesert,
  type CandidateMoveEvaluation,
  type MoveDecisionOutcome,
  type MatchEvent,
  type PieceState,
} from '../psychology';

import { applyEnemyTurn, trackEnemyIdentities } from './enemyTurn';
import { insightToEvaluation, isVindicatedMove } from './evaluation';
import { engineAuditEntry, heroismNomination } from './heroism';
import {
  createInsightRoundHandle,
  resolveAuditPositionScore,
  resolveBestAuditMoveScore,
  resolveAuditMoveScore,
  resolveMoverInsights,
  type MoverInsights,
} from './insight';
import type { OpponentArchetype } from './leaderPolicy';
import {
  applyCostlySignalsToRoster,
  applyDeclinedSacrificeSignal,
  applyDesertionWithCascade,
  applyOutcomeVindication,
  applyPostMoveCredence,
  applyRosterAbilityObservations,
  applyPosthumousClassCredit,
  applyRefusalAuthorityCost,
  applySacrificeWitnesses,
  attributeSacrifice,
  detectDeclinedSacrificeCostlySignal,
  desertionContextFor,
  detectKingEndangermentCostlySignal,
  expectedVindicationDelta,
  isAvengedCapture,
} from './psychologyHooks';
import { scoreMatchOutcome } from './outcomeScore';
import { createStartingRoster } from './roster';
import { applyMoveTrauma, type DreadExposureByPiece } from './trauma';
import { applyCaptureInjury } from '../psychology';
import { kingExposureAfterWithdrawals } from './kingExposure';

function applyCapturedPieceInjury(
  roster: PieceState[],
  capturedPieceId: string | undefined,
  events: MatchEvent[],
  ply: number,
): PieceState[] {
  if (capturedPieceId === undefined) return roster;
  return roster.map((piece) => {
    if (piece.id !== capturedPieceId) return piece;
    const injured = applyCaptureInjury(piece);
    events.push({
      t: 'PSYCH_DELTA',
      ply,
      pieceId: piece.id,
      field: 'B_i',
      delta: injured.B_i - piece.B_i,
    });
    return injured;
  });
}

export interface HeadlessMoveChoice {
  readonly moverId: string;
  readonly intent: MoveIntent;
  readonly san: string;
  /** When omitted, orchestration resolves engine insight for the mover. */
  readonly moveEval?: CandidateMoveEvaluation;
  readonly leaderImpliedBias?: number;
}

export interface HeadlessLeaderPort {
  chooseMove(
    board: LivingBoard,
    side: Side,
    random: SeededRandom,
    ply: number,
    refusedSans?: ReadonlySet<string>,
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
  /**
   * Optional complete starting position. It is mutually exclusive with
   * initialLineup and initialEnemyLineup.
   */
  readonly initialBoard?: LivingBoard;
  /**
   * Optional fielded lineup whose IDs must be installed on the standard
   * position. When omitted, the historical starting-square IDs are used.
   */
  readonly initialLineup?: readonly PieceState[];
  readonly initialEnemyRoster?: readonly PieceState[];
  readonly initialEnemyLineup?: readonly PieceState[];
  readonly enemyTrackedIdentities?: number;
  readonly engine: EnginePort;
  readonly opponentArchetype?: OpponentArchetype;
}

export interface HeadlessMatchResult {
  readonly events: readonly MatchEvent[];
  readonly engineAudit?: readonly EngineAuditEntry[];
  readonly roster: readonly PieceState[];
  readonly departedRoster: readonly PieceState[];
  readonly enemyRoster: readonly PieceState[];
  readonly departedEnemyRoster: readonly PieceState[];
  readonly enemyFieldedPieceIds: readonly PieceId[];
  readonly plies: number;
  readonly winScore: number;
  readonly rout: boolean;
  readonly enemyRout: boolean;
  readonly refusedGoodMoves: number;
  /** Initial desertions whose true post-move audit score was materially winning. */
  readonly winningPositionDesertions: number;
  /** Private-view obviousness values for accepted justified refusals. */
  readonly justifiedRefusalObviousness: readonly number[];
  /** Raw absolute private-view losses for accepted justified refusals. */
  readonly justifiedRefusalPrivateViewLosses: readonly number[];
  readonly determinismId: string;
  /** Observable enemy behaviours — never private gauges (ADR 0025). */
  readonly enemyObservableBehaviours: readonly string[];
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

function lineupPieceIdFactory(
  lineups: Readonly<Partial<Record<Side, readonly PieceState[]>>>,
): PieceIdFactory {
  const roleNameFor = (role: Role): PieceState['role'] => {
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
  };
  const counts: Record<string, number> = {};
  return ({
    side,
    role,
    square,
  }: {
    readonly side: Side;
    readonly role: Role;
    readonly square: Square;
  }) => {
    const key = `${side}:${role}`;
    const index = counts[key] ?? 0;
    counts[key] = index + 1;
    const lineup = lineups[side];
    const roleName = roleNameFor(role);
    const candidates = lineup?.filter((piece) => piece.role === roleName) ?? [];
    const piece = candidates[index];
    if (piece !== undefined) return piece.id;
    return `${side}:${role}:${square}`;
  };
}

function applyPlayerOverride(
  roster: readonly PieceState[],
  actor: PieceState,
  ply: number,
  san: string,
  implicit: boolean,
  vindicated: boolean,
): {
  readonly roster: PieceState[];
  readonly events: readonly MatchEvent[];
} {
  const witnesses = roster.filter((piece) => piece.id !== actor.id);
  const override = applyOverride(actor, witnesses, ply, san, vindicated);
  return {
    roster: roster.map((piece) => {
      if (piece.id === override.overriddenPiece.id) {
        return normalizePieceState(override.overriddenPiece);
      }
      const witness = override.witnesses.find(
        (candidate) => candidate.id === piece.id,
      );
      return witness === undefined ? piece : normalizePieceState(witness);
    }),
    events: [
      {
        ...override.event,
        ...(implicit ? { implicit: true } : {}),
        authorityGain: 0,
      } as Extract<MatchEvent, { t: 'OVERRIDE' }>,
      ...override.witnessEvents,
    ],
  };
}

function activePlayerPieceIds(board: LivingBoard, playerSide: Side): string[] {
  return board.piecesOf(playerSide).map((piece) => piece.id);
}

function appendDeparted(
  existing: readonly PieceState[],
  departed: readonly PieceState[],
): PieceState[] {
  const byId = new Map(existing.map((piece) => [piece.id, piece]));
  for (const piece of departed) byId.set(piece.id, piece);
  return [...byId.values()];
}

function applyPlayerMoveConsequences(input: {
  readonly board: LivingBoard;
  readonly actor: PieceState;
  readonly choice: HeadlessMoveChoice;
  readonly outcome: MoveDecisionOutcome;
  readonly moveEval: CandidateMoveEvaluation;
  readonly moverInsights: MoverInsights;
  readonly features: MoveFeatures;
  readonly auditScore: number;
  readonly bestAuditScore: number;
  readonly audit: EngineAuditEntry;
  readonly objectivelyGood: boolean;
  readonly ply: number;
  readonly roster: PieceState[];
  readonly events: MatchEvent[];
  readonly lastFriendlyCapturePly: number | undefined;
  readonly abilityDripStreakByPiece: Readonly<Record<string, number>>;
  readonly dreadExposureByPiece: DreadExposureByPiece;
  readonly capturedPieceId?: string;
  readonly actorChallenged: boolean;
}): {
  readonly roster: PieceState[];
  readonly lastFriendlyCapturePly: number | undefined;
  readonly ply: number;
  readonly abilityDripStreakByPiece: Readonly<Record<string, number>>;
  readonly dreadExposureByPiece: DreadExposureByPiece;
  readonly capturedPieceId?: string;
} {
  const {
    board,
    actor,
    choice,
    outcome,
    moveEval,
    moverInsights,
    features,
    auditScore,
    bestAuditScore,
    objectivelyGood,
    ply,
    events,
    abilityDripStreakByPiece,
    dreadExposureByPiece,
    actorChallenged,
  } = input;
  let roster = input.roster;
  let lastFriendlyCapturePly = input.lastFriendlyCapturePly;
  const applied = board.applySan(choice.san);
  events.push({
    t: 'MOVE',
    ply,
    san: choice.san,
    pieceId: actor.id,
    verdict: outcome.verdict,
  });
  if (applied.capture !== undefined) {
    events.push({
      t: 'CAPTURE',
      ply,
      victim: applied.capture.pieceId,
      by: applied.moverId,
    });
  }
  const nomination = heroismNomination(events, moveEval, input.audit);
  if (nomination !== undefined) events.push(nomination);
  const abilityObservations = applyRosterAbilityObservations(
    roster,
    { ...moverInsights.desertionMoveEvals, [actor.id]: moveEval },
    auditScore,
    bestAuditScore,
    bestAuditScore,
    ply,
    actor.id,
    actorChallenged,
    moveEval.deltaV_board >= 0,
    abilityDripStreakByPiece,
  );
  events.push(...abilityObservations.events);
  roster = abilityObservations.roster.map((piece) =>
    piece.id === actor.id
      ? applyPostMoveCredence(
          { ...piece, engagementFactor: outcome.engagementFactor },
          moveEval,
          objectivelyGood,
        )
      : piece,
  );

  if (outcome.verdict === 'FATALISTIC_COMPLIANCE') {
    const fatalistic = applyFatalisticComplianceCosts(roster, actor.id, ply);
    roster = fatalistic.roster;
    events.push(...fatalistic.events);
  }

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
  const trauma = applyMoveTrauma(
    roster,
    dreadExposureByPiece,
    Object.fromEntries(
      Object.entries(moverInsights.desertionMoveEvals).map(
        ([id, evaluation]) => [id, evaluation.P_captured],
      ),
    ),
    applied.capture?.pieceId,
    ply,
  );
  roster = trauma.roster;
  events.push(...trauma.events);

  return {
    roster,
    lastFriendlyCapturePly,
    ply: ply + 1,
    abilityDripStreakByPiece: abilityObservations.dripStreakByPiece,
    dreadExposureByPiece: trauma.exposure,
    ...(applied.capture === undefined
      ? {}
      : { capturedPieceId: applied.capture.pieceId }),
  };
}

export async function runHeadlessMatch(
  config: HeadlessMatchConfig,
): Promise<HeadlessMatchResult> {
  const lineups: Partial<Record<Side, readonly PieceState[]>> = {};
  if (config.initialLineup !== undefined) {
    lineups[config.playerSide] = config.initialLineup;
  }
  if (config.initialEnemyLineup !== undefined) {
    lineups[config.playerSide === 'w' ? 'b' : 'w'] = config.initialEnemyLineup;
  }
  if (
    config.initialBoard !== undefined &&
    (config.initialLineup !== undefined ||
      config.initialEnemyLineup !== undefined)
  ) {
    throw new Error(
      'initialBoard cannot be combined with initialLineup or initialEnemyLineup',
    );
  }
  const board =
    config.initialBoard?.clone() ??
    (Object.keys(lineups).length === 0
      ? LivingBoard.standard()
      : LivingBoard.standard(lineupPieceIdFactory(lineups)));
  let roster = config.initialRoster.map(normalizePieceState);
  let departedRoster: PieceState[] = [];
  const enemySide = config.playerSide === 'w' ? 'b' : 'w';
  let enemyRoster = trackEnemyIdentities(
    config.initialEnemyRoster?.map(normalizePieceState) ??
      createStartingRoster(board, enemySide, 40, config.random.nextFloat()),
    config.enemyTrackedIdentities,
  );
  let departedEnemyRoster: PieceState[] = [];
  const enemyFieldedPieceIds = enemyRoster.map((piece) => piece.id);
  const events: MatchEvent[] = [];
  let ply = 1;
  let rout = false;
  let enemyRout = false;
  let refusedGoodMoves = 0;
  let winningPositionDesertions = 0;
  const justifiedRefusalObviousnessValues: number[] = [];
  const justifiedRefusalPrivateViewLosses: number[] = [];
  const enemyObservableBehaviours: string[] = [];
  const engineAudit: EngineAuditEntry[] = [];
  const insight = createInsightRoundHandle();
  let lastFriendlyCapturePly: number | undefined;
  let abilityDripStreakByPiece: Readonly<Record<string, number>> = {};
  let dreadExposureByPiece: DreadExposureByPiece = {};
  let enemyDreadExposureByPiece: DreadExposureByPiece = {};
  const opponentArchetype = config.opponentArchetype ?? 'random';

  while (ply <= config.maxPlies) {
    if (board.isGameOver()) break;
    const side = board.turn();
    const leader = side === config.playerSide ? config.leader : config.opponent;
    const playerActiveIds = activePlayerPieceIds(board, config.playerSide);
    departedRoster = appendDeparted(
      departedRoster,
      roster.filter((piece) => !playerActiveIds.includes(piece.id)),
    );
    roster = roster.filter((piece) => playerActiveIds.includes(piece.id));
    const enemyActiveIds = new Set(
      board.piecesOf(enemySide).map((piece) => piece.id),
    );
    departedEnemyRoster = appendDeparted(
      departedEnemyRoster,
      enemyRoster.filter((piece) => !enemyActiveIds.has(piece.id)),
    );
    enemyRoster = enemyRoster.filter((piece) => enemyActiveIds.has(piece.id));

    if (playerActiveIds.length <= 1) {
      rout = true;
      break;
    }

    if (side !== config.playerSide) {
      const beforeIds = new Set(playerActiveIds);
      const enemyTurn = await applyEnemyTurn({
        board,
        enemyRoster,
        enemySide,
        random: config.random,
        archetype: opponentArchetype,
        ply,
        engine: config.engine,
        insight,
        overrideRefusals: opponentArchetype === 'tyrannical',
        dreadExposureByPiece: enemyDreadExposureByPiece,
      });
      enemyRoster = enemyTurn.enemyRoster;
      engineAudit.push(...(enemyTurn.engineAudit ?? []));
      enemyDreadExposureByPiece = enemyTurn.dreadExposureByPiece;
      events.push(...enemyTurn.events);
      const capturedByEnemy =
        enemyTurn.capturedPieceId === undefined
          ? undefined
          : roster.find((piece) => piece.id === enemyTurn.capturedPieceId);
      if (capturedByEnemy !== undefined) {
        const credit = applyPosthumousClassCredit(
          roster,
          capturedByEnemy,
          events,
          enemyTurn.ply - 1,
        );
        roster = credit.roster;
        events.push(...credit.events);
      }
      roster = applyCapturedPieceInjury(
        roster,
        enemyTurn.capturedPieceId,
        events,
        enemyTurn.ply - 1,
      );
      departedEnemyRoster = appendDeparted(
        departedEnemyRoster,
        enemyTurn.departedRoster,
      );
      events.push(...enemyTurn.events);
      enemyObservableBehaviours.push(...enemyTurn.observableBehaviours);
      ply = enemyTurn.ply;
      if (enemyTurn.enemyRout) {
        enemyRout = true;
        break;
      }
      const afterIds = new Set(activePlayerPieceIds(board, config.playerSide));
      for (const id of beforeIds) {
        if (!afterIds.has(id)) {
          lastFriendlyCapturePly = ply - 1;
          abilityDripStreakByPiece = {};
          break;
        }
      }
      continue;
    }

    const refusedSans = new Set<string>();
    const maxCandidates = board.legalMoves().length;
    let firstRefused:
      | {
          readonly actor: PieceState;
          readonly choice: HeadlessMoveChoice;
          readonly features: MoveFeatures;
          readonly moverInsights: MoverInsights;
          readonly san: string;
          readonly moveEval: CandidateMoveEvaluation;
          readonly auditScore: number;
          readonly bestAuditScore: number;
          readonly audit: EngineAuditEntry;
          readonly objectivelyGood: boolean;
          readonly outcome: MoveDecisionOutcome;
        }
      | undefined;
    let turnCompleted = false;
    let actorChallenged = false;
    for (let attempt = 0; attempt < maxCandidates; attempt += 1) {
      const choice = await leader.chooseMove(
        board,
        side,
        config.random,
        ply,
        refusedSans,
      );
      if (choice === undefined) break;

      const actor = roster.find((piece) => piece.id === choice.moverId);
      if (actor === undefined) {
        refusedSans.add(choice.san);
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
          moverInsights.actorPrivateScoreCp,
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
      const bestAudit = await resolveBestAuditMoveScore(
        config.engine,
        board,
        insight,
      );
      const preMoveAuditScore = await resolveAuditPositionScore(
        config.engine,
        board,
        insight,
      );
      const audit = engineAuditEntry({
        ply,
        pieceId: actor.id,
        san: choice.san,
        preMoveScoreCp: preMoveAuditScore,
        scoreCp: auditScore,
        bestScoreCp: bestAudit,
        preMoveDepth: SHARED_SEARCH_D_MAX,
        scoreDepth: 8,
        bestScoreDepth: SHARED_SEARCH_D_MAX,
      });
      engineAudit.push(audit);
      const justifiedRefusal = moveEval.deltaV_board < 0 && auditScore < 0;

      const desertionContext = desertionContextFor(actor, moveEval, roster);
      const desertionDecision = shouldDesert(actor, desertionContext, roster);
      let outcome = evaluateMoveResponse(
        actor,
        moveEval,
        roster,
        desertionContext,
      );
      const objectivelyGood = isVindicatedMove(
        auditScore,
        bestAudit,
        bestAudit,
        expectedVindicationDelta(actor, moveEval),
      );

      if (outcome.verdict === 'MORAL_REFUSAL') {
        if (leader.shouldOverride(config.random, ply)) {
          actorChallenged = true;
          const override = applyPlayerOverride(
            roster,
            actor,
            ply,
            choice.san,
            false,
            objectivelyGood,
          );
          events.push(...override.events);
          roster = override.roster;
          outcome = { ...outcome, verdict: 'COMPLIANT_EXECUTION' };
        } else {
          const refusalEvent: Extract<MatchEvent, { t: 'REFUSAL' }> = {
            t: 'REFUSAL',
            ply,
            pieceId: actor.id,
            san: choice.san,
            utility: outcome.utilityScore,
            threshold: outcome.refusalThreshold,
            perceivedValue: outcome.perceivedValue,
            privateViewLoss: justifiedRefusal ? -moveEval.deltaV_board : 0,
            obviousness: justifiedRefusal
              ? justifiedRefusalObviousness(moveEval.deltaV_board, true)
              : 0,
            authorityLoss: 0,
            justified: justifiedRefusal,
          };
          if (justifiedRefusal) {
            justifiedRefusalObviousnessValues.push(
              justifiedRefusalObviousness(moveEval.deltaV_board, true),
            );
            justifiedRefusalPrivateViewLosses.push(-moveEval.deltaV_board);
          }
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
          firstRefused ??= {
            actor,
            choice,
            features,
            moverInsights,
            san: choice.san,
            moveEval,
            auditScore,
            bestAuditScore: bestAudit,
            audit,
            objectivelyGood,
            outcome,
          };
          refusedSans.add(choice.san);
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
            terms: desertionDecision.terms,
          },
          ply,
        );
        events.push(...cascade.events);
        for (const event of cascade.events) {
          if (event.t === 'DESERTION') {
            board.withdrawPiece(event.pieceId);
          }
        }
        const exposure = kingExposureAfterWithdrawals(board, side);
        if (exposure !== undefined) {
          events.push({
            t: 'KING_EXPOSED_TURN_CEDED',
            ply,
            exposedKingId: exposure.kingId,
            attackerSide: exposure.attackerSide,
          });
          board.cedeTurn();
        }
        roster = cascade.roster;
        departedRoster = appendDeparted(departedRoster, cascade.departed);
        if (cascade.rout) {
          rout = true;
          turnCompleted = true;
          break;
        }
        ply += 1;
        turnCompleted = true;
        break;
      }

      const committed = applyPlayerMoveConsequences({
        board,
        actor,
        choice,
        outcome,
        moveEval,
        moverInsights,
        features,
        auditScore,
        bestAuditScore: bestAudit,
        audit,
        objectivelyGood,
        ply,
        roster,
        events,
        lastFriendlyCapturePly,
        abilityDripStreakByPiece,
        dreadExposureByPiece,
        actorChallenged,
      });
      roster = committed.roster;
      const capturedByPlayer =
        committed.capturedPieceId === undefined
          ? undefined
          : enemyRoster.find((piece) => piece.id === committed.capturedPieceId);
      if (capturedByPlayer !== undefined) {
        const credit = applyPosthumousClassCredit(
          enemyRoster,
          capturedByPlayer,
          events,
          committed.ply - 1,
        );
        enemyRoster = credit.roster;
        events.push(...credit.events);
      }
      enemyRoster = applyCapturedPieceInjury(
        enemyRoster,
        committed.capturedPieceId,
        events,
        committed.ply - 1,
      );
      lastFriendlyCapturePly = committed.lastFriendlyCapturePly;
      abilityDripStreakByPiece = committed.abilityDripStreakByPiece;
      dreadExposureByPiece = committed.dreadExposureByPiece;
      ply = committed.ply;
      turnCompleted = true;
      break;
    }

    if (!turnCompleted && firstRefused !== undefined) {
      const currentActor = roster.find(
        (piece) => piece.id === firstRefused?.actor.id,
      );
      if (currentActor === undefined) {
        throw new Error(
          'Refused candidate disappeared before implicit override.',
        );
      }
      const override = applyPlayerOverride(
        roster,
        currentActor,
        ply,
        firstRefused.san,
        true,
        firstRefused.objectivelyGood,
      );
      events.push(...override.events);
      roster = override.roster;
      const committed = applyPlayerMoveConsequences({
        board,
        actor: currentActor,
        choice: firstRefused.choice,
        outcome: {
          ...firstRefused.outcome,
          verdict: 'COMPLIANT_EXECUTION',
        },
        moveEval: firstRefused.moveEval,
        moverInsights: firstRefused.moverInsights,
        features: firstRefused.features,
        auditScore: firstRefused.auditScore,
        bestAuditScore: firstRefused.bestAuditScore,
        audit: firstRefused.audit,
        objectivelyGood: firstRefused.objectivelyGood,
        ply,
        roster,
        events,
        lastFriendlyCapturePly,
        abilityDripStreakByPiece,
        dreadExposureByPiece,
        actorChallenged: true,
      });
      roster = committed.roster;
      enemyRoster = applyCapturedPieceInjury(
        enemyRoster,
        committed.capturedPieceId,
        events,
        committed.ply - 1,
      );
      lastFriendlyCapturePly = committed.lastFriendlyCapturePly;
      abilityDripStreakByPiece = committed.abilityDripStreakByPiece;
      dreadExposureByPiece = committed.dreadExposureByPiece;
      ply = committed.ply;
      continue;
    }
    if (!turnCompleted) break;
  }

  const winScore = scoreMatchOutcome(board, config.playerSide, rout, enemyRout);
  roster =
    config.leader.onMatchEnd?.(roster, winScore) ??
    applyMatchOutcomeTrust(roster, winScore);
  const contestedOrders = events.filter(
    (event) => event.t === 'OVERRIDE' && event.vindicated === true,
  ).length;
  roster = applyOutcomeVindication(roster, winScore, contestedOrders);

  return {
    events: Object.freeze(events),
    engineAudit: Object.freeze(engineAudit),
    roster: roster.map(normalizePieceState),
    departedRoster: departedRoster.map(normalizePieceState),
    enemyRoster: enemyRoster.map(normalizePieceState),
    departedEnemyRoster: departedEnemyRoster.map(normalizePieceState),
    enemyFieldedPieceIds,
    plies: ply - 1,
    winScore,
    rout,
    enemyRout,
    refusedGoodMoves,
    winningPositionDesertions,
    justifiedRefusalObviousness: Object.freeze(
      justifiedRefusalObviousnessValues,
    ),
    justifiedRefusalPrivateViewLosses: Object.freeze(
      justifiedRefusalPrivateViewLosses,
    ),
    determinismId: config.engine.determinismId,
    enemyObservableBehaviours: Object.freeze(enemyObservableBehaviours),
  };
}
