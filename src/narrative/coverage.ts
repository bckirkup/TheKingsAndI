import { composePieceLine } from './compose';
import {
  CREDENCE_BANDS,
  NEGATIVE_GRIEVANCES,
  PERSONAS,
  reachableSituations,
} from './situations';
import type { DialogueTree } from './tree';
import type { PersonaId, PieceLineContext } from './types';

/**
 * Coverage is the product risk (ADR 0004 §2, `docs/llm_integration.md`):
 * undercover the combinatorial space and pieces repeat themselves or fall
 * silent, which reads as cheapness. CI validates that every reachable situation
 * composes to a non-empty line and that no bank that must speak has an empty
 * leaf. The MID credence bands are *deliberately* silent, so they are exempt.
 */
export interface CoverageReport {
  readonly ok: boolean;
  readonly reachableCount: number;
  readonly issues: readonly string[];
}

function sampleContext(
  persona: PersonaId,
  situation: ReturnType<typeof reachableSituations>[number],
): PieceLineContext {
  return {
    speaker: { id: 'coverage', name: 'Coverage', role: 'P' },
    persona,
    verdict: situation.verdict,
    grievance: situation.grievance,
    credence: {
      ability: situation.ability,
      benevolence: situation.benevolence,
    },
    affinity: 'NEUTRAL',
    target: { name: 'Maren', role: 'Q' },
    repeatCount: 0,
    seed: 1,
  };
}

export function validateCoverage(tree: DialogueTree): CoverageReport {
  const issues: string[] = [];
  const situations = reachableSituations();

  for (const situation of situations) {
    const line = composePieceLine(
      tree,
      sampleContext(situation.persona, situation),
    );
    if (line.trim().length === 0) {
      issues.push(`empty line for situation ${situation.key}`);
    }
  }

  for (const persona of PERSONAS) {
    const banks = tree.personas[persona];
    if (banks === undefined) {
      issues.push(`missing persona ${persona}`);
      continue;
    }
    for (const [verdict, variants] of Object.entries(banks.attitudeCore)) {
      if (
        variants.length === 0 ||
        variants.some((v) => v.trim().length === 0)
      ) {
        issues.push(`${persona}.attitudeCore.${verdict} has an empty leaf`);
      }
    }
    for (const grievance of NEGATIVE_GRIEVANCES) {
      const variants = banks.grievanceClause[grievance];
      if (
        variants.length === 0 ||
        variants.some((v) => v.trim().length === 0)
      ) {
        issues.push(
          `${persona}.grievanceClause.${grievance} has an empty leaf`,
        );
      }
    }
    for (const band of CREDENCE_BANDS) {
      if (
        banks.intro[band].length === 0 ||
        banks.intro[band].some((v) => v.trim().length === 0)
      ) {
        issues.push(`${persona}.intro.${band} has an empty leaf`);
      }
      // LOW and HIGH credence colours must speak; MID is intentionally silent.
      if (band !== 'MID') {
        if (banks.abilityClause[band].some((v) => v.trim().length === 0)) {
          issues.push(`${persona}.abilityClause.${band} has an empty leaf`);
        }
        if (banks.benevolenceClause[band].some((v) => v.trim().length === 0)) {
          issues.push(`${persona}.benevolenceClause.${band} has an empty leaf`);
        }
      }
    }
  }

  return { ok: issues.length === 0, reachableCount: situations.length, issues };
}
