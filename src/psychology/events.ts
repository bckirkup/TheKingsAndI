import type { PieceId } from '../chess';
import { ENGINE_CONFIG } from './config';
import type {
  CampaignCultureDriftVector,
  CandidateMoveEvaluation,
  MatchEvent,
  MoveDecisionOutcome,
  MoveResponseVerdict,
  PieceState,
} from './types';
import { sharedBondScalar } from './witness';

export function appendEvent(
  log: readonly MatchEvent[],
  event: MatchEvent,
): readonly MatchEvent[] {
  return Object.freeze([...log, Object.freeze(event)]);
}

const FULL_EFFORT_VERDICTS: readonly MoveResponseVerdict[] = [
  'COMPLIANT_EXECUTION',
  'HEROIC_EXECUTION',
  'FATALISTIC_COMPLIANCE',
];

export function courageForMove(
  outcome: MoveDecisionOutcome,
  moveEval: CandidateMoveEvaluation,
): { margin: number; asked: number } | undefined {
  if (
    !FULL_EFFORT_VERDICTS.includes(outcome.verdict) ||
    outcome.utilityScore >= 0
  ) {
    return undefined;
  }
  return {
    margin: -outcome.utilityScore,
    asked: Math.max(
      moveEval.P_captured,
      -moveEval.deltaV_board,
      ENGINE_CONFIG.COURAGE_ASKED_COST_FLOOR,
    ),
  };
}

export function foldCourage(
  events: readonly MatchEvent[],
  fieldedPieceIds: readonly PieceId[],
): {
  readonly incidents: readonly {
    ply: number;
    pieceId: PieceId;
    san: string;
    verdict: MoveResponseVerdict;
    margin: number;
    asked: number;
    normalized: number;
  }[];
  readonly meanNormalized: number | null;
  readonly count: number;
} {
  const fieldedIds = new Set(fieldedPieceIds);
  const incidents = events.flatMap((event) => {
    if (
      event.t !== 'MOVE' ||
      event.courage === undefined ||
      !fieldedIds.has(event.pieceId)
    ) {
      return [];
    }
    return [
      {
        ply: event.ply,
        pieceId: event.pieceId,
        san: event.san,
        verdict: event.verdict,
        margin: event.courage.margin,
        asked: event.courage.asked,
        normalized: Math.min(1, event.courage.margin / event.courage.asked),
      },
    ];
  });
  return {
    incidents,
    meanNormalized:
      incidents.length === 0
        ? null
        : incidents.reduce((sum, incident) => sum + incident.normalized, 0) /
          incidents.length,
    count: incidents.length,
  };
}

export function applyWitnessedSacrificeEvent(
  observer: PieceState,
  heroPiece: PieceState,
  affinityShift: number = ENGINE_CONFIG.DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE,
  classShift: number = ENGINE_CONFIG.DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE,
): PieceState {
  const currentAffinity = observer.dyadicAffinity[heroPiece.id] ?? 0;
  const newAffinity = Math.max(
    -100,
    Math.min(100, currentAffinity + affinityShift),
  );
  const currentClassPrestige = observer.classPrestige[heroPiece.role] ?? 0;
  const newClassPrestige = Math.max(
    -100,
    Math.min(100, currentClassPrestige + classShift),
  );
  return {
    ...observer,
    dyadicAffinity: {
      ...observer.dyadicAffinity,
      [heroPiece.id]: newAffinity,
    },
    classPrestige: {
      ...observer.classPrestige,
      [heroPiece.role]: newClassPrestige,
    },
  };
}

export function applyPosthumousClassCreditEvent(
  observer: PieceState,
  heroPiece: PieceState,
  classShift: number = ENGINE_CONFIG.DEFAULT_CLASS_SHIFT_POSTHUMOUS_SACRIFICE,
): { readonly piece: PieceState; readonly delta: number } {
  const current = observer.classPrestige[heroPiece.role] ?? 0;
  const next = Math.max(-100, Math.min(100, current + classShift));
  return {
    piece: {
      ...observer,
      classPrestige: { ...observer.classPrestige, [heroPiece.role]: next },
    },
    delta: next - current,
  };
}

export function calculateBenchingTrustPenalties(
  benchedPiece: PieceState,
  survivingActivePieces: readonly PieceState[],
): {
  readonly benchedPieceNewTrust: number;
  readonly updatedPeers: PieceState[];
} {
  const benchedPieceNewTrust = Math.max(
    -100,
    benchedPiece.T_i + ENGINE_CONFIG.DEFAULT_BENCHING_SELF_PENALTY,
  );
  const updatedPeers = survivingActivePieces.map((peer) => {
    const sharedBond = sharedBondScalar(peer, benchedPiece);
    const deltaTj =
      ENGINE_CONFIG.DEFAULT_BENCHING_PEER_BASE_PENALTY *
      (1 + peer.traits.w_empathy) *
      sharedBond;
    const newTrust = Math.max(-100, Math.min(100, peer.T_i + deltaTj));
    return { ...peer, T_i: newTrust };
  });
  return { benchedPieceNewTrust, updatedPeers };
}

export function calculateSingleMatchLeadershipIndex(
  finalAverageTrust: number,
  winScore: number,
  unjustifiedTraumaScore: number,
  quietQuitTurnCount: number,
  emptiedChairsScore = 0,
  weights = ENGINE_CONFIG.LEADERSHIP_WEIGHTS,
): number {
  return (
    weights.alpha * finalAverageTrust +
    weights.beta * winScore -
    weights.gamma * unjustifiedTraumaScore -
    weights.delta * quietQuitTurnCount -
    weights.epsilon * emptiedChairsScore
  );
}

/**
 * Fold trauma attributable to unvindicated overrides from the match event log.
 * Each trauma event is charged at most once when override windows overlap.
 */
export function foldUnjustifiedTrauma(
  events: readonly MatchEvent[],
  fieldedPieceIds: readonly PieceId[],
  fieldedRosterSize: number,
): number {
  const fieldedIds = new Set(fieldedPieceIds);
  const overrides = events.filter(
    (event): event is Extract<MatchEvent, { t: 'OVERRIDE' }> =>
      event.t === 'OVERRIDE' &&
      event.vindicated !== true &&
      fieldedIds.has(event.pieceId),
  );
  const windowPlies = Math.max(
    0,
    Math.trunc(ENGINE_CONFIG.UNJUSTIFIED_TRAUMA_WINDOW_PLIES),
  );
  let attributedTotal = 0;
  for (const event of events) {
    if (
      event.t !== 'PSYCH_DELTA' ||
      event.field !== 'B_i' ||
      event.delta <= 0 ||
      !fieldedIds.has(event.pieceId)
    ) {
      continue;
    }
    const attributed = overrides.some(
      (override) =>
        override.pieceId === event.pieceId &&
        event.ply > override.ply &&
        event.ply <= override.ply + windowPlies,
    );
    if (attributed) attributedTotal += event.delta;
  }
  return Math.max(
    0,
    Math.min(100, attributedTotal / Math.max(1, fieldedRosterSize)),
  );
}

export function compileCampaignCultureDrift(
  initialAvgTrust: number,
  finalAvgTrust: number,
  reassignedCount: number,
  totalRosterSize: number,
  classPrestigeDeltaSum: number,
  quietQuitTurnsTotal: number,
): CampaignCultureDriftVector {
  const deltaAverageTrustLongitudinal = finalAvgTrust - initialAvgTrust;
  const retentionRate = Math.max(
    0,
    (totalRosterSize - reassignedCount) / totalRosterSize,
  );
  const burnoutIndex = Math.min(100, quietQuitTurnsTotal * 2.5);
  const loyaltyStabilityScore = Math.min(
    100,
    Math.max(
      0,
      100 - burnoutIndex + Math.max(0, deltaAverageTrustLongitudinal),
    ),
  );
  return {
    deltaAverageTrustLongitudinal,
    retentionRate,
    crossClassPrestigeShift: classPrestigeDeltaSum,
    burnoutIndex,
    loyaltyStabilityScore,
  };
}
