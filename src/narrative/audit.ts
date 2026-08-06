import { credenceBand } from './authoredProvider';
import type { MatchEvent, PieceRole } from '../psychology';

/**
 * Match-audit and campaign-debrief prose (Milestone 6.4). Both are pure folds
 * over projections of the event log — audits and debriefs are folds, never a
 * second source of truth (`docs/architecture.md` §4). Legibility of cause is
 * mandatory (ADR 0018): every departure names the action behind it; strategy is
 * never disclosed (D28). Prose is presentation only and never re-enters state.
 *
 * These are deterministic by construction (no RNG): the same projection yields
 * the same prose, so a replay reproduces the debrief.
 */

export type NarratedOutcome =
  | 'WIN'
  | 'LOSS'
  | 'DRAW'
  | 'ROUT'
  | 'DISMISSED'
  | 'ABANDONED';

export interface AuditProse {
  readonly headline: string;
  readonly paragraphs: readonly string[];
  readonly findings: readonly string[];
}

export type DebriefProse = AuditProse;

export interface MatchProseInput {
  readonly result: NarratedOutcome;
  /** Mean cp quality of the orders issued (ADR 0022 §5). */
  readonly boardQuality: number;
  /** Share of orders carried out faithfully, 0..1. */
  readonly executionFidelity: number;
  readonly overrideCount: number;
  readonly desertionCount: number;
  readonly refusalCount: number;
  readonly events: readonly MatchEvent[];
  /** Role for each piece id, for role-abstract naming. */
  readonly roleOf: Readonly<Record<string, PieceRole>>;
}

export interface AuditProseConfig {
  /** A departure this many plies after the previous one joins the same run. */
  readonly cascadeWindowPlies: number;
  /** Board-vs-execution gap (cp) beyond which the diagnosis is called out. */
  readonly gapThresholdCp: number;
}

export const AUDIT_PROSE_CONFIG: AuditProseConfig = {
  cascadeWindowPlies: 4,
  gapThresholdCp: 20,
};

const ROLE_NOUN: Readonly<Record<PieceRole, string>> = {
  Pawn: 'pawn',
  Knight: 'knight',
  Bishop: 'bishop',
  Rook: 'rook',
  Queen: 'queen',
  King: 'king',
};

const OUTCOME_HEADLINE: Readonly<Record<NarratedOutcome, string>> = {
  WIN: 'A win — and how it was won.',
  LOSS: 'Checkmate. Outplayed, and the roster spent.',
  DRAW: 'A draw. Who held, and who drifted.',
  ROUT: 'A rout. They would rather lose than serve.',
  DISMISSED: 'Dismissed. They still want the win — just not with you.',
  ABANDONED: 'Abandoned. The match was left unfinished.',
};

const OUTCOME_CLAUSE: Readonly<Record<NarratedOutcome, string>> = {
  WIN: 'a win',
  LOSS: 'checkmate against you',
  DRAW: 'a draw',
  ROUT: 'a rout',
  DISMISSED: 'your dismissal',
  ABANDONED: 'an abandoned match',
};

function noun(role: PieceRole | undefined): string {
  return role === undefined ? 'piece' : ROLE_NOUN[role];
}

function eventPly(event: MatchEvent): number | null {
  return 'ply' in event ? event.ply : null;
}

function maxPly(events: readonly MatchEvent[]): number {
  let max = 0;
  for (const event of events) {
    const ply = eventPly(event);
    if (ply !== null && ply > max) max = ply;
  }
  return max;
}

interface Departure {
  readonly ply: number;
  readonly pieceId: string;
}

function departures(events: readonly MatchEvent[]): Departure[] {
  return events
    .filter(
      (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
        event.t === 'DESERTION',
    )
    .map((event) => ({ ply: event.ply, pieceId: event.pieceId }))
    .sort((a, b) => a.ply - b.ply);
}

/**
 * Name the action behind a departure (ADR 0018). Prefers a forced override of
 * the same piece, then a nearby capture, so the player can act on the cause.
 */
function triggerClause(
  head: Departure,
  events: readonly MatchEvent[],
  roleOf: MatchProseInput['roleOf'],
  window: number,
): string {
  const forced = events.some(
    (event) =>
      event.t === 'OVERRIDE' &&
      event.pieceId === head.pieceId &&
      event.ply <= head.ply &&
      head.ply - event.ply <= window,
  );
  if (forced) return ' after you forced its hand';
  const capture = events
    .filter(
      (event): event is Extract<MatchEvent, { t: 'CAPTURE' }> =>
        event.t === 'CAPTURE',
    )
    .filter((event) => event.ply <= head.ply && head.ply - event.ply <= window)
    .sort((a, b) => b.ply - a.ply)[0];
  if (capture !== undefined) {
    return ` after the ${noun(roleOf[capture.victim])} was taken`;
  }
  return '';
}

function cascadeFindings(
  input: MatchProseInput,
  config: AuditProseConfig,
): string[] {
  const ordered = departures(input.events);
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
    const trigger = triggerClause(
      head,
      input.events,
      input.roleOf,
      config.cascadeWindowPlies,
    );
    let sentence = `The ${noun(input.roleOf[head.pieceId])} walked at move ${head.ply}${trigger}.`;
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

function sacrificeFinding(input: MatchProseInput): string | null {
  const sacrifice = input.events.find(
    (event): event is Extract<MatchEvent, { t: 'SACRIFICE_WITNESSED' }> =>
      event.t === 'SACRIFICE_WITNESSED',
  );
  if (sacrifice === undefined) return null;
  return `The ${noun(input.roleOf[sacrifice.hero])} spent itself to cover the ${noun(
    input.roleOf[sacrifice.beneficiary],
  )}; the room saw it.`;
}

export function matchAuditProse(
  input: MatchProseInput,
  config: AuditProseConfig = AUDIT_PROSE_CONFIG,
): AuditProse {
  const plies = maxPly(input.events);
  const fidelityPct = Math.round(input.executionFidelity * 100);
  const gap = input.boardQuality - input.executionFidelity * 100;

  const paragraphs: string[] = [
    `The match ran ${plies} plies and ended in ${OUTCOME_CLAUSE[input.result]}.`,
  ];
  if (gap >= config.gapThresholdCp) {
    paragraphs.push(
      `Your orders averaged ${input.boardQuality.toFixed(0)} cp, but only ${fidelityPct}% were carried out faithfully. The plan was sound; the room did not follow it.`,
    );
  } else if (gap <= -config.gapThresholdCp) {
    paragraphs.push(
      `Your orders averaged ${input.boardQuality.toFixed(0)} cp, yet ${fidelityPct}% were carried out — they executed better than you led.`,
    );
  } else {
    paragraphs.push(
      `Order quality (${input.boardQuality.toFixed(0)} cp) and execution fidelity (${fidelityPct}%) moved together.`,
    );
  }

  const findings: string[] = [];
  if (input.overrideCount > 0) {
    const word = input.overrideCount === 1 ? 'refusal' : 'refusals';
    findings.push(`You overrode ${input.overrideCount} ${word} by force.`);
  }
  const sacrifice = sacrificeFinding(input);
  if (sacrifice !== null) findings.push(sacrifice);
  findings.push(...cascadeFindings(input, config));
  if (input.desertionCount === 0) findings.push('Nobody left the board.');

  return { headline: OUTCOME_HEADLINE[input.result], paragraphs, findings };
}

export interface CampaignMatchProse {
  readonly result: NarratedOutcome;
  readonly executionFidelity: number;
}

export interface CampaignProseInput {
  readonly matches: readonly CampaignMatchProse[];
  readonly tauAbilTrajectory: readonly number[];
  readonly tauBenevTrajectory: readonly number[];
  readonly attrition: {
    readonly desertions: number;
    readonly refusals: number;
    readonly firings: number;
  };
  readonly traumaGini: number;
}

function trajectoryDelta(trajectory: readonly number[]): number {
  const first = trajectory[0];
  const last = trajectory[trajectory.length - 1];
  if (first === undefined || last === undefined) return 0;
  return last - first;
}

function channelReading(abilDelta: number, benevDelta: number): string {
  if (abilDelta > 0 && benevDelta < 0) {
    return 'They came to think you were right — and to doubt that you cared.';
  }
  if (abilDelta < 0 && benevDelta > 0) {
    return 'They warmed to you even as they lost faith in your judgment.';
  }
  if (abilDelta > 0 && benevDelta > 0) {
    return 'Both their faith in your judgment and their sense that you cared grew.';
  }
  if (abilDelta < 0 && benevDelta < 0) {
    return 'They lost faith in both your judgment and your care.';
  }
  return 'Neither channel of their trust moved decisively.';
}

export function campaignDebriefProse(input: CampaignProseInput): DebriefProse {
  const counts: Record<NarratedOutcome, number> = {
    WIN: 0,
    LOSS: 0,
    DRAW: 0,
    ROUT: 0,
    DISMISSED: 0,
    ABANDONED: 0,
  };
  for (const match of input.matches) counts[match.result] += 1;

  const paragraphs: string[] = [
    `Across ${input.matches.length} matches: ${counts.WIN} won, ${counts.DRAW} drawn, ${counts.LOSS} lost outright, ${counts.DISMISSED} ended in dismissal, ${counts.ROUT} in rout.`,
    channelReading(
      trajectoryDelta(input.tauAbilTrajectory),
      trajectoryDelta(input.tauBenevTrajectory),
    ),
  ];

  const first = input.matches[0];
  const last = input.matches[input.matches.length - 1];
  if (first !== undefined && last !== undefined && input.matches.length > 1) {
    const drift = last.executionFidelity - first.executionFidelity;
    const direction = drift > 0 ? 'rose' : drift < 0 ? 'fell' : 'held';
    paragraphs.push(
      `Execution fidelity ${direction} from ${Math.round(first.executionFidelity * 100)}% to ${Math.round(last.executionFidelity * 100)}% across the campaign.`,
    );
  }

  const findings: string[] = [
    `Attrition: ${input.attrition.desertions} deserted, ${input.attrition.refusals} refused, ${input.attrition.firings} were let go.`,
    input.traumaGini >= 0.5
      ? 'The harm fell on a few: trauma was concentrated, not shared.'
      : 'The harm was spread thin across the roster rather than concentrated.',
  ];

  return {
    headline: 'The campaign, in the round.',
    paragraphs,
    findings,
  };
}

export interface IntroProseInput {
  /** The King's mandate toward the player, 0..100 (ADR 0021). */
  readonly mandate: number;
  /** 1-based appointment within the career (ADR 0023). */
  readonly act: number;
}

const INTRO_BY_MANDATE: Readonly<Record<'low' | 'mid' | 'high', string>> = {
  low: 'The room has already made up its mind about you. Prove it wrong, or do not.',
  mid: 'They will follow. For now. The board is set.',
  high: 'They would walk into fire for you. Do not waste it.',
};

export function narratorIntro(input: IntroProseInput): string {
  const actNote =
    input.act <= 1
      ? 'This is your first command.'
      : `This is command number ${input.act}.`;
  return `${actNote} ${INTRO_BY_MANDATE[credenceBand(input.mandate)]}`;
}
