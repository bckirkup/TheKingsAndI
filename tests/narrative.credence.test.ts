import { describe, expect, it } from 'vitest';

import {
  DIALOGUE_LINES,
  credenceBand,
  lineFor,
  situationKeyFor,
  type NarrationRequest,
} from '../src/narrative';

function refusal(credence?: NarrationRequest['credence']): NarrationRequest {
  return {
    cue: {
      eventKind: 'refusal',
      pieceId: 'w:R:a1',
      san: 'Ra7',
      verdict: 'MORAL_REFUSAL',
    },
    pieceRole: 'Rook',
    trust: 20,
    ply: 6,
    seed: 7,
    ...(credence === undefined ? {} : { credence }),
  };
}

describe('two-channel credence keys (D19)', () => {
  it('says "right, but you do not care" at high ability / low benevolence', () => {
    const request = refusal({ tauAbil: 90, tauBenev: 10 });
    expect(situationKeyFor(request)).toBe('refusal.able_uncared');
    const expected = DIALOGUE_LINES['refusal.able_uncared'].map((template) =>
      template.replaceAll('{san}', request.cue.san),
    );
    expect(expected).toContain(lineFor(request));
  });

  it('says "no faith" at low ability / low benevolence', () => {
    expect(situationKeyFor(refusal({ tauAbil: 10, tauBenev: 10 }))).toBe(
      'refusal.no_faith',
    );
  });

  it('refines an override at high ability / low benevolence', () => {
    const request: NarrationRequest = {
      ...refusal({ tauAbil: 90, tauBenev: 10 }),
      cue: {
        eventKind: 'override',
        pieceId: 'w:R:a1',
        san: 'Ra7',
        verdict: 'MORAL_REFUSAL',
      },
    };
    expect(situationKeyFor(request)).toBe('override.able_uncared');
  });

  it('falls back to the single-trust key when credence is absent', () => {
    // Preserves the Milestone 4 behavior for callers without credence.
    expect(situationKeyFor(refusal())).toBe('refusal.expendable');
  });
});

describe('credence band config', () => {
  it('buckets at the default cut points (golden)', () => {
    expect(credenceBand(10)).toBe('low');
    expect(credenceBand(50)).toBe('mid');
    expect(credenceBand(90)).toBe('high');
  });

  it('reclassifies a value when the cut point moves (sensitivity)', () => {
    expect(credenceBand(40)).toBe('mid');
    expect(credenceBand(40, { low: 50, high: 67 })).toBe('low');
  });
});
