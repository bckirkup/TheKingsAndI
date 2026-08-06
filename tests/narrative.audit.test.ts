import { describe, expect, it } from 'vitest';

import { campaignDebrief, matchAudit } from '../src/narrative/audit';
import { NARRATION_CONFIG } from '../src/narrative/config';
import { DEFAULT_TREE } from '../src/narrative/authoredProvider';
import type { CampaignTelemetry, MatchTelemetry } from '../src/narrative/types';

const CASCADE: MatchTelemetry = {
  outcome: 'ROUT',
  plies: 58,
  overrides: 2,
  boardQuality: 74,
  executionFidelity: 41,
  departures: [
    {
      piece: { name: 'Aldric', role: 'P' },
      ply: 10,
      grievance: 'SPENT_PEER',
      triggeredBy: { name: 'Maren', role: 'Q' },
    },
    { piece: { name: 'Bram', role: 'R' }, ply: 11, grievance: 'LOSING_STREAK' },
    { piece: { name: 'Cade', role: 'N' }, ply: 12, grievance: 'LOSING_STREAK' },
  ],
};

describe('match audit', () => {
  it('reconstructs the desertion cascade in ply order (golden)', () => {
    const audit = matchAudit(DEFAULT_TREE, CASCADE);
    expect(audit).toMatchSnapshot();
  });

  it('names the override count as a legible cause', () => {
    const audit = matchAudit(DEFAULT_TREE, CASCADE);
    expect(audit.findings).toContain('You overrode 2 refusals by force.');
  });

  it('reports the board-quality vs execution-fidelity gap', () => {
    const audit = matchAudit(DEFAULT_TREE, CASCADE);
    expect(audit.paragraphs.join(' ')).toContain('the room did not follow it');
  });

  it('states plainly when nobody left', () => {
    const audit = matchAudit(DEFAULT_TREE, {
      ...CASCADE,
      outcome: 'WIN',
      overrides: 0,
      departures: [],
    });
    expect(audit.findings).toContain('Nobody left the board.');
  });
});

describe('match audit cascade-window sensitivity', () => {
  const spread: MatchTelemetry = {
    ...CASCADE,
    departures: [
      {
        piece: { name: 'Aldric', role: 'P' },
        ply: 10,
        grievance: 'SPENT_PEER',
      },
      {
        piece: { name: 'Bram', role: 'R' },
        ply: 13,
        grievance: 'LOSING_STREAK',
      },
    ],
  };

  it('groups a 3-ply gap into one run at the default window', () => {
    const audit = matchAudit(DEFAULT_TREE, spread, NARRATION_CONFIG);
    const cascadeLines = audit.findings.filter((f) =>
      f.includes('walked at move'),
    );
    expect(cascadeLines).toHaveLength(1);
  });

  it('splits the same gap into two when the window narrows', () => {
    const audit = matchAudit(DEFAULT_TREE, spread, {
      ...NARRATION_CONFIG,
      cascadeWindowPlies: 2,
    });
    const cascadeLines = audit.findings.filter((f) =>
      f.includes('walked at move'),
    );
    expect(cascadeLines).toHaveLength(2);
  });
});

describe('campaign debrief', () => {
  const campaign: CampaignTelemetry = {
    leaderName: 'Vane',
    matches: [
      {
        index: 1,
        outcome: 'CHECKMATE',
        departures: 1,
        boardQuality: 60,
        executionFidelity: 40,
      },
      {
        index: 2,
        outcome: 'DRAW',
        departures: 0,
        boardQuality: 62,
        executionFidelity: 55,
      },
      {
        index: 3,
        outcome: 'WIN',
        departures: 0,
        boardQuality: 65,
        executionFidelity: 70,
      },
    ],
    retirements: [{ name: 'Maren', role: 'Q' }],
  };

  it('folds the campaign into a debrief (golden)', () => {
    expect(campaignDebrief(DEFAULT_TREE, campaign)).toMatchSnapshot();
  });

  it('records retirement as a world event', () => {
    const debrief = campaignDebrief(DEFAULT_TREE, campaign);
    expect(debrief.findings.join(' ')).toContain('retired from the world');
  });
});
