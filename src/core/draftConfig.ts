/**
 * Information-half draft controls. These are search seeds, not balance
 * rulings; the zero consultation budget keeps today's game path unchanged.
 */
export interface DraftConfig {
  readonly CONSULTATIONS_PER_CYCLE: number;
  readonly COUNSEL_RIVALRY_PENALTY: number;
  readonly COUNSEL_STRONGLY_RECOMMEND_THRESHOLD: number;
  readonly COUNSEL_RECOMMEND_THRESHOLD: number;
  readonly COUNSEL_CAUTION_THRESHOLD: number;
  readonly COUNSEL_FORTHCOMING_CREDENCE: number;
  readonly COUNSEL_GUARDED_CREDENCE: number;
  readonly COUNSEL_RELUCTANT_CREDENCE: number;
}

export const DRAFT_CONFIG = {
  CONSULTATIONS_PER_CYCLE: 0,
  COUNSEL_RIVALRY_PENALTY: 60,
  COUNSEL_STRONGLY_RECOMMEND_THRESHOLD: 50,
  COUNSEL_RECOMMEND_THRESHOLD: 10,
  COUNSEL_CAUTION_THRESHOLD: -20,
  COUNSEL_FORTHCOMING_CREDENCE: 75,
  COUNSEL_GUARDED_CREDENCE: 50,
  COUNSEL_RELUCTANT_CREDENCE: 25,
} as const satisfies DraftConfig;
