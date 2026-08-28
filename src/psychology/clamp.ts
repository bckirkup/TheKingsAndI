/** Clamp helpers — every fold ends with these (psychology_engine.md §11.1). */

import { ENGINE_CONFIG } from './config';

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function clampTrust(value: number): number {
  return clampInt(value, -100, 100);
}

export function clampMorale(value: number): number {
  return clampInt(value, 0, 100);
}

export function clampTrauma(value: number): number {
  return clampInt(value, 0, 100);
}

export function clampCredence(value: number): number {
  return clampInt(value, 0, 100);
}

export function clampRuptureDebt(value: number): number {
  return clampInt(
    value,
    0,
    Math.max(0, Math.trunc(ENGINE_CONFIG.BENEV_RUPTURE_DEBT_CEILING)),
  );
}

export function clampAffinity(value: number): number {
  return clampInt(value, -100, 100);
}

export function clampPermille(value: number): number {
  return clampInt(value, 0, 1_000);
}
