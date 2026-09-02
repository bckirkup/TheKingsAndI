/**
 * Normative coefficients from docs/spec/psychology-engine.reference.ts and ADRs.
 * Every knob here must have a wiring (sensitivity) probe; pin a golden only
 * once the default is intentionally frozen (docs/testing_strategy.md).
 */
export const ENGINE_CONFIG = {
  /** Vindication baseline: the piece's expectation is the shipped default. */
  VINDICATION_BASELINE: 'expectation' as 'expectation' | 'oracle',
  MIN_SEARCH_DEPTH: 2,
  MAX_SEARCH_DEPTH: 16,
  DEFAULT_BENCHING_SELF_PENALTY: -30,
  DEFAULT_BENCHING_PEER_BASE_PENALTY: -10,
  DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE: 20,
  /** Class prestige awarded when a witnessed sacrifice is later captured. */
  DEFAULT_CLASS_SHIFT_POSTHUMOUS_SACRIFICE: 10,
  /** Maximum sacrifice-to-capture distance for posthumous class credit. */
  POSTHUMOUS_SACRIFICE_LOOKBACK_PLIES: 3,
  DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE: 50,
  /** Keep promoted roles on their original campaign chair only when enabled. */
  PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES: false,
  /** Signed class-prestige shift witnesses apply to a promotion's origin class. */
  PROMOTION_CLASS_PRESTIGE_SHIFT: 0,
  LEADERSHIP_WEIGHTS: {
    alpha: 0.4,
    beta: 0.3,
    gamma: 0.2,
    delta: 0.1,
    epsilon: 0.2,
  },
  /** Attribution window for unvindicated override trauma, in plies. */
  UNJUSTIFIED_TRAUMA_WINDOW_PLIES: 2,
  QUIET_QUIT_ENGAGEMENT: 0.2,
  DESERTION_ENGAGEMENT: 0.1,
  FULL_ENGAGEMENT: 1.0,
  HEROIC_TRUST_FLOOR: 50,
  HEROIC_CAPTURE_RISK: 0.5,
  HEROIC_BOARD_DELTA: 2.0,
  /** Benevolence heard signal (ADR 0019). */
  BENEV_HEARD_STEP: 15,
  /** Benevolence regard signal after consecutive safe, valuable orders. */
  BENEV_REGARD_STEP: 50,
  BENEV_REGARD_STREAK_PLIES: 3,
  BENEV_REGARD_RISK_CEILING: 0.15,
  /** Benevolence repair applied after an honoured refusal. */
  BENEV_REPAIR_STEP: 30,
  /** Logistic cliff scale for betrayal (ADR 0019). */
  BENEV_BETRAYAL_CLIFF_SCALE: 4,
  BENEV_BETRAYAL_CLIFF_DROP: 40,
  /** Remaining benevolence fraction charged by a betrayal, in permille (D167). */
  BENEV_BETRAYAL_CLIFF_PERMILLE: 250,
  /** Maximum rupture debt recorded for a commander relationship (D167). */
  BENEV_RUPTURE_DEBT_CEILING: 100,
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
  OVERRIDE_WITNESS_TRUST_PENALTY: -8,
  OVERRIDE_BENEV_CLIFF_INPUT: 6,
  /** Logistic cliff input used for benevolence loss by override witnesses (D167). */
  OVERRIDE_WITNESS_BENEV_CLIFF_INPUT: 6,
  /** Scales the witness benevolence charge relative to the target's (D174). */
  OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE: 500,
  /** How strongly a witness's bond to the overridden piece raises its own charge (D170). */
  OVERRIDE_STANDING_PRICE_PERMILLE: 2_000,
  /** Flat injury from being captured (ADR 0049). */
  CAPTURE_TRAUMA_GAIN: 20,
  /** Capture-risk threshold for sustained dread injury (ADR 0049). */
  DREAD_CAPTURE_RISK_THRESHOLD: 0.75,
  /** Small injury applied after sustained serious capture risk (ADR 0049). */
  DREAD_TRAUMA_GAIN: 5,
  /** Consecutive private-risk observations required for dread injury (ADR 0049). */
  DREAD_REQUIRED_PLIES: 2,
  /** Canonical trauma ceiling at which a non-King career retires. */
  RETIREMENT_TRAUMA_THRESHOLD: 100,
  /** Chance of grace per eligible career at a campaign boundary, permille. */
  GRACE_RATE_PERMILLE: 0,
  /** Flat trauma relief granted by a successful grace event. */
  GRACE_RELIEF: 0,
  /** Fraction of the gap to the dawn baseline restored at each match boundary, permille (D207). */
  MORNING_LIFT_PERMILLE: 1000,
  /** Trust baseline the morning lift reaches toward; earned trust above it is never dampened (D207). */
  MORNING_LIFT_TRUST_BASELINE: 0,
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
  /** Calibrated base step scale for earned ability judgments (D149). */
  ABIL_EARNED_STEP_SCALE: 2,
  /**
   * Integer curvature for earned ability gains and losses; at mid-ability this
   * makes a loss step roughly three times a gain step (ADR 0043).
   */
  ABIL_EARNED_CURVATURE: 2,
  /**
   * Additional multiplier applied when a piece's judgment is proved wrong.
   * Curvature supplies the quick-to-lose asymmetry, so this remains 1.
   */
  ABIL_EARNED_LOSS_MULTIPLIER: 1,
  /** Multiplier applied to gains when a justified refusal is heeded. */
  ABIL_EARNED_HEEDED_GAIN_MULTIPLIER: 2,
  /** Trust-to-refusal threshold slope in board-value units. */
  REFUSAL_THRESHOLD_TRUST_SCALE: 0.03,
  /** Desertion model (docs/desertion_model.md). */
  /** Team-loss stake in pain units, modulated by lambda. */
  DESERTION_COLLECTIVE_STAKE: 50,
  /** Standing lost by deserting, measured in pain units. */
  DESERTION_STANDING_STAKE: 150,
  DESERTION_RESIDUAL_STAKE: 0.3,
  DESERTION_HYSTERESIS: 0.05,
  /** Attachment weight applied to the stay collective stake, permille. */
  DESERTION_STAY_ATTACHMENT_PERMILLE: 1_000,
  /** Own-future cost charged when a piece permanently exits, permille. */
  DESERTION_EXIT_PERMANENCE_PERMILLE: 625,
  /** Weight of one peer-bond equivalent of promotion hope, clamped to 1000 permille. */
  DESERTION_PROMOTION_HOPE_PERMILLE: 500,
  /** Minimum ability credence retained by promotion hope, permille. */
  DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE: 250,
  DESERTION_PAIN_BASE: 10,
  DESERTION_PAIN_TRAUMA_SCALE: 0.5,
  DESERTION_LAMBDA_TRUST_SCALE: 0.4,
  DESERTION_LAMBDA_MORALE_SCALE: 0.3,
  DESERTION_LAMBDA_LOYALTY_SCALE: 0.2,
  DESERTION_LAMBDA_AFFINITY_SCALE: 0.1,
  /** Board-score scale for the rational private loss map, in centipawns. */
  DESERTION_BOARD_LOSS_SCALE_CP: 500,
  /** Weight of the private board loss read in the stay-loss blend, permille. */
  DESERTION_BOARD_LOSS_WEIGHT_PERMILLE: 500,
  /** Scale applied to the departing piece's remaining-force share, permille. */
  DESERTION_PIVOTALITY_SCALE_PERMILLE: 500,
  /** Strength of the impending-loss shadow on private and standing costs, permille. */
  DESERTION_SHADOW_SCALE_PERMILLE: 1_000,
  /** Conventional material weights used for desertion pivotality. */
  DESERTION_ROLE_FORCE_WEIGHTS: {
    Pawn: 1,
    Knight: 3,
    Bishop: 3,
    Rook: 5,
    Queen: 9,
    King: 0,
  },
  /** Rumor diffusion (docs/belief_model.md, D42 provisional). */
  RUMOR_P_LOSS_RATE: 0.15,
  RUMOR_LEADER_RATE: 0.1,
  /** Percent of the roster's commander appraisal carried into ability credence (ADR 0065, D169). */
  RUMOR_APPRAISAL_ABIL_WEIGHT: 0,
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
