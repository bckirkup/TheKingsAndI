import { describe, expect, it } from 'vitest';

import { runBoardIdentityFuzz } from './helpers/boardIdentityFuzz';

describe('LivingBoard large identity fuzz', () => {
  it('survives 1,000 random legal games with a consistent identity map', () => {
    const result = runBoardIdentityFuzz(1000);
    expect(result.violations.slice(0, 5)).toEqual([]);
    expect(result.plies).toBeGreaterThan(50_000);
    expect(result.captures).toBeGreaterThan(1_000);
    expect(result.promotions).toBeGreaterThan(0);
    expect(result.castles).toBeGreaterThan(0);
  });
});
