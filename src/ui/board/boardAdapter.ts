import type { Key } from 'chessground/types';
import type { LivingBoard, MoveIntent, Side, Square } from '../../chess';

export function buildDests(board: LivingBoard): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const move of board.legalMoves()) {
    const from = move.from as Key;
    const to = move.to as Key;
    const existing = dests.get(from) ?? [];
    if (!existing.includes(to)) {
      existing.push(to);
    }
    dests.set(from, existing);
  }
  return dests;
}

export function intentFromOrigDest(
  board: LivingBoard,
  orig: Key,
  dest: Key,
): MoveIntent | undefined {
  const match = board
    .legalMoves()
    .find(
      (move) => move.from === (orig as Square) && move.to === (dest as Square),
    );
  return match;
}

export function intentFromKeys(
  board: LivingBoard,
  orig: Key,
  dest: Key,
  promotionRole?: 'q' | 'r' | 'b' | 'n',
): MoveIntent | undefined {
  if (promotionRole === undefined) {
    return intentFromOrigDest(board, orig, dest);
  }
  let promotion: 'Q' | 'R' | 'B' | 'N';
  switch (promotionRole) {
    case 'q':
      promotion = 'Q';
      break;
    case 'r':
      promotion = 'R';
      break;
    case 'b':
      promotion = 'B';
      break;
    case 'n':
      promotion = 'N';
      break;
    default: {
      const exhaustive: never = promotionRole;
      throw new Error(`Unknown promotion role: ${exhaustive}`);
    }
  }
  const intent: MoveIntent = {
    from: orig as Square,
    to: dest as Square,
    ...(promotion === undefined ? {} : { promotion }),
  };
  return board.isLegal(intent) ? intent : undefined;
}

export function sideColor(side: Side): 'white' | 'black' {
  return side === 'w' ? 'white' : 'black';
}
