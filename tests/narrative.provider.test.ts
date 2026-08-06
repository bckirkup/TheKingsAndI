import { describe, expect, it } from 'vitest';

import { CORPUS } from '../src/narrative/authoring/corpus';
import { createAuthoredProvider } from '../src/narrative/authoredProvider';
import type {
  MatchIntroContext,
  PieceLineContext,
} from '../src/narrative/types';

const BANKS = CORPUS.personas.plainspoken;

function refusal(overrides: Partial<PieceLineContext> = {}): PieceLineContext {
  return {
    speaker: { id: 'p1', name: 'Roland', role: 'R' },
    persona: 'plainspoken',
    verdict: 'MORAL_REFUSAL',
    grievance: 'SPENT_PEER',
    credence: { ability: 'HIGH', benevolence: 'LOW' },
    affinity: 'CLOSE',
    target: { name: 'Maren', role: 'Q' },
    repeatCount: 0,
    seed: 42,
    ...overrides,
  };
}

describe('authored provider determinism', () => {
  it('is byte-identical for the same context and seed', () => {
    const provider = createAuthoredProvider();
    expect(provider.pieceLine(refusal())).toBe(provider.pieceLine(refusal()));
  });

  it('reproduces across independent provider instances', () => {
    expect(createAuthoredProvider().pieceLine(refusal())).toBe(
      createAuthoredProvider().pieceLine(refusal()),
    );
  });

  it('changes the line when the seed changes', () => {
    const provider = createAuthoredProvider();
    const lines = new Set(
      [1, 2, 3, 4, 5].map((seed) => provider.pieceLine(refusal({ seed }))),
    );
    expect(lines.size).toBeGreaterThan(1);
  });
});

describe('authored provider variety within a match', () => {
  it('does not repeat the same situation on consecutive occurrences', () => {
    const provider = createAuthoredProvider();
    const lines = [0, 1, 2].map((repeatCount) =>
      provider.pieceLine(refusal({ repeatCount })),
    );
    expect(new Set(lines).size).toBe(3);
  });
});

describe('two-channel credence is expressible', () => {
  it('says the move is right but the leader does not care', () => {
    const line = createAuthoredProvider().pieceLine(refusal());
    expect(BANKS.abilityClause.HIGH.some((v) => line.includes(v))).toBe(true);
    expect(BANKS.benevolenceClause.LOW.some((v) => line.includes(v))).toBe(
      true,
    );
    expect(line).toContain('Maren');
  });

  it('is silent on a channel at the MID band', () => {
    const line = createAuthoredProvider().pieceLine({
      speaker: { id: 'p1', name: 'Roland', role: 'R' },
      persona: 'plainspoken',
      verdict: 'QUIET_QUITTING',
      grievance: 'ABANDONED',
      credence: { ability: 'MID', benevolence: 'MID' },
      repeatCount: 0,
      seed: 42,
    });
    const spoken = [...BANKS.abilityClause.HIGH, ...BANKS.abilityClause.LOW];
    expect(spoken.some((v) => line.includes(v))).toBe(false);
  });
});

describe('positive verdicts name no grievance', () => {
  it('renders the attitude alone', () => {
    const line = createAuthoredProvider().pieceLine({
      speaker: { id: 'p1', name: 'Roland', role: 'R' },
      persona: 'plainspoken',
      verdict: 'HEROIC_EXECUTION',
      grievance: 'NONE',
      credence: { ability: 'HIGH', benevolence: 'HIGH' },
      repeatCount: 0,
      seed: 42,
    });
    expect(BANKS.attitudeCore.HEROIC_EXECUTION).toContain(line);
  });
});

describe('name sanitization at substitution', () => {
  it('strips control characters and markup and caps length', () => {
    const line = createAuthoredProvider().pieceLine(
      refusal({
        grievance: 'SPENT_PEER',
        target: {
          name: 'E\u0000vil<script>&\nMaximilian the Third',
          role: 'Q',
        },
      }),
    );
    expect(line).not.toMatch(/[<>&]/);
    expect([...line].some((c) => (c.codePointAt(0) ?? 0) < 0x20)).toBe(false);
  });

  it('falls back to a placeholder for a blank name', () => {
    const line = createAuthoredProvider().pieceLine(
      refusal({ grievance: 'SPENT_PEER', target: { name: '   ', role: 'Q' } }),
    );
    expect(line).toContain('the recruit');
  });
});

describe('narrator intro', () => {
  function intro(
    overrides: Partial<MatchIntroContext> = {},
  ): MatchIntroContext {
    return {
      leaderName: 'Vane',
      persona: 'plainspoken',
      mandate: 'HIGH',
      act: 1,
      seed: 7,
      ...overrides,
    };
  }

  it('is deterministic and announces the appointment', () => {
    const provider = createAuthoredProvider();
    expect(provider.narratorIntro(intro())).toBe(
      provider.narratorIntro(intro()),
    );
    expect(provider.narratorIntro(intro())).toContain('first command');
    expect(provider.narratorIntro(intro({ act: 3 }))).toContain(
      'command number 3',
    );
  });
});
