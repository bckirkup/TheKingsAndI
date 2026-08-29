import { describe, expect, it } from 'vitest';

import {
  ENGINE_CONFIG,
  applyBetrayalSignal,
  defaultCredence,
} from '../src/psychology';
import { exp, logistic, quantizeBoardValue } from '../src/core/math';

describe('deterministic math golden values', () => {
  it('quantizes board values to fixed lanes', () => {
    expect(quantizeBoardValue(1.2345)).toBe(1234);
    expect(quantizeBoardValue(-0.5)).toBe(-500);
  });

  it('matches stable exp and logistic outputs', () => {
    expect(exp(0)).toBe(1);
    expect(exp(1)).toBeCloseTo(2.71828, 4);
    expect(logistic(0)).toBe(0.5);
    expect(logistic(4)).toBeGreaterThan(0.98);
  });
});

describe('deterministic math sensitivity', () => {
  it('changes logistic output when input changes', () => {
    expect(logistic(1)).not.toBe(logistic(3));
  });
});

describe('deterministic math accuracy and invariants', () => {
  const sweep = Array.from({ length: 321 }, (_, index) => -40 + index * 0.25);

  it('matches Math.exp across the documented domain', () => {
    let maxRelativeError = 0;
    for (const value of sweep) {
      const expected = Math.exp(value);
      const relativeError = Math.abs(exp(value) - expected) / expected;
      maxRelativeError = Math.max(maxRelativeError, relativeError);
    }
    expect(maxRelativeError).toBeLessThan(1e-12);
  });

  it('keeps exp strictly increasing across the documented sweep', () => {
    for (let index = 1; index < sweep.length; index += 1) {
      const previous = exp(sweep[index - 1] ?? 0);
      const current = exp(sweep[index] ?? 0);
      expect(current).toBeGreaterThan(previous);
    }
  });

  it('keeps logistic bounded and non-decreasing across the documented sweep', () => {
    let previous = logistic(sweep[0] ?? -40);
    expect(previous).toBeGreaterThanOrEqual(0);
    expect(previous).toBeLessThanOrEqual(1);
    for (let index = 1; index < sweep.length; index += 1) {
      const current = logistic(sweep[index] ?? 40);
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current).toBeGreaterThanOrEqual(0);
      expect(current).toBeLessThanOrEqual(1);
      previous = current;
    }
  });

  it('keeps the former divergent logistic band near one', () => {
    for (const value of [8, 8.5, 9, 9.5]) {
      expect(logistic(value)).toBeGreaterThanOrEqual(0.999);
      expect(logistic(value)).toBeLessThanOrEqual(1);
    }
  });

  it('bounds betrayal cliffs and preserves their monotone response', () => {
    const config = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = config.BENEV_BETRAYAL_CLIFF_PERMILLE;
    if (original === undefined)
      throw new Error('Missing betrayal cliff config');
    const severities = [0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8];
    try {
      config.BENEV_BETRAYAL_CLIFF_PERMILLE = 0;
      const before = { ...defaultCredence(), tauBenev: 100 };
      const drops = severities.map(
        (severity) =>
          before.tauBenev - applyBetrayalSignal(before, severity).tauBenev,
      );
      for (const drop of drops) {
        expect(drop).toBeGreaterThanOrEqual(0);
        expect(drop).toBeLessThanOrEqual(
          ENGINE_CONFIG.BENEV_BETRAYAL_CLIFF_DROP,
        );
      }
      for (let index = 1; index < drops.length; index += 1) {
        expect(drops[index]).toBeGreaterThanOrEqual(drops[index - 1] ?? 0);
      }
    } finally {
      config.BENEV_BETRAYAL_CLIFF_PERMILLE = original;
    }
  });

  it('reproduces exp and logistic outputs exactly', () => {
    for (const value of [-40, -8, 0, 8, 40]) {
      expect(exp(value)).toBe(exp(value));
      expect(logistic(value)).toBe(logistic(value));
    }
  });
});
