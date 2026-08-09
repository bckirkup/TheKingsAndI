import type { MatchRecord } from './types';
import { LEARNING_DELTA_FOLD_VERSION } from './types';

export { LEARNING_DELTA_FOLD_VERSION };

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function overrideRate(matches: readonly MatchRecord[]): number {
  let overrides = 0;
  let refusals = 0;
  for (const match of matches) {
    overrides += match.audit.overrideCount;
    refusals += match.audit.refusalCount;
  }
  const denom = overrides + refusals;
  return denom === 0 ? 0 : overrides / denom;
}

function concessionQuality(matches: readonly MatchRecord[]): number {
  let qualitySum = 0;
  let count = 0;
  for (const match of matches) {
    for (const event of match.events) {
      if (event.t !== 'REFUSAL') continue;
      qualitySum += event.perceivedValue;
      count += 1;
    }
  }
  return count === 0 ? 0 : qualitySum / count;
}

function meanBenevolence(matches: readonly MatchRecord[]): number {
  const ends = matches.flatMap((match) =>
    match.rosterEnd
      .filter((piece) => piece.status === 'ACTIVE')
      .map((piece) => piece.credence.tauBenev),
  );
  return mean(ends);
}

function meanFidelity(matches: readonly MatchRecord[]): number {
  return mean(matches.map((match) => match.audit.executionFidelity));
}

function meanBoardQuality(matches: readonly MatchRecord[]): number {
  return mean(matches.map((match) => match.audit.boardQuality));
}

/**
 * ADR 0030 §4 / 5.8q — learning delta across acts.
 * Positive values mean act 2 improved on the measured behaviour.
 */
export interface LearningDelta {
  readonly foldVersion: string;
  readonly overrideRateDelta: number;
  readonly concessionQualityDelta: number;
  readonly benevolenceRecovery: number;
  /** Fidelity change after subtracting board-quality change (normalized). */
  readonly fidelityIndependentOfQuality: number;
  /** Max absolute normalized component — shared with harness detectors. */
  readonly composite: number;
}

export function foldLearningDelta(
  act1Matches: readonly MatchRecord[],
  act2Matches: readonly MatchRecord[],
): LearningDelta {
  const overrideRateDelta =
    overrideRate(act2Matches) - overrideRate(act1Matches);
  const concessionQualityDelta =
    concessionQuality(act2Matches) - concessionQuality(act1Matches);
  const benevolenceRecovery =
    (meanBenevolence(act2Matches) - meanBenevolence(act1Matches)) / 100;
  const fidelityDelta = meanFidelity(act2Matches) - meanFidelity(act1Matches);
  const qualityDelta =
    (meanBoardQuality(act2Matches) - meanBoardQuality(act1Matches)) / 100;
  const fidelityIndependentOfQuality = fidelityDelta - qualityDelta;

  const components = [
    Math.abs(overrideRateDelta),
    Math.abs(concessionQualityDelta),
    Math.abs(benevolenceRecovery),
    Math.abs(fidelityIndependentOfQuality),
  ];

  return {
    foldVersion: LEARNING_DELTA_FOLD_VERSION,
    overrideRateDelta,
    concessionQualityDelta,
    benevolenceRecovery,
    fidelityIndependentOfQuality,
    composite: Math.max(0, ...components),
  };
}

/** Normalize a single-campaign band movement into the same composite space. */
export function normalizeBandLearningDelta(
  left: {
    readonly meanTauAbil: number;
    readonly meanTauBenev: number;
    readonly meanRefusalRate: number;
    readonly desertionRate: number;
    readonly routRate: number;
    readonly meanSurvivingRosterSize: number;
  },
  right: {
    readonly meanTauAbil: number;
    readonly meanTauBenev: number;
    readonly meanRefusalRate: number;
    readonly desertionRate: number;
    readonly routRate: number;
    readonly meanSurvivingRosterSize: number;
  },
): number {
  const deltas = [
    Math.abs(right.meanTauAbil - left.meanTauAbil) / 100,
    Math.abs(right.meanTauBenev - left.meanTauBenev) / 100,
    Math.abs(right.meanRefusalRate - left.meanRefusalRate),
    Math.abs(right.desertionRate - left.desertionRate),
    Math.abs(right.routRate - left.routRate),
    Math.abs(right.meanSurvivingRosterSize - left.meanSurvivingRosterSize) / 16,
  ];
  return Math.max(...deltas);
}
