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

export interface PieceState {
  readonly id: PieceId;
  readonly role: PieceRole;
  readonly traits: PieceTraits;
  /** Experience level (1..100). */
  readonly E_i: number;
  /** Trust in leader (-100..100), integer-valued. */
  readonly T_i: number;
  /** Morale and courage (0..100). */
  readonly M_i: number;
  /** Betrayal / disillusionment (0..100). */
  readonly B_i: number;
  readonly dyadicAffinity: Readonly<Record<PieceId, number>>;
  readonly classPrestige: ClassPrestigeMatrix;
  /** Engagement factor η_i (0.1..1.0). */
  readonly engagementFactor: number;
}

export interface CandidateMoveEvaluation {
  readonly moveNotation: string;
  /** Board evaluation delta from the piece's own depth-D_i view. */
  readonly deltaV_board: number;
  readonly deltaV_capture: number;
  readonly P_captured: number;
  readonly peerSafetyDeltas: Readonly<Record<PieceId, number>>;
}

export type MoveResponseVerdict =
  | 'HEROIC_EXECUTION'
  | 'COMPLIANT_EXECUTION'
  | 'QUIET_QUITTING'
  | 'MORAL_REFUSAL'
  | 'DESERTION_MUTINY';

export interface MoveDecisionOutcome {
  readonly verdict: MoveResponseVerdict;
  readonly utilityScore: number;
  readonly refusalThreshold: number;
  readonly effectiveSearchDepth: number;
  readonly engagementFactor: number;
}

export type PsychField =
  | 'T_i'
  | 'M_i'
  | 'B_i'
  | 'engagementFactor'
  | 'dyadicAffinity'
  | 'classPrestige';

/** Append-only match events — the source of truth (AGENTS.md rule 5). */
export type MatchEvent =
  | {
      readonly t: 'MOVE';
      readonly ply: number;
      readonly san: string;
      readonly pieceId: PieceId;
      readonly verdict: MoveResponseVerdict;
    }
  | {
      readonly t: 'REFUSAL';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly utility: number;
      readonly threshold: number;
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
    };

export interface CampaignCultureDriftVector {
  readonly deltaAverageTrustLongitudinal: number;
  readonly retentionRate: number;
  readonly crossClassPrestigeShift: number;
  readonly burnoutIndex: number;
  readonly loyaltyStabilityScore: number;
}
