/**
 * Node-only engine surface: the process pool, the UCI transport, the
 * shared-search broker, and the real adapters. Importing this from the browser
 * bundle pulls in `node:child_process` and fails the build, so `sim/`, tests,
 * and any future server entry import it and `src/app` never does.
 */
export { createLozzaPort, disposeLozzaPort } from './adapters/lozza';
export type { LozzaPortOptions } from './adapters/lozza';
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
export { createSharedSearchBroker } from './broker';
export type { SharedSearchBroker, SharedSearchBrokerOptions } from './broker';
export { EnginePool, defaultPoolSize } from './pool';
export type { EnginePoolOptions } from './pool';
export type { StockfishPortOptions } from './adapters/stockfish';
