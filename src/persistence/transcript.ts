import type { MatchEvent } from '../psychology';

import type { CampaignTranscript, MatchRecord } from './types';
import { TRANSCRIPT_FOLD_VERSION } from './types';

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Gini coefficient over non-negative values (0 = equal, 1 = concentrated). */
export function giniCoefficient(values: readonly number[]): number {
  const sorted = [...values]
    .filter((value) => value >= 0)
    .sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  let weighted = 0;
  for (let index = 0; index < n; index += 1) {
    const value = sorted[index] ?? 0;
    weighted += (2 * (index + 1) - n - 1) * value;
  }
  return weighted / (n * total);
}

function countEvents(
  matches: readonly MatchRecord[],
  kind: MatchEvent['t'],
): number {
  return matches.reduce(
    (sum, match) =>
      sum + match.events.filter((event) => event.t === kind).length,
    0,
  );
}

function concessionCount(matches: readonly MatchRecord[]): number {
  let count = 0;
  for (const match of matches) {
    for (const event of match.events) {
      if (event.t !== 'REFUSAL') continue;
      if (event.perceivedValue >= 0.6) count += 1;
    }
  }
  return count;
}

function channelTrajectories(matches: readonly MatchRecord[]): {
  readonly tauAbil: number[];
  readonly tauBenev: number[];
} {
  const tauAbil: number[] = [];
  const tauBenev: number[] = [];
  for (const match of matches) {
    const active = match.rosterEnd.filter((piece) => piece.status === 'ACTIVE');
    if (active.length === 0) continue;
    tauAbil.push(mean(active.map((piece) => piece.credence.tauAbil)));
    tauBenev.push(mean(active.map((piece) => piece.credence.tauBenev)));
  }
  return { tauAbil, tauBenev };
}

/** ADR 0030 transcript — pure folds over the event log. */
export function foldCampaignTranscript(
  matches: readonly MatchRecord[],
): CampaignTranscript {
  const meanBoardQuality = mean(
    matches.map((match) => match.audit.boardQuality),
  );
  const meanExecutionFidelity = mean(
    matches.map((match) => match.audit.executionFidelity),
  );
  const channels = channelTrajectories(matches);
  const traumaValues = matches.flatMap((match) =>
    match.rosterEnd.map((piece) => piece.B_i),
  );
  const overrideLedger = matches.flatMap((match) =>
    match.events
      .filter((event) => event.t === 'OVERRIDE')
      .map((event) => ({
        ply: event.ply,
        pieceId: event.pieceId,
        san: event.san,
        trustDelta: event.pieceTrustDelta,
      })),
  );

  return {
    foldVersion: TRANSCRIPT_FOLD_VERSION,
    meanBoardQuality,
    meanExecutionFidelity,
    qualityGap: meanBoardQuality - meanExecutionFidelity * 100,
    tauAbilTrajectory: channels.tauAbil,
    tauBenevTrajectory: channels.tauBenev,
    overrideLedger,
    concessionCount: concessionCount(matches),
    traumaGini: giniCoefficient(traumaValues),
    attrition: {
      desertions: countEvents(matches, 'DESERTION'),
      refusals: countEvents(matches, 'REFUSAL'),
      firings: countEvents(matches, 'ROSTER_FIRE'),
    },
  };
}
