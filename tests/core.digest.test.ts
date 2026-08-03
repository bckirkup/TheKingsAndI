import { describe, expect, it } from 'vitest';

import { digest } from '../src/core/digest';
import { comparePieceIds } from '../src/core/ids';

describe('digest golden values', () => {
  it('hashes canonical JSON to 16 hex digits', () => {
    expect(digest(null)).toBe('c88cac46a918842a');
    expect(digest(0)).toBe('31ed8b7d9dbe2331');
    expect(digest('')).toBe('e5221365f38a9099');
    expect(digest([1, 2, 3])).toBe('0aa54a2b23cd11a7');
    expect(digest({ pieceId: 'w:P:e2', scoreCp: 34 })).toBe('cbe764b42df228c8');
  });

  it('ignores key order but not values, keys, or types', () => {
    const base = digest({ a: 1, b: [2, 3] });
    expect(digest({ b: [2, 3], a: 1 })).toBe(base);
    expect(digest({ a: 1, b: [3, 2] })).not.toBe(base);
    expect(digest({ a: 2, b: [2, 3] })).not.toBe(base);
    expect(digest({ A: 1, b: [2, 3] })).not.toBe(base);
    expect(digest({ a: '1', b: [2, 3] })).not.toBe(base);
    // A single-centipawn difference must move the digest.
    expect(digest({ scoreCp: 34 })).not.toBe(digest({ scoreCp: 35 }));
  });

  it('separates strings that differ only above the low byte', () => {
    // Both halves of each code unit are hashed, so 'Ā' (U+0100) must not
    // collide with '\u0000'.
    expect(digest('\u0100')).not.toBe(digest('\u0000'));
    expect(digest('\u0141')).not.toBe(digest('\u0041'));
  });

  it('refuses values canonical JSON cannot encode', () => {
    expect(() => digest(undefined)).toThrow(TypeError);
    expect(() => digest(Number.NaN)).toThrow(TypeError);
    expect(() => digest(new Map())).toThrow(TypeError);
  });
});

describe('PieceId ordering', () => {
  it('is a total order by code unit', () => {
    expect(comparePieceIds('w:B:f1', 'w:K:e1')).toBe(-1);
    expect(comparePieceIds('w:K:e1', 'w:B:f1')).toBe(1);
    expect(comparePieceIds('w:K:e1', 'w:K:e1')).toBe(0);
    const ids = ['w:P:e2', 'b:K:e8', 'w:K:e1', 'b:P:a7'];
    expect([...ids].sort(comparePieceIds)).toEqual([
      'b:K:e8',
      'b:P:a7',
      'w:K:e1',
      'w:P:e2',
    ]);
  });
});
