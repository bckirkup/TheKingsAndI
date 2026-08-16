import { describe, expect, it } from 'vitest';

import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type MatchEvent,
} from '../src/psychology';
import {
  AUDIT_FOLD_VERSION,
  foldPieceServiceRecords,
  SERVICE_RECORD_FOLD_VERSION,
  type MatchRecord,
  type StoredPieceState,
} from '../src/persistence';

function makePiece(id: string): StoredPieceState {
  return {
    ...normalizePieceState({
      id,
      role: 'Pawn',
      traits: {
        w_honor: 0.5,
        w_courage: 0.5,
        w_ambition: 0.5,
        w_loyalty: 0.5,
        w_empathy: 0.5,
        w_prestige: 0.5,
      },
      E_i: 20,
      T_i: 20,
      M_i: 70,
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
    status: 'ACTIVE',
  };
}

function makeMatch(
  rosterSnapshot: readonly StoredPieceState[],
  events: readonly MatchEvent[],
): MatchRecord {
  return {
    id: `match-${rosterSnapshot.length}-${events.length}`,
    campaignId: 'campaign-1',
    actId: 'act-1',
    matchIndex: 1,
    seed: 1,
    rosterSnapshot,
    rosterEnd: rosterSnapshot,
    events,
    result: 'DRAW',
    audit: {
      boardQuality: 0,
      executionFidelity: 1,
      realizedQuality: 0,
      refusalCount: 0,
      overrideCount: 0,
      desertionCount: 0,
      quietQuitCount: 0,
      meanTrustDelta: 0,
      foldVersion: AUDIT_FOLD_VERSION,
    },
    determinismId: 'heuristic-eval-v1',
    psychConfigVersion: 'engine-config-v1',
    schemaVersion: 1,
  };
}

describe('foldPieceServiceRecords', () => {
  it('folds observable deeds and stamps its version', () => {
    const hero = makePiece('hero');
    const comrade = makePiece('comrade');
    const events: MatchEvent[] = [
      {
        t: 'MOVE',
        ply: 1,
        san: 'e4',
        pieceId: hero.id,
        verdict: 'COMPLIANT_EXECUTION',
      },
      {
        t: 'REFUSAL',
        ply: 2,
        pieceId: hero.id,
        utility: -1,
        threshold: 0,
        perceivedValue: 0,
      },
      {
        t: 'OVERRIDE',
        ply: 2,
        pieceId: hero.id,
        san: 'e4',
        pieceTrustDelta: -10,
      },
      { t: 'CAPTURE', ply: 3, victim: comrade.id, by: hero.id },
      {
        t: 'SACRIFICE_WITNESSED',
        ply: 4,
        hero: hero.id,
        beneficiary: comrade.id,
      },
      { t: 'ROSTER_BENCH', pieceId: hero.id },
      { t: 'ROSTER_FIRE', pieceId: hero.id },
      { t: 'ROSTER_RECRUIT', pieceId: hero.id },
      {
        t: 'HEROISM_NOMINATION',
        ply: 5,
        pieceId: hero.id,
        san: 'e5',
      },
      {
        t: 'DESERTION',
        ply: 6,
        pieceId: hero.id,
        refusedMove: 'e5',
        uStay: -1,
        uDesert: 1,
        departureKind: 'first',
      },
    ];

    const folded = foldPieceServiceRecords([
      makeMatch([hero, comrade], events),
    ]);
    const record = folded.records.get(hero.id);

    expect(record).toEqual({
      matchesServed: 1,
      ordersCarriedOut: 1,
      ordersRefused: 1,
      ordersOverridden: 1,
      capturesMade: 1,
      timesTaken: 0,
      timesCoveredComrade: 1,
      heroismNominations: 1,
      timesBenched: 1,
      timesFired: 1,
      timesRecruited: 1,
      deserted: true,
    });
    expect(folded.foldVersion).toBe(SERVICE_RECORD_FOLD_VERSION);
  });

  it('is sensitive to distinct event logs and pure across repeated folds', () => {
    const piece = makePiece('piece');
    const carried = makeMatch(
      [piece],
      [
        {
          t: 'MOVE',
          ply: 1,
          san: 'e4',
          pieceId: piece.id,
          verdict: 'COMPLIANT_EXECUTION',
        },
      ],
    );
    const refused = makeMatch(
      [piece],
      [
        {
          t: 'REFUSAL',
          ply: 1,
          pieceId: piece.id,
          utility: -1,
          threshold: 0,
          perceivedValue: 0,
        },
      ],
    );
    const carriedFold = foldPieceServiceRecords([carried]);
    const repeatedFold = foldPieceServiceRecords([carried]);

    expect([...carriedFold.records.entries()]).not.toEqual([
      ...foldPieceServiceRecords([refused]).records.entries(),
    ]);
    expect([...carriedFold.records.entries()]).toEqual([
      ...repeatedFold.records.entries(),
    ]);
  });

  it('keeps counts bounded and ignores pieces absent from snapshots', () => {
    const piece = makePiece('piece');
    const unknown = 'unknown';
    const events: MatchEvent[] = [
      {
        t: 'MOVE',
        ply: 1,
        san: 'e4',
        pieceId: unknown,
        verdict: 'COMPLIANT_EXECUTION',
      },
      { t: 'CAPTURE', ply: 2, victim: unknown, by: piece.id },
    ];
    const records = foldPieceServiceRecords([
      makeMatch([piece], events),
    ]).records;
    const record = records.get(piece.id);

    expect(records.has(unknown)).toBe(false);
    expect(record?.matchesServed).toBe(1);
    expect(record?.ordersCarriedOut).toBeLessThanOrEqual(
      events.filter((event) => event.t === 'MOVE').length,
    );
    expect(record?.capturesMade).toBeLessThanOrEqual(
      events.filter((event) => event.t === 'CAPTURE').length,
    );
    expect(record?.timesTaken).toBe(0);
    expect(record).toBeDefined();
    for (const value of Object.values(record ?? {})) {
      if (typeof value === 'number') expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});
