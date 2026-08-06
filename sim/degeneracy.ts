import type { CampaignMetrics, MatchMetrics } from './metrics';

export interface DegeneracyFinding {
  readonly code: string;
  readonly message: string;
}

export function detectDegeneracy(
  leader: CampaignMetrics['leader'],
  metrics: readonly MatchMetrics[],
  summary: CampaignMetrics,
): DegeneracyFinding[] {
  const findings: DegeneracyFinding[] = [];

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

  if (leader === 'supportive' && summary.meanWinScore >= 95) {
    findings.push({
      code: 'no-dilemma',
      message:
        'Supportive leader mean win score is too high — no morale/tactics tension.',
    });
  }

  return findings;
}

export function assertSmokeBounds(
  leader: CampaignMetrics['leader'],
  summary: CampaignMetrics,
): void {
  const findings = detectDegeneracy(leader, summary.matchMetrics, summary);
  const hardFailures = findings.filter((finding) =>
    ['no-rout', 'refusal-dead', 'toothless-refusal'].includes(finding.code),
  );
  if (hardFailures.length > 0) {
    throw new Error(
      `Degeneracy detected for ${leader}: ${hardFailures.map((finding) => finding.message).join(' ')}`,
    );
  }
}
