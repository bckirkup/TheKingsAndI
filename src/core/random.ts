export interface RandomState {
  readonly s0: number;
  readonly s1: number;
  readonly s2: number;
  readonly s3: number;
}

export interface SeededRandom {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  snapshot(): RandomState;
  restore(state: RandomState): void;
}

function splitmix32(value: number): number {
  let state = (value + 0x9e3779b9) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x21f0aaad) >>> 0;
  state = Math.imul(state ^ (state >>> 15), 0x735a2d97) >>> 0;
  return (state ^ (state >>> 15)) >>> 0;
}

function rotateLeft(value: number, distance: number): number {
  return ((value << distance) | (value >>> (32 - distance))) >>> 0;
}

function validWord(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

function validateState(state: RandomState): void {
  if (![state.s0, state.s1, state.s2, state.s3].every(validWord)) {
    throw new RangeError('Random state must contain four uint32 words.');
  }
  if ((state.s0 | state.s1 | state.s2 | state.s3) === 0) {
    throw new RangeError('Random state must not contain four zero words.');
  }
}

function createRandom(state: [number, number, number, number]): SeededRandom {
  return {
    nextUint32(): number {
      const result = Math.imul(rotateLeft(Math.imul(state[1], 5), 7), 9) >>> 0;
      const t = (state[1] << 9) >>> 0;
      state[2] = (state[2] ^ state[0]) >>> 0;
      state[3] = (state[3] ^ state[1]) >>> 0;
      state[1] = (state[1] ^ state[2]) >>> 0;
      state[0] = (state[0] ^ state[3]) >>> 0;
      state[2] = (state[2] ^ t) >>> 0;
      state[3] = rotateLeft(state[3], 11);
      return result;
    },
    nextFloat(): number {
      return this.nextUint32() / 0x100000000;
    },
    nextInt(maxExclusive: number): number {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError('maxExclusive must be a positive safe integer.');
      }
      return Math.floor(this.nextFloat() * maxExclusive);
    },
    snapshot(): RandomState {
      return { s0: state[0], s1: state[1], s2: state[2], s3: state[3] };
    },
    restore(snapshot: RandomState): void {
      validateState(snapshot);
      state = [snapshot.s0, snapshot.s1, snapshot.s2, snapshot.s3];
    },
  };
}

export function createSeededRandom(seed: number): SeededRandom {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('Seed must be a safe integer.');
  }
  const seedWord = seed >>> 0;
  const state: [number, number, number, number] = [
    splitmix32(seedWord),
    splitmix32(seedWord + 1),
    splitmix32(seedWord + 2),
    splitmix32(seedWord + 3),
  ];
  if (state.every((word) => word === 0)) {
    state[0] = 0x6d2b79f5;
    state[1] = 0x1b873593;
    state[2] = 0x9e3779b9;
    state[3] = 0x243f6a88;
  }
  return createRandom(state);
}

export function createSeededRandomFromState(
  snapshot: RandomState,
): SeededRandom {
  validateState(snapshot);
  return createRandom([snapshot.s0, snapshot.s1, snapshot.s2, snapshot.s3]);
}
