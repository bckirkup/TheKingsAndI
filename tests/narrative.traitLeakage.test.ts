import { describe, expect, it } from 'vitest';

import {
  BANNED_DISPOSITION_PHRASES,
  scanTraitLeakage,
} from '../src/narrative/traitLeakage';

describe('trait leakage scanner', () => {
  it('flags disposition language with a golden finding', () => {
    const findings = scanTraitLeakage(
      'The compassionate leader protected the roster.',
      'fixture',
    );
    expect(findings).toEqual([
      {
        code: 'trait-leakage',
        source: 'fixture',
        line: 1,
        phrase: 'compassionate leader',
        text: 'The compassionate leader protected the roster.',
      },
    ]);
  });

  it('keeps the lexicon data-driven and ignores behavioural prose', () => {
    expect(BANNED_DISPOSITION_PHRASES).toContain('low empathy');
    expect(
      scanTraitLeakage(
        'You overrode 34% of refusals and protected two pieces.',
        'fixture',
      ),
    ).toEqual([]);
  });
});
