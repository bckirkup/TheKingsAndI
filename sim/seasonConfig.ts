/**
 * Season pool controls. These are deliberately open calibration knobs:
 * changing them must alter the season output, but no value here is a balance
 * ruling.
 */
export interface SeasonConfig {
  readonly POOL_DEPTH_FACTOR: number;
  readonly DESERTION_ABSENCE_MATCHES: number;
  readonly RETIREMENT_TRAUMA_THRESHOLD: number;
}

export const SEASON_CONFIG: SeasonConfig = {
  /** Pool members per starting-lineup role member, excluding the King. */
  POOL_DEPTH_FACTOR: 2,
  /** Matches for which a deserter is unavailable. */
  DESERTION_ABSENCE_MATCHES: 2,
  /** Trauma at or above which a non-King is retired permanently. */
  RETIREMENT_TRAUMA_THRESHOLD: 100,
};
