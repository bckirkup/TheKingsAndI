/**
 * Information-half draft controls. The zero seed keeps today's game path
 * unchanged until the draft consultation surface is deliberately enabled.
 */
export const DRAFT_CONFIG = {
  CONSULTATIONS_PER_CYCLE: 0,
};

export interface DraftConfig {
  readonly CONSULTATIONS_PER_CYCLE: number;
}
