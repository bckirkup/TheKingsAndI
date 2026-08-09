/**
 * Commendation thresholds (ADR 0031). Every knob has golden + sensitivity tests.
 * Awards are computed at debrief only — never surfaced during play (D93).
 */
export const COMMENDATION_CONFIG = {
  /** Attention Gini at or below this earns evenness. */
  EVENNESS_GINI_MAX: 0.35,
  /** Top-quartile mean realized quality vs ceiling ratio. */
  BEST_OF_BEST_RATIO_MIN: 0.75,
  /** Credence floor that "nobody drowned" must stay above. */
  NOBODY_DROWNED_CREDENCE_FLOOR: 5,
  /** Minimum trauma at act start to count as overcoming a weakness. */
  OVERCOMING_TRAUMA_FLOOR: 20,
  /** Minimum trauma recovery (start − end) for overcoming. */
  OVERCOMING_TRAUMA_RECOVERY: 15,
  /** Losing streak length before grit can fire. */
  GRIT_LOSS_STREAK: 2,
  /** Minimum mean execution fidelity during a grit streak. */
  GRIT_FIDELITY_FLOOR: 0.55,
  /** Learning-delta composite at or above this earns overall improvement. */
  OVERALL_IMPROVEMENT_DELTA_MIN: 0.05,
  /** Minimum trust remaining after an honest sacrifice. */
  HONEST_SACRIFICE_TRUST_FLOOR: 0,
  /** Affinity gain required to count a repaired breach. */
  REPAIRED_BREACH_AFFINITY_GAIN: 25,
  /** Fraction of awards one policy may hold before dominating-strategy fires. */
  DOMINATING_AWARD_FRACTION: 0.75,
} as const;

export type CommendationConfig = typeof COMMENDATION_CONFIG;
