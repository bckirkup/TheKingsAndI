import { createLozzaPort } from '../src/engine/adapters/lozza';
import { createStockfishPort } from '../src/engine/adapters/stockfish';
import { createFakeEnginePort } from '../src/engine/fake';
import type { EnginePort } from '../src/engine/types';

export type SimEngineKind = 'fake' | 'lozza' | 'stockfish';

/**
 * Harness engine selection. Runtime defaults to `stockfish`; CI and tests can
 * select `fake` explicitly for speed and stable goldens.
 */
export async function createSimEngine(
  kind: SimEngineKind = 'stockfish',
): Promise<EnginePort> {
  switch (kind) {
    case 'fake':
      return createFakeEnginePort('sim-fake/depth-fixed');
    case 'lozza':
      return createLozzaPort();
    case 'stockfish':
      return createStockfishPort({ poolSize: 2, dMax: 8 });
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown sim engine: ${_exhaustive}`);
    }
  }
}
