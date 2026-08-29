import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { createSharedSearchBroker, type SharedSearchBroker } from '../broker';
import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
  SHARED_SEARCH_D_MAX,
} from '../search';

const require = createRequire(import.meta.url);

/** Pinned stockfish.js WASM build (GPL-3.0). Re-verify license at bump time. */
export const STOCKFISH_NPM_VERSION = '18.0.8';
export const STOCKFISH_BUILD = '18';
export const STOCKFISH_FLAVOR = 'lite-single';
export const STOCKFISH_HASH_MB = 16;

export function stockfishDeterminismId(
  dMax: number = SHARED_SEARCH_D_MAX,
  multiPv: number = DEFAULT_PRIVATE_MULTIPV_WIDTH,
  preferredMultiPv: number = DEFAULT_PREFERRED_MULTIPV_WIDTH,
  preferredPoolSize: number = DEFAULT_PREFERRED_POOL_SIZE,
): string {
  return (
    `stockfish-js-${STOCKFISH_BUILD}-${STOCKFISH_FLAVOR}/` +
    `hash-${STOCKFISH_HASH_MB}/threads-1/dmax-${dMax}/multipv-${multiPv}/` +
    `preferred-multipv-${preferredMultiPv}/preferred-pool-${preferredPoolSize}`
  );
}

export const STOCKFISH_DETERMINISM_ID = stockfishDeterminismId();

export interface StockfishPortOptions {
  /** Override engine script path (tests only). */
  readonly enginePath?: string;
  /** Pool size; defaults to `min(hardwareConcurrency - 1, 4)`. */
  readonly poolSize?: number;
  /** Override D_max for tests. */
  readonly dMax?: number;
  /** MultiPV width used by private-attention pruning. */
  readonly multiPv?: number;
  /** MultiPV width used by the player-visible preferred-line search. */
  readonly preferredMultiPv?: number;
  /** Worker count used by the player-visible preferred-line search. */
  readonly preferredPoolSize?: number;
  /** Capacity shared by the ladder and escalated-result caches. */
  readonly ladderCacheCapacity?: number;
}

function defaultStockfishPath(): string {
  const pkgPath = require.resolve('stockfish/package.json');
  return join(
    dirname(pkgPath),
    'bin',
    `stockfish-${STOCKFISH_BUILD}-${STOCKFISH_FLAVOR}.js`,
  );
}

let sharedBroker: SharedSearchBroker | undefined;

/**
 * Production reference port: Stockfish WASM behind the shared-search broker
 * (Milestone 1.3, ADR 0017 / ADR 0020). Callers outside `engine/` see only
 * `EnginePort`; the GPL engine identity stays in this adapter.
 */
export async function createStockfishPort(
  options: StockfishPortOptions = {},
): Promise<SharedSearchBroker> {
  if (sharedBroker !== undefined && options.enginePath === undefined) {
    return sharedBroker;
  }
  const dMax = options.dMax ?? SHARED_SEARCH_D_MAX;
  const multiPv = options.multiPv ?? DEFAULT_PRIVATE_MULTIPV_WIDTH;
  const preferredMultiPv =
    options.preferredMultiPv ?? DEFAULT_PREFERRED_MULTIPV_WIDTH;
  const preferredPoolSize =
    options.preferredPoolSize ?? DEFAULT_PREFERRED_POOL_SIZE;
  const broker = await createSharedSearchBroker({
    enginePath: options.enginePath ?? defaultStockfishPath(),
    determinismId: stockfishDeterminismId(
      dMax,
      multiPv,
      preferredMultiPv,
      preferredPoolSize,
    ),
    hashMb: STOCKFISH_HASH_MB,
    threads: 1,
    multiPv,
    ...(options.poolSize !== undefined ? { size: options.poolSize } : {}),
    preferredMultiPv,
    preferredPoolSize,
    dMax,
    ...(options.ladderCacheCapacity !== undefined
      ? { ladderCacheCapacity: options.ladderCacheCapacity }
      : {}),
  });
  if (options.enginePath === undefined) {
    sharedBroker = broker;
  }
  return broker;
}

/** Tear down the shared broker (test cleanup). */
export async function disposeStockfishPort(): Promise<void> {
  if (sharedBroker !== undefined) {
    await sharedBroker.dispose();
    sharedBroker = undefined;
  }
}
