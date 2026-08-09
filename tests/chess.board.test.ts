import { describe, expect, it } from 'vitest';

import { IllegalMoveError, IllegalSanError, LivingBoard } from '../src/chess';
import type { MoveIntent, Square } from '../src/chess';
import { createSeededRandom } from '../src/core/random';

describe('LivingBoard identity golden values', () => {
  it('mints one identity per piece in the starting position', () => {
    const board = LivingBoard.standard();
    expect(board.pieces()).toHaveLength(32);
    expect(board.pieceAt('e2' as Square)).toEqual({
      id: 'w:P:e2',
      side: 'w',
      role: 'P',
      square: 'e2',
    });
    expect(board.squareOf('b:N:g8')).toBe('g8');
  });

  it('carries the mover identity to the destination square', () => {
    const board = LivingBoard.standard();
    const applied = board.applyMove({ from: 'e2', to: 'e4' } as MoveIntent);
    expect(applied.san).toBe('e4');
    expect(applied.ply).toBe(1);
    expect(applied.moverId).toBe('w:P:e2');
    expect(board.squareOf('w:P:e2')).toBe('e4');
    expect(board.pieceAt('e2' as Square)).toBeUndefined();
  });

  it('names the victim of an ordinary capture', () => {
    const board = LivingBoard.fromFen(
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    );
    const applied = board.applyMove({ from: 'e4', to: 'd5' } as MoveIntent);
    expect(applied.capture).toEqual({
      pieceId: 'b:P:d5',
      role: 'P',
      square: 'd5',
    });
    expect(board.pieceOf('b:P:d5')).toBeUndefined();
    expect(board.squareOf('w:P:e4')).toBe('d5');
  });

  it('removes the en-passant victim from its own square, not the destination', () => {
    const board = LivingBoard.fromFen(
      'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
    );
    const applied = board.applyMove({ from: 'e5', to: 'f6' } as MoveIntent);
    expect(applied.capture).toEqual({
      pieceId: 'b:P:f5',
      role: 'P',
      square: 'f5',
    });
    expect(board.squareOf('w:P:e5')).toBe('f6');
    expect(board.pieceOf('b:P:f5')).toBeUndefined();
  });

  it('relocates both identities when castling', () => {
    const board = LivingBoard.fromFen(
      'r3k2r/pppq1ppp/2n5/3pP3/8/8/PPP2PPP/R3K2R w KQkq - 0 1',
    );
    const applied = board.applyMove({ from: 'e1', to: 'g1' } as MoveIntent);
    expect(applied.san).toBe('O-O');
    expect(applied.castle).toEqual({
      rookId: 'w:R:h1',
      rookFrom: 'h1',
      rookTo: 'f1',
      wing: 'king',
    });
    expect(board.squareOf('w:K:e1')).toBe('g1');
    expect(board.squareOf('w:R:h1')).toBe('f1');

    const queenside = LivingBoard.fromFen(
      'r3k2r/pppq1ppp/2n5/3pP3/8/8/PPP2PPP/R3K2R b KQkq - 0 1',
    );
    const blackCastle = queenside.applyMove({
      from: 'e8',
      to: 'c8',
    } as MoveIntent);
    expect(blackCastle.castle).toEqual({
      rookId: 'b:R:a8',
      rookFrom: 'a8',
      rookTo: 'd8',
      wing: 'queen',
    });
    expect(queenside.squareOf('b:R:a8')).toBe('d8');
  });

  it('keeps the identity through promotion and mutates only the role', () => {
    const board = LivingBoard.fromFen(
      'rnbq1bnr/ppppkPpp/8/8/8/8/PPPP1PPP/RNBQKBNR w KQ - 0 1',
    );
    const applied = board.applyMove({
      from: 'f7',
      to: 'g8',
      promotion: 'Q',
    } as MoveIntent);
    expect(applied.san).toBe('fxg8=Q');
    expect(applied.promotion).toEqual({
      pieceId: 'w:P:f7',
      fromRole: 'P',
      toRole: 'Q',
    });
    expect(board.pieceAt('g8' as Square)).toEqual({
      id: 'w:P:f7',
      side: 'w',
      role: 'Q',
      square: 'g8',
    });
  });

  it('withdraws a piece from the board for desertion', () => {
    const board = LivingBoard.standard();
    board.withdrawPiece('w:R:a1');
    expect(board.pieceOf('w:R:a1')).toBeUndefined();
    expect(board.pieceAt('a1' as Square)).toBeUndefined();
    expect(board.piecesOf('w')).toHaveLength(15);
  });

  it('rejects an illegal move without changing state', () => {
    const board = LivingBoard.standard();
    const before = board.fen();
    expect(() =>
      board.applyMove({ from: 'e2', to: 'e5' } as MoveIntent),
    ).toThrow(IllegalMoveError);
    expect(board.fen()).toBe(before);
    expect(board.ply()).toBe(0);
    expect(board.isLegal({ from: 'e2', to: 'e5' } as MoveIntent)).toBe(false);
    expect(board.isLegal({ from: 'e2', to: 'e4' } as MoveIntent)).toBe(true);
  });

  it('enumerates legal moves in a canonical order', () => {
    const board = LivingBoard.standard();
    const moves = board.legalMoves();
    expect(moves).toHaveLength(20);
    expect(moves.slice(0, 3)).toEqual([
      { from: 'a2', to: 'a3' },
      { from: 'a2', to: 'a4' },
      { from: 'b1', to: 'a3' },
    ]);
  });

  it('applies a recorded SAN move to the same effect as its intent', () => {
    const board = LivingBoard.fromFen(
      'r3k2r/pppq1ppp/2n5/3pP3/8/8/PPP2PPP/R3K2R w KQkq - 0 1',
    );
    const viaSan = board.clone().applySan('O-O');
    const viaIntent = board
      .clone()
      .applyMove({ from: 'e1', to: 'g1' } as MoveIntent);
    expect(viaSan).toEqual(viaIntent);
    expect(() => board.applySan('Qh8')).toThrow(IllegalSanError);
    expect(board.ply()).toBe(0);
  });

  it('enumerates the same move set as SAN and as intents', () => {
    const board = LivingBoard.fromFen(
      'r3k2r/pppq1ppp/2n5/3pP3/8/8/PPP2PPP/R3K2R w KQkq - 0 1',
    );
    const fromSan = board.legalMovesSan();
    expect(fromSan).toEqual([...fromSan].sort());
    expect(fromSan).toHaveLength(board.legalMoves().length);
    expect(
      board
        .legalMoves()
        .map((intent) => board.clone().applyMove(intent).san)
        .sort(),
    ).toEqual(fromSan);
  });

  it('clones without aliasing the identity map', () => {
    const board = LivingBoard.standard();
    const clone = board.clone();
    clone.applyMove({ from: 'e2', to: 'e4' } as MoveIntent);
    expect(board.squareOf('w:P:e2')).toBe('e2');
    expect(clone.squareOf('w:P:e2')).toBe('e4');
    expect(board.ply()).toBe(0);
    expect(clone.ply()).toBe(1);
  });
});

describe('LivingBoard identity fuzz', () => {
  it('survives 100 random legal games with a consistent identity map', () => {
    const random = createSeededRandom(20260803);
    // Violations are collected rather than asserted per ply: a few million
    // `expect` calls cost minutes of CI time and say nothing extra.
    const violations: string[] = [];
    let promotions = 0;
    let captures = 0;
    let castles = 0;
    let plies = 0;

    for (let game = 0; game < 100; game += 1) {
      const board = LivingBoard.standard();
      const living = new Set(board.pieces().map((piece) => piece.id));
      for (let ply = 0; ply < 120 && !board.isGameOver(); ply += 1) {
        const moves = board.legalMovesSan();
        const san = moves[random.nextInt(moves.length)];
        if (san === undefined) break;
        const applied = board.applySan(san);
        plies += 1;
        if (applied.capture !== undefined) {
          captures += 1;
          living.delete(applied.capture.pieceId);
        }
        if (applied.promotion !== undefined) promotions += 1;
        if (applied.castle !== undefined) castles += 1;

        const pieces = board.pieces();
        const context = `game ${game} ply ${ply} (${applied.san})`;
        if (pieces.length !== living.size) {
          violations.push(
            `${context}: ${pieces.length} on board, ${living.size} alive`,
          );
        }
        if (Object.keys(board.identityMap()).length !== pieces.length) {
          violations.push(`${context}: identity map size disagrees`);
        }
        for (const piece of pieces) {
          if (!living.has(piece.id)) {
            violations.push(
              `${context}: ${piece.id} was captured but is on board`,
            );
          }
          if (board.squareOf(piece.id) !== piece.square) {
            violations.push(`${context}: ${piece.id} square lookup disagrees`);
          }
          if (board.pieceAt(piece.square)?.id !== piece.id) {
            violations.push(
              `${context}: ${piece.square} identity lookup disagrees`,
            );
          }
        }
        // A King is never captured, so each side keeps exactly one.
        for (const side of ['w', 'b'] as const) {
          const kings = board
            .piecesOf(side)
            .filter((piece) => piece.role === 'K');
          if (kings.length !== 1) {
            violations.push(`${context}: ${side} has ${kings.length} kings`);
          }
        }
      }
    }

    expect(violations.slice(0, 5)).toEqual([]);
    // The corpus must actually exercise the hard paths.
    expect(plies).toBeGreaterThan(5_000);
    expect(captures).toBeGreaterThan(100);
    expect(promotions).toBeGreaterThan(0);
    expect(castles).toBeGreaterThan(0);
  });

  it('is reproducible for a fixed seed and diverges for another', () => {
    const play = (seed: number): string => {
      const random = createSeededRandom(seed);
      const board = LivingBoard.standard();
      for (let ply = 0; ply < 40 && !board.isGameOver(); ply += 1) {
        const moves = board.legalMoves();
        const intent = moves[random.nextInt(moves.length)];
        if (intent === undefined) break;
        board.applyMove(intent);
      }

      return board.fen();
    };
    expect(play(7)).toBe(play(7));
    expect(play(7)).not.toBe(play(8));
  });
});
