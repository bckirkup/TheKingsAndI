import { describe, expect, it } from 'vitest';

import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type MatchEvent,
} from '../src/psychology';
import {
  AUDIT_FOLD_VERSION,
  CULTURE_DRIFT_FOLD_VERSION,
  JUDGEMENT_SEAT_FOLD_VERSION,
  foldCampaignCultureDrift,
  foldJudgementSeat,
  foldMatchAudit,
  buildCampaignDebrief,
  type MatchRecord,
  type StoredPieceState,
} from '../src/persistence';

const neutralTraits = {
  w_honor: 0.5,
  w_courage: 0.5,
  w_ambition: 0.5,
  w_loyalty: 0.5,
  w_empathy: 0.5,
  w_prestige: 0.5,
} as const;

function makeStoredPiece(
  id: string,
  trust: number,
  status: StoredPieceState['status'] = 'ACTIVE',
): StoredPieceState {
  return {
    ...normalizePieceState({
      id,
      role: 'Pawn',
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

function makeMatchRecord(
  events: MatchEvent[],
  auditOverrides: Partial<MatchRecord['audit']> = {},
  options: {
    readonly result?: MatchRecord['result'];
    readonly winScore?: number;
    readonly rosterSnapshot?: MatchRecord['rosterSnapshot'];
    readonly rosterEnd?: MatchRecord['rosterEnd'];
  } = {},
): MatchRecord {
  return {
    id: 'match-1',
    campaignId: 'campaign-1',
    actId: 'act-1',
    matchIndex: 1,
    seed: 1,
    rosterSnapshot: options.rosterSnapshot ?? [],
    rosterEnd: options.rosterEnd ?? [],
    events,
    ...(options.winScore === undefined ? {} : { winScore: options.winScore }),
    result: options.result ?? 'DRAW',
    audit: {
      boardQuality: 70,
      executionFidelity: 0.8,
      realizedQuality: 80,
      refusalCount: 0,
      overrideCount: 0,
      desertionCount: 0,
      quietQuitCount: 0,
      promotionCount: 0,
      meanTrustDelta: 0,
      foldVersion: AUDIT_FOLD_VERSION,
      ...auditOverrides,
    },
    determinismId: 'heuristic-eval-v1',
    psychConfigVersion: 'engine-config-v1',
    schemaVersion: 1,
  };
}

describe('foldMatchAudit', () => {
  const events: MatchEvent[] = [
    {
      t: 'MOVE',
      ply: 1,
      san: 'e4',
      pieceId: 'w:P:e2',
      verdict: 'COMPLIANT_EXECUTION',
      orderQualityCp: 80,
    },
    {
      t: 'REFUSAL',
      ply: 2,
      pieceId: 'w:N:g1',
      utility: -10,
      threshold: 0,
      perceivedValue: 1,
    },
  ];

  it('matches golden audit columns for a mixed log', () => {
    const audit = foldMatchAudit(events, 50, 48);
    expect(audit.foldVersion).toBe(AUDIT_FOLD_VERSION);
    expect(audit.refusalCount).toBe(1);
    expect(audit.executionFidelity).toBeCloseTo(0.5, 5);
    expect(audit.boardQuality).toBeCloseTo(90, 5);
    expect(audit.realizedQuality).toBeCloseTo(80, 5);
    expect(audit.meanTrustDelta).toBe(-2);
  });

  it('penalizes overrides in execution fidelity', () => {
    const withOverride: MatchEvent[] = [
      ...events,
      {
        t: 'OVERRIDE',
        ply: 3,
        pieceId: 'w:B:c1',
        san: 'Bc4',
        pieceTrustDelta: -35,
      },
      {
        t: 'MOVE',
        ply: 3,
        san: 'Bc4',
        pieceId: 'w:B:c1',
        verdict: 'COMPLIANT_EXECUTION',
        orderQualityCp: 70,
      },
    ];
    const audit = foldMatchAudit(withOverride, 50, 50);
    expect(audit.overrideCount).toBe(1);
    expect(audit.executionFidelity).toBeCloseTo(1 / 3, 5);
  });

  it('changes execution fidelity when refusal count changes', () => {
    const baseline = foldMatchAudit(events, 50, 50);
    const compliantOnly = foldMatchAudit(
      events.filter((event) => event.t === 'MOVE'),
      50,
      50,
    );
    expect(compliantOnly.executionFidelity).not.toBe(
      baseline.executionFidelity,
    );
  });

  it('counts promotion events without maintaining a second source of truth', () => {
    const promotions: MatchEvent[] = [
      {
        t: 'PROMOTION',
        ply: 1,
        pieceId: 'w:P:a7',
        fromRole: 'Pawn',
        toRole: 'Queen',
      },
      {
        t: 'PROMOTION',
        ply: 2,
        pieceId: 'w:P:b7',
        fromRole: 'Pawn',
        toRole: 'Rook',
      },
    ];
    expect(
      foldMatchAudit(promotions, 50, 50, new Set(['w:P:a7', 'w:P:b7']))
        .promotionCount,
    ).toBe(2);
    expect(foldMatchAudit([], 50, 50).promotionCount).toBe(0);
  });

  it("excludes the opponent's promotions from the commander's audit", () => {
    const promotions: MatchEvent[] = [
      {
        t: 'PROMOTION',
        ply: 1,
        pieceId: 'w:P:a7',
        fromRole: 'Pawn',
        toRole: 'Queen',
      },
      {
        t: 'PROMOTION',
        ply: 2,
        pieceId: 'b:P:a2',
        fromRole: 'Pawn',
        toRole: 'Queen',
      },
    ];
    expect(
      foldMatchAudit(promotions, 50, 50, new Set(['w:P:a7'])).promotionCount,
    ).toBe(1);
    expect(
      foldMatchAudit(promotions, 50, 50, new Set(['b:P:a2'])).promotionCount,
    ).toBe(1);
    expect(
      foldMatchAudit(promotions, 50, 50, new Set(['w:N:b1'])).promotionCount,
    ).toBe(0);
  });
});

describe('foldCampaignCultureDrift', () => {
  it('computes drift from roster and match folds', () => {
    const initial = [
      makeStoredPiece('w:P:a2', 50),
      makeStoredPiece('w:N:b1', 60),
    ];
    const final = [
      makeStoredPiece('w:P:a2', 45),
      makeStoredPiece('w:N:b1', 55, 'BENCHED'),
    ];
    const matches = [
      makeMatchRecord([], { quietQuitCount: 2 }),
      makeMatchRecord([], { quietQuitCount: 1 }),
    ];
    const drift = foldCampaignCultureDrift(matches, initial, final);
    expect(drift.deltaAverageTrustLongitudinal).toBeLessThan(0);
    expect(drift.burnoutIndex).toBeGreaterThan(0);
  });
});

describe('buildCampaignDebrief', () => {
  it('separates board quality and execution fidelity means', () => {
    const matches = [
      makeMatchRecord([], {
        boardQuality: 80,
        executionFidelity: 1,
      }),
      makeMatchRecord([], {
        boardQuality: 60,
        executionFidelity: 0.5,
      }),
    ];
    const debrief = buildCampaignDebrief(
      'campaign-1',
      matches,
      [makeStoredPiece('w:P:a2', 50)],
      [makeStoredPiece('w:P:a2', 48)],
      'ongoing',
    );
    expect(debrief.meanBoardQuality).toBe(70);
    expect(debrief.meanExecutionFidelity).toBeCloseTo(0.75, 5);
    expect(debrief.foldVersion).toBe(CULTURE_DRIFT_FOLD_VERSION);
  });
});

describe('foldJudgementSeat', () => {
  it('folds debrief-only courage incidents from fielded pieces', () => {
    const fielded = makeStoredPiece('w:P:a2', 40);
    const opponent = makeStoredPiece('b:P:a7', 40);
    const events: MatchEvent[] = [
      {
        t: 'MOVE',
        ply: 1,
        san: 'e4',
        pieceId: fielded.id,
        verdict: 'COMPLIANT_EXECUTION',
        courage: { margin: 0.4, asked: 0.5 },
      },
      {
        t: 'MOVE',
        ply: 2,
        san: 'e5',
        pieceId: opponent.id,
        verdict: 'HEROIC_EXECUTION',
        courage: { margin: 1, asked: 1 },
      },
    ];
    const record = makeMatchRecord(
      events,
      {},
      {
        result: 'WIN',
        rosterSnapshot: [fielded],
        rosterEnd: [fielded],
      },
    );
    const debrief = buildCampaignDebrief(
      'campaign-1',
      [record],
      [fielded],
      [fielded],
      'ongoing',
    );
    expect(debrief.courage.count).toBe(1);
    expect(debrief.courage.meanNormalized).toBe(0.8);
    expect(debrief.courage.incidents[0]).toMatchObject({
      matchId: record.id,
      matchIndex: record.matchIndex,
      pieceId: fielded.id,
      normalized: 0.8,
    });
  });

  it('maps legacy outcomes and excludes dismissed matches without a stored score', () => {
    const roster = [makeStoredPiece('w:P:a2', 40)];
    const folded = foldJudgementSeat([
      makeMatchRecord([], {}, { result: 'WIN', rosterEnd: roster }),
      makeMatchRecord([], {}, { result: 'DRAW', rosterEnd: roster }),
      makeMatchRecord([], {}, { result: 'DISMISSED', rosterEnd: roster }),
    ]);

    expect(folded.matches.map((match) => match.winScore)).toEqual([
      100,
      50,
      null,
    ]);
    expect(folded.matches[2]?.leadershipIndex).toBeNull();
    expect(folded.computedMatchCount).toBe(2);
    expect(folded.totalMatchCount).toBe(3);
    expect(folded.meanWinScore).toBe(75);
  });

  it('prefers stored chess scores, including the dismissed king result', () => {
    const roster = [makeStoredPiece('w:P:a2', 40)];
    const folded = foldJudgementSeat([
      makeMatchRecord(
        [],
        {},
        {
          result: 'DISMISSED',
          winScore: 100,
          rosterEnd: roster,
        },
      ),
    ]);

    expect(folded.matches[0]?.winScore).toBe(100);
    expect(folded.matches[0]?.leadershipIndex).not.toBeNull();
    expect(folded.computedMatchCount).toBe(1);
  });

  it('uses fielding decisions over roster status when folding trauma', () => {
    const fielded = makeStoredPiece('w:P:a2', 40);
    const passedOver = makeStoredPiece('w:N:b1', 40);
    const events: MatchEvent[] = [
      {
        t: 'SQUAD_FIELDING',
        match: 1,
        side: 'w',
        pieceId: fielded.id,
        decision: 'fielded',
        originRole: 'Pawn',
        provenance: 'original',
      },
      {
        t: 'SQUAD_FIELDING',
        match: 1,
        side: 'w',
        pieceId: passedOver.id,
        decision: 'passed_over',
        originRole: 'Knight',
        provenance: 'original',
      },
      {
        t: 'OVERRIDE',
        ply: 1,
        pieceId: fielded.id,
        san: 'e4',
        pieceTrustDelta: -10,
      },
      {
        t: 'PSYCH_DELTA',
        ply: 3,
        pieceId: fielded.id,
        field: 'B_i',
        delta: 10,
      },
      {
        t: 'OVERRIDE',
        ply: 1,
        pieceId: passedOver.id,
        san: 'Nf3',
        pieceTrustDelta: -10,
      },
      {
        t: 'PSYCH_DELTA',
        ply: 3,
        pieceId: passedOver.id,
        field: 'B_i',
        delta: 100,
      },
    ];
    const folded = foldJudgementSeat([
      makeMatchRecord(
        events,
        {},
        {
          result: 'WIN',
          rosterSnapshot: [fielded, passedOver],
          rosterEnd: [fielded],
        },
      ),
    ]);

    expect(folded.matches[0]?.unjustifiedTrauma).toBe(10);
  });

  it('restricts trust and emptied chairs to fielded careers', () => {
    const deserter = makeStoredPiece('w:P:a2', 20);
    const retired = makeStoredPiece('w:N:b1', 30);
    const benched = makeStoredPiece('w:P:a3', 100, 'BENCHED');
    const events: MatchEvent[] = [
      {
        t: 'SQUAD_FIELDING',
        match: 1,
        side: 'w',
        pieceId: deserter.id,
        decision: 'fielded',
        originRole: 'Pawn',
        provenance: 'original',
      },
      {
        t: 'SQUAD_FIELDING',
        match: 1,
        side: 'w',
        pieceId: retired.id,
        decision: 'fielded',
        originRole: 'Knight',
        provenance: 'original',
      },
      {
        t: 'SQUAD_FIELDING',
        match: 1,
        side: 'w',
        pieceId: benched.id,
        decision: 'passed_over',
        originRole: 'Pawn',
        provenance: 'original',
      },
      {
        t: 'DESERTION',
        ply: 2,
        pieceId: deserter.id,
        refusedMove: 'a2a3',
        uStay: 0,
        uDesert: 1,
        departureKind: 'first',
      },
    ];
    const folded = foldJudgementSeat([
      makeMatchRecord(
        events,
        {},
        {
          result: 'WIN',
          rosterSnapshot: [deserter, retired, benched],
          rosterEnd: [
            makeStoredPiece(deserter.id, 10, 'DESERTED'),
            makeStoredPiece(retired.id, 30, 'RETIRED'),
            benched,
          ],
        },
      ),
    ]);

    expect(folded.foldVersion).toBe(JUDGEMENT_SEAT_FOLD_VERSION);
    expect(folded.matches[0]?.finalTrust).toBe(20);
    expect(folded.matches[0]?.emptiedChairs).toBe(2);
    expect(folded.matches[0]?.emptiedChairsScore).toBe(100);
    expect(folded.meanEmptiedChairs).toBe(2);
    expect(folded.meanEmptiedChairsScore).toBe(100);
  });

  it("filters quiet quitting to the commander's fielded side", () => {
    const own = makeStoredPiece('w:P:a2', 40);
    const enemy = makeStoredPiece('b:P:a7', 40);
    const folded = foldJudgementSeat([
      makeMatchRecord(
        [
          {
            t: 'MOVE',
            ply: 1,
            san: 'a2a3',
            pieceId: own.id,
            verdict: 'QUIET_QUITTING',
          },
          {
            t: 'MOVE',
            ply: 2,
            san: 'a7a6',
            pieceId: enemy.id,
            verdict: 'QUIET_QUITTING',
          },
        ],
        {},
        {
          result: 'WIN',
          rosterSnapshot: [own],
          rosterEnd: [own],
        },
      ),
    ]);
    expect(folded.matches[0]?.quietQuitTurns).toBe(1);
  });

  it('falls back to ACTIVE roster pieces for legacy records', () => {
    const active = makeStoredPiece('w:P:a2', 40);
    const benched = makeStoredPiece('w:P:a3', 40, 'BENCHED');
    const folded = foldJudgementSeat([
      makeMatchRecord(
        [
          {
            t: 'OVERRIDE',
            ply: 1,
            pieceId: active.id,
            san: 'e4',
            pieceTrustDelta: -10,
          },
          {
            t: 'PSYCH_DELTA',
            ply: 3,
            pieceId: active.id,
            field: 'B_i',
            delta: 10,
          },
          {
            t: 'OVERRIDE',
            ply: 1,
            pieceId: benched.id,
            san: 'e5',
            pieceTrustDelta: -10,
          },
          {
            t: 'PSYCH_DELTA',
            ply: 3,
            pieceId: benched.id,
            field: 'B_i',
            delta: 100,
          },
        ],
        {},
        {
          result: 'WIN',
          rosterSnapshot: [active, benched],
          rosterEnd: [active],
        },
      ),
    ]);

    expect(folded.matches[0]?.unjustifiedTrauma).toBe(10);
  });

  it('pools only computable matches and is deterministic', () => {
    const roster = [makeStoredPiece('w:P:a2', 40)];
    const records = [
      makeMatchRecord(
        [],
        {},
        {
          result: 'WIN',
          winScore: 80,
          rosterSnapshot: roster,
          rosterEnd: roster,
        },
      ),
      makeMatchRecord(
        [],
        {},
        {
          result: 'ABANDONED',
          rosterSnapshot: roster,
          rosterEnd: roster,
        },
      ),
    ];
    const first = foldJudgementSeat(records);
    const second = foldJudgementSeat(records);

    expect(first).toEqual(second);
    expect(first.computedMatchCount).toBe(1);
    expect(first.meanLeadershipIndex).toBe(first.matches[0]?.leadershipIndex);
  });
});
