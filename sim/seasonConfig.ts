import { SQUAD_CONFIG, type SquadConfig } from '../src/orchestration';

/**
 * Season pool controls. These are deliberately open calibration knobs:
 * changing them must alter the season output, but no value here is a balance
 * ruling.
 */
export type SeasonConfig = SquadConfig;

/** Harness view of the shipped squad-fielding controls. */
export const SEASON_CONFIG: SeasonConfig = SQUAD_CONFIG;
