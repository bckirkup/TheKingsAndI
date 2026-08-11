/**
 * Normative coefficients from docs/spec/psychology-engine.reference.ts and ADRs.
 * Every knob here must have a golden test and a sensitivity probe.
 */
export const ENGINE_CONFIG = {
  /** Vindication baseline: the piece's expectation is the shipped default. */
  VINDICATION_BASELINE: 'expectation' as 'expectation' | 'oracle',
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
  /**
   * Placeholder prior strength for ability credence (ADR 0039).
   * The owner will choose the calibrated value.
   */
  ABIL_PRIOR_STRENGTH: 10,
  /** Multiplier applied to falsified ability observations (ADR 0043). */
  ABIL_VINDICATION_LOSS_MULTIPLIER: 2,
  /** Integer curvature strength for current-level ability steps (ADR 0043). */
  ABIL_VINDICATION_CURVATURE: 2,
  /** Integer curvature strength for safe-play ability drip (ADR 0044). */
  ABIL_DRIP_CURVATURE: 2,
  /** Trust/trauma multiplier for pessimistic vindication expectations (D114). */
  VINDICATION_PESSIMISM_SCALE: 100,
  /** Override penalties (ADR 0014). */
  OVERRIDE_PIECE_TRUST_PENALTY: -35,
  OVERRIDE_PIECE_TRAUMA_GAIN: 20,
  OVERRIDE_WITNESS_TRUST_PENALTY: -8,
  OVERRIDE_BENEV_CLIFF_INPUT: 6,
  /** Ability-channel authority loss when a justified refusal is accepted. */
  REFUSAL_AUTHORITY_LOSS_SCALE: 20,
  /** Ability-channel credit for executed-order vindication. */
  ABIL_VINDICATION_GAIN_SCALE: 20,
  /** Match-end ability credit per contested win, disabled by default. */
  ABIL_OUTCOME_VINDICATION_SCALE: 0,
  /** Ability credence drip after an uninterrupted safe-play stretch (ADR 0044). */
  ABIL_DRIP_SCALE: 4,
  /** Near-refusal margin in utility units that qualifies for adjudication (ADR 0044). */
  ABIL_VINDICATION_NEAR_REFUSAL_MARGIN: 0.25,
  /** Trust-to-refusal threshold slope in board-value units. */
  REFUSAL_THRESHOLD_TRUST_SCALE: 0.03,
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
  /**
   * Fatalistic compliance (ADR 0024): high personal capture risk with low
   * ability credence — the piece still executes at full engagement.
   */
  FATALISTIC_CAPTURE_RISK: 0.55,
  FATALISTIC_TAU_ABIL_CEILING: 35,
  /** Witness trust penalty when a peer marches under fatalistic compliance. */
  FATALISTIC_WITNESS_TRUST_PENALTY: -12,
  /** Actor future-willingness hit after fatalistic compliance. */
  FATALISTIC_ACTOR_ENGAGEMENT_PENALTY: 0.25,
} as const;

export type EngineConfig = typeof ENGINE_CONFIG;
