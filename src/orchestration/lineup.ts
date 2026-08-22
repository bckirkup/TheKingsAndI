import type { PieceId, PieceIdFactory, Role, Side, Square } from '../chess';
import type { PieceState } from '../psychology';

function roleNameFor(role: Role): PieceState['role'] {
  switch (role) {
    case 'P':
      return 'Pawn';
    case 'N':
      return 'Knight';
    case 'B':
      return 'Bishop';
    case 'R':
      return 'Rook';
    case 'Q':
      return 'Queen';
    case 'K':
      return 'King';
  }
}

export function lineupPieceIdFactory(
  lineups: Readonly<Partial<Record<Side, readonly PieceState[]>>>,
): PieceIdFactory {
  const counts: Record<string, number> = {};
  return ({
    side,
    role,
    square,
  }: {
    readonly side: Side;
    readonly role: Role;
    readonly square: Square;
  }): PieceId => {
    const key = `${side}:${role}`;
    const index = counts[key] ?? 0;
    counts[key] = index + 1;
    const lineup = lineups[side];
    const candidates =
      lineup?.filter((piece) => piece.role === roleNameFor(role)) ?? [];
    const piece = candidates[index];
    return piece?.id ?? `${side}:${role}:${square}`;
  };
}
