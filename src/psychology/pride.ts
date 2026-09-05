import { clampInt } from './clamp';

export function prideAppraisalDelta(
  price: number,
  expectation: number,
): number {
  return clampInt(
    Math.trunc(((price - expectation) * 1_000) / Math.max(1, expectation)),
    -1_000,
    1_000,
  );
}

export function prideExpectationAfter(
  price: number,
  expectation: number,
  movement: number,
): number {
  const ema = Math.max(0, Math.min(1_000, Math.trunc(movement)));
  return expectation + Math.trunc(((price - expectation) * ema) / 1_000);
}

export function prideAppraisalSum(previous: number, delta: number): number {
  return clampInt(Math.trunc(previous) + Math.trunc(delta), -1_000, 1_000);
}
