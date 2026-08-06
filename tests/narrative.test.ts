import { describe, expect, it } from 'vitest';

import {
  allSituationKeys,
  DIALOGUE_LINES,
  lineFor,
  sanitizePieceLabel,
  situationKeyFor,
  totalDialogueLineCount,
} from '../src/narrative';

describe('authored narration', () => {
  it('is deterministic for a fixed seed, ply, and role', () => {
    const request = {
      cue: {
        eventKind: 'refusal' as const,
        pieceId: 'w:N:b1',
        san: 'Nf3',
        verdict: 'MORAL_REFUSAL' as const,
      },
      pieceRole: 'Knight' as const,
      trust: -20,
      ply: 4,
      seed: 99,
    };
    expect(lineFor(request)).toBe(lineFor(request));
    expect(situationKeyFor(request)).toBe('refusal.low_trust');
  });

  it('sanitizes player-supplied labels', () => {
    expect(sanitizePieceLabel('  Sir\x01Bold  ')).toBe('SirBold');
  });

  it('ships at least 200 authored dialogue lines (M4.5)', () => {
    expect(totalDialogueLineCount()).toBeGreaterThanOrEqual(200);
  });

  it('has non-empty leaves for every situation key', () => {
    for (const key of allSituationKeys()) {
      const lines = DIALOGUE_LINES[key];
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('provides at least twenty variants per situation', () => {
    for (const key of allSituationKeys()) {
      expect(DIALOGUE_LINES[key].length).toBeGreaterThanOrEqual(20);
    }
  });
});
