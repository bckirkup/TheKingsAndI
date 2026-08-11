import type { MoveFeatures } from '../chess';
import { isObjectivelyGoodMove, isVindicatedMove } from './evaluation';
import {
  applyAbilityDrip,
  applyAbilityObservation,
  applyAuthorityGain,
  applyAuthorityLoss,
  applyCostlySignal,
  applyHeardSignal,
  applyWitnessedSacrificeEvent,
  desertionContextFor,
  evaluateMoveResponse,
  justifiedRefusalObviousness,
  justifiedRefusalAuthorityLoss,
  isWitnessedSacrifice,
  normalizePieceState,
  type CandidateMoveEvaluation,
  type PieceState,
  type SacrificeAttribution,
  ENGINE_CONFIG,
  type MatchEvent,
} from '../psychology';

export {
  applyDesertionWithCascade,
  desertionContextFor,
} from '../psychology/cascade';

export function attributeSacrifice(
  features: MoveFeatures,
  postMoveAuditCp: number,
): SacrificeAttribution {
  const removedThreatToPeer = Object.values(features.peerSafetyDeltas).some(
    (delta) => delta > 0.05,
  );
  const enabledForcedWin = postMoveAuditCp >= 20_000;
  return { removedThreatToPeer, enabledForcedWin };
}

export function applySacrificeWitnesses(
  roster: readonly PieceState[],
  hero: PieceState,
  attribution: SacrificeAttribution,
  ply: number,
): { readonly roster: PieceState[]; readonly events: MatchEvent[] } {
  if (!isWitnessedSacrifice(attribution)) {
    return { roster: [...roster], events: [] };
  }
  const events: MatchEvent[] = [];
  let next = [...roster];
  for (const observer of roster) {
    if (observer.id === hero.id) continue;
    const witnessed = applyWitnessedSacrificeEvent(observer, hero);
    next = next.map((piece) =>
      piece.id === observer.id ? normalizePieceState(witnessed) : piece,
    );
    events.push({
      t: 'SACRIFICE_WITNESSED',
      ply,
      hero: hero.id,
      beneficiary: observer.id,
    });
  }
  return { roster: next, events };
}

export function detectKingEndangermentCostlySignal(
  features: MoveFeatures,
): boolean {
  const peerRelief = Object.values(features.peerSafetyDeltas).some(
    (delta) => delta > 0.05,
  );
  return features.kingSafetyDelta < -0.2 && peerRelief;
}

export function detectDeclinedSacrificeCostlySignal(
  opportunity:
    | {
        readonly sacrificedPieceId: string;
        readonly preferredMove: string;
        readonly preferredScoreCp: number;
      }
    | undefined,
  playedMove: string,
  postMoveAuditCp: number,
): boolean {
  return (
    opportunity !== undefined &&
    opportunity.preferredMove !== playedMove &&
    !isObjectivelyGoodMove(postMoveAuditCp, opportunity.preferredScoreCp)
  );
}

export function applyDeclinedSacrificeSignal(
  roster: readonly PieceState[],
  sparedPieceId: string,
  ply: number,
): { readonly roster: PieceState[]; readonly events: MatchEvent[] } {
  const spared = roster.find((piece) => piece.id === sparedPieceId);
  if (spared === undefined) return { roster: [...roster], events: [] };
  const beneficiaries = roster.filter(
    (piece) =>
      piece.id === sparedPieceId ||
      (piece.dyadicAffinity[sparedPieceId] ?? 0) > 0,
  );
  const applied = applyCostlySignalsToRoster(
    beneficiaries,
    ['declined_sacrifice'],
    ply,
  );
  return {
    roster: roster.map(
      (piece) =>
        applied.roster.find((updated) => updated.id === piece.id) ?? piece,
    ),
    events: applied.events,
  };
}

export function applyCostlySignalsToRoster(
  roster: readonly PieceState[],
  kinds: readonly (
    | 'king_endangerment'
    | 'declined_sacrifice'
    | 'avenged_capture'
    | 'retained_piece'
  )[],
  ply: number,
): { readonly roster: PieceState[]; readonly events: MatchEvent[] } {
  if (kinds.length === 0) return { roster: [...roster], events: [] };
  const events: MatchEvent[] = [];
  let next = roster.map((piece) => ({ ...piece }));
  for (const kind of kinds) {
    next = next.map((piece) => {
      const applied = applyCostlySignal(piece, kind, ply);
      events.push(applied.event);
      return normalizePieceState(applied.piece);
    });
  }
  return { roster: next, events };
}

export function applyPostMoveCredence(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  objectivelyGood: boolean,
): PieceState {
  void objectivelyGood;
  const surrendered =
    moveEval.deltaV_board < 0 &&
    moveEval.vLeaderImplied > moveEval.deltaV_board;
  const credence = applyHeardSignal(actor.credence, surrendered);
  return normalizePieceState({ ...actor, credence });
}

export function expectedVindicationDelta(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
): number {
  const distrustAndTrauma = Math.max(
    0,
    Math.min(200, 100 - actor.credence.tauBenev + actor.B_i),
  );
  const pessimismPercent =
    100 +
    Math.trunc(
      (ENGINE_CONFIG.VINDICATION_PESSIMISM_SCALE * distrustAndTrauma) / 100,
    );
  const expectedHarm =
    ((1 - actor.traits.w_courage) * moveEval.P_captured * pessimismPercent) /
    100;
  return Math.trunc((moveEval.deltaV_board - expectedHarm) * 100) / 100;
}

export function applyRosterAbilityObservations(
  roster: readonly PieceState[],
  moveEvalByPiece: Readonly<Record<string, CandidateMoveEvaluation>>,
  playedAuditCp: number,
  preMoveAuditCp: number,
  oracleBestAuditCp: number,
  ply = 0,
  actorId: string | undefined = undefined,
  actorChallenged = false,
  safePly = false,
  dripStreakByPiece: Readonly<Record<string, number>> = {},
): {
  readonly roster: PieceState[];
  readonly vindicatedCount: number;
  readonly events: MatchEvent[];
  readonly dripStreakByPiece: Readonly<Record<string, number>>;
} {
  let vindicatedCount = 0;
  const events: MatchEvent[] = [];
  const nextDripStreakByPiece: Record<string, number> = {};
  const next = roster.map((piece) => {
    const moveEval = moveEvalByPiece[piece.id];
    const streak = safePly ? (dripStreakByPiece[piece.id] ?? 0) + 1 : 0;
    nextDripStreakByPiece[piece.id] = streak;
    let credence = piece.credence;
    if (safePly && streak > 0 && streak % ABILITY_DRIP_STREAK_PLIES === 0) {
      const gain = calculateAbilityDripGain(piece, moveEval);
      if (gain > 0) {
        credence = applyAbilityDrip(credence, gain);
        events.push({
          t: 'ABILITY_DRIP',
          ply,
          pieceId: piece.id,
          streak,
          gain,
        });
      }
    }
    if (moveEval === undefined) {
      return normalizePieceState({ ...piece, credence });
    }
    const witnessOutcome = evaluateMoveResponse(
      piece,
      moveEval,
      roster,
      desertionContextFor(piece, moveEval),
    );
    const nearRefusal = isNearRefusal(witnessOutcome);
    const challenged =
      actorId === undefined ||
      (piece.id === actorId && actorChallenged) ||
      nearRefusal;
    if (!challenged) {
      return normalizePieceState({ ...piece, credence });
    }
    const vindicated = isVindicatedMove(
      playedAuditCp,
      preMoveAuditCp,
      oracleBestAuditCp,
      expectedVindicationDelta(piece, moveEval),
    );
    if (vindicated) vindicatedCount += 1;
    events.push({
      t: 'ABILITY_OBSERVATION',
      ply,
      pieceId: piece.id,
      vindicated,
      channel: 'adjudication',
    });
    const authorityGain = vindicated
      ? Math.trunc(
          justifiedRefusalObviousness(
            expectedVindicationDelta(piece, moveEval),
            true,
          ) * ENGINE_CONFIG.ABIL_VINDICATION_GAIN_SCALE,
        )
      : 0;
    credence = applyAbilityObservation(credence, vindicated);
    if (authorityGain > 0) {
      credence = applyAuthorityGain(credence, authorityGain);
    }
    return normalizePieceState({
      ...piece,
      credence,
    });
  });
  return {
    roster: next,
    vindicatedCount,
    events,
    dripStreakByPiece: nextDripStreakByPiece,
  };
}

export function isNearRefusal(
  outcome: Pick<
    ReturnType<typeof evaluateMoveResponse>,
    'utilityScore' | 'refusalThreshold'
  >,
  margin: number = ENGINE_CONFIG.ABIL_VINDICATION_NEAR_REFUSAL_MARGIN,
): boolean {
  return outcome.utilityScore <= outcome.refusalThreshold + margin;
}

const ABILITY_DRIP_STREAK_PLIES = 3;

export function calculateAbilityDripGain(
  piece: PieceState,
  moveEval: CandidateMoveEvaluation | undefined,
  scale: number = ENGINE_CONFIG.ABIL_DRIP_SCALE,
): number {
  const vulnerability = moveEval?.P_captured ?? 0;
  const roleValue = Math.max(0, Math.min(80, piece.E_i));
  const expendability = 100 - Math.trunc((roleValue * 100) / 80);
  const standing = Math.max(
    0,
    Math.min(100, 50 + (piece.classPrestige[piece.role] ?? 0)),
  );
  const standingExposure = 100 - standing;
  const weight = Math.trunc(
    (vulnerability * 100 + expendability + standingExposure) / 3,
  );
  return Math.trunc((scale * weight) / 100);
}

export function applyRefusalAuthorityCost(
  roster: readonly PieceState[],
  actorId: string,
  actorView: number,
  justified: boolean,
): { readonly roster: PieceState[]; readonly authorityLoss: number } {
  const authorityLoss = justifiedRefusalAuthorityLoss(actorView, justified);
  if (authorityLoss === 0) {
    return { roster: [...roster], authorityLoss };
  }
  return {
    roster: roster.map((piece) =>
      piece.id === actorId
        ? piece
        : normalizePieceState({
            ...piece,
            credence: applyAuthorityLoss(piece.credence, authorityLoss),
          }),
    ),
    authorityLoss,
  };
}

export function applyVindicationAuthorityGain(
  roster: readonly PieceState[],
  actorId: string,
  actorView: number,
  justified: boolean,
  vindicated: boolean,
): { readonly roster: PieceState[]; readonly authorityGain: number } {
  const obviousness = justifiedRefusalObviousness(actorView, justified);
  const authorityGain =
    vindicated && obviousness > 0
      ? Math.trunc(obviousness * ENGINE_CONFIG.ABIL_VINDICATION_GAIN_SCALE)
      : 0;
  if (authorityGain === 0) {
    return { roster: [...roster], authorityGain };
  }
  return {
    roster: roster.map((piece) =>
      piece.id === actorId
        ? piece
        : normalizePieceState({
            ...piece,
            credence: applyAuthorityGain(piece.credence, authorityGain),
          }),
    ),
    authorityGain,
  };
}

export function applyOutcomeVindication(
  roster: readonly PieceState[],
  winScore: number,
  contestedOrders: number,
): PieceState[] {
  const matchGain = Math.trunc(
    (Math.max(0, Math.min(100, winScore)) / 100) *
      Math.max(0, Math.trunc(contestedOrders)) *
      ENGINE_CONFIG.ABIL_OUTCOME_VINDICATION_SCALE,
  );
  if (matchGain === 0) return roster.map(normalizePieceState);
  return roster.map((piece) =>
    normalizePieceState({
      ...piece,
      credence: applyAuthorityGain(piece.credence, matchGain),
    }),
  );
}

export function isAvengedCapture(
  capturePly: number | undefined,
  currentPly: number,
  windowPlies: number = ENGINE_CONFIG.AVENGED_CAPTURE_WINDOW_PLIES,
): boolean {
  if (capturePly === undefined) return false;
  const gap = currentPly - capturePly;
  return gap > 0 && gap <= windowPlies;
}
