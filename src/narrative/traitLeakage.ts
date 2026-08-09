export interface TraitLeakageFinding {
  readonly code: 'trait-leakage';
  readonly source: string;
  readonly line: number;
  readonly phrase: string;
  readonly text: string;
}

/**
 * Disposition claims are banned from shipped transcript/certificate prose.
 * These are data so the lexicon can grow without changing the scanner.
 */
export const BANNED_DISPOSITION_PHRASES = [
  'low empathy',
  'high empathy',
  'compassionate leader',
  'empathetic leader',
  'tyrannical leader',
  'supportive leader',
  'cold winner',
] as const;

export function scanTraitLeakage(
  source: string,
  sourceName: string,
): readonly TraitLeakageFinding[] {
  const findings: TraitLeakageFinding[] = [];
  for (const [index, text] of source.split(/\r?\n/).entries()) {
    const lower = text.toLowerCase();
    for (const phrase of BANNED_DISPOSITION_PHRASES) {
      if (lower.includes(phrase)) {
        findings.push({
          code: 'trait-leakage',
          source: sourceName,
          line: index + 1,
          phrase,
          text: text.trim(),
        });
      }
    }
  }
  return findings;
}
