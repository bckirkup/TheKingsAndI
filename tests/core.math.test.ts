import { describe, expect, it } from 'vitest';

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
