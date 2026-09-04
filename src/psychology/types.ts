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
  /** Rupture debt owed by this commander relationship, integer 0..configured ceiling. */
  readonly ruptureDebt: number;
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
  /** Integer mourning load, in permille (D211). */
  readonly griefLoad?: number;
  /** Integer cash held by the piece for seminar ransom (D183). */
  readonly cash?: number;
  /** Terminal-only grievance carrier; absent preserves legacy payload identity (D208). */
  readonly bitternessPermille?: number;
}

export interface CandidateMoveEvaluation {
  readonly moveNotation: string;
  /** Piece's own depth-D_i board delta (V_own component). */
  readonly deltaV_board: number;
  /** Piece's own absolute post-move score, in centipawns. */
  readonly privateScoreCp: number;
  /** Value the piece infers the leader must see (ADR 0015). */
  readonly vLeaderImplied: number;
  readonly deltaV_capture: number;
  readonly P_captured: number;
  readonly peerSafetyDeltas: Readonly<Record<PieceId, number>>;
  /** Post-move promotion prospect for the evaluated actor, 0..1000. */
  readonly promotionProspect: number;
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
  readonly pLossBoard: number;
  readonly pivotality: number;
  readonly shadowFactor: number;
  /** Post-move promotion prospect for the evaluated actor, 0..1000. */
  readonly promotionProspect: number;
}

export interface DesertionDecisionTerms {
  readonly P_captured: number;
  readonly pain: number;
  readonly P_lossIfStay: number;
  readonly P_lossIfLeave: number;
  readonly pLossBoard?: number;
  readonly pivotality?: number;
  readonly shadowFactor?: number;
  readonly attachment?: number;
  readonly lambda: number;
  readonly lambdaTrust: number;
  readonly lambdaMorale: number;
  readonly lambdaLoyalty: number;
  readonly lambdaAffinity: number;
  /** Positive cost subtracted from U_desert. */
  readonly standingCost: number;
  /** Positive own-future cost subtracted from U_desert. */
  readonly exitSelfCost?: number;
  /** Posthumous/prospective standing component, in pain units. */
  readonly prospectiveStandingCost?: number;
  /** Post-move promotion prospect used by the standing calculation. */
  readonly promotionProspect?: number;
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
      /** Overcome margin and trait-free ask (ADR 0073 addendum, D199) — debrief-only. */
      readonly courage?: {
        readonly margin: number;
        readonly asked: number;
      };
      /** Optional D213 debrief-only survivor-guilt attribution. */
      readonly guilt?: {
        readonly spentPeers: Readonly<Record<PieceId, number>>;
      };
    }
  | {
      readonly t: 'PROMOTION';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly fromRole: PieceRole;
      readonly toRole: PieceRole;
    }
  | {
      /** Hidden hope transition (ADR 0073) — debrief-only */
      readonly t: 'HOPE_EXTINGUISHED';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly object: 'promotion';
      readonly priorProspect: number;
      readonly reason: 'unreachable' | 'captured';
    }
  | {
      /** Hidden hope transition (ADR 0073) — debrief-only */
      readonly t: 'HOPE_REKINDLED';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly object: 'promotion';
      readonly prospect: number;
    }
  | {
      readonly t: 'SQUAD_FIELDING';
      readonly match: number;
      readonly side: 'w' | 'b';
      readonly pieceId: PieceId;
      readonly decision: 'fielded' | 'passed_over';
      readonly chair?: PieceRole;
      readonly originRole: PieceRole;
      readonly provenance: 'original' | 'conscript' | 'drafted';
    }
  | {
      readonly t: 'SQUAD_OBSOLESCENCE';
      readonly match: number;
      readonly side: 'w' | 'b';
      readonly pieceId: PieceId;
      readonly nonSelectionStreak: number;
    }
  | {
      readonly t: 'ABILITY_OBSERVATION';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly vindicated: boolean;
      readonly channel?: 'adjudication';
      readonly delta?: number;
    }
  | {
      readonly t: 'ABILITY_GRADE';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly wasRight: boolean;
      readonly delta: number;
      readonly channel: 'forced' | 'heeded';
    }
  | {
      readonly t: 'ABILITY_DRIP';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly streak: number;
      readonly gain: number;
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
      readonly t: 'REPAIR';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly repaid: number;
    }
  | {
      readonly t: 'REGARD';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly gained: number;
    }
  | {
      /** Hidden bitterness formation; terminal debrief only (D208). */
      readonly t: 'BITTERNESS_FORMED';
      readonly pieceId: PieceId;
      readonly trigger: 'rupture_floor' | 'not_ransomed';
      readonly bitternessPermille: number;
      readonly ply?: number;
      readonly week?: number;
    }
  | {
      readonly t: 'OVERRIDE';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly san: string;
      readonly pieceTrustDelta: number;
      /** True when the commander had no unrefused candidate remaining. */
      readonly implicit?: boolean;
      /** True when the overridden order was vindicated by the audit. */
      readonly vindicated?: boolean;
      /** Ability-channel credit applied to the witnesses. */
      readonly authorityGain?: number;
    }
  | {
      /** Terminal-only naming of witness-scaled override shame (D212). */
      readonly t: 'SHAME_EXPOSURE';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly witnesses: number;
      readonly shamePermille: number;
    }
  | {
      /** Terminal-only naming of a shared, acute fright across the fielded roster (D216). */
      readonly t: 'PANIC_ONSET';
      readonly ply: number;
      readonly side: 'w' | 'b';
      readonly trigger: 'dread' | 'king_danger';
      /** Pieces reading capture risk at or above the panic floor, sorted by id. */
      readonly dreading: readonly PieceId[];
      readonly fielded: number;
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
      readonly t: 'KING_EXPOSED_TURN_CEDED';
      readonly ply: number;
      readonly exposedKingId: PieceId;
      readonly attackerSide: 'w' | 'b';
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
      /** Terminal-only grief naming; emitted only when the load is non-zero. */
      readonly t: 'GRIEF_MOURNING';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly mournedId: PieceId;
      readonly cause: 'captured' | 'deserted' | 'career_ended';
      readonly weekOrMatch: number;
    }
  | {
      readonly t: 'POSTHUMOUS_CLASS_CREDIT';
      readonly ply: number;
      readonly witnessId: PieceId;
      readonly heroId: PieceId;
      readonly role: PieceRole;
      readonly delta: number;
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
    }
  | {
      /** Machine candidate only; a human cohort must confer any honour. */
      readonly t: 'HEROISM_NOMINATION';
      readonly ply: number;
      readonly pieceId: PieceId;
      readonly san: string;
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
