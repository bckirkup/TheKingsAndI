export { createLozzaPort, disposeLozzaPort } from './adapters/lozza';
export type { LozzaPortOptions } from './adapters/lozza';
export { createFakeEnginePort } from './fake';
export {
  STOCKFISH_BUILD,
  STOCKFISH_DETERMINISM_ID,
  STOCKFISH_FLAVOR,
  STOCKFISH_HASH_MB,
  STOCKFISH_NPM_VERSION,
  createStockfishPort,
  disposeStockfishPort,
  stockfishDeterminismId,
} from './adapters/stockfish';
export type { StockfishPortOptions } from './adapters/stockfish';
export {
  InsightRoundFailedError,
  insightOf,
  requireComplete,
  resolveInsightRound,
} from './barrier';
export {
  SHARED_SEARCH_D_MAX,
  applyPrivateScoring,
  createSharedSearchBroker,
} from './broker';
export type { SharedSearchBroker, SharedSearchBrokerOptions } from './broker';
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
export { EnginePool, defaultPoolSize } from './pool';
export type { EnginePoolOptions } from './pool';
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
