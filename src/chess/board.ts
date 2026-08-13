import { Chess } from 'chess.js';
import type { Move, Square as ChessSquare } from 'chess.js';

import type {
  AppliedCastle,
  AppliedMove,
  BoardPiece,
  MoveIntent,
  PieceId,
  PieceIdFactory,
  PromotionRole,
  Role,
  Side,
  Square,
} from './types';
import { comparePieceIds } from '../core/ids';

/**
 * chess.js has no notion of piece identity: it stores glyphs on squares, so a
 * captured knight and a promoted knight are indistinguishable. `LivingBoard`
 * keeps a square -> PieceId map alongside the position and maintains it through
 * every move, capture, castle, promotion, and en passant.
 */

export class IllegalMoveError extends Error {
  constructor(intent: MoveIntent) {
    super(
      `Illegal move: ${intent.from}${intent.to}${intent.promotion ?? ''}`.trim(),
    );
    this.name = 'IllegalMoveError';
  }
}

export class IllegalSanError extends Error {
  constructor(san: string) {
    super(`Illegal move: ${san}`);
    this.name = 'IllegalSanError';
  }
}

/** The position and the identity map disagree — a bug, never bad input. */
export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityError';
  }
}

const ROLE_BY_GLYPH: Readonly<Record<string, Role>> = {
  p: 'P',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
};

const GLYPH_BY_ROLE: Readonly<Record<PromotionRole, 'q' | 'r' | 'b' | 'n'>> = {
  Q: 'q',
  R: 'r',
  B: 'b',
  N: 'n',
};

function roleOfGlyph(glyph: string): Role {
  const role = ROLE_BY_GLYPH[glyph];
  if (role === undefined) {
    throw new TypeError(`Unknown piece glyph: ${glyph}`);
  }
  return role;
}

function promotionOfGlyph(glyph: string): PromotionRole {
  const role = roleOfGlyph(glyph);
  if (role === 'P' || role === 'K') {
    throw new TypeError(`Not a promotion target: ${glyph}`);
  }
  return role;
}

/** Deterministic default identities, e.g. `w:P:e2` for the pawn born on e2. */
export function startingSquarePieceId(seed: {
  readonly side: Side;
  readonly role: Role;
  readonly square: Square;
}): PieceId {
  return `${seed.side}:${seed.role}:${seed.square}`;
}

function enPassantVictimSquare(move: Move): Square {
  const file = move.to.charAt(0);
  const rank = move.from.charAt(1);
  return `${file}${rank}` as ChessSquare;
}

function castleOf(move: Move, rookId: PieceId): AppliedCastle {
  const wing = move.flags.includes('k') ? 'king' : 'queen';
  const rank = move.from.charAt(1);
  const rookFrom = `${wing === 'king' ? 'h' : 'a'}${rank}` as ChessSquare;
  const rookTo = `${wing === 'king' ? 'f' : 'd'}${rank}` as ChessSquare;
  return { rookId, rookFrom, rookTo, wing };
}

function isCastle(move: Move): boolean {
  return move.flags.includes('k') || move.flags.includes('q');
}

export class LivingBoard {
  private readonly chess: Chess;
  private readonly idBySquare: Map<Square, PieceId>;
  private readonly squareById: Map<PieceId, Square>;
  private readonly roleById: Map<PieceId, Role>;
  private readonly sideById: Map<PieceId, Side>;
  private plyCount: number;

  private constructor(
    chess: Chess,
    idBySquare: Map<Square, PieceId>,
    squareById: Map<PieceId, Square>,
    roleById: Map<PieceId, Role>,
    sideById: Map<PieceId, Side>,
    plyCount: number,
  ) {
    this.chess = chess;
    this.idBySquare = idBySquare;
    this.squareById = squareById;
    this.roleById = roleById;
    this.sideById = sideById;
    this.plyCount = plyCount;
  }

  static fromFen(
    fen: string,
    mintId: PieceIdFactory = startingSquarePieceId,
  ): LivingBoard {
    const chess = new Chess(fen);
    const idBySquare = new Map<Square, PieceId>();
    const squareById = new Map<PieceId, Square>();
    const roleById = new Map<PieceId, Role>();
    const sideById = new Map<PieceId, Side>();
    for (const row of chess.board()) {
      for (const entry of row) {
        if (entry === null) continue;
        const role = roleOfGlyph(entry.type);
        const side: Side = entry.color;
        const id = mintId({ side, role, square: entry.square });
        if (squareById.has(id)) {
          throw new Error(`Duplicate PieceId minted: ${id}`);
        }
        idBySquare.set(entry.square, id);
        squareById.set(id, entry.square);
        roleById.set(id, role);
        sideById.set(id, side);
      }
    }
    return new LivingBoard(
      chess,
      idBySquare,
      squareById,
      roleById,
      sideById,
      0,
    );
  }

  static standard(mintId: PieceIdFactory = startingSquarePieceId): LivingBoard {
    return LivingBoard.fromFen(new Chess().fen(), mintId);
  }

  clone(): LivingBoard {
    return new LivingBoard(
      new Chess(this.chess.fen()),
      new Map(this.idBySquare),
      new Map(this.squareById),
      new Map(this.roleById),
      new Map(this.sideById),
      this.plyCount,
    );
  }

  fen(): string {
    return this.chess.fen();
  }

  turn(): Side {
    return this.chess.turn();
  }

  ply(): number {
    return this.plyCount;
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  isCheck(): boolean {
    return this.chess.inCheck();
  }

  /** Pieces sorted by `PieceId` so every consumer sees one canonical order. */
  pieces(): BoardPiece[] {
    return [...this.squareById.keys()]
      .sort(comparePieceIds)
      .map((id) => this.requirePiece(id));
  }

  piecesOf(side: Side): BoardPiece[] {
    return this.pieces().filter((piece) => piece.side === side);
  }

  pieceAt(square: Square): BoardPiece | undefined {
    const id = this.idBySquare.get(square);
    return id === undefined ? undefined : this.requirePiece(id);
  }

  pieceOf(id: PieceId): BoardPiece | undefined {
    return this.squareById.has(id) ? this.requirePiece(id) : undefined;
  }

  squareOf(id: PieceId): Square | undefined {
    return this.squareById.get(id);
  }

  /** A copy of the square -> PieceId map; the caller cannot mutate ours. */
  identityMap(): Record<Square, PieceId> {
    const map: Record<string, PieceId> = {};
    for (const square of [...this.idBySquare.keys()].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      const id = this.idBySquare.get(square);
      if (id !== undefined) map[square] = id;
    }
    return map;
  }

  /** Enemy pieces attacking `square`, sorted by `PieceId`. */
  attackersOf(square: Square, side: Side): BoardPiece[] {
    return this.chess
      .attackers(square, side)
      .map((from) => this.pieceAt(from))
      .filter((piece): piece is BoardPiece => piece !== undefined)
      .sort((left, right) => (left.id < right.id ? -1 : 1));
  }

  isAttacked(square: Square, by: Side): boolean {
    return this.chess.isAttacked(square, by);
  }

  /** Legal moves for the side to move, sorted by LAN for determinism. */
  legalMoves(): MoveIntent[] {
    return this.chess
      .moves({ verbose: true })
      .map((move) => this.intentOf(move))
      .sort((left, right) => (this.lanOf(left) < this.lanOf(right) ? -1 : 1));
  }

  /**
   * SAN for every legal move, sorted. Much cheaper than `legalMoves()`, whose
   * verbose generation costs a position dump per candidate: use this when only
   * the move list is needed (the harness, the replayer, fuzzing).
   */
  legalMovesSan(): string[] {
    return this.chess.moves().sort();
  }

  isLegal(intent: MoveIntent): boolean {
    return this.chess
      .moves({ verbose: true })
      .some((move) => this.lanOf(this.intentOf(move)) === this.lanOf(intent));
  }

  applyMove(intent: MoveIntent): AppliedMove {
    if (this.idBySquare.get(intent.from) === undefined) {
      throw new IllegalMoveError(intent);
    }
    try {
      return this.commit(
        this.chess.move({
          from: intent.from,
          to: intent.to,
          ...(intent.promotion === undefined
            ? {}
            : { promotion: GLYPH_BY_ROLE[intent.promotion] }),
        }),
      );
    } catch (cause) {
      if (cause instanceof IdentityError) throw cause;
      throw new IllegalMoveError(intent);
    }
  }

  /** Replay path: apply a move recorded as SAN in the event log. */
  applySan(san: string): AppliedMove {
    try {
      return this.commit(this.chess.move(san));
    } catch (cause) {
      if (cause instanceof IdentityError) throw cause;
      throw new IllegalSanError(san);
    }
  }

  /** Remove a piece from the board without ending the game (desertion path). */
  withdrawPiece(id: PieceId): void {
    const square = this.squareById.get(id);
    if (square === undefined) {
      throw new IdentityError(`Unknown PieceId: ${id}`);
    }
    const role = this.requireRole(id);
    if (role === 'K') {
      throw new IdentityError('The King cannot leave the board.');
    }
    this.chess.remove(square);
    this.removePiece(id, square);
  }

  private commit(move: Move): AppliedMove {
    const moverId = this.idBySquare.get(move.from);
    if (moverId === undefined) {
      this.chess.undo();
      throw new IdentityError(`No identity registered on ${move.from}`);
    }
    const moverRole = this.requireRole(moverId);
    const fenBefore = move.before;

    const applied: {
      capture?: AppliedMove['capture'];
      promotion?: AppliedMove['promotion'];
      castle?: AppliedMove['castle'];
    } = {};

    if (move.captured !== undefined) {
      const victimSquare = move.isEnPassant()
        ? enPassantVictimSquare(move)
        : move.to;
      const victimId = this.idBySquare.get(victimSquare);
      if (victimId === undefined) {
        throw new IdentityError(`No identity registered on ${victimSquare}`);
      }
      applied.capture = {
        pieceId: victimId,
        role: this.requireRole(victimId),
        square: victimSquare,
      };
      this.removePiece(victimId, victimSquare);
    }

    this.relocate(moverId, move.from, move.to);

    if (move.promotion !== undefined) {
      const toRole = promotionOfGlyph(move.promotion);
      applied.promotion = { pieceId: moverId, fromRole: moverRole, toRole };
      this.roleById.set(moverId, toRole);
    }

    if (isCastle(move)) {
      const wingIsKing = move.flags.includes('k');
      const rank = move.from.charAt(1);
      const rookFrom = `${wingIsKing ? 'h' : 'a'}${rank}` as ChessSquare;
      const rookId = this.idBySquare.get(rookFrom);
      if (rookId === undefined) {
        throw new IdentityError(`No identity registered on ${rookFrom}`);
      }
      const castle = castleOf(move, rookId);
      applied.castle = castle;
      this.relocate(rookId, castle.rookFrom, castle.rookTo);
    }

    this.plyCount += 1;
    return {
      ply: this.plyCount,
      side: move.color,
      san: move.san,
      lan: move.lan,
      moverId,
      moverRole,
      from: move.from,
      to: move.to,
      fenBefore,
      fenAfter: this.chess.fen(),
      ...(applied.capture === undefined ? {} : { capture: applied.capture }),
      ...(applied.promotion === undefined
        ? {}
        : { promotion: applied.promotion }),
      ...(applied.castle === undefined ? {} : { castle: applied.castle }),
    };
  }

  private intentOf(move: Move): MoveIntent {
    return {
      from: move.from,
      to: move.to,
      ...(move.promotion === undefined
        ? {}
        : { promotion: promotionOfGlyph(move.promotion) }),
    };
  }

  private lanOf(intent: MoveIntent): string {
    return `${intent.from}${intent.to}${
      intent.promotion === undefined ? '' : GLYPH_BY_ROLE[intent.promotion]
    }`;
  }

  private relocate(id: PieceId, from: Square, to: Square): void {
    this.idBySquare.delete(from);
    this.idBySquare.set(to, id);
    this.squareById.set(id, to);
  }

  private removePiece(id: PieceId, square: Square): void {
    this.idBySquare.delete(square);
    this.squareById.delete(id);
  }

  private requireRole(id: PieceId): Role {
    const role = this.roleById.get(id);
    if (role === undefined) throw new Error(`Unknown PieceId: ${id}`);
    return role;
  }

  private requirePiece(id: PieceId): BoardPiece {
    const square = this.squareById.get(id);
    const side = this.sideById.get(id);
    if (square === undefined || side === undefined) {
      throw new Error(`Unknown PieceId: ${id}`);
    }
    return { id, side, role: this.requireRole(id), square };
  }
}
