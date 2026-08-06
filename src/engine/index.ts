export { createLozzaPort, disposeLozzaPort } from './adapters/lozza';
export type { LozzaPortOptions } from './adapters/lozza';
export {
  InsightRoundFailedError,
  insightOf,
  requireComplete,
  resolveInsightRound,
} from './barrier';
export { CONFORMANCE_CORPUS } from './conformanceCorpus';
export type { ConformanceCase } from './conformanceCorpus';
export type { BarrierOptions } from './barrier';
export {
  DEFAULT_CACHE_CONFIG,
  createEvaluationCache,
  evaluationKey,
  requestKey,
} from './cache';
export type { CacheConfig, CacheStats, EvaluationCache } from './cache';
export { DuplicateSeatError, buildInsightRound, roundKey } from './round';
export type {
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
