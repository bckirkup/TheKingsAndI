import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PREFERRED_MULTIPV_WIDTH,
  DEFAULT_PREFERRED_POOL_SIZE,
  DEFAULT_PRIVATE_MULTIPV_WIDTH,
} from '../broker';
import type { EngineEvaluation, EnginePort, EvalProfile } from '../types';
import { UciEngine, type DepthLadder } from '../uci';

const LOZZA_HASH_MB = 16;
const LOZZA_BUILD_PATTERN = /\bconst BUILD = ['"]([^'"]+)['"];/;
const LOZZA_ARTIFACT_HASH_PREFIX_LENGTH = 12;

const defaultEnginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../vendor/lozza/lozza.cjs',
);

export interface LozzaPortOptions {
  /** Override the vendored lozza.cjs path (tests only). */
  readonly enginePath?: string;
}

interface LozzaEngineState {
  sharedEngine: UciEngine;
  bestEngine: UciEngine | undefined;
  searchQueue: Promise<void>;
  bestSearchQueue: Promise<void>;
  ladderByFen: Map<string, DepthLadder>;
}

const statesByPath = new Map<string, LozzaEngineState>();
const artifactIdentityByPath = new Map<
  string,
  { readonly build: string; readonly hash: string }
>();

function getState(enginePath: string): LozzaEngineState {
  const existing = statesByPath.get(enginePath);
  if (existing !== undefined) return existing;
  const state: LozzaEngineState = {
    sharedEngine: new UciEngine({
      enginePath,
      hashMb: LOZZA_HASH_MB,
      threads: 1,
      multiPv: DEFAULT_PRIVATE_MULTIPV_WIDTH,
    }),
    bestEngine: undefined,
    searchQueue: Promise.resolve(),
    bestSearchQueue: Promise.resolve(),
    ladderByFen: new Map(),
  };
  statesByPath.set(enginePath, state);
  return state;
}

function getBestEngine(state: LozzaEngineState, enginePath: string): UciEngine {
  if (state.bestEngine === undefined) {
    state.bestEngine = new UciEngine({
      enginePath,
      hashMb: LOZZA_HASH_MB,
      threads: 1,
      multiPv: 1,
    });
  }
  return state.bestEngine;
}

function getArtifactIdentity(enginePath: string): {
  readonly build: string;
  readonly hash: string;
} {
  const cached = artifactIdentityByPath.get(enginePath);
  if (cached !== undefined) return cached;
  const artifact = readFileSync(enginePath);
  const source = artifact.toString('utf8');
  const build = LOZZA_BUILD_PATTERN.exec(source)?.[1];
  if (build === undefined) {
    throw new Error(
      `Lozza artifact does not declare a readable BUILD label: ${enginePath}`,
    );
  }
  const hash = createHash('sha256')
    .update(artifact)
    .digest('hex')
    .slice(0, LOZZA_ARTIFACT_HASH_PREFIX_LENGTH);
  const identity = { build, hash };
  artifactIdentityByPath.set(enginePath, identity);
  return identity;
}

function lozzaDeterminismId(enginePath: string): string {
  const { build, hash } = getArtifactIdentity(enginePath);
  // The short hash is an equality token, not a security boundary.
  return (
    `lozza-${build}/artifact-${hash}/depth-fixed/hash-${LOZZA_HASH_MB}/` +
    `threads-1/multipv-${DEFAULT_PRIVATE_MULTIPV_WIDTH}/` +
    `preferred-multipv-${DEFAULT_PREFERRED_MULTIPV_WIDTH}/` +
    `preferred-pool-${DEFAULT_PREFERRED_POOL_SIZE}`
  );
}

/**
 * Permissive MIT adapter proving `EnginePort` is real (ADR 0020 §4).
 * A single shared UCI process serialises searches; the evaluation cache
 * handles deduplication across pieces at the barrier.
 */
export function createLozzaPort(options: LozzaPortOptions = {}): EnginePort {
  const enginePath = resolve(options.enginePath ?? defaultEnginePath);
  const determinismId = lozzaDeterminismId(enginePath);
  const state = getState(enginePath);
  const ladderFor = async (
    fen: string,
    depth: number,
  ): Promise<DepthLadder> => {
    const cached = state.ladderByFen.get(fen);
    if (cached !== undefined && cached.maxDepth >= depth) return cached;
    const search = state.searchQueue.then(() =>
      state.sharedEngine.searchLadder(fen, depth),
    );
    state.searchQueue = search.then(
      () => undefined,
      () => undefined,
    );
    const ladder = await search;
    state.ladderByFen.set(fen, ladder);
    return ladder;
  };
  return {
    determinismId,
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
      const search = state.bestSearchQueue.then(() =>
        getBestEngine(state, enginePath).searchLadder(fen, depth),
      );
      state.bestSearchQueue = search.then(
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
  const states = [...statesByPath.values()];
  statesByPath.clear();
  await Promise.all(
    states.flatMap((state) => [
      state.sharedEngine.dispose(),
      ...(state.bestEngine === undefined ? [] : [state.bestEngine.dispose()]),
    ]),
  );
}
