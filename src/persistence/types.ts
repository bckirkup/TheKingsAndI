import type {
  CampaignCultureDriftVector,
  CredenceState,
  MatchEvent,
  MoveResponseVerdict,
  PieceRole,
  PieceState,
} from '../psychology';
import type { EngineAuditEntry } from '../engine';
import type { LeaderId } from '../core/ids';

export const SCHEMA_VERSION = 4;
export const CULTURE_DRIFT_FOLD_VERSION = 'culture-drift-v1';
export const AUDIT_FOLD_VERSION = 'audit-v3';
export const TRANSCRIPT_FOLD_VERSION = 'transcript-v1';
export const JUDGEMENT_SEAT_FOLD_VERSION = 'judgement-seat-v3';
export const COURAGE_FOLD_VERSION = 'courage-v1';
export const HOPE_FOLD_VERSION = 'hope-v1';
export const CERTIFICATE_VERSION = 'certificate-v1';
export const PASSPORT_VERSION = 'passport-v1';
export const PSYCH_CONFIG_VERSION = 'engine-config-v1';
export const DETERMINISM_ID = 'heuristic-eval-v1';
export const COMMENDATION_FOLD_VERSION = 'commendations-v2';
export const LEARNING_DELTA_FOLD_VERSION = 'learning-delta-v1';
export const SERVICE_RECORD_FOLD_VERSION = 'service-record-v2';

/** Why a commander was dismissed (ADR 0024 §3). */
export type DismissalCause = 'dismissed_by_room' | 'dismissed_by_king';

export type PieceStatus =
  | 'ACTIVE'
  | 'BENCHED'
  | 'CAPTURED'
  | 'DESERTED'
  | 'FIRED'
  | 'RETIRED';

export type MatchResult =
  | 'WIN'
  | 'LOSS'
  | 'DRAW'
  | 'ROUT'
  | 'DISMISSED'
  | 'ABANDONED';

export type ActTerminalState =
  | 'ongoing'
  | 'checkmate'
  | 'dismissal'
  | 'rout'
  | 'victory';

export type CareerOutcome = 'ongoing' | 'victory' | 'dismissed' | 'exhausted';

export interface PieceIdentityRecord {
  readonly id: string;
  readonly name: string;
  readonly bornInMatch: number;
  readonly originRole: PieceRole;
  readonly attainedRole?: PieceRole;
  /** Stable seed minted when this identity was created. */
  readonly identityCreationSeed?: number;
  /** Stable individual prior, before any commander-specific evidence. */
  readonly disposition?: CredenceState;
  /** Learned credence keyed by stable commander identity. */
  readonly relationshipAccounts?: Readonly<Record<LeaderId, CredenceState>>;
}

export interface StoredPieceState extends PieceState {
  readonly status: PieceStatus;
}

export interface CareerRecord {
  readonly id: string;
  readonly seed: number;
  readonly schemaVersion: number;
  readonly outcome: CareerOutcome;
  readonly actIds: readonly string[];
  readonly createdAt: number;
}

export type OpponentArchetype =
  | 'tyrannical'
  | 'supportive'
  | 'volatile'
  | 'servant'
  | 'random';

export interface ActRecord {
  readonly id: string;
  readonly careerId: string;
  readonly kingId: string;
  readonly matchIds: readonly string[];
  readonly terminalState: ActTerminalState;
  readonly kingsRemaining: number;
  /** Player dismissed last match; reinstatement evaluated at next match start (ADR 0022 §7). */
  readonly playerSuspended: boolean;
  readonly opponentArchetype: OpponentArchetype;
  /**
   * King's independent ability channel in the player (ADR 0024 §3).
   * Formed from results, not from roster rumor.
   */
  readonly kingTauAbil: number;
  /** Appointment index within the career (1 = first act). */
  readonly appointmentIndex: number;
  /** Diminished second appointments (ADR 0024 §4). */
  readonly diminished: boolean;
  readonly dismissalCause?: DismissalCause;
}

export interface CampaignRecord {
  readonly id: string;
  readonly actId: string;
  readonly matchIds: readonly string[];
  readonly targetMatches: number;
  readonly cultureDriftFoldVersion: string;
}

export interface MatchAudit {
  readonly boardQuality: number;
  readonly executionFidelity: number;
  /** Mean cp quality of moves actually played (5.10 realized quality). */
  readonly realizedQuality: number;
  readonly refusalCount: number;
  readonly overrideCount: number;
  readonly desertionCount: number;
  readonly quietQuitCount: number;
  readonly promotionCount: number;
  readonly meanTrustDelta: number;
  readonly foldVersion: string;
}

export interface MatchRecord {
  readonly id: string;
  readonly campaignId: string;
  readonly actId: string;
  readonly matchIndex: number;
  readonly seed: number;
  readonly rosterSnapshot: readonly StoredPieceState[];
  readonly rosterEnd: readonly StoredPieceState[];
  readonly events: readonly MatchEvent[];
  /** True engine evaluations, separate from psychology state (ADR 0036). */
  readonly engineAudit?: readonly EngineAuditEntry[];
  /** Persisted chess result for the closing Judgement Seat (D203). */
  readonly winScore?: number;
  readonly result: MatchResult;
  readonly audit: MatchAudit;
  readonly determinismId: string;
  readonly psychConfigVersion: string;
  readonly schemaVersion: number;
}

export interface CampaignDebrief {
  readonly campaignId: string;
  readonly matches: readonly MatchRecord[];
  readonly cultureDrift: CampaignCultureDriftVector;
  readonly meanBoardQuality: number;
  readonly meanExecutionFidelity: number;
  readonly meanRealizedQuality: number;
  readonly judgementSeat: {
    readonly foldVersion: string;
    readonly matches: readonly {
      readonly matchId: string;
      readonly matchIndex: number;
      readonly finalTrust: number;
      readonly winScore: number | null;
      readonly unjustifiedTrauma: number;
      readonly quietQuitTurns: number;
      readonly emptiedChairs: number;
      readonly emptiedChairsScore: number;
      readonly leadershipIndex: number | null;
      readonly computable: boolean;
    }[];
    readonly meanFinalTrust: number | null;
    readonly meanWinScore: number | null;
    readonly meanUnjustifiedTrauma: number | null;
    readonly meanQuietQuitTurns: number | null;
    readonly meanEmptiedChairs: number | null;
    readonly meanEmptiedChairsScore: number | null;
    readonly meanLeadershipIndex: number | null;
    readonly computedMatchCount: number;
    readonly totalMatchCount: number;
  };
  readonly courage: {
    readonly foldVersion: string;
    readonly incidents: readonly {
      readonly matchId: string;
      readonly matchIndex: number;
      readonly ply: number;
      readonly pieceId: string;
      readonly san: string;
      readonly verdict: MoveResponseVerdict;
      readonly margin: number;
      readonly asked: number;
      readonly normalized: number;
    }[];
    readonly meanNormalized: number | null;
    readonly count: number;
  };
  readonly hope: {
    readonly foldVersion: string;
    readonly realized: readonly {
      readonly matchId: string;
      readonly matchIndex: number;
      readonly ply: number;
      readonly pieceId: string;
    }[];
    readonly extinguished: readonly {
      readonly matchId: string;
      readonly matchIndex: number;
      readonly ply: number;
      readonly pieceId: string;
      readonly reason: 'unreachable' | 'captured';
      readonly priorProspect: number;
    }[];
    readonly realizedCount: number;
    readonly extinguishedCount: number;
    readonly rekindledCount: number;
  };
  readonly foldVersion: string;
  readonly actTerminalState: ActTerminalState;
  readonly transcript: CampaignTranscript;
  /** Debrief-only — never written into live match UI (ADR 0031 / D93). */
  readonly commendations: {
    readonly foldVersion: string;
    readonly awards: readonly {
      readonly id: string;
      readonly label: string;
      readonly earned: boolean;
      readonly score: number;
      readonly threshold: number;
    }[];
    readonly earnedIds: readonly string[];
    readonly learningDelta: {
      readonly foldVersion: string;
      readonly overrideRateDelta: number;
      readonly concessionQualityDelta: number;
      readonly benevolenceRecovery: number;
      readonly fidelityIndependentOfQuality: number;
      readonly composite: number;
    } | null;
  };
}

export interface CampaignTranscript {
  readonly foldVersion: string;
  readonly meanBoardQuality: number;
  readonly meanExecutionFidelity: number;
  readonly qualityGap: number;
  readonly tauAbilTrajectory: readonly number[];
  readonly tauBenevTrajectory: readonly number[];
  readonly overrideLedger: readonly {
    readonly ply: number;
    readonly pieceId: string;
    readonly san: string;
    readonly trustDelta: number;
  }[];
  readonly concessionCount: number;
  readonly traumaGini: number;
  readonly attrition: {
    readonly desertions: number;
    readonly refusals: number;
    readonly firings: number;
  };
}

export interface CertificateBundle {
  readonly version: string;
  readonly careerId: string;
  readonly campaignId: string;
  readonly seed: number;
  readonly determinismId: string;
  readonly matches: readonly MatchRecord[];
  readonly debrief: CampaignDebrief;
  readonly transcript: CampaignTranscript;
  readonly contentDigest: string;
}

export interface PiecePassport {
  readonly version: string;
  readonly piece: StoredPieceState;
  readonly identity: PieceIdentityRecord;
  readonly provenance: readonly string[];
  readonly contentDigest: string;
}

export interface BenchPreview {
  readonly pieceId: string;
  readonly selfTrustDelta: number;
  readonly peerTrustDeltas: readonly {
    readonly pieceId: string;
    readonly delta: number;
  }[];
}

export interface FirePreview {
  readonly pieceId: string;
  readonly newTrust: number;
}
