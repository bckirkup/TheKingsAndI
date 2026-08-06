import type {
  CampaignCultureDriftVector,
  MatchEvent,
  PieceState,
} from '../psychology';

export const SCHEMA_VERSION = 1;
export const CULTURE_DRIFT_FOLD_VERSION = 'culture-drift-v1';
export const AUDIT_FOLD_VERSION = 'audit-v2';
export const PSYCH_CONFIG_VERSION = 'engine-config-v1';
export const DETERMINISM_ID = 'heuristic-eval-v1';

export type PieceStatus =
  | 'ACTIVE'
  | 'BENCHED'
  | 'CAPTURED'
  | 'DESERTED'
  | 'FIRED';

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
  readonly originRole: string;
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

export interface ActRecord {
  readonly id: string;
  readonly careerId: string;
  readonly kingId: string;
  readonly matchIds: readonly string[];
  readonly terminalState: ActTerminalState;
  readonly kingsRemaining: number;
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
  readonly refusalCount: number;
  readonly overrideCount: number;
  readonly desertionCount: number;
  readonly quietQuitCount: number;
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
  readonly foldVersion: string;
  readonly actTerminalState: ActTerminalState;
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
