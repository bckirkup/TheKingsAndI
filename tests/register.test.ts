import { describe, expect, it } from 'vitest';

import { bootstrapRoster } from '../src/app/careerBootstrap';
import { LivingBoard, parsePieceId } from '../src/chess';
import { createCommanderPool } from '../sim/pool';
import {
  AUDIT_FOLD_VERSION,
  PUBLIC_REGISTER_COLUMNS,
  foldPublicRegister,
  publicMatchFactsFromRecord,
  type MatchRecord,
  type PublicMatchEvent,
} from '../src/persistence';
import type { MatchEvent } from '../src/psychology';

function pieceId(
  board: LivingBoard,
  side: 'w' | 'b',
  role: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P',
): string {
  const piece = board
    .piecesOf(side)
    .find((candidate) => candidate.role === role);
  if (piece === undefined) {
    throw new Error(`Missing ${side} ${role} in board fixture.`);
  }
  return piece.id;
}

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
    const board = LivingBoard.standard();
    const whiteRook = pieceId(board, 'w', 'R');
    const blackQueen = pieceId(board, 'b', 'Q');
    const whitePawn = pieceId(board, 'w', 'P');
    const blackKnight = pieceId(board, 'b', 'N');
    const blackBishop = pieceId(board, 'b', 'B');
    const captures: PublicMatchEvent[] = [
      { t: 'CAPTURE', victim: blackQueen, by: whiteRook },
      { t: 'CAPTURE', victim: whitePawn, by: blackKnight },
      {
        t: 'PROMOTION',
        pieceId: whitePawn,
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
          { t: 'CAPTURE', victim: pieceId(board, 'b', 'K'), by: whiteRook },
          { t: 'CAPTURE', victim: blackBishop, by: whitePawn },
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
    expect(register.unattributedCaptures).toBe(0);
    expect(register.promotionsReached).toBe(1);
    expect(register.currentWinStreak).toBe(0);
    expect(register.longestWinStreak).toBe(1);
    expect(Object.keys(register).sort()).toEqual(
      ['foldVersion', ...PUBLIC_REGISTER_COLUMNS].sort(),
    );
  });

  it('parses every real identity encoding and exposes unattributed captures', () => {
    const board = LivingBoard.standard();
    const appRoster = bootstrapRoster(17).roster;
    const harnessPool = createCommanderPool({
      id: 'commander',
      side: 'w',
      style: 'supportive',
      careerSeed: 17,
    });
    const boardId = pieceId(board, 'w', 'P');
    const opposingBoardId = pieceId(board, 'b', 'P');
    const appId = appRoster[0]?.id;
    const harnessId = harnessPool.members[0]?.state.id;
    if (appId === undefined || harnessId === undefined) {
      throw new Error('Expected real roster identities in parser fixture.');
    }
    expect(parsePieceId(boardId)).toEqual({ side: 'w', role: 'P' });
    expect(parsePieceId(appId)).toEqual({ side: 'w', role: 'P' });
    expect(parsePieceId(harnessId)).toEqual({ side: 'w', role: 'P' });

    const register = foldPublicRegister([
      {
        side: 'w',
        result: 'WIN',
        events: [
          { t: 'CAPTURE', victim: opposingBoardId, by: appId },
          { t: 'CAPTURE', victim: 'not-a-piece-id', by: boardId },
        ],
      },
    ]);
    expect(register.materialTaken).toBe(1);
    expect(register.unattributedCaptures).toBe(1);
    expect(register.largestMaterialMargin).toBe(1);
  });

  it('keeps the record result and strips psychology and engine truth', () => {
    const board = LivingBoard.standard();
    const facts = publicMatchFactsFromRecord(
      makeMatch('ROUT', [
        {
          t: 'CAPTURE',
          ply: 1,
          victim: pieceId(board, 'b', 'P'),
          by: pieceId(board, 'w', 'N'),
        },
        {
          t: 'PROMOTION',
          ply: 2,
          pieceId: pieceId(board, 'w', 'P'),
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
      result: 'ROUT',
      events: [
        {
          t: 'CAPTURE',
          victim: pieceId(board, 'b', 'P'),
          by: pieceId(board, 'w', 'N'),
        },
      ],
    });
    expect(Object.keys(facts).sort()).toEqual(['events', 'result', 'side']);
    expect(foldPublicRegister([facts]).materialTaken).toBe(0);
  });

  it('resets streaks on draws and routs while retaining the longest streak', () => {
    const board = LivingBoard.standard();
    const facts = (result: MatchRecord['result']) => ({
      side: 'w' as const,
      result,
      events: [] as PublicMatchEvent[],
    });
    const afterDraw = foldPublicRegister([
      facts('WIN'),
      facts('WIN'),
      facts('DRAW'),
    ]);
    expect(afterDraw.currentWinStreak).toBe(0);
    expect(afterDraw.longestWinStreak).toBe(2);

    const afterRout = foldPublicRegister([
      facts('WIN'),
      facts('ROUT'),
      {
        ...facts('WIN'),
        events: [
          {
            t: 'CAPTURE' as const,
            victim: pieceId(board, 'b', 'P'),
            by: pieceId(board, 'w', 'P'),
          },
        ],
      },
    ]);
    expect(afterRout.currentWinStreak).toBe(1);
    expect(afterRout.longestWinStreak).toBe(1);
  });

  it('retains a negative largest margin instead of defaulting to zero', () => {
    const board = LivingBoard.standard();
    const facts = {
      side: 'w' as const,
      result: 'LOSS' as const,
      events: [
        {
          t: 'CAPTURE' as const,
          victim: pieceId(board, 'w', 'P'),
          by: pieceId(board, 'b', 'N'),
        },
      ],
    };
    const register = foldPublicRegister([facts, facts]);
    expect(register.materialTaken).toBe(0);
    expect(register.materialLost).toBe(2);
    expect(register.largestMaterialMargin).toBe(-1);
  });

  it("counts promotions only for the commander's side", () => {
    const board = LivingBoard.standard();
    const register = foldPublicRegister([
      {
        side: 'w',
        result: 'WIN',
        events: [
          {
            t: 'PROMOTION',
            pieceId: pieceId(board, 'w', 'P'),
            fromRole: 'Pawn',
            toRole: 'Queen',
          },
          {
            t: 'PROMOTION',
            pieceId: pieceId(board, 'b', 'P'),
            fromRole: 'Pawn',
            toRole: 'Queen',
          },
        ],
      },
    ]);
    expect(register.promotionsReached).toBe(1);
  });
});
