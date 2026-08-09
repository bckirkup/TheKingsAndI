/**
 * World / cohort type scaffold (ADR 0026–0029, Milestone 5b).
 * Runtime host, Dexie tables, and facilitator services are deferred —
 * these types exist so later work lands without inventing the schema twice.
 */

export type WorldKind = 'cohort' | 'lan' | 'solo' | 'friend';

export type WorldDisposition = 'archive' | 'discard' | 'active';

export type CurriculumFormat = 'intensive' | 'nibelungen';

export interface CurriculumRecord {
  readonly id: string;
  readonly format: CurriculumFormat;
  /** Planned match count for the curriculum. */
  readonly matchBudget: number;
  /** Shared piece-pool size relative to curriculum length (5.8n knob later). */
  readonly poolSize: number;
}

export interface WorldRecord {
  readonly id: string;
  readonly kind: WorldKind;
  readonly curriculumId: string;
  readonly createdAt: number;
  readonly endsAt: number;
  readonly disposition: WorldDisposition;
}

export interface CohortParticipantRecord {
  readonly id: string;
  readonly worldId: string;
  /** Enrollment is identity for the closed cohort (ADR 0027). */
  readonly enrollmentId: string;
  readonly displayLabel: string;
  readonly seatIndex: number;
}

export interface CohortRecord {
  readonly id: string;
  readonly worldId: string;
  readonly facilitatorId: string;
  readonly participantIds: readonly string[];
  /** Closed membership size target (12–24). */
  readonly seatTarget: number;
}

/** Retirement is permanent within a world (ADR 0026 / 0029). */
export type PieceLifecycleStatus =
  | 'active'
  | 'benched'
  | 'free_agent'
  | 'retired';

export interface WorldPieceIdentityScaffold {
  readonly id: string;
  readonly worldId: string;
  readonly name: string;
  readonly provenance: readonly string[];
  /** Identity-seeded prior — full ADR 0035 wiring deferred. */
  readonly dispositionSeed: number;
  readonly globalTrauma: number;
  readonly lifecycle: PieceLifecycleStatus;
}
