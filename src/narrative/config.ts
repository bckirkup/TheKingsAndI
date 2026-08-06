import type { AffinityBand, CredenceBand } from './types';

/**
 * Narration configuration. These are **presentation** knobs — where a continuous
 * credence or affinity value falls into a spoken band, how long a phrasing
 * window counts as "within a few moves." They never feed back into psychology
 * (ADR 0001); they only choose which authored line is spoken.
 *
 * Every knob here is covered by a golden test (a fixed input maps to a fixed
 * band) and a sensitivity test (moving the cut point moves the band), per
 * AGENTS.md rule 6.
 */
export interface NarrationConfig {
  /** Credence cut points over `[0, 1]`: `< low` → LOW, `< high` → MID, else HIGH. */
  readonly credence: { readonly low: number; readonly high: number };
  /** Affinity cut points over `[-1, 1]`: `< hostile` → HOSTILE, `> close` → CLOSE. */
  readonly affinity: { readonly hostile: number; readonly close: number };
  /** Longest display name substituted into a line; longer names are truncated. */
  readonly maxNameLength: number;
  /**
   * A departure this many plies after the one that triggered it is narrated as
   * part of the same cascade ("three more followed within two moves").
   */
  readonly cascadeWindowPlies: number;
}

export const NARRATION_CONFIG: NarrationConfig = {
  credence: { low: 0.34, high: 0.67 },
  affinity: { hostile: -0.25, close: 0.25 },
  maxNameLength: 24,
  cascadeWindowPlies: 4,
};

/** Bucket a credence value in `[0, 1]` into a spoken band. */
export function credenceBand(
  value: number,
  config: NarrationConfig = NARRATION_CONFIG,
): CredenceBand {
  if (value < config.credence.low) return 'LOW';
  if (value < config.credence.high) return 'MID';
  return 'HIGH';
}

/** Bucket an affinity value in `[-1, 1]` into a spoken band. */
export function affinityBand(
  value: number,
  config: NarrationConfig = NARRATION_CONFIG,
): AffinityBand {
  if (value < config.affinity.hostile) return 'HOSTILE';
  if (value > config.affinity.close) return 'CLOSE';
  return 'NEUTRAL';
}
