import type { EngineEvaluation, EnginePort, EvalProfile } from './types';

/**
 * Deterministic stand-in for tests and environments without a WASM worker.
 * Score is a pure function of (fen, depth); never uses wall clock or Math.random.
 */
export function createFakeEnginePort(
  determinismId = 'fake-engine/depth-fixed',
): EnginePort {
  return {
    determinismId,
    async evaluate(
      fen: string,
      depth: number,
      evalProfile: EvalProfile = {},
    ): Promise<EngineEvaluation> {
      if (!Number.isSafeInteger(depth) || depth < 1) {
        throw new RangeError('Depth must be a positive integer.');
      }
      let hash = depth * 1_000_003;
      for (let index = 0; index < fen.length; index += 1) {
        hash = (hash * 33 + fen.charCodeAt(index)) | 0;
      }
      for (const value of Object.values(evalProfile)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          hash = (hash + Math.trunc(value) * 17) | 0;
        }
      }
      const scoreCp = (hash % 401) - 200;
      const file = 7 - (Math.abs(hash) % 8);
      const rank = 1 + (Math.abs(hash >> 3) % 2);
      const toFile = file;
      const toRank = rank + 1;
      const fileChar = String.fromCharCode('a'.charCodeAt(0) + file);
      const toFileChar = String.fromCharCode('a'.charCodeAt(0) + toFile);
      return Object.freeze({
        scoreCp,
        pv: Object.freeze([
          `${fileChar}${rank}${toFileChar}${toRank}`,
        ]) as readonly string[],
      });
    },
  };
}
