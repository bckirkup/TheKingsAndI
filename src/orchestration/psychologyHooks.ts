import type { MoveFeatures } from '../chess';
import { isObjectivelyGoodMove } from './evaluation';
import {
  applyAbilityObservation,
  applyAuthorityLoss,
  applyCostlySignal,
  applyHeardSignal,
  applyWitnessedSacrificeEvent,
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
  observationCount: number,
): PieceState {
  const surrendered =
    moveEval.deltaV_board < 0 &&
    moveEval.vLeaderImplied > moveEval.deltaV_board;
  let credence = applyHeardSignal(actor.credence, surrendered);
  credence = applyAbilityObservation(
    credence,
    objectivelyGood,
    observationCount,
  );
  return normalizePieceState({ ...actor, credence });
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

export function isAvengedCapture(
  capturePly: number | undefined,
  currentPly: number,
  windowPlies: number = ENGINE_CONFIG.AVENGED_CAPTURE_WINDOW_PLIES,
): boolean {
  if (capturePly === undefined) return false;
  const gap = currentPly - capturePly;
  return gap > 0 && gap <= windowPlies;
}
