import { describe, expect, it } from 'vitest';

import { squareGridPosition } from '../src/ui/overlays/PieceOverlay';

describe('PieceOverlay square grid (S1 board chrome)', () => {
  it('maps a1..h8 onto an 8×8 CSS grid from white’s view', () => {
    expect(squareGridPosition('a1')).toEqual({ column: 1, row: 8 });
    expect(squareGridPosition('h1')).toEqual({ column: 8, row: 8 });
    expect(squareGridPosition('a8')).toEqual({ column: 1, row: 1 });
    expect(squareGridPosition('e4')).toEqual({ column: 5, row: 5 });
  });

  it('keeps files monotone left-to-right on the same rank', () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
    const columns = files.map((file) => squareGridPosition(`${file}4`).column);
    expect(columns).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
