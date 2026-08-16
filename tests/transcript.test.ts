import { describe, expect, it } from 'vitest';

import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
} from '../src/psychology';
import {
  foldCampaignTranscript,
  giniCoefficient,
  exportPiecePassport,
  importPiecePassport,
  buildCertificateBundle,
  verifyCertificateDigest,
  type StoredPieceState,
} from '../src/persistence';

function makePiece(trust: number): StoredPieceState {
  return {
    ...normalizePieceState({
      id: 'w:N:g1',
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
      T_i: trust,
      M_i: 80,
      B_i: 10,
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

describe('transcript fold', () => {
  it('computes Gini over trauma values', () => {
    expect(giniCoefficient([0, 0, 0])).toBe(0);
    expect(giniCoefficient([10, 10, 10])).toBe(0);
    expect(giniCoefficient([0, 0, 100])).toBeGreaterThan(0.5);
  });

  it('folds override ledger and attrition from event logs', () => {
    const transcript = foldCampaignTranscript([
      {
        id: 'm1',
        campaignId: 'c1',
        actId: 'a1',
        matchIndex: 1,
        seed: 1,
        rosterSnapshot: [makePiece(50)],
        rosterEnd: [makePiece(40)],
        events: [
          {
            t: 'OVERRIDE',
            ply: 2,
            pieceId: 'w:N:g1',
            san: 'Nf3',
            pieceTrustDelta: -20,
          },
          { t: 'ROSTER_FIRE', pieceId: 'w:P:e2' },
        ],
        result: 'DRAW',
        audit: {
          boardQuality: 70,
          executionFidelity: 0.8,
          realizedQuality: 65,
          refusalCount: 0,
          overrideCount: 1,
          desertionCount: 0,
          quietQuitCount: 0,
          promotionCount: 0,
          meanTrustDelta: -10,
          foldVersion: 'audit-v2',
        },
        determinismId: 'heuristic-eval-v1',
        psychConfigVersion: 'engine-config-v1',
        schemaVersion: 1,
      },
    ]);
    expect(transcript.overrideLedger).toHaveLength(1);
    expect(transcript.attrition.firings).toBe(1);
    expect(transcript.foldVersion).toBe('transcript-v1');
  });
});

describe('passport export', () => {
  it('round-trips a signed piece passport', () => {
    const piece = makePiece(30);
    const passport = exportPiecePassport({
      piece,
      identity: {
        id: piece.id,
        name: 'Test',
        bornInMatch: 1,
        originRole: 'Knight',
      },
      provenance: ['career-abc'],
    });
    const imported = importPiecePassport(passport);
    expect(imported?.piece.id).toBe(piece.id);
    expect(imported?.identity.name).toBe('Test');
  });
});

describe('certificate bundle', () => {
  it('verifies its content digest', () => {
    const bundle = buildCertificateBundle({
      career: {
        id: 'career-1',
        seed: 42,
        schemaVersion: 1,
        outcome: 'ongoing',
        actIds: ['act-1'],
        createdAt: 1,
      },
      campaignId: 'campaign-1',
      matches: [
        {
          id: 'm1',
          campaignId: 'campaign-1',
          actId: 'act-1',
          matchIndex: 1,
          seed: 42,
          rosterSnapshot: [makePiece(50)],
          rosterEnd: [makePiece(48)],
          events: [],
          result: 'DRAW',
          audit: {
            boardQuality: 70,
            executionFidelity: 0.9,
            realizedQuality: 68,
            refusalCount: 0,
            overrideCount: 0,
            desertionCount: 0,
            quietQuitCount: 0,
            promotionCount: 0,
            meanTrustDelta: -2,
            foldVersion: 'audit-v2',
          },
          determinismId: 'heuristic-eval-v1',
          psychConfigVersion: 'engine-config-v1',
          schemaVersion: 1,
        },
      ],
      initialRoster: [makePiece(50)],
      finalRoster: [makePiece(48)],
      actTerminalState: 'ongoing',
    });
    expect(bundle.matches).toHaveLength(1);
    expect(verifyCertificateDigest(bundle)).toBe(true);
  });
});
