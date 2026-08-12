import { describe, expect, it } from 'vitest';

import {
  AUDIT_PROSE_CONFIG,
  campaignDebriefProse,
  matchAuditProse,
  narratorIntro,
  type MatchProseInput,
} from '../src/narrative';
import type { MatchEvent, PieceRole } from '../src/psychology';

const ROLE_OF: Record<string, PieceRole> = {
  'w:P:a2': 'Pawn',
  'w:R:h1': 'Rook',
  'w:N:b1': 'Knight',
  'w:Q:d1': 'Queen',
  'w:B:f1': 'Bishop',
  'w:K:e1': 'King',
};

const EVENTS: readonly MatchEvent[] = [
  {
    t: 'OVERRIDE',
    ply: 2,
    pieceId: 'w:R:h1',
    san: 'Rh4',
    pieceTrustDelta: -30,
  },
  { t: 'SACRIFICE_WITNESSED', ply: 7, hero: 'w:B:f1', beneficiary: 'w:K:e1' },
  { t: 'CAPTURE', ply: 9, victim: 'w:Q:d1', by: 'b:N:g8' },
  {
    t: 'DESERTION',
    ply: 10,
    pieceId: 'w:P:a2',
    refusedMove: 'a4',
    uStay: -5,
    uDesert: 3,
    terms: {
      P_captured: 0,
      pain: 0,
      P_lossIfStay: 0,
      P_lossIfLeave: 0,
      lambda: 0,
      lambdaTrust: 0,
      lambdaMorale: 0,
      lambdaLoyalty: 0,
      lambdaAffinity: 0,
      standingCost: 0,
      gloryWeight: 0,
      tauBenev: 0,
      tauAbil: 0,
    },
    departureKind: 'first',
  },
  {
    t: 'DESERTION',
    ply: 13,
    pieceId: 'w:R:h1',
    refusedMove: 'Rh5',
    uStay: -6,
    uDesert: 4,
    terms: {
      P_captured: 0,
      pain: 0,
      P_lossIfStay: 0,
      P_lossIfLeave: 0,
      lambda: 0,
      lambdaTrust: 0,
      lambdaMorale: 0,
      lambdaLoyalty: 0,
      lambdaAffinity: 0,
      standingCost: 0,
      gloryWeight: 0,
      tauBenev: 0,
      tauAbil: 0,
    },
    departureKind: 'cascade',
  },
  {
    t: 'DESERTION',
    ply: 16,
    pieceId: 'w:N:b1',
    refusedMove: 'Nc3',
    uStay: -7,
    uDesert: 5,
    terms: {
      P_captured: 0,
      pain: 0,
      P_lossIfStay: 0,
      P_lossIfLeave: 0,
      lambda: 0,
      lambdaTrust: 0,
      lambdaMorale: 0,
      lambdaLoyalty: 0,
      lambdaAffinity: 0,
      tauBenev: 0,
      tauAbil: 0,
      standingCost: 0,
      gloryWeight: 0,
    },
    departureKind: 'cascade',
  },
];

function input(overrides: Partial<MatchProseInput> = {}): MatchProseInput {
  return {
    result: 'ROUT',
    boardQuality: 74,
    executionFidelity: 0.41,
    overrideCount: 1,
    desertionCount: 3,
    refusalCount: 2,
    events: EVENTS,
    roleOf: ROLE_OF,
    ...overrides,
  };
}

describe('match audit prose (6.4)', () => {
  it('carries the outcome headline', () => {
    expect(matchAuditProse(input()).headline).toBe(
      'A rout. They would rather lose than serve.',
    );
  });

  it('reconstructs the desertion cascade with its cause (golden)', () => {
    const prose = matchAuditProse(input());
    expect(prose.findings).toContain(
      'The pawn walked at move 10 after the queen was taken. Then 2 more followed within 6 moves.',
    );
  });

  it('names the override count as a legible cause', () => {
    expect(matchAuditProse(input()).findings).toContain(
      'You overrode 1 refusal by force.',
    );
  });

  it('credits a witnessed sacrifice', () => {
    expect(matchAuditProse(input()).findings).toContain(
      'The bishop spent itself to cover the king; the room saw it.',
    );
  });

  it('diagnoses the board-quality vs execution-fidelity gap', () => {
    expect(matchAuditProse(input()).paragraphs.join(' ')).toContain(
      'the room did not follow it',
    );
  });

  it('states plainly when nobody left', () => {
    const prose = matchAuditProse(
      input({ result: 'WIN', desertionCount: 0, events: [] }),
    );
    expect(prose.findings).toContain('Nobody left the board.');
  });
});

describe('match audit cascade-window sensitivity', () => {
  const cascadeLines = (windowPlies: number): string[] =>
    matchAuditProse(input(), {
      ...AUDIT_PROSE_CONFIG,
      cascadeWindowPlies: windowPlies,
    }).findings.filter((finding) => finding.includes('walked at move'));

  it('groups 3-ply gaps into one run at the default window', () => {
    expect(cascadeLines(AUDIT_PROSE_CONFIG.cascadeWindowPlies)).toHaveLength(1);
  });

  it('splits the same gaps into three when the window narrows', () => {
    expect(cascadeLines(2)).toHaveLength(3);
  });
});

describe('campaign debrief prose', () => {
  it('reads the two credence channels separately (D19)', () => {
    const prose = campaignDebriefProse({
      matches: [
        { result: 'LOSS', executionFidelity: 0.4 },
        { result: 'WIN', executionFidelity: 0.7 },
      ],
      tauAbilTrajectory: [30, 70],
      tauBenevTrajectory: [60, 20],
      attrition: { desertions: 2, refusals: 5, firings: 1 },
      traumaGini: 0.7,
    });
    expect(prose.paragraphs).toContain(
      'They came to think you were right — and to doubt that you cared.',
    );
    expect(prose.findings.join(' ')).toContain('trauma was concentrated');
  });
});

describe('narrator intro', () => {
  it('announces the appointment and bands the mandate', () => {
    expect(narratorIntro({ mandate: 90, act: 1 })).toContain('first command');
    expect(narratorIntro({ mandate: 90, act: 1 })).toContain('walk into fire');
    expect(narratorIntro({ mandate: 10, act: 3 })).toContain(
      'command number 3',
    );
  });
});
