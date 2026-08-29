import type { PieceId } from '../core/ids';

/**
 * Engine-layer types. Nothing outside `engine/` learns which engine exists
 * (ADR 0020), and nothing outside it sees a `Promise`: results leave through a
 * frozen, ordered `InsightBundle` (ADR 0034).
 */

/**
 * A piece's egocentric evaluation weights (ADR 0016/0017), opaque here on
 * purpose: their schema belongs to `psychology/` and is still open. The barrier
 * only needs them to be canonical data, because two pieces at the same depth
 * with different weights are not interchangeable and must not share a cache
 * entry (ADR 0017).
 */
export type EvalProfile = Readonly<Record<string, number>>;

/** What the engine returns for one (position, depth) pair. */
export interface EngineEvaluation {
  /** Centipawns, from the moving side's point of view. Integer. */
  readonly scoreCp: number;
  /** Principal variation in LAN, e.g. `['e2e4', 'e7e5']`. */
  readonly pv: readonly string[];
}

/** Persisted true-evaluation evidence; never passed into psychology. */
export interface EngineAuditEntry {
  readonly ply: number;
  readonly pieceId: PieceId;
  readonly san: string;
  readonly preMoveScoreCp: number;
  readonly scoreCp: number;
  readonly bestScoreCp: number;
  readonly preMoveDepth: number;
  readonly scoreDepth: number;
  readonly bestScoreDepth: number;
}

/** The narrow port of ADR 0020. `depth` is fixed; no wall clock, ever. */
export interface EnginePort {
  /**
   * Evaluate `fen` at fixed depth. The optional profile is canonical transport
   * identity only; private scoring belongs to orchestration (ADR 0037).
   */
  evaluate(
    fen: string,
    depth: number,
    evalProfile?: EvalProfile,
  ): Promise<EngineEvaluation>;
  /**
   * Optional profile-agnostic MultiPV transport for orchestration attention
   * pruning (ADR 0037). The engine still returns only shared evaluations.
   */
  readonly multiPvAtMax?: (fen: string) => Promise<readonly EngineEvaluation[]>;
  readonly multiPvAt?: (
    fen: string,
    depth: number,
  ) => Promise<readonly EngineEvaluation[]>;
  /** Cheapest top-line query for authored pre-move opportunity signals. */
  readonly bestAt?: (fen: string, depth: number) => Promise<EngineEvaluation>;
  /** Harness-only lifecycle telemetry; absent for pure/in-process engines. */
  readonly getCostStats?: () => {
    readonly restarts: number;
    readonly scoreEscalations?: number;
    readonly maxInfoLines?: number;
    readonly lastInfoLines?: number;
  };
  /** Engine + version + settings. Goes into every `MatchRecord`. */
  readonly determinismId: string;
}

/** One seat in a round: which piece asks, how deep it sees, how it scores. */
export interface InsightSeat {
  readonly pieceId: PieceId;
  /** `D_i`, derived from `E_i`/`η_i`. Capped and fixed (ADR 0005). */
  readonly depth: number;
  readonly evalProfile: EvalProfile;
}

/** The round's inputs: a pure function of the position and the roster. */
export interface RoundSpec {
  readonly fen: string;
  readonly seats: readonly InsightSeat[];
}

export interface InsightRequest extends InsightSeat {
  readonly fen: string;
}

/** What a piece believes about the position — never the true evaluation. */
export interface Insight extends EngineEvaluation {
  readonly pieceId: PieceId;
  readonly depth: number;
}

/**
 * A query that did not produce a value. Ordered like an insight and never
 * silently dropped: which piece was lost would otherwise be a machine-dependent
 * value, which is what ADR 0034 exists to exclude.
 */
export interface InsightFailure {
  readonly pieceId: PieceId;
  readonly depth: number;
  readonly reason: string;
}

/** The barrier's output: frozen, totally ordered, and hashed. */
export interface InsightBundle {
  /** 0-based. A dependent query opens the next round (ADR 0034 §3). */
  readonly round: number;
  readonly determinismId: string;
  /** Content digest of everything above and below it, for replay triage. */
  readonly digest: string;
  readonly insights: readonly Insight[];
  readonly failures: readonly InsightFailure[];
}
