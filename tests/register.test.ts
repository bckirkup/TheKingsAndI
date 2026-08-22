import { describe, expect, it } from 'vitest';

import {
  AUDIT_FOLD_VERSION,
  foldPublicRegister,
  publicMatchFactsFromRecord,
  type MatchRecord,
  type PublicMatchEvent,
} from '../src/persistence';
import type { MatchEvent } from '../src/psychology';

function makeMatch(
  result: MatchRecord['result'],
  events: readonly MatchEvent[],
): MatchRecord {
  return {
    id: 'm1',
    campaignId: 'c1',
    actId: 'a1',
    matchIndex: 1,
    seed: 1,
    rosterSnapshot: [],
    rosterEnd: [],
    events,
    result,
    audit: {
      boardQuality: 1,
      executionFidelity: 2,
      realizedQuality: 3,
      refusalCount: 0,
      overrideCount: 0,
      desertionCount: 0,
      quietQuitCount: 0,
      promotionCount: 0,
      meanTrustDelta: 0,
      foldVersion: AUDIT_FOLD_VERSION,
    },
    engineAudit: [
      {
        ply: 1,
        pieceId: 'w:Pawn:e2',
        san: 'e4',
        preMoveScoreCp: 0,
        scoreCp: 10,
        bestScoreCp: 20,
        preMoveDepth: 1,
        scoreDepth: 1,
        bestScoreDepth: 1,
      },
    ],
    determinismId: 'test',
    psychConfigVersion: 'test',
    schemaVersion: 1,
  };
}

describe('public register fold', () => {
  it('folds public results, captures, promotions, margins, and streaks', () => {
    const captures: PublicMatchEvent[] = [
      { t: 'CAPTURE', victim: 'b:Queen:d8', by: 'w:Rook:d1' },
      { t: 'CAPTURE', victim: 'w:Pawn:e4', by: 'b:Knight:f6' },
      {
        t: 'PROMOTION',
        pieceId: 'w:Pawn:a7',
        fromRole: 'Pawn',
        toRole: 'Queen',
      },
    ];
    const register = foldPublicRegister([
      {
        side: 'w',
        result: 'WIN',
        events: captures,
      },
      {
        side: 'w',
        result: 'LOSS',
        events: [],
      },
      {
        side: 'w',
        result: 'WIN',
        events: [
          { t: 'CAPTURE', victim: 'b:King:e8', by: 'w:Queen:e7' },
          { t: 'CAPTURE', victim: 'b:Bishop:c8', by: 'w:Pawn:b7' },
        ],
      },
      {
        side: 'w',
        result: 'ROUT',
        events: [],
      },
    ]);
    expect(register.matchesPlayed).toBe(4);
    expect(register.wins).toBe(2);
    expect(register.losses).toBe(1);
    expect(register.draws).toBe(0);
    expect(register.routs).toBe(1);
    expect(register.materialTaken).toBe(12);
    expect(register.materialLost).toBe(1);
    expect(register.largestMaterialMargin).toBe(8);
    expect(register.ownPiecesLost).toBe(1);
    expect(register.promotionsReached).toBe(1);
    expect(register.currentWinStreak).toBe(0);
    expect(register.longestWinStreak).toBe(1);
  });

  it('adapts result perspective and strips psychology and engine truth', () => {
    const facts = publicMatchFactsFromRecord(
      makeMatch('ROUT', [
        {
          t: 'CAPTURE',
          ply: 1,
          victim: 'b:Pawn:e7',
          by: 'w:Knight:f3',
        },
        {
          t: 'PROMOTION',
          ply: 2,
          pieceId: 'w:Pawn:a7',
          fromRole: 'Pawn',
          toRole: 'Queen',
        },
        {
          t: 'ABILITY_OBSERVATION',
          ply: 3,
          pieceId: 'w:Knight:f3',
          vindicated: true,
        },
      ]),
      'b',
    );
    expect(facts).toEqual({
      side: 'b',
      result: 'WIN',
      events: [
        {
          t: 'CAPTURE',
          victim: 'b:Pawn:e7',
          by: 'w:Knight:f3',
        },
      ],
    });
    expect(Object.keys(facts)).not.toContain('audit');
    expect(Object.keys(facts)).not.toContain('engineAudit');
    expect(foldPublicRegister([facts]).materialTaken).toBe(0);
  });
});
