export interface RandomState {
  readonly state: number;
}

export interface SeededRandom {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  snapshot(): RandomState;
  restore(state: RandomState): void;
}

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x9e3779b9 : normalized;
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = normalizeSeed(seed);

  return {
    nextUint32(): number {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state;
    },
    nextFloat(): number {
      return this.nextUint32() / 0x1_0000_0000;
    },
    nextInt(maxExclusive: number): number {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError('maxExclusive must be a positive safe integer.');
      }
      return Math.floor(this.nextFloat() * maxExclusive);
    },
    snapshot(): RandomState {
      return { state };
    },
    restore(snapshot: RandomState): void {
      state = normalizeSeed(snapshot.state);
    },
  };
}
