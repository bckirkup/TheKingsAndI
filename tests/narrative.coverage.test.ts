import { describe, expect, it } from 'vitest';

import {
  longestConsecutiveRepeat,
  reachableSituationKeys,
  validateNarrationCoverage,
} from '../src/narrative';

describe('narration coverage (6.3)', () => {
  it('has enough non-empty leaves for every reachable situation', () => {
    const report = validateNarrationCoverage();
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('covers the two-channel credence keys added for D19', () => {
    const keys = reachableSituationKeys();
    expect(keys).toContain('refusal.able_uncared');
    expect(keys).toContain('refusal.no_faith');
    expect(keys).toContain('override.able_uncared');
  });

  it('does not repeat a line on consecutive plies within a match', () => {
    const longest = longestConsecutiveRepeat({
      cue: {
        eventKind: 'refusal',
        pieceId: 'w:N:b1',
        san: 'Nf3',
        verdict: 'MORAL_REFUSAL',
      },
      pieceRole: 'Knight',
      trust: -10,
      seed: 42,
      plies: 40,
    });
    expect(longest).toBe(1);
  });
});
