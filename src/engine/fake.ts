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
      let fenHash = 0x811c9dc5;
      for (let index = 0; index < fen.length; index += 1) {
        fenHash ^= fen.charCodeAt(index);
        fenHash = Math.imul(fenHash, 0x01000193);
      }
      const deepLimitScore = (Math.abs(fenHash) % 401) - 200;
      const errorDirection = fenHash % 2 === 0 ? 1 : -1;
      const depthError =
        errorDirection * Math.max(0, 16 - Math.min(depth, 16)) * 4;
      let scoreCp = deepLimitScore + depthError;
      for (const value of Object.values(evalProfile)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          scoreCp += Math.trunc(value);
        }
      }
      const pvHash = (fenHash + depth * 1_000_003) | 0;
      const file = 7 - (Math.abs(pvHash) % 8);
      const rank = 1 + (Math.abs(pvHash >> 3) % 2);
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
