export interface SeminarConfig {
  readonly WEEKS_PER_SEMESTER: number;
  readonly MATCHES_PER_WEEK: number;
  readonly COMMANDERS_PER_COHORT: number;
}

/**
 * Seminar spine controls. The draft and its economy are deliberately absent
 * from this slice; these values only determine the loop dimensions.
 */
export const SEMINAR_CONFIG = {
  WEEKS_PER_SEMESTER: 4,
  MATCHES_PER_WEEK: 2,
  COMMANDERS_PER_COHORT: 2,
} as const satisfies SeminarConfig;
