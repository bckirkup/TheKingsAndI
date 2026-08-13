import { DEFAULT_PRIVATE_MULTIPV_WIDTH } from './search';
import type { EngineEvaluation, EnginePort } from './types';

interface FakePiece {
  readonly side: 'w' | 'b';
  readonly role: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  readonly file: number;
  readonly rank: number;
}

function hashFen(fen: string): number {
  let fenHash = 0x811c9dc5;
  for (let index = 0; index < fen.length; index += 1) {
    fenHash ^= fen.charCodeAt(index);
    fenHash = Math.imul(fenHash, 0x01000193);
  }
  return fenHash;
}

function scoreFen(fen: string, depth: number): number {
  const fenHash = hashFen(fen);
  const deepLimitScore = (Math.abs(fenHash) % 401) - 200;
  const errorDirection = fenHash % 2 === 0 ? 1 : -1;
  return (
    deepLimitScore + errorDirection * Math.max(0, 16 - Math.min(depth, 16)) * 4
  );
}

function parsePieces(fen: string): {
  readonly pieces: FakePiece[];
  readonly side: 'w' | 'b';
} {
  const fields = fen.split(' ');
  const rows = fields[0]?.split('/') ?? [];
  const pieces: FakePiece[] = [];
  for (let row = 0; row < rows.length; row += 1) {
    let file = 0;
    for (const glyph of rows[row] ?? '') {
      if (glyph >= '1' && glyph <= '8') {
        file += Number(glyph);
        continue;
      }
      const side = glyph === glyph.toUpperCase() ? 'w' : 'b';
      pieces.push({
        side,
        role: glyph.toLowerCase() as FakePiece['role'],
        file,
        rank: 7 - row,
      });
      file += 1;
    }
  }
  return { pieces, side: fields[1] === 'b' ? 'b' : 'w' };
}

function square(file: number, rank: number): string {
  return `${String.fromCodePoint(97 + file)}${rank + 1}`;
}

function inside(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

function pseudoMoves(pieces: readonly FakePiece[], side: 'w' | 'b'): string[] {
  const occupancy = new Map<string, FakePiece>();
  for (const piece of pieces) {
    occupancy.set(square(piece.file, piece.rank), piece);
  }
  const moves: string[] = [];
  const add = (piece: FakePiece, file: number, rank: number): boolean => {
    if (!inside(file, rank)) return false;
    const target = occupancy.get(square(file, rank));
    if (target?.side === side) return false;
    moves.push(`${square(piece.file, piece.rank)}${square(file, rank)}`);
    return target === undefined;
  };
  const directions: Readonly<
    Record<'b' | 'r' | 'q', readonly (readonly [number, number])[]>
  > = {
    b: [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ],
    r: [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ],
    q: [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ],
  };
  for (const piece of pieces.filter((candidate) => candidate.side === side)) {
    if (piece.role === 'p') {
      const step = side === 'w' ? 1 : -1;
      const start = side === 'w' ? 1 : 6;
      const one = piece.rank + step;
      if (
        inside(piece.file, one) &&
        occupancy.get(square(piece.file, one)) === undefined
      ) {
        add(piece, piece.file, one);
        if (
          piece.rank === start &&
          occupancy.get(square(piece.file, piece.rank + step * 2)) === undefined
        ) {
          add(piece, piece.file, piece.rank + step * 2);
        }
      }
      for (const file of [piece.file - 1, piece.file + 1]) {
        const target = inside(file, one)
          ? occupancy.get(square(file, one))
          : undefined;
        if (target !== undefined && target.side !== side) add(piece, file, one);
      }
      continue;
    }
    if (piece.role === 'n') {
      for (const [file, rank] of [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ] as const) {
        add(piece, piece.file + file, piece.rank + rank);
      }
      continue;
    }
    const rays =
      piece.role === 'k'
        ? directions.q.map(([file, rank]) => [file, rank] as const)
        : directions[piece.role as 'b' | 'r' | 'q'];
    if (rays === undefined) continue;
    for (const [fileStep, rankStep] of rays) {
      const max = piece.role === 'k' ? 1 : 7;
      for (let distance = 1; distance <= max; distance += 1) {
        if (
          !add(
            piece,
            piece.file + fileStep * distance,
            piece.rank + rankStep * distance,
          )
        )
          break;
      }
    }
  }
  return moves.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function applyPseudoMove(pieces: FakePiece[], move: string): void {
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const mover = pieces.find((piece) => square(piece.file, piece.rank) === from);
  if (mover === undefined) return;
  const target = pieces.findIndex(
    (piece) => square(piece.file, piece.rank) === to,
  );
  if (target >= 0) pieces.splice(target, 1);
  const index = pieces.indexOf(mover);
  pieces[index] = {
    ...mover,
    file: (to.codePointAt(0) ?? 0) - 97,
    rank: Number(to[1]) - 1,
  };
}

function fakeLines(fen: string, depth: number): readonly EngineEvaluation[] {
  const { pieces, side } = parsePieces(fen);
  const width = DEFAULT_PRIVATE_MULTIPV_WIDTH;
  const hash = Math.abs(hashFen(fen));
  const lines: EngineEvaluation[] = [];
  const used = new Set<string>();
  for (let lineIndex = 0; lineIndex < width; lineIndex += 1) {
    const working = pieces.map((piece) => ({ ...piece }));
    let turn = side;
    const pv: string[] = [];
    for (let ply = 0; ply < Math.max(1, Math.min(depth, 4)); ply += 1) {
      const moves = pseudoMoves(working, turn);
      if (moves.length === 0) break;
      const start = (hash + lineIndex * 17 + ply * 31) % moves.length;
      const move =
        moves.find(
          (candidate, index) => !used.has(candidate) || index === start,
        ) ?? moves[start];
      if (move === undefined) break;
      pv.push(move);
      used.add(move);
      applyPseudoMove(working, move);
      turn = turn === 'w' ? 'b' : 'w';
    }
    if (pv.length > 0) {
      lines.push(
        Object.freeze({
          scoreCp: scoreFen(fen, depth),
          pv: Object.freeze(pv),
        }),
      );
    }
  }
  return Object.freeze(lines);
}

/**
 * Deterministic stand-in for tests and environments without a WASM worker.
 * Score is a pure function of (fen, depth); never uses wall clock or Math.random.
 */
export function createFakeEnginePort(
  determinismId = 'fake-engine/depth-fixed',
): EnginePort {
  return {
    determinismId,
    async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
      if (!Number.isSafeInteger(depth) || depth < 1) {
        throw new RangeError('Depth must be a positive integer.');
      }
      const scoreCp = scoreFen(fen, depth);
      const pvHash = (hashFen(fen) + depth * 1_000_003) | 0;
      const file = 7 - (Math.abs(pvHash) % 8);
      const rank = 1 + (Math.abs(pvHash >> 3) % 2);
      const toFile = file;
      const toRank = rank + 1;
      const fileChar = String.fromCodePoint(('a'.codePointAt(0) ?? 0) + file);
      const toFileChar = String.fromCodePoint(
        ('a'.codePointAt(0) ?? 0) + toFile,
      );
      return Object.freeze({
        scoreCp,
        pv: Object.freeze([
          `${fileChar}${rank}${toFileChar}${toRank}`,
        ]) as readonly string[],
      });
    },
    async multiPvAt(
      fen: string,
      depth: number,
    ): Promise<readonly EngineEvaluation[]> {
      if (!Number.isSafeInteger(depth) || depth < 1) {
        throw new RangeError('Depth must be a positive integer.');
      }
      return fakeLines(fen, depth);
    },
    async multiPvAtMax(fen: string): Promise<readonly EngineEvaluation[]> {
      return fakeLines(fen, 16);
    },
    async bestAt(fen: string, depth: number): Promise<EngineEvaluation> {
      const line = fakeLines(fen, depth)[0];
      if (line === undefined) throw new Error('Fake engine produced no line');
      return line;
    },
  };
}
