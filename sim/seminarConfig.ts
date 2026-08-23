export interface SeminarConfig {
  readonly WEEKS_PER_SEMESTER: number;
  readonly MATCHES_PER_WEEK: number;
  readonly COMMANDERS_PER_COHORT: number;
  readonly STANDING_WIN_WEIGHT: number;
  readonly STANDING_DRAW_WEIGHT: number;
  readonly STANDING_LOSS_WEIGHT: number;
}

/**
 * Seminar spine controls. The draft and its economy are deliberately absent
 * from this slice; these values determine loop dimensions and public standings.
 */
export const SEMINAR_CONFIG = {
  WEEKS_PER_SEMESTER: 4,
  MATCHES_PER_WEEK: 2,
  COMMANDERS_PER_COHORT: 2,
  STANDING_WIN_WEIGHT: 3,
  STANDING_DRAW_WEIGHT: 1,
  STANDING_LOSS_WEIGHT: -1,
} as const satisfies SeminarConfig;
