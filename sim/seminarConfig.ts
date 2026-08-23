export interface SeminarConfig {
  readonly WEEKS_PER_SEMESTER: number;
  readonly MATCHES_PER_WEEK: number;
  readonly COMMANDERS_PER_COHORT: number;
  readonly STANDING_WIN_WEIGHT: number;
  readonly STANDING_DRAW_WEIGHT: number;
  readonly STANDING_LOSS_WEIGHT: number;
  readonly DRAFT_AT_CYCLE_ONE: boolean;
  readonly DRAFT_CONSULTATIONS_PER_CYCLE: number;
  readonly DRAFT_COUNSEL_WILLINGNESS_WEIGHT_PERMILLE: number;
}

/**
 * Seminar controls. Draft magnitudes remain search seeds, not balance rulings.
 */
export const SEMINAR_CONFIG = {
  WEEKS_PER_SEMESTER: 4,
  MATCHES_PER_WEEK: 2,
  COMMANDERS_PER_COHORT: 2,
  STANDING_WIN_WEIGHT: 3,
  STANDING_DRAW_WEIGHT: 1,
  STANDING_LOSS_WEIGHT: -1,
  DRAFT_AT_CYCLE_ONE: false,
  DRAFT_CONSULTATIONS_PER_CYCLE: 4,
  DRAFT_COUNSEL_WILLINGNESS_WEIGHT_PERMILLE: 250,
} as const satisfies SeminarConfig;
