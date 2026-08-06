import { NARRATION_CONFIG } from './config';
import type { NarrationConfig } from './config';
import { sanitizeName } from './sanitize';
import type { DialogueTree } from './tree';
import type {
  AuditProse,
  CampaignTelemetry,
  DebriefProse,
  DepartureProjection,
  MatchOutcome,
  MatchTelemetry,
  PieceRef,
} from './types';

/**
 * Match audit and campaign debrief prose. Both are **pure folds over projections
 * of the event log** (there is no second source of truth to drift, ADR 0001 /
 * `docs/architecture.md` §4). Legibility of cause is mandatory (ADR 0018): every
 * departure names the player action behind it; strategy is never disclosed (D28).
 */

const OUTCOME_HEADLINE: Readonly<Record<MatchOutcome, string>> = {
  WIN: 'A win — and how it was won.',
  DRAW: 'A draw. Who held, and who drifted.',
  CHECKMATE: 'Checkmate. Outplayed, and the roster spent.',
  DISMISSAL: 'Dismissed. The room still wants the win — just not with you.',
  ROUT: 'A rout. They would rather lose than serve.',
};

function noun(tree: DialogueTree, ref: PieceRef): string {
  return tree.nounMap[ref.role];
}

function named(ref: PieceRef, config: NarrationConfig): string {
  return sanitizeName(ref.name, config.maxNameLength);
}

/**
 * Reconstruct the desertion cascade in ply order. A departure within
 * `cascadeWindowPlies` of the previous one is read as part of the same run
 * ("three more followed within two moves").
 */
function cascadeFindings(
  tree: DialogueTree,
  departures: readonly DepartureProjection[],
  config: NarrationConfig,
): string[] {
  if (departures.length === 0) return [];
  const ordered = [...departures].sort((a, b) => a.ply - b.ply);
  const findings: string[] = [];
  let index = 0;
  while (index < ordered.length) {
    const head = ordered[index];
    if (head === undefined) break;
    let runEnd = index;
    while (
      runEnd + 1 < ordered.length &&
      (ordered[runEnd + 1]?.ply ?? Infinity) - (ordered[runEnd]?.ply ?? 0) <=
        config.cascadeWindowPlies
    ) {
      runEnd += 1;
    }
    const followers = runEnd - index;
    const trigger =
      head.triggeredBy !== undefined
        ? ` after you spent ${named(head.triggeredBy, config)} the ${noun(
            tree,
            head.triggeredBy,
          )}`
        : '';
    let sentence = `${named(head.piece, config)} the ${noun(tree, head.piece)} walked at move ${head.ply}${trigger}.`;
    if (followers > 0) {
      const last = ordered[runEnd];
      const span = (last?.ply ?? head.ply) - head.ply;
      const moreWord = followers === 1 ? 'one more' : `${followers} more`;
      const moveWord = span === 1 ? 'move' : 'moves';
      sentence += ` Then ${moreWord} followed within ${span} ${moveWord}.`;
    }
    findings.push(sentence);
    index = runEnd + 1;
  }
  return findings;
}

export function matchAudit(
  tree: DialogueTree,
  telemetry: MatchTelemetry,
  config: NarrationConfig = NARRATION_CONFIG,
): AuditProse {
  const paragraphs: string[] = [];
  paragraphs.push(
    `The match ran ${telemetry.plies} plies and ended in ${describeOutcome(telemetry.outcome)}.`,
  );

  const gap = telemetry.boardQuality - telemetry.executionFidelity;
  const gapParagraph =
    gap >= 20
      ? `Your orders scored ${telemetry.boardQuality} for quality, but only ${telemetry.executionFidelity} of them were carried out. The plan was sound; the room did not follow it.`
      : gap <= -20
        ? `Your orders scored ${telemetry.boardQuality} for quality, yet ${telemetry.executionFidelity} were carried out — they executed better than you led.`
        : `Order quality was ${telemetry.boardQuality} and execution fidelity ${telemetry.executionFidelity}; the two moved together.`;
  paragraphs.push(gapParagraph);

  const findings: string[] = [];
  if (telemetry.overrides > 0) {
    const refusalWord = telemetry.overrides === 1 ? 'refusal' : 'refusals';
    findings.push(
      `You overrode ${telemetry.overrides} ${refusalWord} by force.`,
    );
  }
  findings.push(...cascadeFindings(tree, telemetry.departures, config));
  if (telemetry.departures.length === 0) {
    findings.push('Nobody left the board.');
  }

  return {
    headline: OUTCOME_HEADLINE[telemetry.outcome],
    paragraphs,
    findings,
  };
}

function describeOutcome(outcome: MatchOutcome): string {
  switch (outcome) {
    case 'WIN':
      return 'a win';
    case 'DRAW':
      return 'a draw';
    case 'CHECKMATE':
      return 'checkmate against you';
    case 'DISMISSAL':
      return 'your dismissal';
    case 'ROUT':
      return 'a rout';
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

function tally(
  matches: CampaignTelemetry['matches'],
): Record<MatchOutcome, number> {
  const counts: Record<MatchOutcome, number> = {
    WIN: 0,
    DRAW: 0,
    CHECKMATE: 0,
    DISMISSAL: 0,
    ROUT: 0,
  };
  for (const match of matches) counts[match.outcome] += 1;
  return counts;
}

export function campaignDebrief(
  tree: DialogueTree,
  telemetry: CampaignTelemetry,
  config: NarrationConfig = NARRATION_CONFIG,
): DebriefProse {
  const leader = sanitizeName(telemetry.leaderName, config.maxNameLength);
  const counts = tally(telemetry.matches);
  const paragraphs: string[] = [];
  paragraphs.push(
    `Across ${telemetry.matches.length} matches under ${leader}: ${counts.WIN} won, ${counts.DRAW} drawn, ${counts.CHECKMATE} lost outright, ${counts.DISMISSAL} ended in dismissal, ${counts.ROUT} in rout.`,
  );

  const first = telemetry.matches[0];
  const last = telemetry.matches[telemetry.matches.length - 1];
  if (
    first !== undefined &&
    last !== undefined &&
    telemetry.matches.length > 1
  ) {
    const drift = last.executionFidelity - first.executionFidelity;
    const direction = drift > 0 ? 'rose' : drift < 0 ? 'fell' : 'held';
    paragraphs.push(
      `Execution fidelity ${direction} from ${first.executionFidelity} to ${last.executionFidelity} across the campaign — how much of what you ordered actually happened.`,
    );
  }

  const findings: string[] = [];
  for (const retiree of telemetry.retirements) {
    findings.push(
      `${sanitizeName(retiree.name, config.maxNameLength)} the ${tree.nounMap[retiree.role]} retired from the world for good.`,
    );
  }
  if (telemetry.retirements.length === 0) {
    findings.push('No one was worn past the point of return.');
  }

  return {
    headline: `The command of ${leader}, in the round.`,
    paragraphs,
    findings,
  };
}
