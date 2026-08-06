import { describe, expect, it } from 'vitest';

import { lineFor, sanitizePieceLabel, situationKeyFor } from '../src/narrative';

describe('authored narration', () => {
  it('is deterministic for a fixed seed and ply', () => {
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
});
