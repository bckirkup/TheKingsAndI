import type { CampaignMetrics, MatchMetrics } from './metrics';
import type { PoolSeasonMetrics } from './pool';
import {
  COMMENDATION_CONFIG,
  PUBLIC_REGISTER_COLUMNS,
  type PlayerCommendationId,
  type PlayerCommendationSet,
  type PublicRegister,
  type CommendationVerdictStability,
} from '../src/persistence';
import {
  evaluateConsumerPacing,
  PACING_CONFIG,
} from '../src/orchestration/pacingConfig';
import { normalizeBandLearningDelta } from '../src/persistence/learningDelta';

export const EARLY_QUARTILE_COUNT = 2;

export const DEGENERACY_CONFIG = {
  /** Pearson |r| above this indicates transcript-column collapse. */
  metricCorrelationThreshold: 0.95,
  /** Correlations need at least four matches to be meaningful. */
  metricCorrelationMinimumSamples: 4,
  /** Normalized movement required between redeemer trajectory bands. */
  learningDeltaThreshold: 0.02,
  /** Minimum seed matches before the weak counterfactual can report. */
  counterfactualMinimumMatches: 1,
  /** Fraction of awards one policy may earn before dominating-strategy fires. */
  dominatingAwardFraction: COMMENDATION_CONFIG.DOMINATING_AWARD_FRACTION,
  /** Minimum attrition proving that a tyrant loses at least one piece. */
  noRoutAttritionThreshold: 0.05,
  /** Attrition above this means a supportive leader routs too often. */
  supportiveRoutAttritionThreshold: 0.5,
  /** Early-quartile attrition above this is campaign saturation. */
  earlySaturationAttritionThreshold: 0.8,
  /** Early-quartile rout rate above this is campaign saturation. */
  earlySaturationRoutThreshold: 0.8,
  /** Bounded refusal rate below this means refusals are inert. */
  refusalDeadRateThreshold: 0.001,
  /** Bounded refusal rate above this makes refused-good detection meaningful. */
  toothlessRefusalRateThreshold: 0.05,
  /** Bounded refusal rate above this makes override detection meaningful. */
  overrideInertRefusalRateThreshold: 0.05,
  /** Crowned selection below this means elevation is a trap. */
  promotionTrapSelectionRateThreshold: 0.01,
  /** Require more than one promotion window before declaring a trap. */
  promotionTrapMinimumPromotions: 2,
  /** Crowned selection below this share of control indicates a trap. */
  promotionTrapControlRatioThreshold: 0.5,
  /** Churn below this means a deep bench is frozen. */
  frozenBenchChurnThreshold: 0.001,
  /** Fraction of careers stable before the final third before liveness fires. */
  commendationLivenessFraction: 0.75,
  /** Minimum careers needed before an award liveness claim is meaningful. */
  commendationLivenessMinimumCareers: 4,
  /** Absolute signed correlation above this indicates register capture. */
  registerCorrelationThreshold: 0.8,
  /** Minimum careers needed before a register correlation is meaningful. */
  registerCorrelationMinimumCareers: 5,
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
  readonly noRoutAttritionThreshold?: number;
  readonly supportiveRoutAttritionThreshold?: number;
  readonly earlySaturationAttritionThreshold?: number;
  readonly earlySaturationRoutThreshold?: number;
  readonly refusalDeadRateThreshold?: number;
  readonly toothlessRefusalRateThreshold?: number;
  readonly overrideInertRefusalRateThreshold?: number;
  readonly poolMetrics?: PoolSeasonMetrics;
  readonly promotionTrapSelectionRateThreshold?: number;
  readonly promotionTrapMinimumPromotions?: number;
  readonly promotionTrapControlRatioThreshold?: number;
  readonly frozenBenchChurnThreshold?: number;
  readonly commendationLivenessFraction?: number;
  readonly commendationLivenessMinimumCareers?: number;
  readonly registerCorrelationThreshold?: number;
  readonly registerCorrelationMinimumCareers?: number;
  /**
   * Forward campaigns run on the same seed set. This is deliberately not the
   * ADR 0030 replay-based counterfactual: ReplayManifest is not wired yet.
   */
  readonly oracleCampaigns?: readonly CampaignMetrics[];
  /** Per-oracle commendation sets for non-domination checks (ADR 0031). */
  readonly oracleCommendations?: readonly {
    readonly leader: string;
    readonly commendations: PlayerCommendationSet;
  }[];
  /** Per-career verdict stability prefixes for the dead-by-match-two detector. */
  readonly oracleCommendationLiveness?: readonly {
    readonly leader: string;
    readonly cycleMatches: number;
    readonly verdictStability: CommendationVerdictStability;
  }[];
  /** Per-career public registers and sealed commendations for orthogonality. */
  readonly oracleRegisterCommendations?: readonly {
    readonly leader: string;
    readonly register: PublicRegister;
    readonly commendations: PlayerCommendationSet;
  }[];
  /** Student-facing strings scanned for live commendation leakage (D93). */
  readonly studentFacingStrings?: readonly string[];
  /** Match audits for the consumer pacing cliff detector (5.8i). */
  readonly pacingMatches?: readonly {
    readonly matchIndex: number;
    readonly audit: {
      readonly refusalCount: number;
      readonly overrideCount: number;
      readonly desertionCount: number;
      readonly meanTrustDelta: number;
      readonly boardQuality: number;
      readonly executionFidelity: number;
    };
  }[];
  /** True when enemy psych never produced an observable behaviour. */
  readonly enemyBehaviourCount?: number;
  /** True when any enemy private field leaked to player-facing surfaces. */
  readonly enemyPsychLeak?: boolean;
  /** True when difficulty changed engine depth rather than leader policy. */
  readonly difficultyChangedDepth?: boolean;
  /** Dismissal occurred while mean roster trust remained high (McClellan). */
  readonly dismissalWithHighMandate?: boolean;
}

export function detectPoolDegeneracy(
  poolMetrics: PoolSeasonMetrics,
  options: {
    readonly promotionTrapSelectionRateThreshold?: number;
    readonly promotionTrapMinimumPromotions?: number;
    readonly promotionTrapControlRatioThreshold?: number;
    readonly frozenBenchChurnThreshold?: number;
  } = {},
): DegeneracyFinding[] {
  const findings: DegeneracyFinding[] = [];
  const trapThreshold =
    options.promotionTrapSelectionRateThreshold ??
    DEGENERACY_CONFIG.promotionTrapSelectionRateThreshold;
  const frozenThreshold =
    options.frozenBenchChurnThreshold ??
    DEGENERACY_CONFIG.frozenBenchChurnThreshold;
  const minimumPromotions =
    options.promotionTrapMinimumPromotions ??
    DEGENERACY_CONFIG.promotionTrapMinimumPromotions;
  const controlRatioThreshold =
    options.promotionTrapControlRatioThreshold ??
    DEGENERACY_CONFIG.promotionTrapControlRatioThreshold;
  if (
    poolMetrics.promotionsWithRemainingWindow > 0 &&
    poolMetrics.crownedNeverFieldedAgain ===
      poolMetrics.promotionsWithRemainingWindow
  ) {
    findings.push({
      code: 'promotion-decoration',
      message: 'Promotions occurred, but no crowned piece was fielded again.',
    });
  }
  if (
    poolMetrics.promotionsWithRemainingWindow >= minimumPromotions &&
    (poolMetrics.crownedSelectionRate <= trapThreshold ||
      (poolMetrics.unpromotedOriginControlRate > 0 &&
        poolMetrics.crownedSelectionRate <
          poolMetrics.unpromotedOriginControlRate * controlRatioThreshold))
  ) {
    findings.push({
      code: 'promotion-trap',
      message: `Crowned-piece selection rate stayed at ${poolMetrics.crownedSelectionRate.toFixed(3)} across the season.`,
    });
  }
  if (
    poolMetrics.squadSize > 16 &&
    poolMetrics.meanLineupChurn <= frozenThreshold
  ) {
    findings.push({
      code: 'frozen-bench',
      message:
        'A deep squad fielded the same lineup every match under a rotating pool policy.',
    });
  }
  if (poolMetrics.firstCycleLevies > 0) {
    findings.push({
      code: 'cycle-one-unplayability',
      message: `The first cycle required ${poolMetrics.firstCycleLevies} green levy member(s) to fill the legal army.`,
    });
  }
  return findings;
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

export function pearsonCorrelation(
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
  return numerator / Math.sqrt(leftVariance * rightVariance);
}

function pearsonSquared(
  left: readonly number[],
  right: readonly number[],
): number | null {
  const correlation = pearsonCorrelation(left, right);
  return correlation === null ? null : correlation * correlation;
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
  return normalizeBandLearningDelta(left, right);
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
    noRoutAttritionThreshold:
      options.noRoutAttritionThreshold ??
      DEGENERACY_CONFIG.noRoutAttritionThreshold,
    supportiveRoutAttritionThreshold:
      options.supportiveRoutAttritionThreshold ??
      DEGENERACY_CONFIG.supportiveRoutAttritionThreshold,
    earlySaturationAttritionThreshold:
      options.earlySaturationAttritionThreshold ??
      DEGENERACY_CONFIG.earlySaturationAttritionThreshold,
    earlySaturationRoutThreshold:
      options.earlySaturationRoutThreshold ??
      DEGENERACY_CONFIG.earlySaturationRoutThreshold,
    refusalDeadRateThreshold:
      options.refusalDeadRateThreshold ??
      DEGENERACY_CONFIG.refusalDeadRateThreshold,
    toothlessRefusalRateThreshold:
      options.toothlessRefusalRateThreshold ??
      DEGENERACY_CONFIG.toothlessRefusalRateThreshold,
    overrideInertRefusalRateThreshold:
      options.overrideInertRefusalRateThreshold ??
      DEGENERACY_CONFIG.overrideInertRefusalRateThreshold,
    promotionTrapSelectionRateThreshold:
      options.promotionTrapSelectionRateThreshold ??
      DEGENERACY_CONFIG.promotionTrapSelectionRateThreshold,
    promotionTrapMinimumPromotions:
      options.promotionTrapMinimumPromotions ??
      DEGENERACY_CONFIG.promotionTrapMinimumPromotions,
    promotionTrapControlRatioThreshold:
      options.promotionTrapControlRatioThreshold ??
      DEGENERACY_CONFIG.promotionTrapControlRatioThreshold,
    frozenBenchChurnThreshold:
      options.frozenBenchChurnThreshold ??
      DEGENERACY_CONFIG.frozenBenchChurnThreshold,
    commendationLivenessFraction:
      options.commendationLivenessFraction ??
      DEGENERACY_CONFIG.commendationLivenessFraction,
    commendationLivenessMinimumCareers:
      options.commendationLivenessMinimumCareers ??
      DEGENERACY_CONFIG.commendationLivenessMinimumCareers,
    registerCorrelationThreshold:
      options.registerCorrelationThreshold ??
      DEGENERACY_CONFIG.registerCorrelationThreshold,
    registerCorrelationMinimumCareers:
      options.registerCorrelationMinimumCareers ??
      DEGENERACY_CONFIG.registerCorrelationMinimumCareers,
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

  if (
    leader === 'tyrannical' &&
    summary.desertionAttrition < config.noRoutAttritionThreshold
  ) {
    findings.push({
      code: 'no-rout',
      message: `Tyrannical leader did not lose a piece — consequence layer may be inert.`,
    });
  }
  if (
    leader === 'supportive' &&
    summary.desertionAttrition > config.supportiveRoutAttritionThreshold
  ) {
    findings.push({
      code: 'supportive-rout',
      message: `Supportive leader desertion attrition above ${config.supportiveRoutAttritionThreshold * 100}%.`,
    });
  }
  if (
    summary.meanRefusalRate < config.refusalDeadRateThreshold &&
    leader !== 'supportive'
  ) {
    findings.push({
      code: 'refusal-dead',
      message: 'Refusal rate near zero across the campaign.',
    });
  }
  if (
    summary.meanRefusedGoodMoveRate < 0.01 &&
    summary.meanRefusalRate > config.toothlessRefusalRateThreshold
  ) {
    findings.push({
      code: 'toothless-refusal',
      message: 'Refusals occur but refused-good-move rate is near zero.',
    });
  }
  if (
    leader === 'tyrannical' &&
    summary.meanOverrideRate < 0.01 &&
    summary.meanRefusalRate > config.overrideInertRefusalRateThreshold
  ) {
    findings.push({
      code: 'override-inert',
      message:
        'Tyrannical leader has refusals but almost never overrides — override path may be mis-tuned.',
    });
  }

  if (options.poolMetrics !== undefined) {
    findings.push(
      ...detectPoolDegeneracy(options.poolMetrics, {
        promotionTrapSelectionRateThreshold:
          config.promotionTrapSelectionRateThreshold,
        promotionTrapMinimumPromotions: config.promotionTrapMinimumPromotions,
        promotionTrapControlRatioThreshold:
          config.promotionTrapControlRatioThreshold,
        frozenBenchChurnThreshold: config.frozenBenchChurnThreshold,
      }),
    );
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
      band.desertionAttrition >= config.earlySaturationAttritionThreshold &&
      band.routRate >= config.earlySaturationRoutThreshold
    ) {
      findings.push({
        code: 'early-saturation',
        message: `Quartile ${band.quartile} desertion attrition and rout rates are both at least ${config.earlySaturationAttritionThreshold * 100}% — the campaign collapses too early.`,
      });
    }
  }

  const dominating = dominatingStrategyFinding(
    options.oracleCommendations ?? [],
  );
  if (dominating !== null) findings.push(dominating);

  const leakage = commendationLeakageFinding(
    options.studentFacingStrings ?? [],
  );
  if (leakage !== null) findings.push(leakage);

  const unwinnable = unwinnableAwardFinding(options.oracleCommendations ?? []);
  if (unwinnable !== null) findings.push(unwinnable);

  findings.push(
    ...commendationLivenessFindings(
      options.oracleCommendationLiveness ?? [],
      config.commendationLivenessFraction,
      config.commendationLivenessMinimumCareers,
    ),
  );

  findings.push(
    ...registerOrthogonalityFindings(
      options.oracleRegisterCommendations ?? [],
      config.registerCorrelationThreshold,
      config.registerCorrelationMinimumCareers,
    ),
  );

  if (options.pacingMatches !== undefined) {
    const pacing = evaluateConsumerPacing(options.pacingMatches);
    if (pacing.cliff) {
      findings.push({
        code: 'ninety-minute-cliff',
        message: `Consumer pacing profile missed a leadership beat inside the first ${PACING_CONFIG.CONSUMER_WINDOW_MINUTES} minutes.`,
      });
    }
  }

  if (options.enemyBehaviourCount === 0) {
    findings.push({
      code: 'inert-opposition',
      message:
        'Enemy morale never produced an observable behaviour — opposing psychology is decoration.',
    });
  }

  if (options.enemyPsychLeak === true) {
    findings.push({
      code: 'telepathy',
      message:
        'Enemy psychological state reached a player-facing surface (ADR 0025).',
    });
  }

  if (options.difficultyChangedDepth === true) {
    findings.push({
      code: 'difficulty-by-depth',
      message:
        'Difficulty scaled engine depth rather than opposing leader policy (ADR 0025 / D67).',
    });
  }

  if (options.dismissalWithHighMandate === false) {
    findings.push({
      code: 'no-mcclellan',
      message:
        'Dismissal never occurred while roster mandate was high — King results channel inert (ADR 0024).',
    });
  }

  return findings;
}

function dominatingStrategyFinding(
  oracleCommendations: readonly {
    readonly leader: string;
    readonly commendations: PlayerCommendationSet;
  }[],
): DegeneracyFinding | null {
  if (oracleCommendations.length === 0) return null;
  const totalAwards = 8;
  for (const entry of oracleCommendations) {
    const fraction = entry.commendations.earnedIds.length / totalAwards;
    if (fraction >= DEGENERACY_CONFIG.dominatingAwardFraction) {
      return {
        code: 'dominating-strategy',
        message: `${entry.leader} earned ${entry.commendations.earnedIds.length}/${totalAwards} commendations — awards collapsed into one score.`,
      };
    }
  }
  return null;
}

function commendationLeakageFinding(
  studentFacingStrings: readonly string[],
): DegeneracyFinding | null {
  const banned = [
    'evenness of attention',
    'nobody drowned',
    'best of the best',
    'overall improvement',
    'commendation',
  ];
  for (const text of studentFacingStrings) {
    const lower = text.toLowerCase();
    for (const phrase of banned) {
      if (lower.includes(phrase)) {
        return {
          code: 'commendation-leakage',
          message: `Student-facing surface mentions "${phrase}" during play (D93).`,
        };
      }
    }
  }
  return null;
}

function unwinnableAwardFinding(
  oracleCommendations: readonly {
    readonly leader: string;
    readonly commendations: PlayerCommendationSet;
  }[],
): DegeneracyFinding | null {
  if (oracleCommendations.length < 2) return null;
  const awardIds: PlayerCommendationId[] = [
    'evenness_of_attention',
    'best_of_the_best',
    'nobody_drowned',
    'overcoming_a_weakness',
    'grit_and_endurance',
    'overall_improvement',
    'honest_sacrifice',
    'repaired_breach',
  ];
  for (const id of awardIds) {
    const earners = oracleCommendations.filter((entry) =>
      entry.commendations.earnedIds.includes(id),
    );
    if (earners.length === 0) {
      return {
        code: 'unwinnable-award',
        message: `Commendation ${id} was never earned by any oracle policy.`,
      };
    }
    if (earners.length === oracleCommendations.length) {
      return {
        code: 'unwinnable-award',
        message: `Commendation ${id} was earned by every oracle — dead content.`,
      };
    }
  }
  return null;
}

function commendationLivenessFindings(
  careers: readonly {
    readonly leader: string;
    readonly cycleMatches: number;
    readonly verdictStability: CommendationVerdictStability;
  }[],
  fractionThreshold: number,
  minimumCareers: number,
): DegeneracyFinding[] {
  if (careers.length < minimumCareers) return [];
  const awardIds: readonly PlayerCommendationId[] = [
    'evenness_of_attention',
    'best_of_the_best',
    'nobody_drowned',
    'overcoming_a_weakness',
    'grit_and_endurance',
    'overall_improvement',
    'honest_sacrifice',
    'repaired_breach',
  ];
  const findings: DegeneracyFinding[] = [];
  for (const id of awardIds) {
    const measured = careers.filter(
      (career) =>
        career.cycleMatches > 0 && career.verdictStability[id] !== undefined,
    );
    if (measured.length < minimumCareers) continue;
    const early = measured.filter((career) => {
      const finalThirdStart = Math.ceil((career.cycleMatches * 2) / 3);
      return career.verdictStability[id] < finalThirdStart;
    }).length;
    const fraction = early / measured.length;
    if (fraction <= fractionThreshold) continue;
    findings.push({
      code: 'commendation-dead-by-match-two',
      message: `Commendation ${id} was verdict-stable before the final third in ${(fraction * 100).toFixed(0)}% of careers.`,
    });
  }
  return findings;
}

function registerOrthogonalityFindings(
  entries: readonly {
    readonly leader: string;
    readonly register: PublicRegister;
    readonly commendations: PlayerCommendationSet;
  }[],
  threshold: number,
  minimumCareers: number,
): DegeneracyFinding[] {
  if (entries.length < minimumCareers) return [];
  const findings: DegeneracyFinding[] = [];
  const awardIds: readonly PlayerCommendationId[] = [
    'evenness_of_attention',
    'best_of_the_best',
    'nobody_drowned',
    'overcoming_a_weakness',
    'grit_and_endurance',
    'overall_improvement',
    'honest_sacrifice',
    'repaired_breach',
  ];
  for (const awardId of awardIds) {
    const scores = new Map(
      entries.flatMap((entry) => {
        const award = entry.commendations.awards.find(
          (candidate) => candidate.id === awardId,
        );
        return award === undefined ? [] : [[entry, award.score] as const];
      }),
    );
    for (const column of PUBLIC_REGISTER_COLUMNS) {
      const rows = [...scores.entries()];
      if (rows.length < minimumCareers) continue;
      const correlation = pearsonCorrelation(
        rows.map(([, score]) => score),
        rows.map(([entry]) => entry.register[column]),
      );
      if (correlation === null || Math.abs(correlation) <= threshold) {
        continue;
      }
      findings.push({
        code:
          correlation > 0 ? 'register-mirroring' : 'register-anti-correlation',
        message: `Commendation ${awardId} has signed correlation ${correlation.toFixed(2)} with public ${column}.`,
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
