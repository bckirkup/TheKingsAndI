import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/core/canonicalJson';
import { createSeededRandom } from '../src/core/random';

describe('seeded PRNG golden values', () => {
  it('produces the fixed xorshift32 sequence', () => {
    const random = createSeededRandom(123456789);
    expect([
      random.nextUint32(),
      random.nextUint32(),
      random.nextUint32(),
    ]).toEqual([2714967881, 2238813396, 1250077441]);
  });

  it('changes when the seed changes', () => {
    const first = createSeededRandom(1).nextUint32();
    const second = createSeededRandom(2).nextUint32();
    expect(first).not.toBe(second);
  });

  it('restores a snapshot and reproduces the tail', () => {
    const random = createSeededRandom(42);
    random.nextUint32();
    const snapshot = random.snapshot();
    const tail = [random.nextUint32(), random.nextUint32()];
    random.restore(snapshot);
    expect([random.nextUint32(), random.nextUint32()]).toEqual(tail);
  });
});

describe('canonical JSON golden values', () => {
  it('sorts keys and formats values deterministically', () => {
    expect(
      canonicalJson({ z: 1, a: 'value', nested: { b: true, a: null } }),
    ).toBe('{"a":"value","nested":{"a":null,"b":true},"z":1}');
  });

  it('is independent of insertion order', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it.each([NaN, Infinity, -Infinity, undefined])('rejects %s', (value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  });
});
