import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { createSharedSearchBroker, type SharedSearchBroker } from '../broker';
import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
  SHARED_SEARCH_D_MAX,
} from '../search';
import { DEFAULT_MAX_SCORE_ESCALATIONS } from '../uci';

/** Caissa release this adapter was verified against (MIT license). */
export const CAISSA_VERSION = '2.0.1';
export const CAISSA_HASH_MB = 16;
// A depth-16 MultiPV-8 search emits well over 128 info lines (one per
// depth × line, plus currmove lines); 4096 keeps the ADR 0068 fail-never-
// truncate guard with the same order of headroom the depth-4 default has.
export const CAISSA_MAX_INFO_LINES_PER_SEARCH = 4096;
export const CAISSA_ENGINE_PATH_ENV = 'CAISSA_ENGINE_PATH';
const CAISSA_ARTIFACT_HASH_PREFIX_LENGTH = 12;

const artifactIdentityByPath = new Map<string, string>();

/**
 * sha256 of the native binary, first 12 hex chars, cached per path. The
 * binary embeds the neural network, so the hash covers version, build
 * target, and net in one token. It is an equality token, not a security
 * boundary.
 */
function getArtifactIdentity(enginePath: string): string {
  const cached = artifactIdentityByPath.get(enginePath);
  if (cached !== undefined) return cached;
  const hash = createHash('sha256')
    .update(readFileSync(enginePath))
    .digest('hex')
    .slice(0, CAISSA_ARTIFACT_HASH_PREFIX_LENGTH);
  artifactIdentityByPath.set(enginePath, hash);
  return hash;
}

/**
 * Path to a locally built Caissa binary. The harness never hard-codes a
 * machine path: the operator points `CAISSA_ENGINE_PATH` at a binary built
 * from source.
 */
export function defaultCaissaPath(): string {
  const candidate = process.env[CAISSA_ENGINE_PATH_ENV];
  if (candidate === undefined || !existsSync(candidate)) {
    throw new Error(
      `${CAISSA_ENGINE_PATH_ENV} is unset or does not point at a readable ` +
        'Caissa binary. Build one from https://github.com/Witek902/Caissa ' +
        '(`make bmi2` or `make avx2` under `src/`) and set ' +
        `${CAISSA_ENGINE_PATH_ENV} to the produced executable.`,
    );
  }
  return candidate;
}

export function caissaDeterminismId(
  enginePath: string,
  dMax: number = SHARED_SEARCH_D_MAX,
  multiPv: number = DEFAULT_PRIVATE_MULTIPV_WIDTH,
  preferredMultiPv: number = DEFAULT_PREFERRED_MULTIPV_WIDTH,
  preferredPoolSize: number = DEFAULT_PREFERRED_POOL_SIZE,
): string {
  const hash = getArtifactIdentity(enginePath);
  return (
    `caissa-${CAISSA_VERSION}/artifact-${hash}/hash-${CAISSA_HASH_MB}/` +
    `threads-1/dmax-${dMax}/multipv-${multiPv}/` +
    `preferred-multipv-${preferredMultiPv}/preferred-pool-${preferredPoolSize}/` +
    `search-cold/ladder-rung-canonical/` +
    `score-escalate-${DEFAULT_MAX_SCORE_ESCALATIONS}/` +
    `runaway-${CAISSA_MAX_INFO_LINES_PER_SEARCH}`
  );
}

export interface CaissaPortOptions {
  /** Override the binary path (tests only); defaults to `CAISSA_ENGINE_PATH`. */
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

let sharedBroker: SharedSearchBroker | undefined;

/**
 * Permissive (MIT) native-binary port: Caissa behind the shared-search
 * broker, spawned directly rather than under the Node runtime. Callers
 * outside `engine/` see only `EnginePort`.
 */
export async function createCaissaPort(
  options: CaissaPortOptions = {},
): Promise<SharedSearchBroker> {
  if (sharedBroker !== undefined && options.enginePath === undefined) {
    return sharedBroker;
  }
  const enginePath = options.enginePath ?? defaultCaissaPath();
  const dMax = options.dMax ?? SHARED_SEARCH_D_MAX;
  const multiPv = options.multiPv ?? DEFAULT_PRIVATE_MULTIPV_WIDTH;
  const preferredMultiPv =
    options.preferredMultiPv ?? DEFAULT_PREFERRED_MULTIPV_WIDTH;
  const preferredPoolSize =
    options.preferredPoolSize ?? DEFAULT_PREFERRED_POOL_SIZE;
  const broker = await createSharedSearchBroker({
    enginePath,
    spawnMode: 'native',
    determinismId: caissaDeterminismId(
      enginePath,
      dMax,
      multiPv,
      preferredMultiPv,
      preferredPoolSize,
    ),
    hashMb: CAISSA_HASH_MB,
    threads: 1,
    multiPv,
    ...(options.poolSize !== undefined ? { size: options.poolSize } : {}),
    preferredMultiPv,
    preferredPoolSize,
    dMax,
    maxInfoLinesPerSearch: CAISSA_MAX_INFO_LINES_PER_SEARCH,
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
export async function disposeCaissaPort(): Promise<void> {
  if (sharedBroker !== undefined) {
    await sharedBroker.dispose();
    sharedBroker = undefined;
  }
}
