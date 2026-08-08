import {
  createLozzaPort,
  disposeLozzaPort,
} from '../src/engine/adapters/lozza';
import {
  createStockfishPort,
  disposeStockfishPort,
} from '../src/engine/adapters/stockfish';
import { createFakeEnginePort } from '../src/engine/fake';
import type { EnginePort } from '../src/engine/types';

export type SimEngineKind = 'fake' | 'lozza' | 'stockfish';

export function capEngineDepth(
  engine: EnginePort,
  depthCap: number | undefined,
): EnginePort {
  if (depthCap === undefined) return engine;
  if (!Number.isSafeInteger(depthCap) || depthCap < 1) {
    throw new Error('--depth-cap must be a positive integer.');
  }
  return {
    determinismId: `${engine.determinismId}/depth-cap-${depthCap}`,
    evaluate: (fen, depth, evalProfile) =>
      engine.evaluate(fen, Math.min(depth, depthCap), evalProfile),
  };
}

export async function disposeSimEngine(kind: SimEngineKind): Promise<void> {
  switch (kind) {
    case 'fake':
      return;
    case 'lozza':
      await disposeLozzaPort();
      return;
    case 'stockfish':
      await disposeStockfishPort();
      return;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown sim engine: ${_exhaustive}`);
    }
  }
}

/**
 * Harness engine selection. Runtime defaults to `lozza`; CI and tests can
 * select `fake` explicitly for speed and stable goldens.
 */
export async function createSimEngine(
  kind: SimEngineKind = 'lozza',
): Promise<EnginePort> {
  switch (kind) {
    case 'fake':
      return createFakeEnginePort('sim-fake/depth-fixed');
    case 'lozza':
      return createLozzaPort();
    case 'stockfish':
      return createStockfishPort({ poolSize: 2 });
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown sim engine: ${_exhaustive}`);
    }
  }
}
