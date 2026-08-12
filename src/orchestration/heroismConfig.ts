/**
 * Machine-nomination thresholds. Humans, not this configuration, confer
 * honours; these values only decide which acts enter the candidate record.
 */
export const HEROISM_CONFIG = {
  /** True post-move gain over the pre-move audit score required for decisiveness. */
  DECISIVE_MARGIN_CP: 100,
  /** Private perceived harm, in cp-equivalent units, required for blindness. */
  PRIVATE_DISAGREEMENT_THRESHOLD_CP: 100,
  /** Maximum true-score gap from the best move allowed for nomination. */
  NEAR_BEST_TOLERANCE_CP: 30,
} as const;

export type HeroismConfig = typeof HEROISM_CONFIG;
