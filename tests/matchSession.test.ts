import { describe, expect, it } from 'vitest';

import { buildDests, intentFromKeys } from '../src/ui/board/boardAdapter';
import { LivingBoard } from '../src/chess';
import { MatchSession } from '../src/orchestration/matchSession';

describe('match session', () => {
  it('starts with a full player roster and playing phase', () => {
    const session = new MatchSession({ seed: 5 });
    const snapshot = session.snapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.roster).toHaveLength(16);
    expect(snapshot.board.turn()).toBe('w');
  });

  it('accepts a legal opening move and advances the opponent', () => {
    const session = new MatchSession({ seed: 5 });
    const accepted = session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    expect(accepted).toBe(true);
    const after = session.snapshot();
    expect(after.events.some((event) => event.t === 'MOVE')).toBe(true);
    expect(after.board.turn()).toBe('w');
    expect(after.ply).toBeGreaterThan(1);
    expect(after.lastMove).not.toBeNull();
    expect(after.lastMove).toHaveLength(2);
  });

  it('tracks selected piece id from selectPiece', () => {
    const session = new MatchSession({ seed: 5 });
    const snapshot = session.snapshot();
    const first = snapshot.roster[0];
    expect(first).toBeDefined();
    session.selectPiece(first?.id ?? null);
    expect(session.snapshot().selectedPieceId).toBe(first?.id ?? null);
  });

  it('builds chessground dests for all legal moves', () => {
    const board = LivingBoard.standard();
    const dests = buildDests(board);
    expect(dests.size).toBeGreaterThan(0);
    const intent = intentFromKeys(board, 'e2', 'e4');
    expect(intent).toEqual({ from: 'e2', to: 'e4' });
  });
});
