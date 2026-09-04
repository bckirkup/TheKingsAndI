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

export interface PromotionHopeState {
  readonly prospects: Readonly<Record<PieceId, number>>;
}

export function trackPromotionHope(
  state: PromotionHopeState | undefined,
  current: Readonly<Record<PieceId, number>>,
  capturedPawnIds: readonly PieceId[],
  promotedPieceIds: readonly PieceId[],
  ply: number,
): { state: PromotionHopeState; events: readonly MatchEvent[] } {
  const prior = state?.prospects ?? {};
  const captured = new Set(capturedPawnIds);
  const promoted = new Set(promotedPieceIds);
  const pieceIds = [
    ...new Set([...Object.keys(prior), ...Object.keys(current)]),
  ].sort((left, right) => left.localeCompare(right)) as PieceId[];
  const prospects: Record<PieceId, number> = {};
  const events: MatchEvent[] = [];
  for (const pieceId of pieceIds) {
    const previousProspect = prior[pieceId];
    if (previousProspect === undefined) {
      const nextProspect = current[pieceId];
      if (nextProspect !== undefined) prospects[pieceId] = nextProspect;
      continue;
    }
    if (captured.has(pieceId)) {
      if (previousProspect > 0) {
        events.push({
          t: 'HOPE_EXTINGUISHED',
          ply,
          pieceId,
          object: 'promotion',
          priorProspect: previousProspect,
          reason: 'captured',
        });
      }
      continue;
    }
    if (promoted.has(pieceId)) continue;
    const nextProspect = current[pieceId];
    if (nextProspect === undefined) continue;
    prospects[pieceId] = nextProspect;
    if (previousProspect > 0 && nextProspect === 0) {
      events.push({
        t: 'HOPE_EXTINGUISHED',
        ply,
        pieceId,
        object: 'promotion',
        priorProspect: previousProspect,
        reason: 'unreachable',
      });
    } else if (previousProspect === 0 && nextProspect > 0) {
      events.push({
        t: 'HOPE_REKINDLED',
        ply,
        pieceId,
        object: 'promotion',
        prospect: nextProspect,
      });
    }
  }
  return { state: { prospects }, events };
}

export function foldHope(
  events: readonly MatchEvent[],
  fieldedPieceIds: readonly PieceId[],
): {
  readonly realized: readonly { ply: number; pieceId: PieceId }[];
  readonly extinguished: readonly {
    ply: number;
    pieceId: PieceId;
    reason: 'unreachable' | 'captured';
    priorProspect: number;
  }[];
  readonly rekindledCount: number;
} {
  const fielded = new Set(fieldedPieceIds);
  const realized: { ply: number; pieceId: PieceId }[] = [];
  const extinguished: {
    ply: number;
    pieceId: PieceId;
    reason: 'unreachable' | 'captured';
    priorProspect: number;
  }[] = [];
  let rekindledCount = 0;
  for (const event of events) {
    if (event.t === 'PROMOTION') {
      if (!fielded.has(event.pieceId)) continue;
      realized.push({ ply: event.ply, pieceId: event.pieceId });
    } else if (event.t === 'HOPE_EXTINGUISHED') {
      if (!fielded.has(event.pieceId)) continue;
      extinguished.push({
        ply: event.ply,
        pieceId: event.pieceId,
        reason: event.reason,
        priorProspect: event.priorProspect,
      });
    } else if (event.t === 'HOPE_REKINDLED') {
      if (!fielded.has(event.pieceId)) continue;
      rekindledCount += 1;
    }
  }
  return { realized, extinguished, rekindledCount };
}

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

export interface SpiteIncident {
  readonly ply: number;
  readonly pieceId: PieceId;
  readonly kind: 'refusal' | 'desertion';
  readonly grievance: 'override' | 'bitterness';
  readonly commanderCost: number;
}

export function foldSpite(
  events: readonly MatchEvent[],
  fieldedPieceIds: readonly PieceId[],
): { readonly incidents: readonly SpiteIncident[]; readonly count: number } {
  if (
    ENGINE_CONFIG.SPITE_COMMANDER_COST_FLOOR <= 0 &&
    ENGINE_CONFIG.SPITE_DESERTION_PIVOTALITY_FLOOR <= 0
  ) {
    return { incidents: [], count: 0 };
  }
  const fielded = new Set(fieldedPieceIds);
  const overrideGround = new Set<PieceId>();
  const bitternessGround = new Set<PieceId>();
  const incidents: SpiteIncident[] = [];
  for (const event of events) {
    if (event.t === 'REPAIR') {
      overrideGround.delete(event.pieceId);
      continue;
    }
    if (event.t === 'OVERRIDE') {
      if (event.vindicated !== true) overrideGround.add(event.pieceId);
      continue;
    }
    if (event.t === 'BITTERNESS_FORMED') {
      bitternessGround.add(event.pieceId);
      continue;
    }
    if (event.t !== 'REFUSAL' && event.t !== 'DESERTION') continue;
    if (!fielded.has(event.pieceId)) continue;
    const grievance = overrideGround.has(event.pieceId)
      ? 'override'
      : bitternessGround.has(event.pieceId)
        ? 'bitterness'
        : undefined;
    if (grievance === undefined) continue;
    if (
      event.t === 'REFUSAL' &&
      ENGINE_CONFIG.SPITE_COMMANDER_COST_FLOOR > 0 &&
      event.justified !== true &&
      event.perceivedValue >= ENGINE_CONFIG.SPITE_COMMANDER_COST_FLOOR
    ) {
      incidents.push({
        ply: event.ply,
        pieceId: event.pieceId,
        kind: 'refusal',
        grievance,
        commanderCost: event.perceivedValue,
      });
    } else if (
      event.t === 'DESERTION' &&
      ENGINE_CONFIG.SPITE_DESERTION_PIVOTALITY_FLOOR > 0 &&
      event.terms?.pivotality !== undefined &&
      event.terms.pivotality >= ENGINE_CONFIG.SPITE_DESERTION_PIVOTALITY_FLOOR
    ) {
      incidents.push({
        ply: event.ply,
        pieceId: event.pieceId,
        kind: 'desertion',
        grievance,
        commanderCost: event.terms.pivotality,
      });
    }
  }
  incidents.sort(
    (left, right) =>
      left.pieceId.localeCompare(right.pieceId) || left.ply - right.ply,
  );
  return { incidents, count: incidents.length };
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
