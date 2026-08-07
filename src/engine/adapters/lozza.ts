import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { EngineEvaluation, EnginePort, EvalProfile } from '../types';
import { UciEngine } from '../uci';

const LOZZA_BUILD = '11';
const LOZZA_HASH_MB = 16;
const LOZZA_DETERMINISM_ID = `lozza-${LOZZA_BUILD}/depth-fixed/hash-${LOZZA_HASH_MB}/threads-1`;

const defaultEnginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../vendor/lozza/lozza.cjs',
);

export interface LozzaPortOptions {
  /** Override the vendored lozza.cjs path (tests only). */
  readonly enginePath?: string;
}

let sharedEngine: UciEngine | undefined;

function getSharedEngine(enginePath: string): UciEngine {
  if (sharedEngine === undefined) {
    sharedEngine = new UciEngine({
      enginePath,
      hashMb: LOZZA_HASH_MB,
      threads: 1,
      multiPv: 1,
    });
  }
  return sharedEngine;
}

/**
 * Permissive MIT adapter proving `EnginePort` is real (ADR 0020 §4).
 * A single shared UCI process serialises searches; the evaluation cache
 * handles deduplication across pieces at the barrier.
 */
export function createLozzaPort(options: LozzaPortOptions = {}): EnginePort {
  const enginePath = options.enginePath ?? defaultEnginePath;
  const engine = getSharedEngine(enginePath);
  return {
    determinismId: LOZZA_DETERMINISM_ID,
    async evaluate(
      fen: string,
      depth: number,
      evalProfile: EvalProfile = {},
    ): Promise<EngineEvaluation> {
      void evalProfile;
      const result = await engine.evaluate(fen, depth);
      return Object.freeze({
        scoreCp: result.scoreCp,
        pv: result.pv,
      });
    },
  };
}

/** Tear down the shared process (test cleanup). */
export async function disposeLozzaPort(): Promise<void> {
  if (sharedEngine !== undefined) {
    await sharedEngine.dispose();
    sharedEngine = undefined;
  }
}
