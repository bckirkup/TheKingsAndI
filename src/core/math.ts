/**
 * Deterministic math for cross-engine replay (ADR 0032 §4).
 * Transcendentals here use fixed algorithms with quantized outputs.
 */

const EXP_TAYLOR_TERMS = 16;
const EXP_MIN_INPUT = -40;
const EXP_MAX_INPUT = 40;
const LN2 = 0.6931471805599453;

/** Fixed-point scale for comparing board-valued quantities. */
export const BOARD_VALUE_SCALE = 1_000;

/** Quantize a float to an integer comparison lane. */
export function quantizeBoardValue(value: number): number {
  return Math.trunc(value * BOARD_VALUE_SCALE);
}

/**
 * exp(x) via range reduction and a Taylor series around zero.
 * Inputs are clamped to the documented domain [-40, 40].
 */
export function exp(x: number): number {
  const bounded = Math.max(EXP_MIN_INPUT, Math.min(EXP_MAX_INPUT, x));
  const power = Math.round(bounded / LN2);
  const reduced = bounded - power * LN2;
  let term = 1;
  let sum = 1;
  for (let index = 1; index < EXP_TAYLOR_TERMS; index += 1) {
    term = (term * reduced) / index;
    sum += term;
  }
  if (power >= 0) {
    for (let index = 0; index < power; index += 1) {
      sum *= 2;
    }
  } else {
    for (let index = 0; index > power; index -= 1) {
      sum /= 2;
    }
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
