import type { PieceId } from '../core/ids';

/**
 * Narration-layer types (Milestone 6).
 *
 * The narration layer is **presentation-only** (ADR 0001): nothing here is ever
 * parsed into a number, stored as state, or fed back into psychology. It renders
 * *projections* of the event log as prose, from an authored decision tree with
 * no model call at runtime (ADR 0004).
 *
 * These types are the narration *surface* — the stable projection contract the
 * upstream layers (orchestration/psychology/persistence) will populate once they
 * land. They are deliberately decoupled from psychology internals so the surface
 * stays put when those internals change (see the `narrative-llm` skill).
 */

/** A role label, kept as plain data so a content pack can rename it (D53). */
export type RoleLabel = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

/**
 * The verdict ladder. A commanded move is always played (ADR 0008); the verdict
 * describes how the piece *received* the order. `FATALISTIC_COMPLIANCE` is full
 * effort with no faith (ADR 0024 §2, D61).
 */
export type Verdict =
  | 'HEROIC_EXECUTION'
  | 'COMPLIANT_EXECUTION'
  | 'FATALISTIC_COMPLIANCE'
  | 'QUIET_QUITTING'
  | 'MORAL_REFUSAL'
  | 'DESERTION_MUTINY';

/**
 * The cause a line names. Every negative verdict must name one (ADR 0018): an
 * unattributable trust loss is the top refund risk in `docs/trust_dynamics.md`.
 * `NONE` is reserved for the positive verdicts.
 */
export type GrievanceKind =
  | 'NONE'
  | 'ABANDONED'
  | 'SPENT_PEER'
  | 'OVERRIDDEN'
  | 'NEGLECTED'
  | 'CLASS_CONTEMPT'
  | 'LOSING_STREAK';

/** A coarse bucket over a credence channel in `[0, 1]`; presentation only. */
export type CredenceBand = 'LOW' | 'MID' | 'HIGH';

/** A coarse bucket over a peer affinity value; presentation only. */
export type AffinityBand = 'HOSTILE' | 'NEUTRAL' | 'CLOSE';

/**
 * The two credence channels, carried **separately** (ADR 0019) so a piece can
 * say "I know it was right, I just don't think you care" — the most valuable
 * sentence in the design.
 */
export interface CredenceBands {
  /** τ_abil — "are his orders right." */
  readonly ability: CredenceBand;
  /** τ_benev — "does he care about me." */
  readonly benevolence: CredenceBand;
}

/** The single shipped persona. Others arrive later as data packs (D53/D17). */
export type PersonaId = 'plainspoken';

/** A referenced piece: a sanitized display name plus its role for the noun map. */
export interface PieceRef {
  readonly name: string;
  readonly role: RoleLabel;
}

/**
 * Everything a piece line is keyed on. Leaf selection is a pure function of this
 * context plus a seeded variant pick, so replays reproduce dialogue byte for
 * byte (see the `narrative-llm` skill).
 */
export interface PieceLineContext {
  readonly speaker: PieceRef & { readonly id: PieceId };
  readonly persona: PersonaId;
  readonly verdict: Verdict;
  readonly grievance: GrievanceKind;
  readonly credence: CredenceBands;
  /** Affinity toward the referenced peer, when the grievance names one. */
  readonly affinity?: AffinityBand;
  /** The peer a grievance points at (e.g. the comrade who was spent). */
  readonly target?: PieceRef;
  /**
   * How many times this exact situation has already been voiced this match.
   * Successive occurrences rotate to a fresh variant so a piece does not repeat
   * itself within one match.
   */
  readonly repeatCount: number;
  /** The match seed; makes the variant pick deterministic and replayable. */
  readonly seed: number;
}

/** Which side of the severity ladder a match ended on (ADR 0021 §6, D54). */
export type MatchOutcome = 'WIN' | 'DRAW' | 'CHECKMATE' | 'DISMISSAL' | 'ROUT';

/** A single departure, projected from the event log for causal reconstruction. */
export interface DepartureProjection {
  readonly piece: PieceRef;
  readonly ply: number;
  readonly grievance: GrievanceKind;
  /** The piece whose loss triggered this grievance, when there was one. */
  readonly triggeredBy?: PieceRef;
}

/**
 * A match audit's inputs — a pure projection (a fold) of the event log, never a
 * second source of truth (event log is authoritative). `boardQuality` and
 * `executionFidelity` are the two columns of ADR 0022 §5 / D57: the gap between
 * them is the player's diagnosis.
 */
export interface MatchTelemetry {
  readonly outcome: MatchOutcome;
  readonly plies: number;
  /** Order matters: departures are read in ply order to rebuild the cascade. */
  readonly departures: readonly DepartureProjection[];
  readonly overrides: number;
  /** 0..100, presentation-scaled quality of the orders issued. */
  readonly boardQuality: number;
  /** 0..100, share of orders actually carried out. */
  readonly executionFidelity: number;
}

/** One match's contribution to a campaign, projected from its log. */
export interface CampaignMatchProjection {
  readonly index: number;
  readonly outcome: MatchOutcome;
  readonly departures: number;
  readonly boardQuality: number;
  readonly executionFidelity: number;
}

/** A campaign debrief's inputs — a fold over per-match projections. */
export interface CampaignTelemetry {
  readonly leaderName: string;
  readonly matches: readonly CampaignMatchProjection[];
  /** Pieces that left the world permanently (retirement, ADR 0026 §1). */
  readonly retirements: readonly PieceRef[];
}

/** Pre-game framing; reputation is a band, never a number shown to the player. */
export interface MatchIntroContext {
  readonly leaderName: string;
  readonly persona: PersonaId;
  /** The King's mandate band toward the player (ADR 0021). */
  readonly mandate: CredenceBand;
  /** 1-based appointment within the career (ADR 0023, up to three). */
  readonly act: number;
  readonly seed: number;
}

/** Structured prose. Plain strings only; the UI renders them as text. */
export interface AuditProse {
  readonly headline: string;
  readonly paragraphs: readonly string[];
  /** Cause-legible findings, one per notable event (ADR 0018). */
  readonly findings: readonly string[];
}

export interface DebriefProse {
  readonly headline: string;
  readonly paragraphs: readonly string[];
  readonly findings: readonly string[];
}

/**
 * The narration port. All signatures are **synchronous** (ADR 0004): no await,
 * no loading state, no way for narration to desynchronize from state. The
 * shipped implementation is `AuthoredProvider`; an `LlmProvider` is intentionally
 * not shipped, and the port exists only to keep ADR 0004 reversible.
 */
export interface NarrationProvider {
  pieceLine(context: PieceLineContext): string;
  narratorIntro(context: MatchIntroContext): string;
  matchAudit(telemetry: MatchTelemetry): AuditProse;
  campaignDebrief(telemetry: CampaignTelemetry): DebriefProse;
}
