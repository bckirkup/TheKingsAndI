import { ENGINE_CONFIG } from '../psychology/config';

/** Campaign calibration knobs (Milestone 5 / 5b). */
export const CAMPAIGN_CONFIG = {
  /** Mean roster trust at or below this triggers dismissal by the room (D26). */
  DISMISSAL_MEAN_TRUST: -25,
  /**
   * King's results-channel ability floor — below this the King dismisses even
   * when the room still believes (ADR 0024 §3 / McClellan).
   */
  KING_DISMISSAL_TAU_ABIL: 15,
  /** Consecutive matches above this realized-quality floor = career victory (5.10). */
  VICTORY_SUSTAINED_MATCHES: 3,
  VICTORY_REALIZED_QUALITY: 65,
  VICTORY_BOARD_QUALITY: 72,
  REINSTATEMENT_TRUST_FLOOR: -15,
  REINSTATEMENT_TRUST_RECOVERY: 0,
  /** King search depth strictly below effective player depth (ADR 0022 §4). */
  KING_MAX_SEARCH_DEPTH: 8,
  PLAYER_EFFECTIVE_DEPTH: 12,
  /** Lesser king depth on diminished appointments (ADR 0024 §4). */
  DIMINISHED_KING_MAX_SEARCH_DEPTH: 6,
  /** Thinner available roster size for act 2+. */
  DIMINISHED_ROSTER_CAP: 10,
  /** Lower stakes — fewer campaign matches on diminished appointments. */
  DIMINISHED_TARGET_MATCHES: 4,
  MIN_CAMPAIGN_MATCHES: 5,
  MAX_CAMPAIGN_MATCHES: 20,
  /**
   * Max enemy identities tracked with full psychology (ADR 0025).
   * Remaining enemy pieces move without private belief.
   */
  ENEMY_TRACKED_IDENTITIES: 8,
} as const;

export function assertKingDepthInvariant(): void {
  if (
    CAMPAIGN_CONFIG.KING_MAX_SEARCH_DEPTH >=
    CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH
  ) {
    throw new Error(
      'D_king must be strictly less than D_player_effective (ADR 0022 §4).',
    );
  }
  if (CAMPAIGN_CONFIG.KING_MAX_SEARCH_DEPTH > ENGINE_CONFIG.MAX_SEARCH_DEPTH) {
    throw new Error('King depth exceeds engine maximum.');
  }
  if (
    CAMPAIGN_CONFIG.DIMINISHED_KING_MAX_SEARCH_DEPTH >=
    CAMPAIGN_CONFIG.KING_MAX_SEARCH_DEPTH
  ) {
    throw new Error(
      'Diminished king depth must be strictly below full king depth (ADR 0024 §4).',
    );
  }
}

export function kingDepthForAppointment(diminished: boolean): number {
  return diminished
    ? CAMPAIGN_CONFIG.DIMINISHED_KING_MAX_SEARCH_DEPTH
    : CAMPAIGN_CONFIG.KING_MAX_SEARCH_DEPTH;
}
