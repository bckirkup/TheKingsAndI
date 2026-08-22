import { describe, expect, it } from 'vitest';

import { createFakeEnginePort } from '../src/engine/fake';
import { LivingBoard } from '../src/chess';
import { MatchSession } from '../src/orchestration/matchSession';
import { createStartingRoster } from '../src/orchestration/roster';
import { buildDests, intentFromKeys } from '../src/ui/board/boardAdapter';

describe('match session', () => {
  it('starts with a full player roster and playing phase', () => {
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
    });
    const snapshot = session.snapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.roster).toHaveLength(16);
    expect(snapshot.board.turn()).toBe('w');
    expect(snapshot.determinismId).toContain('fake-engine');
  });

  it('installs selected lineup identities on the standard board', () => {
    const standard = LivingBoard.standard();
    const lineup = createStartingRoster(standard, 'w', 20, 0.5);
    const selected = lineup.map((piece) =>
      piece.id === 'w:P:e2' ? { ...piece, id: 'w:Pawn:00' } : piece,
    );
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
      initialRoster: selected,
      initialLineup: selected,
    });

    expect(session.snapshot().board.pieceAt('e2')?.id).toBe('w:Pawn:00');
  });

  it('accepts a legal opening move and advances the opponent', async () => {
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
    });
    const accepted = await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    expect(accepted).toBe(true);
    const after = session.snapshot();
    expect(after.events.some((event) => event.t === 'MOVE')).toBe(true);
    expect(after.board.turn()).toBe('w');
    expect(after.ply).toBeGreaterThan(1);
    expect(after.lastMove).not.toBeNull();
    expect(after.lastMove).toHaveLength(2);
  });

  it('continues after an enemy refusal instead of deadlocking on its turn', async () => {
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
    });
    await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    const afterEnemyTurn = session.snapshot();
    expect(afterEnemyTurn.events.some((event) => event.t === 'REFUSAL')).toBe(
      true,
    );
    const accepted = await session.submitPlayerIntent({ from: 'd2', to: 'd4' });
    if (session.snapshot().phase === 'awaiting_player') {
      session.confirmOverride();
    }
    const after = session.snapshot();
    expect(accepted).toBe(true);
    expect(after.board.turn()).toBe('w');
    expect(after.ply).toBeGreaterThan(afterEnemyTurn.ply);
  });

  it('records the true audit score on the player move event', async () => {
    const engine = {
      ...createFakeEnginePort(),
      async evaluateTrue(): Promise<{ scoreCp: number }> {
        return { scoreCp: -123 };
      },
    };
    const session = new MatchSession({ seed: 5, engine });
    await session.submitPlayerIntent({ from: 'e2', to: 'e4' });
    const playerMove = session
      .snapshot()
      .events.find((event) => event.t === 'MOVE' && event.pieceId === 'w:P:e2');
    expect(playerMove?.t).toBe('MOVE');
    if (playerMove?.t === 'MOVE') {
      expect(playerMove.orderQualityCp).toBe(123);
    }
  });

  it('tracks selected piece id from selectPiece', () => {
    const session = new MatchSession({
      seed: 5,
      engine: createFakeEnginePort(),
    });
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
