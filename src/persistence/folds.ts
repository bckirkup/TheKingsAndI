import {
  calculateSingleMatchLeadershipIndex,
  compileCampaignCultureDrift,
  foldCourage,
  foldHope,
  foldUnjustifiedTrauma,
} from '../psychology/events';
import type {
  CampaignCultureDriftVector,
  GriefIncident,
  MatchEvent,
} from '../psychology';
import { foldPlayerCommendations } from './commendations';
import { foldCampaignTranscript } from './transcript';
import {
  AUDIT_FOLD_VERSION,
  CULTURE_DRIFT_FOLD_VERSION,
  COURAGE_FOLD_VERSION,
  HOPE_FOLD_VERSION,
  JUDGEMENT_SEAT_FOLD_VERSION,
  type ActTerminalState,
  type CampaignDebrief,
  type MatchAudit,
  type MatchRecord,
  type MatchResult,
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
  rosterPieceIds?: ReadonlySet<string>,
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
        if (rosterPieceIds === undefined || rosterPieceIds.has(event.pieceId)) {
          promotionCount += 1;
        }
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

function legacyWinScore(result: MatchResult): number | null {
  switch (result) {
    case 'WIN':
      return 100;
    case 'DRAW':
      return 50;
    case 'LOSS':
    case 'ROUT':
      return 0;
    case 'DISMISSED':
    case 'ABANDONED':
      return null;
  }
}

function judgementSeatWinScore(match: MatchRecord): number | null {
  return match.winScore === undefined
    ? legacyWinScore(match.result)
    : match.winScore;
}

function fieldedIdsForJudgementSeat(match: MatchRecord): readonly string[] {
  const fieldingDecisions = match.events.filter(
    (event): event is Extract<MatchEvent, { t: 'SQUAD_FIELDING' }> =>
      event.t === 'SQUAD_FIELDING' && event.side === 'w',
  );
  if (fieldingDecisions.length > 0) {
    return fieldingDecisions
      .filter((event) => event.decision === 'fielded')
      .map((event) => event.pieceId);
  }
  return match.rosterSnapshot
    .filter((piece) => piece.status === 'ACTIVE')
    .map((piece) => piece.id);
}

function emptiedChairsScore(
  emptiedChairs: number,
  fieldedRosterSize: number,
): number {
  return Math.max(
    0,
    Math.min(100, (100 * emptiedChairs) / Math.max(1, fieldedRosterSize)),
  );
}

export function foldJudgementSeat(
  matches: readonly MatchRecord[],
): CampaignDebrief['judgementSeat'] {
  const foldedMatches = matches.map((match) => {
    const fieldedPieceIds = fieldedIdsForJudgementSeat(match);
    const fieldedIds = new Set(fieldedPieceIds);
    const trustFinal = meanTrust(
      match.rosterEnd.filter((piece) => fieldedIds.has(piece.id)),
    );
    const winScore = judgementSeatWinScore(match);
    const unjustifiedTrauma = foldUnjustifiedTrauma(
      match.events,
      fieldedPieceIds,
      fieldedPieceIds.length,
    );
    const quietQuitTurns = match.events.filter(
      (event): event is Extract<MatchEvent, { t: 'MOVE' }> =>
        event.t === 'MOVE' &&
        event.verdict === 'QUIET_QUITTING' &&
        fieldedIds.has(event.pieceId),
    ).length;
    const desertions = new Set(
      match.events
        .filter(
          (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
            event.t === 'DESERTION' && fieldedIds.has(event.pieceId),
        )
        .map((event) => event.pieceId),
    );
    const snapshotById = new Map(
      match.rosterSnapshot.map((piece) => [piece.id, piece]),
    );
    const traumaEndedCareers = new Set(
      match.rosterEnd
        .filter(
          (piece) =>
            fieldedIds.has(piece.id) &&
            piece.status === 'RETIRED' &&
            snapshotById.get(piece.id)?.status !== 'RETIRED',
        )
        .map((piece) => piece.id),
    );
    const emptiedChairs = new Set([...desertions, ...traumaEndedCareers]).size;
    const emptiedChairsScoreValue = emptiedChairsScore(
      emptiedChairs,
      fieldedPieceIds.length,
    );
    return {
      matchId: match.id,
      matchIndex: match.matchIndex,
      finalTrust: trustFinal,
      winScore,
      unjustifiedTrauma,
      quietQuitTurns,
      emptiedChairs,
      emptiedChairsScore: emptiedChairsScoreValue,
      leadershipIndex:
        winScore === null
          ? null
          : calculateSingleMatchLeadershipIndex(
              trustFinal,
              winScore,
              unjustifiedTrauma,
              quietQuitTurns,
              emptiedChairsScoreValue,
            ),
      computable: winScore !== null,
    };
  });
  const computable = foldedMatches.filter((match) => match.computable);
  const pooledMean = (
    selector: (match: (typeof computable)[number]) => number,
  ): number | null =>
    computable.length === 0 ? null : mean(computable.map(selector));
  return {
    foldVersion: JUDGEMENT_SEAT_FOLD_VERSION,
    matches: foldedMatches,
    meanFinalTrust: pooledMean((match) => match.finalTrust),
    meanWinScore: pooledMean((match) => match.winScore ?? 0),
    meanUnjustifiedTrauma: pooledMean((match) => match.unjustifiedTrauma),
    meanQuietQuitTurns: pooledMean((match) => match.quietQuitTurns),
    meanEmptiedChairs: pooledMean((match) => match.emptiedChairs),
    meanEmptiedChairsScore: pooledMean((match) => match.emptiedChairsScore),
    meanLeadershipIndex: pooledMean((match) => match.leadershipIndex ?? 0),
    computedMatchCount: computable.length,
    totalMatchCount: matches.length,
  };
}

function foldCampaignCourage(
  matches: readonly MatchRecord[],
): CampaignDebrief['courage'] {
  const incidents = matches.flatMap((match) => {
    const folded = foldCourage(match.events, fieldedIdsForJudgementSeat(match));
    return folded.incidents.map((incident) => ({
      matchId: match.id,
      matchIndex: match.matchIndex,
      ...incident,
    }));
  });
  return {
    foldVersion: COURAGE_FOLD_VERSION,
    incidents,
    meanNormalized:
      incidents.length === 0
        ? null
        : incidents.reduce((sum, incident) => sum + incident.normalized, 0) /
          incidents.length,
    count: incidents.length,
  };
}

function foldCampaignHope(
  matches: readonly MatchRecord[],
): CampaignDebrief['hope'] {
  const foldedMatches = matches.map((match) => ({
    match,
    folded: foldHope(match.events, fieldedIdsForJudgementSeat(match)),
  }));
  const realized = foldedMatches.flatMap(({ match, folded }) =>
    folded.realized.map((incident) => ({
      matchId: match.id,
      matchIndex: match.matchIndex,
      ...incident,
    })),
  );
  const extinguished = foldedMatches.flatMap(({ match, folded }) =>
    folded.extinguished.map((incident) => ({
      matchId: match.id,
      matchIndex: match.matchIndex,
      ...incident,
    })),
  );
  return {
    foldVersion: HOPE_FOLD_VERSION,
    realized,
    extinguished,
    realizedCount: realized.length,
    extinguishedCount: extinguished.length,
    rekindledCount: foldedMatches.reduce(
      (count, { folded }) => count + folded.rekindledCount,
      0,
    ),
  };
}

function foldCampaignGrief(
  matches: readonly MatchRecord[],
): CampaignDebrief['grief'] {
  const incidents: GriefIncident[] = [];
  for (const match of matches) {
    for (const event of match.events) {
      if (event.t !== 'GRIEF_MOURNING') continue;
      incidents.push({
        pieceId: event.pieceId,
        mournedId: event.mournedId,
        cause: event.cause,
        weekOrMatch: event.weekOrMatch ?? match.matchIndex,
      });
    }
  }
  return { incidents };
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
  const judgementSeat = foldJudgementSeat(matches);
  const courage = foldCampaignCourage(matches);
  const hope = foldCampaignHope(matches);
  const grief = foldCampaignGrief(matches);
  return {
    campaignId,
    matches,
    cultureDrift,
    meanBoardQuality,
    meanExecutionFidelity,
    meanRealizedQuality,
    judgementSeat,
    courage,
    hope,
    grief,
    foldVersion: CULTURE_DRIFT_FOLD_VERSION,
    actTerminalState,
    transcript: foldCampaignTranscript(matches),
    commendations: foldPlayerCommendations(matches, act2Matches),
  };
}
