import type { CampaignMetrics, MatchMetrics } from './metrics';

export const EARLY_QUARTILE_COUNT = 2;
export const EARLY_SATURATION_RATE = 0.8;

export const DEGENERACY_CONFIG = {
  /** Pearson |r| above this indicates transcript-column collapse. */
  metricCorrelationThreshold: 0.95,
  /** Correlations need at least four matches to be meaningful. */
  metricCorrelationMinimumSamples: 4,
  /** Normalized movement required between redeemer trajectory bands. */
  learningDeltaThreshold: 0.02,
  /** Minimum seed matches before the weak counterfactual can report. */
  counterfactualMinimumMatches: 1,
} as const;

export interface DegeneracyFinding {
  readonly code: string;
  readonly message: string;
}

export interface DegeneracyAssertionOptions {
  readonly enforceEarlySaturation?: boolean;
  readonly matchedSkillWinScore?: number;
  readonly metricCorrelationThreshold?: number;
  readonly metricCorrelationMinimumSamples?: number;
  readonly learningDeltaThreshold?: number;
  readonly counterfactualMinimumMatches?: number;
  /**
   * Forward campaigns run on the same seed set. This is deliberately not the
   * ADR 0030 replay-based counterfactual: ReplayManifest is not wired yet.
   */
  readonly oracleCampaigns?: readonly CampaignMetrics[];
}

type TranscriptMetricKey =
  | 'refusalRate'
  | 'quietQuitRate'
  | 'refusedGoodMoveRate'
  | 'overrideRate'
  | 'meanTrustStart'
  | 'meanTrustEnd'
  | 'meanTauAbilStart'
  | 'meanTauAbilEnd'
  | 'meanTauBenevStart'
  | 'meanTauBenevEnd'
  | 'classContemptStart'
  | 'classContemptEnd'
  | 'survivingRosterSize'
  | 'winScore';

const TRANSCRIPT_METRICS: readonly TranscriptMetricKey[] = [
  'refusalRate',
  'quietQuitRate',
  'refusedGoodMoveRate',
  'overrideRate',
  'meanTrustStart',
  'meanTrustEnd',
  'meanTauAbilStart',
  'meanTauAbilEnd',
  'meanTauBenevStart',
  'meanTauBenevEnd',
  'classContemptStart',
  'classContemptEnd',
  'survivingRosterSize',
  'winScore',
];

function pearsonSquared(
  left: readonly number[],
  right: readonly number[],
): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = (left[index] ?? 0) - leftMean;
    const rightDelta = (right[index] ?? 0) - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  if (leftVariance === 0 || rightVariance === 0) return null;
  return (numerator * numerator) / (leftVariance * rightVariance);
}

function metricCollinearityFinding(
  metrics: readonly MatchMetrics[],
  threshold: number,
  minimumSamples: number,
): DegeneracyFinding | null {
  if (metrics.length < minimumSamples) return null;
  const correlated: string[] = [];
  for (
    let leftIndex = 0;
    leftIndex < TRANSCRIPT_METRICS.length;
    leftIndex += 1
  ) {
    const leftKey = TRANSCRIPT_METRICS[leftIndex];
    if (leftKey === undefined) continue;
    const leftValues = metrics.map((metric) => metric[leftKey]);
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < TRANSCRIPT_METRICS.length;
      rightIndex += 1
    ) {
      const rightKey = TRANSCRIPT_METRICS[rightIndex];
      if (rightKey === undefined) continue;
      const correlationSquared = pearsonSquared(
        leftValues,
        metrics.map((metric) => metric[rightKey]),
      );
      if (
        correlationSquared !== null &&
        correlationSquared > threshold * threshold
      ) {
        correlated.push(`${leftKey}/${rightKey}`);
      }
    }
  }
  if (correlated.length === 0) return null;
  return {
    code: 'metric-collinearity',
    message: `Transcript metrics are highly collinear (|r| > ${threshold.toFixed(2)}): ${correlated.join(', ')}.`,
  };
}

function normalizedLearningDelta(
  left: CampaignMetrics['trajectoryBands'][number],
  right: CampaignMetrics['trajectoryBands'][number],
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

function unmeasurableLearningFinding(
  leader: CampaignMetrics['leader'],
  metrics: readonly MatchMetrics[],
  summary: CampaignMetrics,
  threshold: number,
): DegeneracyFinding | null {
  const changedPolicy =
    leader === 'redeemer' ||
    metrics.some((metric) => metric.archetype === 'redeemer_arc');
  if (!changedPolicy) return null;
  const bands = summary.trajectoryBands.filter((band) => band.matches > 0);
  if (bands.length < 2) return null;
  let maximumMovement = 0;
  for (let index = 1; index < bands.length; index += 1) {
    const previous = bands[index - 1];
    const current = bands[index];
    if (previous !== undefined && current !== undefined) {
      maximumMovement = Math.max(
        maximumMovement,
        normalizedLearningDelta(previous, current),
      );
    }
  }
  if (maximumMovement > threshold) return null;
  return {
    code: 'unmeasurable-learning',
    message: `Redeemer policy changed between trajectory bands, but normalized learning movement stayed at ${maximumMovement.toFixed(3)} (threshold ${threshold.toFixed(3)}).`,
  };
}

function flatteringCounterfactualFinding(
  subject: CampaignMetrics,
  oracleCampaigns: readonly CampaignMetrics[],
  minimumMatches: number,
): DegeneracyFinding | null {
  if (oracleCampaigns.length === 0) return null;
  const subjectBySeed = new Map(
    subject.matchMetrics.map((metric) => [metric.seed, metric]),
  );
  let comparable = 0;
  let oracleOutperformed = false;
  for (const oracle of oracleCampaigns) {
    for (const metric of oracle.matchMetrics) {
      const subjectMetric = subjectBySeed.get(metric.seed);
      if (subjectMetric === undefined) continue;
      comparable += 1;
      if (metric.winScore > subjectMetric.winScore) oracleOutperformed = true;
    }
  }
  if (comparable < minimumMatches || oracleOutperformed) return null;
  return {
    code: 'flattering-counterfactual',
    message: `Seed-matched forward-comparison approximation is vacuous: no supplied oracle outperformed the subject on ${comparable} comparable seed${comparable === 1 ? '' : 's'}. This does not close ADR 0030's replay-based detector.`,
  };
}

export function detectDegeneracy(
  leader: CampaignMetrics['leader'],
  metrics: readonly MatchMetrics[],
  summary: CampaignMetrics,
  options: DegeneracyAssertionOptions = {},
): DegeneracyFinding[] {
  const findings: DegeneracyFinding[] = [];
  const config = {
    metricCorrelationThreshold:
      options.metricCorrelationThreshold ??
      DEGENERACY_CONFIG.metricCorrelationThreshold,
    metricCorrelationMinimumSamples:
      options.metricCorrelationMinimumSamples ??
      DEGENERACY_CONFIG.metricCorrelationMinimumSamples,
    learningDeltaThreshold:
      options.learningDeltaThreshold ??
      DEGENERACY_CONFIG.learningDeltaThreshold,
    counterfactualMinimumMatches:
      options.counterfactualMinimumMatches ??
      DEGENERACY_CONFIG.counterfactualMinimumMatches,
  };

  const collinearity = metricCollinearityFinding(
    metrics,
    config.metricCorrelationThreshold,
    config.metricCorrelationMinimumSamples,
  );
  if (collinearity !== null) findings.push(collinearity);

  const learning = unmeasurableLearningFinding(
    leader,
    metrics,
    summary,
    config.learningDeltaThreshold,
  );
  if (learning !== null) findings.push(learning);

  const counterfactual = flatteringCounterfactualFinding(
    summary,
    options.oracleCampaigns ?? [],
    config.counterfactualMinimumMatches,
  );
  if (counterfactual !== null) findings.push(counterfactual);

  if (leader === 'tyrannical' && summary.desertionCampaignRate < 0.2) {
    findings.push({
      code: 'no-rout',
      message:
        'Tyrannical leader desertion campaign rate below 20% — consequence layer may be inert.',
    });
  }
  if (leader === 'supportive' && summary.desertionCampaignRate > 0.5) {
    findings.push({
      code: 'supportive-rout',
      message: 'Supportive leader desertion campaign rate above 50%.',
    });
  }
  if (summary.meanRefusalRate < 0.001 && leader !== 'supportive') {
    findings.push({
      code: 'refusal-dead',
      message: 'Refusal rate near zero across the campaign.',
    });
  }
  if (
    summary.meanRefusedGoodMoveRate < 0.01 &&
    summary.meanRefusalRate > 0.05
  ) {
    findings.push({
      code: 'toothless-refusal',
      message: 'Refusals occur but refused-good-move rate is near zero.',
    });
  }
  if (
    leader === 'tyrannical' &&
    summary.meanOverrideRate < 0.01 &&
    summary.meanRefusalRate > 0.05
  ) {
    findings.push({
      code: 'override-inert',
      message:
        'Tyrannical leader has refusals but almost never overrides — override path may be mis-tuned.',
    });
  }

  const trustDeltas = metrics.map(
    (metric) => metric.meanTrustEnd - metric.meanTrustStart,
  );
  if (
    trustDeltas.length > 1 &&
    trustDeltas.every(
      (delta) => Math.sign(delta) === Math.sign(trustDeltas[0] ?? 0),
    )
  ) {
    findings.push({
      code: 'trust-monotonic',
      message: 'Trust moved monotonically across all matches in the campaign.',
    });
  }

  const matchedSkillWinScore = options.matchedSkillWinScore ?? 95;
  if (leader === 'supportive' && summary.meanWinScore >= matchedSkillWinScore) {
    findings.push({
      code: 'no-dilemma',
      message:
        'Supportive leader mean win score is too high — no morale/tactics tension.',
    });
  }

  for (const band of summary.trajectoryBands.slice(0, EARLY_QUARTILE_COUNT)) {
    if (
      band.matches > 0 &&
      band.desertionRate >= EARLY_SATURATION_RATE &&
      band.routRate >= EARLY_SATURATION_RATE
    ) {
      findings.push({
        code: 'early-saturation',
        message: `Quartile ${band.quartile} desertion and rout rates are both at least ${EARLY_SATURATION_RATE * 100}% — the campaign collapses too early.`,
      });
    }
  }

  return findings;
}

export function assertSmokeBounds(
  leader: CampaignMetrics['leader'],
  summary: CampaignMetrics,
  options: DegeneracyAssertionOptions = {},
): void {
  const findings = detectDegeneracy(
    leader,
    summary.matchMetrics,
    summary,
    options,
  );
  const hardFailureCodes = ['no-rout', 'refusal-dead', 'toothless-refusal'];
  if (options.enforceEarlySaturation) {
    hardFailureCodes.push('early-saturation');
  }
  const hardFailures = findings.filter((finding) =>
    hardFailureCodes.includes(finding.code),
  );
  if (hardFailures.length > 0) {
    throw new Error(
      `Degeneracy detected for ${leader}: ${hardFailures.map((finding) => finding.message).join(' ')}`,
    );
  }
}

export function assertCalibrationBounds(
  leader: CampaignMetrics['leader'],
  summary: CampaignMetrics,
): void {
  assertSmokeBounds(leader, summary, { enforceEarlySaturation: true });
}
