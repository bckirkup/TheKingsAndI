/**
 * Normative coefficients from `docs/spec/psychology-engine.reference.ts`.
 * Every knob here must have a golden test and a sensitivity probe.
 */
export const ENGINE_CONFIG = {
  MIN_SEARCH_DEPTH: 2,
  MAX_SEARCH_DEPTH: 16,
  DEFAULT_BENCHING_SELF_PENALTY: -30,
  DEFAULT_BENCHING_PEER_BASE_PENALTY: -10,
  DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE: 20,
  DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE: 50,
  LEADERSHIP_WEIGHTS: {
    alpha: 0.4,
    beta: 0.3,
    gamma: 0.2,
    delta: 0.1,
  },
  /** Quiet-quitting engagement η (docs/psychology_engine.md §3). */
  QUIET_QUIT_ENGAGEMENT: 0.2,
  /** Full engagement η for compliant and heroic execution. */
  FULL_ENGAGEMENT: 1.0,
  /** Heroic trust floor (docs/psychology_engine.md §6 rule 4). */
  HEROIC_TRUST_FLOOR: 50,
  /** Heroic danger threshold on P_captured. */
  HEROIC_CAPTURE_RISK: 0.5,
  /** Heroic board-value threshold on ΔV_board. */
  HEROIC_BOARD_DELTA: 2.0,
} as const;

export type EngineConfig = typeof ENGINE_CONFIG;
