/**
 * Living Chess - Psychological Engine Mathematical Specification
 * Machine-readable implementation of core equations, utility functions, 
 * trust decay rules, and state transition thresholds.
 */

// ============================================================================
// 1. DATA MODELS & TYPES
// ============================================================================

export type PieceRole = 'Pawn' | 'Knight' | 'Bishop' | 'Rook' | 'Queen' | 'King';

export interface PieceTraits {
  /** Value placed on heroic achievement and fair leadership (0.0 to 1.0) */
  w_honor: number;
  /** Resistance to fear when facing capture or high risk (0.0 to 1.0) */
  w_courage: number;
  /** Desire to engage high-value targets like Queens and Rooks (0.0 to 1.0) */
  w_ambition: number;
  /** Weight placed on player trust vs. self-preservation (0.0 to 1.0) */
  w_loyalty: number;
  /** Sensitivity to the safety and fair treatment of peers (0.0 to 1.0) */
  w_empathy: number;
  /** Sensitivity to rank and role status (0.0 to 1.0) */
  w_prestige: number;
}

export interface ClassPrestigeMatrix {
  Pawn: number;   // -100 to +100
  Knight: number; // -100 to +100
  Bishop: number; // -100 to +100
  Rook: number;   // -100 to +100
  Queen: number;  // -100 to +100
  King: number;   // -100 to +100
}

export interface PieceState {
  id: string;
  role: PieceRole;
  traits: PieceTraits;
  /** Experience Level (1 to 100) */
  E_i: number;
  /** Trust in Leader (-100 to +100) */
  T_i: number;
  /** Morale & Courage (0 to 100) */
  M_i: number;
  /** Betrayal / Disillusionment Score (0 to 100) */
  B_i: number;
  /** Dyadic Affinity Vector: Map of peer piece ID to affinity (-100 to +100) */
  dyadicAffinity: Record<string, number>;
  /** Class Prestige Matrix: Baseline attitude toward each role (-100 to +100) */
  classPrestige: ClassPrestigeMatrix;
  /** Current Engagement Factor (0.1 to 1.0) */
  engagementFactor: number;
}

export interface CandidateMoveEvaluation {
  moveNotation: string;
  /**
   * Piece-private board evaluation delta: after the commanded move minus the
   * before-position score, at the piece's own depth/profile (-10.0 to +10.0).
   */
  deltaV_board: number;
  /** Value of captured enemy piece (Pawn=1, N/B=3, R=5, Q=9, K=0) */
  deltaV_capture: number;
  /** Estimated probability of this piece being captured next turn (0.0 to 1.0) */
  P_captured: number;
  /** Safety changes for peers: Map of peer ID to safety delta (-1.0 to +1.0) */
  peerSafetyDeltas: Record<string, number>;
}

export type MoveResponseVerdict =
  | 'HEROIC_EXECUTION'
  | 'COMPLIANT_EXECUTION'
  | 'FATALISTIC_COMPLIANCE'
  | 'QUIET_QUITTING'
  | 'MORAL_REFUSAL'
  | 'DESERTION_MUTINY';

export interface MoveDecisionOutcome {
  verdict: MoveResponseVerdict;
  utilityScore: number;
  refusalThreshold: number;
  effectiveSearchDepth: number;
  engagementFactor: number;
}

export interface DesertionContext {
  P_captured: number;
  P_lossIfStay: number;
  P_lossIfLeave: number;
}

// ============================================================================
// 2. DEFAULT COEFFICIENTS & CONFIGURATION
// ============================================================================

export const ENGINE_CONFIG = {
  MIN_SEARCH_DEPTH: 2,
  MAX_SEARCH_DEPTH: 16,
  DEFAULT_BENCHING_SELF_PENALTY: -30,
  DEFAULT_BENCHING_PEER_BASE_PENALTY: -10,
  DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE: 20,
  DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE: 50,
  REFUSAL_AUTHORITY_LOSS_SCALE: 20,
  REFUSAL_THRESHOLD_TRUST_SCALE: 0.03,
  LEADERSHIP_WEIGHTS: {
    alpha: 0.4, // Final Trust weight
    beta: 0.3,  // Win Score weight
    gamma: 0.2, // Unjustified Trauma weight
    delta: 0.1, // Quiet Quit Turns weight
    epsilon: 0.2, // Emptied Chairs weight (D202: ruled 0.2, 2026-08-30)
  },
  /** Fraction of the gap to the dawn baseline restored at each match boundary, permille (D207). */
  MORNING_LIFT_PERMILLE: 400,
  /** Trust baseline the morning lift reaches toward; earned trust above it is never dampened (D207). */
  MORNING_LIFT_TRUST_BASELINE: 0,
};

// ============================================================================
// 3. CORE MATHEMATICAL FORMULAS
// ============================================================================

/**
 * D207: apply a deterministic, lift-only trust movement toward the dawn
 * baseline at a match boundary. Only T_i changes; no leader input or PRNG draw
 * is involved.
 */
export function applyMorningLift(piece: PieceState): PieceState {
  const permille = Math.max(
    0,
    Math.min(1_000, Math.trunc(ENGINE_CONFIG.MORNING_LIFT_PERMILLE)),
  );
  const baseline = Math.max(
    -100,
    Math.min(100, Math.trunc(ENGINE_CONFIG.MORNING_LIFT_TRUST_BASELINE)),
  );
  if (permille === 0 || piece.T_i >= baseline) return piece;
  return {
    ...piece,
    T_i: Math.max(
      -100,
      Math.min(
        100,
        piece.T_i + Math.trunc(((baseline - piece.T_i) * permille) / 1000),
      ),
    ),
  };
}

/**
 * Section 4.2: Search Engine & Insight Allocation Formula
 * Calculates the Stockfish depth allocation based on piece experience and engagement.
 * * Equation: D_i = max(1, floor(D_min + eta_i * (E_i / 100) * (D_max - D_min)))
 */
export function calculateEngineSearchDepth(
  experienceLevel: number, // E_i (1..100)
  engagementFactor: number, // eta_i (0.1..1.0)
  dMin: number = ENGINE_CONFIG.MIN_SEARCH_DEPTH,
  dMax: number = ENGINE_CONFIG.MAX_SEARCH_DEPTH
): number {
  const boundedExperience = Math.max(1, Math.min(100, experienceLevel));
  const boundedEngagement = Math.max(0.1, Math.min(1.0, engagementFactor));
  
  const rawDepth = dMin + boundedEngagement * (boundedExperience / 100) * (dMax - dMin);
  return Math.max(1, Math.floor(rawDepth));
}

/**
 * Section 4.3: Inter-Piece Protection Term Phi(P_i, P_j, m)
 * Calculates the utility impact of how a move changes the safety of a specific peer.
 * * Equation: Phi(P_i, P_j, m) = w_empathy * ((A_{i,j} + C_{i,Role(j)}) / 200) * Delta_Safety_j(m)
 */
export function calculateInterPieceProtection(
  w_empathy: number,
  dyadicAffinity_ij: number, // A_{i,j} (-100..+100)
  classPrestige_roleJ: number, // C_{i,Role(j)} (-100..+100)
  peerSafetyDelta: number // Delta_Safety_j(m) (-1.0..+1.0)
): number {
  const normalizedRelationship = (dyadicAffinity_ij + classPrestige_roleJ) / 200; // -1.0 to +1.0
  return w_empathy * normalizedRelationship * peerSafetyDelta;
}

/**
 * Section 4.3: Personal Move Utility Equation U(P_i, m)
 * Evaluates whether a piece finds a proposed move acceptable.
 * * Equation: U(P_i, m) = w_loyalty * T_i + w_honor * Delta_V_board + w_ambition * Delta_V_capture
 * - (1 - w_courage) * P_captured + sum_{j != i} Phi(P_i, P_j, m)
 */
export function calculateMoveUtility(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  allActivePieces: PieceState[]
): number {
  const { traits, T_i } = actor;
  
  const loyaltyTerm = traits.w_loyalty * T_i;
  const honorTerm = traits.w_honor * moveEval.deltaV_board;
  const ambitionTerm = traits.w_ambition * moveEval.deltaV_capture;
  const riskTerm = (1 - traits.w_courage) * moveEval.P_captured;

  // Calculate peer protection sum across all active teammates
  let protectionSum = 0;
  for (const peer of allActivePieces) {
    if (peer.id === actor.id) continue;

    const affinity_ij = actor.dyadicAffinity[peer.id] ?? 0;
    const classPrestige_j = actor.classPrestige[peer.role] ?? 0;
    const safetyDelta_j = moveEval.peerSafetyDeltas[peer.id] ?? 0;

    protectionSum += calculateInterPieceProtection(
      traits.w_empathy,
      affinity_ij,
      classPrestige_j,
      safetyDelta_j
    );
  }

  return loyaltyTerm + honorTerm + ambitionTerm - riskTerm + protectionSum;
}

/**
 * Section 4.3 / 4.4: Refusal Threshold Theta_refusal
 * Calculates the utility threshold below which a move will be rejected.
 * * Equation: Theta_refusal = -3 + (100 - T_i) * REFUSAL_THRESHOLD_TRUST_SCALE
 */
export function calculateRefusalThreshold(trustLevel: number): number {
  return (
    -3 +
    (100 - trustLevel) * ENGINE_CONFIG.REFUSAL_THRESHOLD_TRUST_SCALE
  );
}

/**
 * Section 4.4: Spectrum of Resistance & Moral Mutiny State Machine
 * Determines piece obedience, quiet quitting, refusal, or mutiny based on utility & trust.
 */
export function evaluateMoveResponse(
  actor: PieceState,
  moveEval: CandidateMoveEvaluation,
  allActivePieces: PieceState[],
  desertionContext?: DesertionContext
): MoveDecisionOutcome {
  const utilityScore = calculateMoveUtility(actor, moveEval, allActivePieces);
  const refusalThreshold = calculateRefusalThreshold(actor.T_i);
  void desertionContext;

  /*
   * ADR 0011 supersedes the historical hard gate below. Production evaluates
   * expected-cost desertion at the actor's decision point:
   *
   *   U_stay   = -P_captured * pain_i
   *              - P_lossIfStay * lambda_i * collective_stake
   *   U_desert = -P_lossIfLeave * lambda_i * collective_stake * residual_stake
   *              - audience_standing_i * glory_i * standing_stake
   *
   * audience_standing_i is the sum of each remaining peer's non-negative
   * affinity-plus-class-prestige bond toward the actor, normalized by the
   * standard fifteen-peer roster scale.
   *
   * with desertion when U_desert > U_stay + hysteresis and the actor is not
   * the King. This retained branch documents the pre-ADR reference only; it
   * is not the production decision rule.
   */
  // The expected-cost reducer is implemented in src/psychology/desertion.ts;
  // this reference keeps the context in the signature without duplicating it.

  // HISTORICAL / SUPERSEDED: ADR 0011 replaced this hard gate.
  if (actor.T_i <= -75 && actor.M_i === 0) {
    return {
      verdict: 'DESERTION_MUTINY',
      utilityScore,
      refusalThreshold,
      effectiveSearchDepth: 1,
      engagementFactor: 0.1
    };
  }

  // 2. Check for Moral Refusal Stage
  if (utilityScore < refusalThreshold) {
    return {
      verdict: 'MORAL_REFUSAL',
      utilityScore,
      refusalThreshold,
      effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, 0.2),
      engagementFactor: 0.2
    };
  }

  // 3. Check for Quiet Quitting / Malicious Compliance Stage
  if (utilityScore < 0 || actor.T_i <= 0) {
    // 3b. Fatalistic compliance (ADR 0024) — full engagement when capture risk
    // is high. Ability-credence gate lives in src/psychology/verdict.ts.
    if (moveEval.P_captured >= 0.55) {
      return {
        verdict: 'FATALISTIC_COMPLIANCE',
        utilityScore,
        refusalThreshold,
        effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, 1.0),
        engagementFactor: 1.0
      };
    }
    const engagement = 0.2;
    return {
      verdict: 'QUIET_QUITTING',
      utilityScore,
      refusalThreshold,
      effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, engagement),
      engagementFactor: engagement
    };
  }

  // 4. Check for Heroic Execution vs Standard Compliance
  const isHeroic = actor.T_i > 50 && (moveEval.P_captured > 0.5 || moveEval.deltaV_board > 2.0);
  const engagement = 1.0;

  return {
    verdict: isHeroic ? 'HEROIC_EXECUTION' : 'COMPLIANT_EXECUTION',
    utilityScore,
    refusalThreshold,
    effectiveSearchDepth: calculateEngineSearchDepth(actor.E_i, engagement),
    engagementFactor: engagement
  };
}

// ============================================================================
// 4. EVENT-DRIVEN RELATIONAL SHIFTS
// ============================================================================

/**
 * Section 4.5: Witnessed Heroic Sacrifice Shift
 * Updates Dyadic Affinity (A_r,p) and Class Prestige (C_Rook,Pawn) upon witnessing a hero hold.
 */
export function applyWitnessedSacrificeEvent(
  observer: PieceState,
  heroPiece: PieceState,
  affinityShift: number = ENGINE_CONFIG.DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE,
  classShift: number = ENGINE_CONFIG.DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE
): PieceState {
  const currentAffinity = observer.dyadicAffinity[heroPiece.id] ?? 0;
  const newAffinity = Math.max(-100, Math.min(100, currentAffinity + affinityShift));

  const currentClassPrestige = observer.classPrestige[heroPiece.role] ?? 0;
  const newClassPrestige = Math.max(-100, Math.min(100, currentClassPrestige + classShift));

  return {
    ...observer,
    dyadicAffinity: {
      ...observer.dyadicAffinity,
      [heroPiece.id]: newAffinity
    },
    classPrestige: {
      ...observer.classPrestige,
      [heroPiece.role]: newClassPrestige
    }
  };
}

/**
 * Section 4.6: Roster Reassignment & Inactive Pool Disillusionment Mechanics
 * Calculates trust penalties when a piece is benched to the reserve pool.
 * * Sidelined Piece Penalty: Delta T_benched = -30
 * Active Peer Penalty: Delta T(P_j) = -10 * (1 + w_empathy,j) * S(P_j, P_benched)
 */
export function calculateBenchingTrustPenalties(
  benchedPiece: PieceState,
  survivingActivePieces: PieceState[],
  sharedBondMap: Record<string, number> // S(P_j, P_benched) between 0.0 and 1.0
): { benchedPieceNewTrust: number; updatedPeers: PieceState[] } {
  // Sidelined piece self-penalty
  const benchedPieceNewTrust = Math.max(-100, benchedPiece.T_i + ENGINE_CONFIG.DEFAULT_BENCHING_SELF_PENALTY);

  // Active peer penalties
  const updatedPeers = survivingActivePieces.map((peer) => {
    const sharedBond = sharedBondMap[peer.id] ?? 0;
    const deltaT_j = ENGINE_CONFIG.DEFAULT_BENCHING_PEER_BASE_PENALTY * (1 + peer.traits.w_empathy) * sharedBond;
    const newTrust = Math.max(-100, Math.min(100, peer.T_i + deltaT_j));

    return {
      ...peer,
      T_i: newTrust
    };
  });

  return { benchedPieceNewTrust, updatedPeers };
}

// ============================================================================
// 5. CAMPAIGN & MATCH PERFORMANCE AUDIT
// ============================================================================

/**
 * Section 4.7: Single-Match Leadership Audit Index
 * Equation: Leadership Index = alpha * T_final + beta * WinScore - gamma * UnjustifiedTrauma - delta * QuietQuitTurns - epsilon * EmptiedChairs
 * T_final is meaned over the fielded roster; a departed piece contributes the
 * trust it left with (D202: no witness leaves the reading).
 * EmptiedChairs = clamp(100 * (desertions + trauma-ended careers among the
 * fielded) / fielded roster size, 0, 100).
 */
export function calculateSingleMatchLeadershipIndex(
  finalAverageTrust: number, // T_final (-100 to +100), fielded population
  winScore: number, // 0 to 100
  unjustifiedTraumaScore: number, // 0 to 100
  quietQuitTurnCount: number,
  emptiedChairsScore = 0, // 0 to 100
  weights = ENGINE_CONFIG.LEADERSHIP_WEIGHTS
): number {
  return (
    weights.alpha * finalAverageTrust +
    weights.beta * winScore -
    weights.gamma * unjustifiedTraumaScore -
    weights.delta * quietQuitTurnCount -
    weights.epsilon * emptiedChairsScore
  );
}

/**
 * Section 4.8: Longitudinal Team Culture Drift Vector K_campaign
 */
export interface CampaignCultureDriftVector {
  deltaAverageTrustLongitudinal: number;
  retentionRate: number; // 0.0 to 1.0
  crossClassPrestigeShift: number; // Delta C_cross-class
  burnoutIndex: number; // 0 to 100
  loyaltyStabilityScore: number; // 0 to 100
}

export function compileCampaignCultureDrift(
  initialAvgTrust: number,
  finalAvgTrust: number,
  reassignedCount: number,
  totalRosterSize: number,
  classPrestigeDeltaSum: number,
  quietQuitTurnsTotal: number
): CampaignCultureDriftVector {
  const deltaAverageTrustLongitudinal = finalAvgTrust - initialAvgTrust;
  const retentionRate = Math.max(0, (totalRosterSize - reassignedCount) / totalRosterSize);
  const burnoutIndex = Math.min(100, quietQuitTurnsTotal * 2.5);
  const loyaltyStabilityScore = Math.max(0, 100 - burnoutIndex + Math.max(0, deltaAverageTrustLongitudinal));

  return {
    deltaAverageTrustLongitudinal,
    retentionRate,
    crossClassPrestigeShift: classPrestigeDeltaSum,
    burnoutIndex,
    loyaltyStabilityScore
  };
}
