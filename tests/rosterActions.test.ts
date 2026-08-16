import { describe, expect, it } from 'vitest';

import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
} from '../src/psychology';
import {
  activeLineup,
  applyBench,
  applyFire,
  mergeRosterAfterMatch,
  previewBench,
  previewFire,
} from '../src/orchestration/rosterActions';
import { ENGINE_CONFIG } from '../src/psychology';
import type { StoredPieceState } from '../src/persistence';

const neutralTraits = {
  w_honor: 0.5,
  w_courage: 0.5,
  w_ambition: 0.5,
  w_loyalty: 0.5,
  w_empathy: 0.5,
  w_prestige: 0.5,
} as const;

function makePiece(
  id: string,
  trust: number,
  status: StoredPieceState['status'] = 'ACTIVE',
): StoredPieceState {
  return {
    ...normalizePieceState({
      id,
      role: 'Knight',
      traits: neutralTraits,
      E_i: 50,
      T_i: trust,
      M_i: 80,
      B_i: 0,
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
    }),
    status,
  };
}

describe('roster actions', () => {
  const roster = [
    makePiece('w:N:g1', 50),
    makePiece('w:B:c1', 55),
    makePiece('w:R:a1', 60, 'BENCHED'),
  ];

  it('previews bench penalties before applying them', () => {
    const target = roster[0];
    if (target === undefined) throw new Error('missing piece');
    const preview = previewBench(target, roster);
    expect(preview.pieceId).toBe('w:N:g1');
    expect(preview.selfTrustDelta).toBeLessThan(0);

    const applied = applyBench(target, roster);
    expect(applied.event.t).toBe('ROSTER_BENCH');
    expect(applied.roster.find((piece) => piece.id === 'w:N:g1')?.status).toBe(
      'BENCHED',
    );
  });

  it('previews and applies firing', () => {
    const target = roster[1];
    if (target === undefined) throw new Error('missing piece');
    expect(previewFire(target).newTrust).toBe(-100);
    const applied = applyFire(target, roster);
    expect(applied.event.t).toBe('ROSTER_FIRE');
    expect(applied.roster.find((piece) => piece.id === 'w:B:c1')?.T_i).toBe(
      -100,
    );
  });

  it('returns only active pieces for match lineup', () => {
    expect(activeLineup(roster)).toHaveLength(2);
  });

  it('merges match psychology back into stored roster statuses', () => {
    const lineup = [
      makePiece('w:N:g1', 40),
      makePiece('w:B:c1', 45, 'BENCHED'),
    ];
    const matchRoster = [
      normalizePieceState({
        id: 'w:N:g1',
        role: 'Knight',
        traits: neutralTraits,
        E_i: 50,
        T_i: 35,
        M_i: 80,
        B_i: 0,
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
      }),
    ];
    const merged = mergeRosterAfterMatch(lineup, matchRoster, []);
    expect(merged.find((piece) => piece.id === 'w:N:g1')?.T_i).toBe(35);
    expect(merged.find((piece) => piece.id === 'w:B:c1')?.status).toBe(
      'BENCHED',
    );
  });

  it('normalizes a promoted role to its chair by default while retaining state', () => {
    const original = ENGINE_CONFIG.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES;
    const config = ENGINE_CONFIG as {
      PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES: boolean;
    };
    try {
      config.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES = false;
      const base = makePiece('w:P:a2', 40);
      const lineup = [base];
      const promoted = { ...base, role: 'Queen' as const };
      const merged = mergeRosterAfterMatch(
        lineup,
        [promoted],
        [
          {
            t: 'PROMOTION',
            ply: 1,
            pieceId: promoted.id,
            fromRole: 'Pawn',
            toRole: 'Queen',
          },
        ],
      );
      expect(merged[0]?.role).toBe('Pawn');
      expect(merged[0]?.T_i).toBe(40);
    } finally {
      config.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES = original;
    }
  });

  it('carries a promoted role when campaign persistence is enabled', () => {
    const original = ENGINE_CONFIG.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES;
    const config = ENGINE_CONFIG as {
      PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES: boolean;
    };
    try {
      config.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES = true;
      const base = makePiece('w:P:a2', 40);
      const lineup = [base];
      const promoted = { ...base, role: 'Queen' as const };
      const merged = mergeRosterAfterMatch(
        lineup,
        [promoted],
        [
          {
            t: 'PROMOTION',
            ply: 1,
            pieceId: promoted.id,
            fromRole: 'Pawn',
            toRole: 'Queen',
          },
        ],
      );
      expect(merged[0]?.role).toBe('Queen');
    } finally {
      config.PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES = original;
    }
  });
});
