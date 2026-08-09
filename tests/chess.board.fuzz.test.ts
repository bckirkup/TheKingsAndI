import { describe, expect, it } from 'vitest';

import { createSeededRandom } from '../src/core/random';
import { LivingBoard } from '../src/chess';

describe('LivingBoard large identity fuzz', () => {
  it('survives 1,000 random legal games with a consistent identity map', () => {
    const random = createSeededRandom(20260803);
    const violations: string[] = [];
    let promotions = 0;
    let captures = 0;
    let castles = 0;
    let plies = 0;

    for (let game = 0; game < 1000; game += 1) {
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
    expect(plies).toBeGreaterThan(50_000);
    expect(captures).toBeGreaterThan(1_000);
    expect(promotions).toBeGreaterThan(0);
    expect(castles).toBeGreaterThan(0);
  });
});
