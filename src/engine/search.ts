import type { EngineEvaluation, EvalProfile } from './types';

/**
 * Search constants and profile-agnostic scoring.
 *
 * Separate from `broker.ts` because the broker owns a process pool and reaches
 * `node:child_process` through it: anything the browser bundle needs must be
 * importable without dragging that in.
 */

/** Shared-search depth ceiling (architecture §5, ADR 0017). */
export const SHARED_SEARCH_D_MAX = 16;
/** Default private-attention width; calibrated against engine runtime budget. */
export const DEFAULT_PRIVATE_MULTIPV_WIDTH = 8;
/** Width of the player-visible preferred-line search. */
export const DEFAULT_PREFERRED_MULTIPV_WIDTH = 1;
/** One serialized worker is sufficient for the preferred-line search. */
export const DEFAULT_PREFERRED_POOL_SIZE = 1;

/** Engine transport is profile-agnostic; private scoring belongs to orchestration. */
export function applyPrivateScoring(
  base: EngineEvaluation,
  evalProfile: EvalProfile,
): EngineEvaluation {
  void evalProfile;
  return Object.freeze({
    scoreCp: base.scoreCp,
    pv: Object.freeze([...base.pv]),
  });
}
