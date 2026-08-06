import {
  lineFor,
  type CredenceReading,
  type DialogueCue,
} from './authoredProvider';
import {
  DIALOGUE_LINES,
  allSituationKeys,
  type SituationKey,
} from './dialogueTree';
import type { PieceRole } from '../psychology';

/**
 * Coverage is the product risk (ADR 0004 §2, `docs/llm_integration.md`):
 * undercover the space and pieces fall silent or repeat, which reads as
 * cheapness. This validator is the CI guard — every reachable situation key has
 * enough non-empty leaves, and a piece does not repeat itself on consecutive
 * plies within a match.
 */

export const MINIMUM_VARIANTS_PER_SITUATION = 20;

export interface CoverageReport {
  readonly ok: boolean;
  readonly situationCount: number;
  readonly issues: readonly string[];
}

/** Every reachable situation key has enough non-empty leaves (6.3). */
export function validateNarrationCoverage(): CoverageReport {
  const issues: string[] = [];
  const keys = allSituationKeys();
  for (const key of keys) {
    const lines = DIALOGUE_LINES[key];
    if (lines.length < MINIMUM_VARIANTS_PER_SITUATION) {
      issues.push(
        `${key}: ${lines.length} variants (< ${MINIMUM_VARIANTS_PER_SITUATION})`,
      );
    }
    if (lines.some((line) => line.trim().length === 0)) {
      issues.push(`${key}: has an empty leaf`);
    }
  }
  return { ok: issues.length === 0, situationCount: keys.length, issues };
}

/** All situation keys the game can voice; the bound coverage is checked against. */
export function reachableSituationKeys(): readonly SituationKey[] {
  return allSituationKeys();
}

/**
 * The longest run of consecutive plies (for one piece, one situation) that
 * produce an identical line. A value of 1 means no line repeats back-to-back —
 * the "no repetition within a match" property (`narrative-llm` skill).
 */
export function longestConsecutiveRepeat(input: {
  readonly cue: DialogueCue;
  readonly pieceRole: PieceRole;
  readonly trust: number;
  readonly seed: number;
  readonly plies: number;
  readonly credence?: CredenceReading;
}): number {
  let longest = 1;
  let current = 1;
  let previous: string | null = null;
  for (let ply = 1; ply <= input.plies; ply += 1) {
    const line = lineFor({
      cue: input.cue,
      pieceRole: input.pieceRole,
      trust: input.trust,
      ply,
      seed: input.seed,
      ...(input.credence === undefined ? {} : { credence: input.credence }),
    });
    if (previous !== null && line === previous) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
    previous = line;
  }
  return longest;
}
