import { compileCampaignCultureDrift } from '../psychology/events';
import type { CampaignCultureDriftVector, MatchEvent } from '../psychology';
import { foldPlayerCommendations } from './commendations';
import { foldCampaignTranscript } from './transcript';
import {
  AUDIT_FOLD_VERSION,
  CULTURE_DRIFT_FOLD_VERSION,
  type ActTerminalState,
  type CampaignDebrief,
  type MatchAudit,
  type MatchRecord,
  type StoredPieceState,
} from './types';

const VERDICT_QUALITY_CP: Record<string, number> = {
  HEROIC_EXECUTION: 120,
  COMPLIANT_EXECUTION: 80,
  FATALISTIC_COMPLIANCE: 90,
  QUIET_QUITTING: 35,
  MORAL_REFUSAL: 0,
  DESERTION_MUTINY: 0,
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanTrust(roster: readonly StoredPieceState[]): number {
  if (roster.length === 0) return 0;
  return roster.reduce((sum, piece) => sum + piece.T_i, 0) / roster.length;
}

function orderQualityCp(event: MatchEvent): number | null {
  switch (event.t) {
    case 'MOVE':
      return event.orderQualityCp ?? VERDICT_QUALITY_CP[event.verdict] ?? 50;
    case 'REFUSAL':
      return Math.max(0, Math.round(event.perceivedValue * 100));
    case 'OVERRIDE':
      return 55;
    default:
      return null;
  }
}

/** Fold a match event log into audit columns (ADR 0022 §5). */
export function foldMatchAudit(
  events: readonly MatchEvent[],
  rosterStartTrust: number,
  rosterEndTrust: number,
): MatchAudit {
  let refusalCount = 0;
  let overrideCount = 0;
  let desertionCount = 0;
  let quietQuitCount = 0;
  let promotionCount = 0;
  const orderQualities: number[] = [];

  for (const event of events) {
    switch (event.t) {
      case 'REFUSAL':
        refusalCount += 1;
        break;
      case 'OVERRIDE':
        overrideCount += 1;
        break;
      case 'MOVE':
        if (event.verdict === 'QUIET_QUITTING') quietQuitCount += 1;
        break;
      case 'PROMOTION':
        promotionCount += 1;
        break;
      case 'DESERTION':
        desertionCount += 1;
        orderQualities.push(10);
        break;
      default:
        break;
    }
    const quality = orderQualityCp(event);
    if (quality !== null) orderQualities.push(quality);
  }

  const moveCount = events.filter((event) => event.t === 'MOVE').length;
  const commandsIssued = moveCount + refusalCount;
  const faithfulMoves = Math.max(0, moveCount - overrideCount);
  const executionFidelity =
    commandsIssued === 0 ? 1 : faithfulMoves / commandsIssued;

  const executedQualities = events
    .filter((event) => event.t === 'MOVE')
    .map(
      (event) =>
        event.orderQualityCp ?? VERDICT_QUALITY_CP[event.verdict] ?? 50,
    );

  return {
    boardQuality: mean(orderQualities),
    executionFidelity,
    realizedQuality: mean(executedQualities),
    refusalCount,
    overrideCount,
    desertionCount,
    quietQuitCount,
    promotionCount,
    meanTrustDelta: rosterEndTrust - rosterStartTrust,
    foldVersion: AUDIT_FOLD_VERSION,
  };
}

function classPrestigeDelta(roster: readonly StoredPieceState[]): number {
  return roster.reduce((sum, piece) => sum + piece.classPrestige.Pawn, 0);
}

function quietQuitTotal(matches: readonly MatchRecord[]): number {
  return matches.reduce((sum, match) => sum + match.audit.quietQuitCount, 0);
}

function reassignedCount(
  initialRoster: readonly StoredPieceState[],
  finalRoster: readonly StoredPieceState[],
): number {
  const finalActive = new Set(
    finalRoster.filter((piece) => piece.status === 'ACTIVE').map((p) => p.id),
  );
  return initialRoster.filter((piece) => !finalActive.has(piece.id)).length;
}

export function foldCampaignCultureDrift(
  matches: readonly MatchRecord[],
  initialRoster: readonly StoredPieceState[],
  finalRoster: readonly StoredPieceState[],
): CampaignCultureDriftVector {
  return compileCampaignCultureDrift(
    meanTrust(initialRoster),
    meanTrust(finalRoster),
    reassignedCount(initialRoster, finalRoster),
    Math.max(1, initialRoster.length),
    classPrestigeDelta(finalRoster) - classPrestigeDelta(initialRoster),
    quietQuitTotal(matches),
  );
}

export function buildCampaignDebrief(
  campaignId: string,
  matches: readonly MatchRecord[],
  initialRoster: readonly StoredPieceState[],
  finalRoster: readonly StoredPieceState[],
  actTerminalState: ActTerminalState,
  act2Matches: readonly MatchRecord[] = [],
): CampaignDebrief {
  const cultureDrift = foldCampaignCultureDrift(
    matches,
    initialRoster,
    finalRoster,
  );
  const meanBoardQuality = mean(
    matches.map((match) => match.audit.boardQuality),
  );
  const meanExecutionFidelity = mean(
    matches.map((match) => match.audit.executionFidelity),
  );
  const meanRealizedQuality = mean(
    matches.map((match) => match.audit.realizedQuality),
  );
  return {
    campaignId,
    matches,
    cultureDrift,
    meanBoardQuality,
    meanExecutionFidelity,
    meanRealizedQuality,
    foldVersion: CULTURE_DRIFT_FOLD_VERSION,
    actTerminalState,
    transcript: foldCampaignTranscript(matches),
    commendations: foldPlayerCommendations(matches, act2Matches),
  };
}
