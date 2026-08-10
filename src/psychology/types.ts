import type { PieceId } from '../core/ids';

/** Psychology-layer types. Chess imports are type-only (ADR 0013). */

export type PieceRole =
  | 'Pawn'
  | 'Knight'
  | 'Bishop'
  | 'Rook'
  | 'Queen'
  | 'King';

export interface PieceTraits {
  readonly w_honor: number;
  readonly w_courage: number;
  readonly w_ambition: number;
  readonly w_loyalty: number;
  readonly w_empathy: number;
  readonly w_prestige: number;
}

export interface ClassPrestigeMatrix {
  readonly Pawn: number;
  readonly Knight: number;
  readonly Bishop: number;
  readonly Rook: number;
  readonly Queen: number;
  readonly King: number;
}

/** Two-channel credence (ADR 0019), integer 0..100. */
export interface CredenceState {
  readonly tauBenev: number;
  readonly tauAbil: number;
  /** Per-piece ability observations retained across matches. */
  readonly abilityObservationCount: number;
}

/** Rumor scalars — appraisals only, never board facts (ADR 0016). */
export interface RumorState {
  /** Team loss probability estimate, permille 0..1000. */
  readonly pLossTeam: number;
  /** Leader appraisal -100..100. */
  readonly leaderAppraisal: number;
}

export interface PieceState {
  readonly id: PieceId;
  readonly role: PieceRole;
  readonly traits: PieceTraits;
  readonly E_i: number;
  readonly T_i: number;
  readonly M_i: number;
  readonly B_i: number;
  readonly dyadicAffinity: Readonly<Record<PieceId, number>>;
  readonly classPrestige: ClassPrestigeMatrix;
  readonly engagementFactor: number;
  readonly credence: CredenceState;
  readonly rumor: RumorState;
}

export interface CandidateMoveEvaluation {
  readonly moveNotation: string;
  /** Piece's own depth-D_i board delta (V_own component). */
  readonly deltaV_board: number;
  /** Value the piece infers the leader must see (ADR 0015). */
  readonly vLeaderImplied: number;
  readonly deltaV_capture: number;
  readonly P_captured: number;
  readonly peerSafetyDeltas: Readonly<Record<PieceId, number>>;
}

export type MoveResponseVerdict =
  | 'HEROIC_EXECUTION'
  | 'COMPLIANT_EXECUTION'
  | 'FATALISTIC_COMPLIANCE'
  | 'QUIET_QUITTING'
  | 'MORAL_REFUSAL'
  | 'DESERTION_MUTINY';

export interface MoveDecisionOutcome {
  readonly verdict: MoveResponseVerdict;
  readonly utilityScore: number;
  readonly perceivedValue: number;
  readonly refusalThreshold: number;
  readonly effectiveSearchDepth: number;
  readonly engagementFactor: number;
}

export interface DesertionContext {
  readonly P_captured: number;
  readonly P_lossIfStay: number;
  readonly P_lossIfLeave: number;
}

export interface DesertionDecisionTerms {
  readonly P_captured: number;
  readonly pain: number;
  readonly P_lossIfStay: number;
  readonly P_lossIfLeave: number;
  readonly lambda: number;
  readonly lambdaTrust: number;
  readonly lambdaMorale: number;
  readonly lambdaLoyalty: number;
  readonly lambdaAffinity: number;
  /** Positive cost subtracted from U_desert. */
  readonly standingCost: number;
  readonly gloryWeight: number;
  readonly tauBenev: number;
  readonly tauAbil: number;
}

export interface SacrificeAttribution {
  readonly removedThreatToPeer: boolean;
  readonly enabledForcedWin: boolean;
}

export type CostlySignalKind =
  | 'king_endangerment'
  | 'declined_sacrifice'
  | 'retained_piece'
  | 'avenged_capture';

export type PsychField =
  | 'T_i'
  | 'M_i'
  | 'B_i'
  | 'tauBenev'
  | 'tauAbil'
  | 'engagementFactor'
  | 'dyadicAffinity'
  | 'classPrestige';

export type MatchEvent =
  | {
      readonly t: 'MOVE';
      readonly ply: number;
      readonly san: string;
      readonly pieceId: PieceId;
      readonly verdict: MoveResponseVerdict;
      /** Centipawn-quality proxy for the order issued (ADR 0022 §5). */
      readonly orderQualityCp?: number;
    }
  | {
      readonly t: 'REFUSAL';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly san?: string;
      readonly utility: number;
      readonly threshold: number;
      readonly perceivedValue: number;
      /** Absolute private-view loss before obviousness clamping. */
      readonly privateViewLoss?: number;
      /** Private-view obviousness used for the justified-refusal authority cost. */
      readonly obviousness?: number;
      /** Ability-channel authority loss applied to the other roster members. */
      readonly authorityLoss?: number;
      /** True only when the command was bad in the audit view. */
      readonly justified?: boolean;
    }
  | {
      readonly t: 'OVERRIDE';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly san: string;
      readonly pieceTrustDelta: number;
      readonly traumaGain: number;
      /** True when the commander had no unrefused candidate remaining. */
      readonly implicit?: boolean;
    }
  | {
      readonly t: 'DESERTION';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly refusedMove: string;
      readonly uStay: number;
      readonly uDesert: number;
      readonly terms?: DesertionDecisionTerms;
      readonly departureKind: 'first' | 'cascade';
    }
  | {
      readonly t: 'DESERTION_WITNESS';
      readonly ply: number;
      readonly witnessId: PieceId;
      readonly deserterId: PieceId;
      readonly appraisal: 'brave' | 'coward';
      readonly witnessOwnValue: number;
    }
  | {
      readonly t: 'PSYCH_DELTA';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly field: PsychField;
      readonly delta: number;
    }
  | {
      readonly t: 'CAPTURE';
      readonly ply: number;
      readonly victim: PieceId;
      readonly by: PieceId;
    }
  | {
      readonly t: 'SACRIFICE_WITNESSED';
      readonly ply: number;
      readonly hero: PieceId;
      readonly beneficiary: PieceId;
    }
  | {
      readonly t: 'ROSTER_BENCH';
      readonly pieceId: PieceId;
    }
  | {
      readonly t: 'ROSTER_FIRE';
      readonly pieceId: PieceId;
    }
  | {
      readonly t: 'ROSTER_RECRUIT';
      readonly pieceId: PieceId;
    }
  | {
      readonly t: 'COSTLY_SIGNAL';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly kind: CostlySignalKind;
      readonly trustCredit: number;
    }
  | {
      /** Witness cost of fatalistic compliance (ADR 0024) — never on the move. */
      readonly t: 'FATALISTIC_WITNESS';
      readonly ply: number;
      readonly actorId: PieceId;
      readonly witnessId: PieceId;
      readonly trustDelta: number;
    };

export interface CampaignCultureDriftVector {
  readonly deltaAverageTrustLongitudinal: number;
  readonly retentionRate: number;
  readonly crossClassPrestigeShift: number;
  readonly burnoutIndex: number;
  readonly loyaltyStabilityScore: number;
}

export interface ReplayPly {
  readonly pieceId: PieceId;
  readonly san: string;
  readonly moveEval: CandidateMoveEvaluation;
  readonly desertionContext?: DesertionContext;
  readonly forced?: boolean;
}

export interface ReplayManifest {
  readonly seed: number;
  readonly roster: readonly PieceState[];
  readonly plies: readonly ReplayPly[];
}

export interface ReplayResult {
  readonly events: readonly MatchEvent[];
  readonly roster: readonly PieceState[];
}
