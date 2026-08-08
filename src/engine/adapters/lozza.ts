import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
} from '../broker';
import type { EngineEvaluation, EnginePort, EvalProfile } from '../types';
import { UciEngine, type DepthLadder } from '../uci';

const LOZZA_BUILD = '11';
const LOZZA_HASH_MB = 16;
const LOZZA_DETERMINISM_ID =
  `lozza-${LOZZA_BUILD}/depth-fixed/hash-${LOZZA_HASH_MB}/` +
  `threads-1/multipv-${DEFAULT_PRIVATE_MULTIPV_WIDTH}/` +
  `preferred-multipv-${DEFAULT_PREFERRED_MULTIPV_WIDTH}/` +
  `preferred-pool-${DEFAULT_PREFERRED_POOL_SIZE}`;

const defaultEnginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../vendor/lozza/lozza.cjs',
);

export interface LozzaPortOptions {
  /** Override the vendored lozza.cjs path (tests only). */
  readonly enginePath?: string;
}

let sharedEngine: UciEngine | undefined;
let bestEngine: UciEngine | undefined;
let searchQueue: Promise<void> = Promise.resolve();
let bestSearchQueue: Promise<void> = Promise.resolve();
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

function getBestEngine(enginePath: string): UciEngine {
  if (bestEngine === undefined) {
    bestEngine = new UciEngine({
      enginePath,
      hashMb: LOZZA_HASH_MB,
      threads: 1,
      multiPv: 1,
    });
  }
  return bestEngine;
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
      return linesAt(ladder, ladder.maxDepth);
    },
    async multiPvAt(
      fen: string,
      depth: number,
    ): Promise<readonly EngineEvaluation[]> {
      const ladder = await ladderFor(fen, depth);
      for (let rung = Math.min(depth, ladder.maxDepth); rung >= 1; rung -= 1) {
        const lines = ladder.multiPvAt.get(rung);
        if (lines !== undefined && lines.size > 0) {
          return linesAt(ladder, rung);
        }
      }
      return Object.freeze([]);
    },
    async bestAt(fen: string, depth: number): Promise<EngineEvaluation> {
      const search = bestSearchQueue.then(() =>
        getBestEngine(enginePath).searchLadder(fen, depth),
      );
      bestSearchQueue = search.then(
        () => undefined,
        () => undefined,
      );
      const ladder = await search;
      const result = ladder.at.get(depth) ?? ladder.multiPvAtMax.get(1);
      if (result === undefined) {
        throw new Error(`Lozza produced no best line at depth ${depth}`);
      }
      return Object.freeze({
        scoreCp: result.scoreCp,
        pv: Object.freeze([...result.pv]),
      });
    },
  };
}

function linesAt(
  ladder: DepthLadder,
  depth: number,
): readonly EngineEvaluation[] {
  const lines = ladder.multiPvAt.get(depth);
  if (lines === undefined) return Object.freeze([]);
  const evaluations: EngineEvaluation[] = [];
  for (const key of [...lines.keys()].sort((left, right) => left - right)) {
    const line = lines.get(key);
    if (line !== undefined) {
      evaluations.push(
        Object.freeze({
          scoreCp: line.scoreCp,
          pv: Object.freeze([...line.pv]),
        }),
      );
    }
  }
  return Object.freeze(evaluations);
}

/** Tear down the shared process (test cleanup). */
export async function disposeLozzaPort(): Promise<void> {
  if (sharedEngine !== undefined) {
    await sharedEngine.dispose();
    sharedEngine = undefined;
  }
  if (bestEngine !== undefined) {
    await bestEngine.dispose();
    bestEngine = undefined;
  }
  searchQueue = Promise.resolve();
  bestSearchQueue = Promise.resolve();
  ladderByFen.clear();
}
