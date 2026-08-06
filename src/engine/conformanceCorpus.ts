/**
 * Fixed FEN × depth corpus for engine conformance (ADR 0020 §2).
 * Golden values were recorded from Lozza 11 at default hash on 2026-08-06.
 */
export interface ConformanceCase {
  readonly id: string;
  readonly fen: string;
  readonly depth: number;
  readonly scoreCp: number;
  readonly pvPrefix: readonly string[];
}

export const CONFORMANCE_CORPUS: readonly ConformanceCase[] = [
  {
    id: 'startpos-d4',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    depth: 4,
    scoreCp: 42,
    pvPrefix: ['e2e4'],
  },
  {
    id: 'italian-d6',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    depth: 6,
    scoreCp: -37,
    pvPrefix: ['e7e5', 'g1f3'],
  },
  {
    id: 'endgame-d8',
    fen: '8/8/8/4k3/8/8/4K3/8 w - - 0 1',
    depth: 8,
    scoreCp: 0,
    pvPrefix: [],
  },
];
