/**
 * Season pool controls. These are deliberately open calibration knobs:
 * changing them must alter the season output, but no value here is a balance
 * ruling.
 */
export interface SeasonConfig {
  readonly POOL_DEPTH_FACTOR: number;
  readonly DESERTION_ABSENCE_MATCHES: number;
  readonly RETIREMENT_TRAUMA_THRESHOLD: number;
  readonly NON_SELECTION_TRUST_THRESHOLD: number;
  readonly NON_SELECTION_SELF_TRUST_PENALTY: number;
  readonly NON_SELECTION_PEER_TRUST_PENALTY: number;
  readonly NON_SELECTION_REDEMPTION_TRUST_RECOVERY: number;
  readonly OBSOLESCENCE_NON_SELECTION_THRESHOLD: number;
}

export const SEASON_CONFIG: SeasonConfig = {
  /** Pool members per starting-lineup role member, excluding the King. */
  POOL_DEPTH_FACTOR: 2,
  /** Matches for which a deserter is unavailable. */
  DESERTION_ABSENCE_MATCHES: 2,
  /** Trauma at or above which a non-King is retired permanently. */
  RETIREMENT_TRAUMA_THRESHOLD: 100,
  /** Consecutive available non-selections before trust erosion begins. */
  NON_SELECTION_TRUST_THRESHOLD: 2,
  /** Trust loss applied to a piece at the erosion threshold. */
  NON_SELECTION_SELF_TRUST_PENALTY: -10,
  /** Base trust loss applied to bonded pool-mates at the erosion threshold. */
  NON_SELECTION_PEER_TRUST_PENALTY: -2,
  /** Trust credited when a piece returns after sustained non-selection. */
  NON_SELECTION_REDEMPTION_TRUST_RECOVERY: 4,
  /** Consecutive available non-selections before a non-King becomes obsolete. */
  OBSOLESCENCE_NON_SELECTION_THRESHOLD: 6,
};
