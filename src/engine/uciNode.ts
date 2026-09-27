import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import {
  UciEngine,
  type UciEngineOptions,
  type UciTransport,
  type UciTransportExit,
} from './uci';

/**
 * Node-only half of the UCI surface: spawning engines as child processes.
 * `./uci` stays browser-safe so the Web Worker host (ADR 0079) can share it;
 * nothing under `src/app` may import this file.
 */

/**
 * How the engine child is spawned: `'node'` runs `enginePath` as a script
 * under `process.execPath`; `'native'` executes `enginePath` directly.
 */
export type UciSpawnMode = 'node' | 'native';

/**
 * Spawn `enginePath` as a Node child process per `spawnMode` and expose its
 * stdio as a `UciTransport`.
 */
export function nodeUciTransport(
  enginePath: string,
  spawnMode: UciSpawnMode = 'node',
): UciTransport {
  const child =
    spawnMode === 'native'
      ? spawn(enginePath, [], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      : spawn(process.execPath, [enginePath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
  });
  let stderrTail = '';
  let exitListener: ((exit: UciTransportExit) => void) | undefined;
  const emitExit = (
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void => {
    exitListener?.({ code, signal, stderr: stderrTail });
  };
  child.stderr.on('data', (chunk: Buffer | string) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2_000);
  });
  child.on('error', (cause) => {
    stderrTail = `${stderrTail}${String(cause)}`.slice(-2_000);
    emitExit(null, null);
  });
  child.on('exit', (code, signal) => emitExit(code, signal));
  const reader = createInterface({ input: child.stdout });
  return {
    sendLine: (line) => {
      child.stdin.write(`${line}\n`);
    },
    onLine: (listener) => {
      reader.on('line', listener);
    },
    onExit: (listener) => {
      exitListener = listener;
    },
    dispose: async () => {
      reader.close();
      child.kill();
      await exited;
    },
  };
}

export interface UciChildEngineOptions
  extends Omit<UciEngineOptions, 'enginePath' | 'transport'> {
  /**
   * Absolute path to the engine artifact: a JS script (e.g. lozza.cjs or
   * stockfish-*.js) under `'node'` spawn mode, or a native executable under
   * `'native'` spawn mode.
   */
  readonly enginePath: string;
  /** Spawn mode; defaults to `'node'` (script run under the Node runtime). */
  readonly spawnMode?: UciSpawnMode;
}

/** Construct a `UciEngine` backed by a spawned Node child process. */
export function spawnUciEngine(options: UciChildEngineOptions): UciEngine {
  const { enginePath, spawnMode = 'node', ...rest } = options;
  return new UciEngine({
    ...rest,
    enginePath,
    transport: () => nodeUciTransport(enginePath, spawnMode),
  });
}
