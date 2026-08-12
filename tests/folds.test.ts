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
  foldCampaignCultureDrift,
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
): MatchRecord {
  return {
    id: 'match-1',
    campaignId: 'campaign-1',
    actId: 'act-1',
    matchIndex: 1,
    seed: 1,
    rosterSnapshot: [],
    rosterEnd: [],
    events,
    result: 'DRAW',
    audit: {
      boardQuality: 70,
      executionFidelity: 0.8,
      realizedQuality: 80,
      refusalCount: 0,
      overrideCount: 0,
      desertionCount: 0,
      quietQuitCount: 0,
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
