import { compileCampaignCultureDrift } from '../psychology/events';
import type { CampaignCultureDriftVector, MatchEvent } from '../psychology';
import {
  AUDIT_FOLD_VERSION,
  CULTURE_DRIFT_FOLD_VERSION,
  type MatchAudit,
  type MatchRecord,
  type StoredPieceState,
} from './types';

const VERDICT_QUALITY: Record<string, number> = {
  HEROIC_EXECUTION: 100,
  COMPLIANT_EXECUTION: 80,
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
  const orderQualities: number[] = [];

  for (const event of events) {
    switch (event.t) {
      case 'REFUSAL':
        refusalCount += 1;
        orderQualities.push(
          Math.max(0, 50 + event.perceivedValue * 10 + event.threshold),
        );
        break;
      case 'OVERRIDE':
        overrideCount += 1;
        orderQualities.push(60);
        break;
      case 'MOVE':
        orderQualities.push(VERDICT_QUALITY[event.verdict] ?? 50);
        if (event.verdict === 'QUIET_QUITTING') quietQuitCount += 1;
        break;
      case 'DESERTION':
        desertionCount += 1;
        orderQualities.push(10);
        break;
      default:
        break;
    }
  }

  const moveCount = events.filter((event) => event.t === 'MOVE').length;
  const commandsIssued = moveCount + refusalCount;
  const executionFidelity =
    commandsIssued === 0 ? 1 : moveCount / commandsIssued;

  return {
    boardQuality: mean(orderQualities),
    executionFidelity,
    refusalCount,
    overrideCount,
    desertionCount,
    quietQuitCount,
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
): {
  readonly campaignId: string;
  readonly matches: readonly MatchRecord[];
  readonly cultureDrift: CampaignCultureDriftVector;
  readonly meanBoardQuality: number;
  readonly meanExecutionFidelity: number;
  readonly foldVersion: string;
} {
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
  return {
    campaignId,
    matches,
    cultureDrift,
    meanBoardQuality,
    meanExecutionFidelity,
    foldVersion: CULTURE_DRIFT_FOLD_VERSION,
  };
}
