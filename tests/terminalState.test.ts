import { describe, expect, it } from 'vitest';

import {
  EPILOGUE_BY_TERMINAL,
  classifyActTerminal,
  classifyMatchResult,
} from '../src/orchestration/terminalState';

describe('terminalState', () => {
  it('classifies match results from rout, dismissal, and win score', () => {
    expect(
      classifyMatchResult({ rout: false, winScore: 50, dismissed: true }),
    ).toBe('DISMISSED');
    expect(
      classifyMatchResult({ rout: true, winScore: 100, dismissed: false }),
    ).toBe('ROUT');
    expect(
      classifyMatchResult({ rout: false, winScore: 100, dismissed: false }),
    ).toBe('WIN');
    expect(
      classifyMatchResult({ rout: false, winScore: 0, dismissed: false }),
    ).toBe('LOSS');
    expect(
      classifyMatchResult({ rout: false, winScore: 50, dismissed: false }),
    ).toBe('DRAW');
  });

  it('classifies act terminals with graded dismissal and closing results', () => {
    expect(classifyActTerminal(['WIN', 'ROUT'], 1)).toBe('rout');
    expect(classifyActTerminal(['WIN', 'DISMISSED'], 0)).toBe('dismissal');
    expect(classifyActTerminal(['WIN', 'DISMISSED'], 1)).toBe('ongoing');
    expect(classifyActTerminal(['DRAW', 'WIN'], 1)).toBe('victory');
    expect(classifyActTerminal(['WIN', 'LOSS'], 1)).toBe('checkmate');
    expect(classifyActTerminal(['WIN', 'DRAW'], 1)).toBe('ongoing');
  });

  it('ships an epilogue for every act terminal', () => {
    for (const terminal of Object.keys(EPILOGUE_BY_TERMINAL) as Array<
      keyof typeof EPILOGUE_BY_TERMINAL
    >) {
      expect(EPILOGUE_BY_TERMINAL[terminal].length).toBeGreaterThan(10);
    }
  });
});
