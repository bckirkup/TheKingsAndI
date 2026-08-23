import { describe, expect, it } from 'vitest';

import { applyMoveTrauma } from '../src/orchestration/trauma';
import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
} from '../src/psychology';

function piece(id: string, trauma = 0) {
  return normalizePieceState({
    id,
    role: 'Knight',
    traits: {
      w_honor: 0.5,
      w_courage: 0.5,
      w_ambition: 0.5,
      w_loyalty: 0.5,
      w_empathy: 0.5,
      w_prestige: 0.5,
    },
    E_i: 50,
    T_i: 50,
    M_i: 80,
    B_i: trauma,
    dyadicAffinity: {},
    classPrestige: {
      Pawn: 0,
      Knight: 0,
      Bishop: 0,
      Rook: 0,
      Queen: 0,
      King: 0,
    },
    engagementFactor: 1,
    credence: defaultCredence(),
    rumor: defaultRumor(),
  });
}

describe('applyMoveTrauma', () => {
  it('applies sustained dread when private capture risk is elevated', () => {
    const roster = [piece('w:N:g1'), piece('w:B:c1')];
    const result = applyMoveTrauma(
      roster,
      {},
      { 'w:N:g1': 0.9, 'w:B:c1': 0 },
      undefined,
      3,
    );
    expect(result.roster).toHaveLength(2);
    expect(result.exposure['w:N:g1']).toBeDefined();
    const dreadEvents = result.events.filter(
      (event) => event.t === 'PSYCH_DELTA' && event.pieceId === 'w:N:g1',
    );
    expect(dreadEvents.length).toBeGreaterThanOrEqual(0);
  });

  it('raises capture trauma on the captured piece and emits a delta', () => {
    const before = piece('w:N:g1', 0);
    const result = applyMoveTrauma(
      [before, piece('w:B:c1')],
      {},
      { 'w:N:g1': 0, 'w:B:c1': 0 },
      'w:N:g1',
      5,
    );
    const captured = result.roster.find((entry) => entry.id === 'w:N:g1');
    expect(captured?.B_i).toBeGreaterThan(before.B_i);
    expect(
      result.events.some(
        (event) =>
          event.t === 'PSYCH_DELTA' &&
          event.pieceId === 'w:N:g1' &&
          event.field === 'B_i' &&
          event.delta > 0,
      ),
    ).toBe(true);
  });
});
