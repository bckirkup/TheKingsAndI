/**
 * Normative coefficients from docs/spec/psychology-engine.reference.ts and ADRs.
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
  QUIET_QUIT_ENGAGEMENT: 0.2,
  DESERTION_ENGAGEMENT: 0.1,
  FULL_ENGAGEMENT: 1.0,
  HEROIC_TRUST_FLOOR: 50,
  HEROIC_CAPTURE_RISK: 0.5,
  HEROIC_BOARD_DELTA: 2.0,
  /** Benevolence heard signal (ADR 0019). */
  BENEV_HEARD_STEP: 15,
  /** Logistic cliff scale for betrayal (ADR 0019). */
  BENEV_BETRAYAL_CLIFF_SCALE: 4,
  BENEV_BETRAYAL_CLIFF_DROP: 40,
  BENEV_NEGLECT_EROSION: 3,
  /** Benevolence floor below which expendable-refusal is possible. */
  BENEV_EXPENDABLE_FLOOR: 25,
  /** Minimum leader-implied gap to trigger expendable refusal. */
  BENEV_EXPENDABLE_GAP: 1.5,
  /** Ability channel Bayesian step numerator (ADR 0019). */
  ABIL_BAYES_NUMERATOR: 100,
  /** Override penalties (ADR 0014). */
  OVERRIDE_PIECE_TRUST_PENALTY: -35,
  OVERRIDE_PIECE_TRAUMA_GAIN: 20,
  OVERRIDE_WITNESS_TRUST_PENALTY: -8,
  OVERRIDE_BENEV_CLIFF_INPUT: 6,
  /** Desertion model (docs/desertion_model.md). */
  /** Team-loss stake in pain units, modulated by lambda. */
  DESERTION_COLLECTIVE_STAKE: 50,
  /** Standing lost by deserting, measured in pain units. */
  DESERTION_STANDING_STAKE: 150,
  DESERTION_RESIDUAL_STAKE: 0.3,
  DESERTION_HYSTERESIS: 0.05,
  DESERTION_PAIN_BASE: 10,
  DESERTION_PAIN_TRAUMA_SCALE: 0.5,
  DESERTION_LAMBDA_TRUST_SCALE: 0.4,
  DESERTION_LAMBDA_MORALE_SCALE: 0.3,
  DESERTION_LAMBDA_LOYALTY_SCALE: 0.2,
  DESERTION_LAMBDA_AFFINITY_SCALE: 0.1,
  /** Rumor diffusion (docs/belief_model.md, D42 provisional). */
  RUMOR_P_LOSS_RATE: 0.15,
  RUMOR_LEADER_RATE: 0.1,
  /** Match outcome trust (docs/trust_dynamics.md). */
  OUTCOME_TRUST_LOSS_SCALE: 12,
  /** Costly signal credits (docs/trust_dynamics.md §3). */
  COSTLY_SIGNAL_KING_DANGER: 25,
  COSTLY_SIGNAL_DECLINED_SACRIFICE: 15,
  COSTLY_SIGNAL_RETAINED_PIECE: 5,
  COSTLY_SIGNAL_AVENGED_CAPTURE: 10,
  /** Minimum incoming dyadic affinity for a high-`A` spared piece. */
  DECLINED_SACRIFICE_MIN_INCOMING_AFFINITY: 100,
  /** Plies within which a recapture counts as avenged (calibration knob). */
  AVENGED_CAPTURE_WINDOW_PLIES: 3,
  /** Witness desertion appraisal shifts (ADR 0018). */
  /*
   * WITNESS_BRAVE_AFFINITY_GAIN was retired: the authored brake requires an
   * affinity loss for every witness, including brave appraisals.
   */
  WITNESS_BRAVE_TRUST_LOSS: 10,
  WITNESS_COWARD_AFFINITY_LOSS: 25,
  /** Egocentric attention decay per square (docs/belief_model.md §3). */
  ATTENTION_DISTANCE_DECAY: 0.15,
  /** Maximum private evaluation displacement from the shared score (ADR 0037). */
  PRIVATE_EVAL_DISTORTION_BOUND_CP: 30,
  /** D43 trauma drift remains an explicit calibration branch, off by default. */
  PRIVATE_EVAL_TRAUMA_DRIFT: false,
} as const;

export type EngineConfig = typeof ENGINE_CONFIG;
