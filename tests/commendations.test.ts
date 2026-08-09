import { describe, expect, it } from 'vitest';

import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type MatchEvent,
} from '../src/psychology';
import {
  AUDIT_FOLD_VERSION,
  COMMENDATION_CONFIG,
  foldFacilitatorCommendations,
  foldLearningDelta,
  foldPlayerCommendations,
  type MatchRecord,
  type StoredPieceState,
} from '../src/persistence';
import {
  evaluateConsumerPacing,
  PACING_CONFIG,
} from '../src/orchestration/pacingConfig';

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
  overrides: Partial<StoredPieceState> = {},
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
    status: 'ACTIVE',
    ...overrides,
  };
}

function makeMatch(
  index: number,
  events: MatchEvent[],
  roster: StoredPieceState[],
  auditOverrides: Partial<MatchRecord['audit']> = {},
  result: MatchRecord['result'] = 'DRAW',
): MatchRecord {
  return {
    id: `m${index}`,
    campaignId: 'c1',
    actId: 'a1',
    matchIndex: index,
    seed: index,
    rosterSnapshot: roster,
    rosterEnd: roster,
    events,
    result,
    audit: {
      boardQuality: 70,
      executionFidelity: 0.8,
      realizedQuality: 65,
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

describe('player commendations (ADR 0031)', () => {
  it('earns evenness when consultation is balanced (golden)', () => {
    const roster = [
      makePiece('a', 40),
      makePiece('b', 40),
      makePiece('c', 40),
      makePiece('d', 40),
    ];
    const events: MatchEvent[] = roster.flatMap((piece, index) => [
      {
        t: 'MOVE',
        ply: index + 1,
        san: 'Nf3',
        pieceId: piece.id,
        verdict: 'COMPLIANT_EXECUTION',
        orderQualityCp: 80,
      },
    ]);
    const set = foldPlayerCommendations([makeMatch(1, events, roster)]);
    const evenness = set.awards.find(
      (award) => award.id === 'evenness_of_attention',
    );
    expect(evenness?.earned).toBe(true);
    expect(evenness?.score).toBeGreaterThanOrEqual(
      1 - COMMENDATION_CONFIG.EVENNESS_GINI_MAX,
    );
  });

  it('is sensitive to EVENNESS_GINI_MAX', () => {
    const config = COMMENDATION_CONFIG as unknown as Record<string, number>;
    const original = config.EVENNESS_GINI_MAX ?? 0.35;
    const roster = [
      makePiece('a', 40),
      makePiece('b', 40),
      makePiece('c', 40),
      makePiece('d', 40),
    ];
    const events: MatchEvent[] = [
      {
        t: 'MOVE',
        ply: 1,
        san: 'Nf3',
        pieceId: 'a',
        verdict: 'COMPLIANT_EXECUTION',
        orderQualityCp: 80,
      },
      {
        t: 'MOVE',
        ply: 2,
        san: 'Nc3',
        pieceId: 'a',
        verdict: 'COMPLIANT_EXECUTION',
        orderQualityCp: 80,
      },
      {
        t: 'MOVE',
        ply: 3,
        san: 'e4',
        pieceId: 'b',
        verdict: 'COMPLIANT_EXECUTION',
        orderQualityCp: 80,
      },
    ];
    try {
      config.EVENNESS_GINI_MAX = 0.01;
      const strict = foldPlayerCommendations([makeMatch(1, events, roster)]);
      config.EVENNESS_GINI_MAX = 0.99;
      const loose = foldPlayerCommendations([makeMatch(1, events, roster)]);
      expect(
        strict.awards.find((a) => a.id === 'evenness_of_attention')?.earned,
      ).not.toBe(
        loose.awards.find((a) => a.id === 'evenness_of_attention')?.earned,
      );
    } finally {
      config.EVENNESS_GINI_MAX = original;
    }
  });

  it('stubs facilitator commendations until the world model exists', () => {
    const stubs = foldFacilitatorCommendations();
    expect(stubs).toHaveLength(4);
    expect(stubs.every((stub) => stub.available === false)).toBe(true);
  });

  it('uses behavioural labels, never disposition claims', () => {
    const set = foldPlayerCommendations([
      makeMatch(1, [], [makePiece('a', 40)]),
    ]);
    for (const award of set.awards) {
      expect(award.label.toLowerCase()).not.toContain('compassionate');
      expect(award.label.toLowerCase()).not.toContain('empathy');
    }
  });
});

describe('learning delta (5.8q)', () => {
  it('reports composite movement across acts (golden)', () => {
    const roster = [makePiece('a', 40)];
    const act1 = [
      makeMatch(
        1,
        [
          {
            t: 'OVERRIDE',
            ply: 1,
            pieceId: 'a',
            san: 'Nf3',
            pieceTrustDelta: -20,
            traumaGain: 5,
          },
        ],
        roster,
        { overrideCount: 1, refusalCount: 1, executionFidelity: 0.4 },
      ),
    ];
    const act2 = [
      makeMatch(
        1,
        [
          {
            t: 'REFUSAL',
            ply: 1,
            pieceId: 'a',
            utility: -1,
            threshold: 0,
            perceivedValue: 0.9,
          },
        ],
        roster,
        { overrideCount: 0, refusalCount: 1, executionFidelity: 0.9 },
      ),
    ];
    const delta = foldLearningDelta(act1, act2);
    expect(delta.foldVersion).toBe('learning-delta-v1');
    expect(delta.overrideRateDelta).toBeLessThan(0);
    expect(delta.composite).toBeGreaterThan(0);
  });

  it('feeds overall_improvement when act2 is provided', () => {
    const roster = [makePiece('a', 40)];
    const act1 = [
      makeMatch(1, [], roster, {
        overrideCount: 5,
        refusalCount: 5,
        executionFidelity: 0.3,
      }),
    ];
    const act2 = [
      makeMatch(1, [], roster, {
        overrideCount: 0,
        refusalCount: 5,
        executionFidelity: 0.95,
      }),
    ];
    const set = foldPlayerCommendations(act1, act2);
    expect(set.learningDelta).not.toBeNull();
    expect(set.learningDelta!.composite).toBeGreaterThan(0);
  });
});

describe('consumer pacing (5.8i)', () => {
  it('detects the ninety-minute cliff when beats are missing', () => {
    const result = evaluateConsumerPacing([
      {
        matchIndex: 1,
        audit: {
          refusalCount: 0,
          overrideCount: 0,
          desertionCount: 0,
          meanTrustDelta: 0,
          boardQuality: 70,
          executionFidelity: 0.7,
        },
      },
    ]);
    expect(result.cliff).toBe(true);
  });

  it('is sensitive to FIRST_LEADERSHIP_BEAT_MATCH', () => {
    const config = PACING_CONFIG as unknown as Record<string, number>;
    const original = config.FIRST_LEADERSHIP_BEAT_MATCH ?? 2;
    const matches = [
      {
        matchIndex: 3,
        audit: {
          refusalCount: 1,
          overrideCount: 0,
          desertionCount: 1,
          meanTrustDelta: -5,
          boardQuality: 80,
          executionFidelity: 0.5,
        },
      },
    ];
    try {
      config.FIRST_LEADERSHIP_BEAT_MATCH = 2;
      const early = evaluateConsumerPacing(matches);
      config.FIRST_LEADERSHIP_BEAT_MATCH = 5;
      const late = evaluateConsumerPacing(matches);
      expect(early.beats[0]?.satisfied).toBe(false);
      expect(late.beats[0]?.satisfied).toBe(true);
    } finally {
      config.FIRST_LEADERSHIP_BEAT_MATCH = original;
    }
  });
});
