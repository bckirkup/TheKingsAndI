import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EnginePort } from '../types';
import {
  createLozzaPortCore,
  disposeLozzaPorts,
  lozzaDeterminismIdCore,
  LOZZA_ARTIFACT_HASH_PREFIX_LENGTH,
  LOZZA_HASH_MB,
  type LozzaArtifactIdentity,
  type LozzaEngineHost,
  type LozzaEngineSpec,
  type LozzaPortOptions as LozzaCorePortOptions,
} from '../lozzaCore';
import { spawnUciEngine } from '../uciNode';

/**
 * The Node host for the shared Lozza port (`../lozzaCore.ts`): engines are
 * spawned child processes running the vendored `lozza.cjs`, and the artifact
 * identity is hashed off the real file. The browser host is `workerLozza.ts`.
 */

const LOZZA_BUILD_PATTERN = /\bconst BUILD = ['"]([^'"]+)['"];/;

const defaultEnginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../vendor/lozza/lozza.cjs',
);

export interface LozzaPortOptions extends LozzaCorePortOptions {
  /** Override the vendored lozza.cjs path (tests only). */
  readonly enginePath?: string;
}

const artifactIdentityByPath = new Map<string, LozzaArtifactIdentity>();

function getArtifactIdentity(enginePath: string): LozzaArtifactIdentity {
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

function nodeHost(enginePath: string): LozzaEngineHost {
  return {
    stateKey: enginePath,
    createEngine: (spec: LozzaEngineSpec) =>
      spawnUciEngine({
        enginePath,
        coldSearch: spec.coldSearch,
        maxScoreEscalations: spec.maxScoreEscalations,
        maxInfoLinesPerSearch: spec.maxInfoLinesPerSearch,
        hashMb: LOZZA_HASH_MB,
        threads: 1,
        multiPv: spec.multiPv,
      }),
    artifactIdentity: () => getArtifactIdentity(enginePath),
  };
}

export function createLozzaPort(options: LozzaPortOptions = {}): EnginePort {
  const enginePath = resolve(options.enginePath ?? defaultEnginePath);
  return createLozzaPortCore(nodeHost(enginePath), options);
}

export function lozzaDeterminismId(
  enginePath: string,
  coldSearch: boolean,
  maxScoreEscalations?: number,
  maxInfoLinesPerSearch?: number,
): string {
  return lozzaDeterminismIdCore(
    getArtifactIdentity(enginePath),
    coldSearch,
    maxScoreEscalations,
    maxInfoLinesPerSearch,
  );
}

/** Tear down the shared engine hosts (test cleanup). */
export async function disposeLozzaPort(): Promise<void> {
  await disposeLozzaPorts();
}

export {
  DEFAULT_LOZZA_LADDER_CACHE_CAPACITY,
  DEFAULT_LOZZA_RECYCLE_AFTER_SEARCHES,
} from '../lozzaCore';
