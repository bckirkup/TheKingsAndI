import { describe, expect, it } from 'vitest';

import { chooseOpponentMove as fromOpponent } from '../src/orchestration/opponent';
import { chooseOpponentMove as fromPolicy } from '../src/orchestration/leaderPolicy';

describe('opponent re-export', () => {
  it('keeps the backward-compatible chooseOpponentMove binding', () => {
    expect(fromOpponent).toBe(fromPolicy);
  });
});
