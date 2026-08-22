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

function makePiece(
  id: string,
  status: StoredPieceState['status'] = 'ACTIVE',
): StoredPieceState {
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
    status,
  };
}

function makeMatch(
  rosterSnapshot: readonly StoredPieceState[],
  events: readonly MatchEvent[],
  matchIndex = 1,
): MatchRecord {
  return {
    id: `match-${matchIndex}`,
    campaignId: 'campaign-1',
    actId: 'act-1',
    matchIndex,
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
      promotionCount: 0,
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
        t: 'MOVE',
        ply: 2,
        san: 'd4',
        pieceId: hero.id,
        verdict: 'HEROIC_EXECUTION',
      },
      {
        t: 'MOVE',
        ply: 3,
        san: 'Nf3',
        pieceId: hero.id,
        verdict: 'FATALISTIC_COMPLIANCE',
      },
      {
        t: 'MOVE',
        ply: 4,
        san: 'Nc3',
        pieceId: hero.id,
        verdict: 'QUIET_QUITTING',
      },
      {
        t: 'MOVE',
        ply: 5,
        san: 'a3',
        pieceId: hero.id,
        verdict: 'MORAL_REFUSAL',
      },
      {
        t: 'MOVE',
        ply: 6,
        san: 'h3',
        pieceId: hero.id,
        verdict: 'DESERTION_MUTINY',
      },
      {
        t: 'REFUSAL',
        ply: 7,
        pieceId: hero.id,
        utility: -1,
        threshold: 0,
        perceivedValue: 0,
      },
      {
        t: 'OVERRIDE',
        ply: 8,
        pieceId: hero.id,
        san: 'e4',
        pieceTrustDelta: -10,
      },
      { t: 'CAPTURE', ply: 9, victim: comrade.id, by: hero.id },
      {
        t: 'SACRIFICE_WITNESSED',
        ply: 10,
        hero: hero.id,
        beneficiary: comrade.id,
      },
      { t: 'ROSTER_BENCH', pieceId: hero.id },
      { t: 'ROSTER_FIRE', pieceId: hero.id },
      { t: 'ROSTER_RECRUIT', pieceId: hero.id },
      {
        t: 'SQUAD_FIELDING',
        match: 1,
        side: 'w',
        pieceId: hero.id,
        decision: 'passed_over',
        originRole: 'Pawn',
        provenance: 'original',
      },
      {
        t: 'HEROISM_NOMINATION',
        ply: 11,
        pieceId: hero.id,
        san: 'e5',
      },
      {
        t: 'PROMOTION',
        ply: 11,
        pieceId: hero.id,
        fromRole: 'Pawn',
        toRole: 'Queen',
      },
      {
        t: 'DESERTION',
        ply: 13,
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
      ordersCarriedOut: 2,
      ordersFatalistic: 1,
      ordersQuietlyQuit: 1,
      ordersRefused: 1,
      ordersOverridden: 1,
      capturesMade: 1,
      timesTaken: 0,
      timesCoveredComrade: 1,
      heroismNominations: 1,
      timesBenched: 1,
      timesFired: 1,
      timesRecruited: 1,
      promotions: 1,
      deserted: true,
      timesPassedOver: 1,
    });
    expect(folded.foldVersion).toBe(SERVICE_RECORD_FOLD_VERSION);
  });

  it('is sensitive to distinct event logs and pure across repeated folds', () => {
    const piece = makePiece('piece');
    const target = makePiece('target');
    const logs = [
      makeMatch(
        [piece, target],
        [
          {
            t: 'MOVE',
            ply: 1,
            san: 'e4',
            pieceId: piece.id,
            verdict: 'COMPLIANT_EXECUTION',
          },
        ],
        1,
      ),
      makeMatch(
        [piece, target],
        [
          {
            t: 'MOVE',
            ply: 1,
            san: 'e4',
            pieceId: piece.id,
            verdict: 'COMPLIANT_EXECUTION',
          },
          {
            t: 'REFUSAL',
            ply: 2,
            pieceId: piece.id,
            utility: -1,
            threshold: 0,
            perceivedValue: 0,
          },
        ],
        2,
      ),
      makeMatch(
        [piece, target],
        [
          {
            t: 'MOVE',
            ply: 1,
            san: 'e4',
            pieceId: piece.id,
            verdict: 'HEROIC_EXECUTION',
          },
          {
            t: 'REFUSAL',
            ply: 2,
            pieceId: piece.id,
            utility: -1,
            threshold: 0,
            perceivedValue: 0,
          },
          {
            t: 'OVERRIDE',
            ply: 2,
            pieceId: piece.id,
            san: 'e4',
            pieceTrustDelta: -10,
          },
          { t: 'CAPTURE', ply: 3, victim: target.id, by: piece.id },
        ],
        3,
      ),
    ];
    const folds = logs.map((_, index) =>
      foldPieceServiceRecords(logs.slice(0, index + 1)).records.get(piece.id),
    );
    const carried = folds.map((record) => record?.ordersCarriedOut ?? 0);
    const matches = folds.map((record) => record?.matchesServed ?? 0);
    const refusals = folds.map((record) => record?.ordersRefused ?? 0);
    const captures = folds.map((record) => record?.capturesMade ?? 0);
    const serviceTotals = folds.map(
      (record) =>
        (record?.matchesServed ?? 0) +
        (record?.ordersCarriedOut ?? 0) +
        (record?.ordersRefused ?? 0) +
        (record?.ordersOverridden ?? 0) +
        (record?.capturesMade ?? 0),
    );

    expect(matches).toEqual([1, 2, 3]);
    expect(carried).toEqual([1, 2, 3]);
    expect(refusals).toEqual([0, 1, 2]);
    expect(captures).toEqual([0, 0, 1]);
    expect(serviceTotals).toEqual([2, 5, 10]);
    const firstFold = foldPieceServiceRecords(logs);
    const repeatedFold = foldPieceServiceRecords(logs);
    expect([...firstFold.records.entries()]).toEqual([
      ...repeatedFold.records.entries(),
    ]);
  });

  it('keeps counts bounded and ignores pieces absent from snapshots', () => {
    const piece = makePiece('piece');
    const benched = makePiece('benched', 'BENCHED');
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
      makeMatch([piece, benched], events),
    ]).records;
    const record = records.get(piece.id);
    const benchedRecord = records.get(benched.id);

    expect(records.has(unknown)).toBe(false);
    expect(record?.matchesServed).toBe(1);
    expect(benchedRecord?.matchesServed).toBe(0);
    expect(record?.ordersCarriedOut).toBeLessThanOrEqual(
      events.filter(
        (event) =>
          event.t === 'MOVE' &&
          (event.verdict === 'HEROIC_EXECUTION' ||
            event.verdict === 'COMPLIANT_EXECUTION'),
      ).length,
    );
    expect(record?.ordersFatalistic).toBeLessThanOrEqual(
      events.filter(
        (event) =>
          event.t === 'MOVE' && event.verdict === 'FATALISTIC_COMPLIANCE',
      ).length,
    );
    expect(record?.ordersQuietlyQuit).toBeLessThanOrEqual(
      events.filter(
        (event) => event.t === 'MOVE' && event.verdict === 'QUIET_QUITTING',
      ).length,
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
