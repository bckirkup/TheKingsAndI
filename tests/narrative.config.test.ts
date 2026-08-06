import { describe, expect, it } from 'vitest';

import {
  NARRATION_CONFIG,
  affinityBand,
  credenceBand,
} from '../src/narrative/config';
import { sanitizeName } from '../src/narrative/sanitize';

describe('credence band config (golden)', () => {
  it('buckets values at the default cut points', () => {
    expect(credenceBand(0.2)).toBe('LOW');
    expect(credenceBand(0.5)).toBe('MID');
    expect(credenceBand(0.9)).toBe('HIGH');
  });

  it('treats the cut points as the lower edge of the higher band', () => {
    expect(credenceBand(NARRATION_CONFIG.credence.low)).toBe('MID');
    expect(credenceBand(NARRATION_CONFIG.credence.high)).toBe('HIGH');
  });
});

describe('credence band config (sensitivity)', () => {
  it('reclassifies a value when the low cut point moves', () => {
    expect(credenceBand(0.4)).toBe('MID');
    expect(
      credenceBand(0.4, {
        ...NARRATION_CONFIG,
        credence: { low: 0.5, high: 0.67 },
      }),
    ).toBe('LOW');
  });
});

describe('affinity band config', () => {
  it('buckets at the default cut points (golden)', () => {
    expect(affinityBand(-0.9)).toBe('HOSTILE');
    expect(affinityBand(0)).toBe('NEUTRAL');
    expect(affinityBand(0.9)).toBe('CLOSE');
  });

  it('reclassifies when the close cut point moves (sensitivity)', () => {
    expect(affinityBand(0.3)).toBe('CLOSE');
    expect(
      affinityBand(0.3, {
        ...NARRATION_CONFIG,
        affinity: { hostile: -0.25, close: 0.5 },
      }),
    ).toBe('NEUTRAL');
  });
});

describe('name length config', () => {
  it('caps to the given length (golden)', () => {
    expect(sanitizeName('abcdefghij', 5)).toBe('abcde');
  });

  it('caps differently when the length changes (sensitivity)', () => {
    expect(sanitizeName('abcdefghij', 5)).not.toBe(
      sanitizeName('abcdefghij', 8),
    );
  });
});
