import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/core/canonicalJson';
import { createSeededRandom } from '../src/core/random';

describe('seeded PRNG golden values', () => {
  it('produces the xoshiro128** sequence expanded by splitmix32', () => {
    const random = createSeededRandom(123456789);
    expect([
      random.nextUint32(),
      random.nextUint32(),
      random.nextUint32(),
    ]).toEqual([2159658373, 2958244506, 522434695]);
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
    expect(snapshot).toEqual(
      expect.objectContaining({
        s0: expect.any(Number),
        s1: expect.any(Number),
        s2: expect.any(Number),
        s3: expect.any(Number),
      }),
    );
    const tail = [random.nextUint32(), random.nextUint32()];
    random.nextUint32();
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

  it('sorts keys by UTF-16 code unit rather than locale', () => {
    expect(canonicalJson({ a: 1, B: 2, _: 3 })).toBe('{"B":2,"_":3,"a":1}');
  });

  it('accepts null-prototype objects', () => {
    const value = Object.create(null) as { answer: number };
    value.answer = 42;
    expect(canonicalJson(value)).toBe('{"answer":42}');
  });

  it.each([
    NaN,
    Infinity,
    -Infinity,
    undefined,
    new Date('2025-01-01T00:00:00.000Z'),
    new Map([['key', 'value']]),
    new Set(['value']),
    new (class Example {
      readonly value = 1;
    })(),
    Object.assign([], { extra: true }),
    Object.assign(Array(2), { 1: 'sparse' }),
  ])('rejects values it cannot canonicalize', (value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  });
});
