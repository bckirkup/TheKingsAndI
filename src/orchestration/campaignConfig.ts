import { ENGINE_CONFIG } from '../psychology/config';

/** Campaign calibration knobs (Milestone 5). */
export const CAMPAIGN_CONFIG = {
  /** Mean roster trust at or below this triggers dismissal (D26). */
  DISMISSAL_MEAN_TRUST: -25,
  /** Consecutive matches above this realized-quality floor = career victory (5.10). */
  VICTORY_SUSTAINED_MATCHES: 3,
  VICTORY_REALIZED_QUALITY: 65,
  VICTORY_BOARD_QUALITY: 72,
  REINSTATEMENT_TRUST_FLOOR: -15,
  REINSTATEMENT_TRUST_RECOVERY: 0,
  /** King search depth strictly below effective player depth (ADR 0022 §4). */
  KING_MAX_SEARCH_DEPTH: 8,
  PLAYER_EFFECTIVE_DEPTH: 12,
  MIN_CAMPAIGN_MATCHES: 5,
  MAX_CAMPAIGN_MATCHES: 20,
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
}
