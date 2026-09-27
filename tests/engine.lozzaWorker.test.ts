import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { afterAll, describe, expect, it } from 'vitest';

import {
  createLozzaPort,
  disposeLozzaPort,
} from '../src/engine/adapters/lozza';
import {
  LOZZA_ARTIFACT_BUILD,
  LOZZA_ARTIFACT_SHA256,
} from '../src/engine/lozzaArtifact';
import {
  createLozzaWorkerPort,
  disposeLozzaWorkerPort,
  type UciWorkerLike,
} from '../src/engine/workerLozza';

const artifactPath = fileURLToPath(
  new URL('../vendor/lozza/lozza.cjs', import.meta.url),
);
const shimPath = fileURLToPath(
  new URL('./fixtures/lozza-worker-shim.cjs', import.meta.url),
);

const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r1bq1rk1/ppp2ppp/2n2n2/3pp3/3PP3/2P1BN2/PP1N1PPP/R2Q1RK1 w - - 0 7',
] as const;

/** Adapt a `node:worker_threads` worker to the browser-side worker shape. */
function threadsWorkerFactory(url: string): UciWorkerLike {
  const worker = new NodeWorker(url);
  return {
    postMessage: (message) => {
      worker.postMessage(message);
    },
    terminate: async () => {
      await worker.terminate();
    },
    addLineListener: (listener) => {
      worker.on('message', (data: unknown) => {
        listener(typeof data === 'string' ? data : String(data));
      });
    },
    addErrorListener: (listener) => {
      worker.on('error', (error) => listener(error.message));
      worker.on('exit', (code) => {
        listener(`worker exited with code ${code}`);
      });
    },
  };
}

describe('Lozza Web Worker port', () => {
  afterAll(async () => {
    await disposeLozzaPort();
    await disposeLozzaWorkerPort();
  });

  it('committed artifact identity matches the vendored lozza.cjs', () => {
    const artifact = readFileSync(artifactPath);
    const hash = createHash('sha256')
      .update(artifact)
      .digest('hex')
      .slice(0, 12);
    const build = /\bconst BUILD = ['"]([^'"]+)['"];/.exec(
      artifact.toString('utf8'),
    )?.[1];
    expect(LOZZA_ARTIFACT_SHA256).toBe(hash);
    expect(LOZZA_ARTIFACT_BUILD).toBe(build);
  });

  it('reports the same determinismId as the node adapter', () => {
    const worker = createLozzaWorkerPort({
      workerUrl: shimPath,
      createWorker: threadsWorkerFactory,
    });
    const node = createLozzaPort();
    expect(worker.determinismId).toBe(node.determinismId);
  });

  it(
    'returns identical evaluations to the node adapter',
    async () => {
      const worker = createLozzaWorkerPort({
        workerUrl: shimPath,
        createWorker: threadsWorkerFactory,
      });
      const node = createLozzaPort();
      for (const fen of FENS) {
        const fromWorker = await worker.evaluate(fen, 3);
        const fromNode = await node.evaluate(fen, 3);
        expect(fromWorker.scoreCp).toBe(fromNode.scoreCp);
        expect(fromWorker.pv).toEqual(fromNode.pv);
      }
    },
    60_000,
  );
});
