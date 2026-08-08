import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DEFAULT_PRIVATE_MULTIPV_WIDTH } from '../broker';
import type { EngineEvaluation, EnginePort, EvalProfile } from '../types';
import { UciEngine, type DepthLadder } from '../uci';

const LOZZA_BUILD = '11';
const LOZZA_HASH_MB = 16;
const LOZZA_DETERMINISM_ID =
  `lozza-${LOZZA_BUILD}/depth-fixed/hash-${LOZZA_HASH_MB}/` +
  `threads-1/multipv-${DEFAULT_PRIVATE_MULTIPV_WIDTH}`;

const defaultEnginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../vendor/lozza/lozza.cjs',
);

export interface LozzaPortOptions {
  /** Override the vendored lozza.cjs path (tests only). */
  readonly enginePath?: string;
}

let sharedEngine: UciEngine | undefined;
let searchQueue: Promise<void> = Promise.resolve();
const ladderByFen = new Map<string, DepthLadder>();

function getSharedEngine(enginePath: string): UciEngine {
  if (sharedEngine === undefined) {
    sharedEngine = new UciEngine({
      enginePath,
      hashMb: LOZZA_HASH_MB,
      threads: 1,
      multiPv: DEFAULT_PRIVATE_MULTIPV_WIDTH,
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
  const ladderFor = async (
    fen: string,
    depth: number,
  ): Promise<DepthLadder> => {
    const cached = ladderByFen.get(fen);
    if (cached !== undefined && cached.maxDepth >= depth) return cached;
    const search = searchQueue.then(() => engine.searchLadder(fen, depth));
    searchQueue = search.then(
      () => undefined,
      () => undefined,
    );
    const ladder = await search;
    ladderByFen.set(fen, ladder);
    return ladder;
  };
  return {
    determinismId: LOZZA_DETERMINISM_ID,
    async evaluate(
      fen: string,
      depth: number,
      evalProfile: EvalProfile = {},
    ): Promise<EngineEvaluation> {
      void evalProfile;
      const ladder = await ladderFor(fen, depth);
      const result = ladder.at.get(depth) ?? ladder.multiPvAtMax.get(1);
      if (result === undefined) {
        throw new Error(`Lozza produced no score at depth ${depth}`);
      }
      return Object.freeze({
        scoreCp: result.scoreCp,
        pv: result.pv,
      });
    },
    async multiPvAtMax(fen: string): Promise<readonly EngineEvaluation[]> {
      const ladder = await ladderFor(fen, 16);
      const lines: EngineEvaluation[] = [];
      for (const key of [...ladder.multiPvAtMax.keys()].sort(
        (left, right) => left - right,
      )) {
        const line = ladder.multiPvAtMax.get(key);
        if (line !== undefined) {
          lines.push(
            Object.freeze({
              scoreCp: line.scoreCp,
              pv: Object.freeze([...line.pv]),
            }),
          );
        }
      }
      return Object.freeze(lines);
    },
  };
}

/** Tear down the shared process (test cleanup). */
export async function disposeLozzaPort(): Promise<void> {
  if (sharedEngine !== undefined) {
    await sharedEngine.dispose();
    sharedEngine = undefined;
    searchQueue = Promise.resolve();
    ladderByFen.clear();
  }
}
