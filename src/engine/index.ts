/**
 * Browser-safe engine surface. Everything here must be importable from the
 * bundle, so nothing in this graph may reach `node:*`; the pool, the UCI
 * transport, the shared-search broker, and the real adapters live in
 * `./node` instead.
 */
export {
  InsightRoundFailedError,
  insightOf,
  requireComplete,
  resolveInsightRound,
} from './barrier';
export type { BarrierOptions } from './barrier';
export {
  DEFAULT_CACHE_CONFIG,
  createEvaluationCache,
  evaluationKey,
  requestKey,
} from './cache';
export type { CacheConfig, CacheStats, EvaluationCache } from './cache';
export { CONFORMANCE_CORPUS } from './conformanceCorpus';
export type { ConformanceCase } from './conformanceCorpus';
export { createFakeEnginePort } from './fake';
export { DuplicateSeatError, buildInsightRound, roundKey } from './round';
export {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
  SHARED_SEARCH_D_MAX,
  applyPrivateScoring,
} from './search';
export type {
  EngineAuditEntry,
  EngineEvaluation,
  EnginePort,
  EvalProfile,
  Insight,
  InsightBundle,
  InsightFailure,
  InsightRequest,
  InsightSeat,
  RoundSpec,
} from './types';
