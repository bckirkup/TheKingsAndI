import { ENGINE_CONFIG } from './config';
import type {
  CampaignCultureDriftVector,
  MatchEvent,
  PieceState,
} from './types';

export function appendEvent(
  log: readonly MatchEvent[],
  event: MatchEvent,
): readonly MatchEvent[] {
  return Object.freeze([...log, Object.freeze(event)]);
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

export function calculateBenchingTrustPenalties(
  benchedPiece: PieceState,
  survivingActivePieces: readonly PieceState[],
  sharedBondMap: Readonly<Record<string, number>>,
): {
  readonly benchedPieceNewTrust: number;
  readonly updatedPeers: PieceState[];
} {
  const benchedPieceNewTrust = Math.max(
    -100,
    benchedPiece.T_i + ENGINE_CONFIG.DEFAULT_BENCHING_SELF_PENALTY,
  );
  const updatedPeers = survivingActivePieces.map((peer) => {
    const sharedBond = sharedBondMap[peer.id] ?? 0;
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
  weights = ENGINE_CONFIG.LEADERSHIP_WEIGHTS,
): number {
  return (
    weights.alpha * finalAverageTrust +
    weights.beta * winScore -
    weights.gamma * unjustifiedTraumaScore -
    weights.delta * quietQuitTurnCount
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
  const loyaltyStabilityScore = Math.max(
    0,
    100 - burnoutIndex + Math.max(0, deltaAverageTrustLongitudinal),
  );
  return {
    deltaAverageTrustLongitudinal,
    retentionRate,
    crossClassPrestigeShift: classPrestigeDeltaSum,
    burnoutIndex,
    loyaltyStabilityScore,
  };
}
