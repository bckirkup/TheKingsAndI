/**
 * Deterministic math for cross-engine replay (ADR 0032 §4).
 * Transcendentals here use fixed algorithms with quantized outputs.
 */

const EXP_TERMS = 20;

/** Fixed-point scale for comparing board-valued quantities. */
export const BOARD_VALUE_SCALE = 1_000;

/** Quantize a float to an integer comparison lane. */
export function quantizeBoardValue(value: number): number {
  return Math.trunc(value * BOARD_VALUE_SCALE);
}

/**
 * exp(x) via Taylor series around 0, truncated at EXP_TERMS.
 * Valid for x in [-10, 10]; outside that range clamps the input.
 */
export function exp(x: number): number {
  const bounded = Math.max(-10, Math.min(10, x));
  let term = 1;
  let sum = 1;
  for (let index = 1; index < EXP_TERMS; index += 1) {
    term = (term * bounded) / index;
    sum += term;
  }
  return sum;
}

/** Logistic function 1 / (1 + exp(-x)), quantized for branch decisions. */
export function logistic(x: number): number {
  if (x >= 10) return 1;
  if (x <= -10) return 0;
  const raw = 1 / (1 + exp(-x));
  return Math.trunc(raw * BOARD_VALUE_SCALE) / BOARD_VALUE_SCALE;
}
