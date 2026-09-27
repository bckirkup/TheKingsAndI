import {
  LOZZA_ARTIFACT_BUILD,
  LOZZA_ARTIFACT_SHA256,
} from './lozzaArtifact';
import {
  createLozzaPortCore,
  disposeLozzaPorts,
  lozzaDeterminismIdCore,
  LOZZA_HASH_MB,
  type LozzaEngineHost,
  type LozzaEngineSpec,
  type LozzaPortOptions,
} from './lozzaCore';
import type { EnginePort } from './types';
import {
  DEFAULT_MAX_INFO_LINES_PER_SEARCH,
  DEFAULT_MAX_SCORE_ESCALATIONS,
  UciEngine,
  type UciTransport,
} from './uci';

/**
 * The browser host for the shared Lozza port (`lozzaCore.ts`): the vendored
 * `vendor/lozza/lozza.cjs` runs in a classic Web Worker — it installs its own
 * `onmessage` handler when `process` is undefined, so no wrapper or WASM port
 * is needed. UCI lines travel over `postMessage`; the port's `determinismId`
 * is identical to the Node adapter's because both name the same artifact hash
 * and policy tokens (ADR 0079).
 */

/** State-map key distinguishing the worker host from a Node artifact path. */
const LOZZA_WORKER_STATE_KEY = 'worker:vendor/lozza/lozza.cjs';

/**
 * The vendored artifact as a URL — `new URL(asset, import.meta.url)` so Vite
 * emits it as an asset AND the module never executes under Node/tsx (a static
 * `import` or `?url` specifier would run `lozza.cjs` in-process, where it
 * eats `process.argv` as UCI commands).
 */
const LOZZA_WORKER_URL = new URL(
  '../../vendor/lozza/lozza.cjs',
  import.meta.url,
).href;

/**
 * The slice of a Web Worker (or `node:worker_threads` worker under test) that
 * the UCI transport drives.
 */
export interface UciWorkerLike {
  readonly postMessage: (message: string) => void;
  readonly terminate: () => void | Promise<unknown>;
  readonly addLineListener: (listener: (line: string) => void) => void;
  readonly addErrorListener: (listener: (message: string) => void) => void;
}

export function workerUciTransport(worker: UciWorkerLike): UciTransport {
  return {
    sendLine: (line) => worker.postMessage(line),
    onLine: (listener) => {
      worker.addLineListener((data) => {
        for (const line of data.split('\n')) {
          if (line.length > 0) listener(line);
        }
      });
    },
    onExit: (listener) => {
      worker.addErrorListener((message) => {
        listener({ code: null, signal: null, stderr: message });
      });
    },
    dispose: async () => {
      await worker.terminate();
    },
  };
}

function browserWorker(url: string): UciWorkerLike {
  const worker = new Worker(url, { type: 'classic', name: 'lozza-engine' });
  return {
    postMessage: (message) => {
      worker.postMessage(message);
    },
    terminate: () => {
      worker.terminate();
    },
    addLineListener: (listener) => {
      worker.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') listener(event.data);
      };
    },
    addErrorListener: (listener) => {
      worker.onerror = (event) => {
        listener(
          typeof event === 'string'
            ? event
            : ((event as ErrorEvent).message ?? 'worker error'),
        );
      };
    },
  };
}

export interface LozzaWorkerPortOptions extends LozzaPortOptions {
  /** Worker script URL; defaults to the vendored artifact as a Vite asset. */
  readonly workerUrl?: string;
  /** Test seam: override worker construction (e.g. `node:worker_threads`). */
  readonly createWorker?: (url: string) => UciWorkerLike;
}

export function createLozzaWorkerPort(
  options: LozzaWorkerPortOptions = {},
): EnginePort {
  const workerUrl = options.workerUrl ?? LOZZA_WORKER_URL;
  const createWorker = options.createWorker ?? browserWorker;
  const host: LozzaEngineHost = {
    stateKey: LOZZA_WORKER_STATE_KEY,
    createEngine: (spec: LozzaEngineSpec) =>
      new UciEngine({
        enginePath: 'lozza-worker',
        transport: () => workerUciTransport(createWorker(workerUrl)),
        coldSearch: spec.coldSearch,
        maxScoreEscalations: spec.maxScoreEscalations,
        maxInfoLinesPerSearch: spec.maxInfoLinesPerSearch,
        hashMb: LOZZA_HASH_MB,
        threads: 1,
        multiPv: spec.multiPv,
      }),
    artifactIdentity: () => ({
      build: LOZZA_ARTIFACT_BUILD,
      hash: LOZZA_ARTIFACT_SHA256,
    }),
  };
  return createLozzaPortCore(host, options);
}

/** The same `determinismId` the Node adapter reports for this artifact. */
export function lozzaWorkerDeterminismId(
  coldSearch = true,
  maxScoreEscalations = DEFAULT_MAX_SCORE_ESCALATIONS,
  maxInfoLinesPerSearch = DEFAULT_MAX_INFO_LINES_PER_SEARCH,
): string {
  return lozzaDeterminismIdCore(
    { build: LOZZA_ARTIFACT_BUILD, hash: LOZZA_ARTIFACT_SHA256 },
    coldSearch,
    maxScoreEscalations,
    maxInfoLinesPerSearch,
  );
}

/** Tear down worker engines (test cleanup / page teardown). */
export async function disposeLozzaWorkerPort(): Promise<void> {
  await disposeLozzaPorts();
}
