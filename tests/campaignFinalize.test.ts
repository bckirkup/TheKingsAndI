import { describe, expect, it } from 'vitest';

import {
  careerOutcomeForTerminal,
  finalizeCampaignIfComplete,
} from '../src/orchestration/campaignFinalize';
import { AUDIT_FOLD_VERSION } from '../src/persistence';
import type { MatchRecord, MatchResult } from '../src/persistence';

function match(
  result: MatchResult,
  index: number,
  realizedQuality = 80,
): MatchRecord {
  return {
    id: `match-${index}`,
    campaignId: 'campaign-1',
    actId: 'act-1',
    matchIndex: index,
    seed: index,
    result,
    events: [],
    rosterSnapshot: [],
    rosterEnd: [],
    audit: {
      boardQuality: realizedQuality,
      executionFidelity: 1,
      realizedQuality,
      refusalCount: 0,
      overrideCount: 0,
      desertionCount: 0,
      quietQuitCount: 0,
      promotionCount: 0,
      meanTrustDelta: 0,
      foldVersion: AUDIT_FOLD_VERSION,
    },
    determinismId: 'test',
    psychConfigVersion: 'engine-config-v1',
    schemaVersion: 2,
  };
}

describe('campaignFinalize', () => {
  it('maps act terminals onto career outcomes', () => {
    expect(careerOutcomeForTerminal('victory')).toBe('victory');
    expect(careerOutcomeForTerminal('dismissal')).toBe('dismissed');
    expect(careerOutcomeForTerminal('rout')).toBe('exhausted');
    expect(careerOutcomeForTerminal('checkmate')).toBe('ongoing');
    expect(careerOutcomeForTerminal('ongoing')).toBe('ongoing');
  });

  it('returns null until the campaign target length is reached', () => {
    expect(
      finalizeCampaignIfComplete({
        matches: [match('WIN', 1)],
        campaignTarget: 2,
        kingsRemaining: 1,
      }),
    ).toBeNull();
  });

  it('finalizes victory when the target is met with sustained quality', () => {
    const finalized = finalizeCampaignIfComplete({
      matches: [match('WIN', 1, 90), match('WIN', 2, 90)],
      campaignTarget: 2,
      kingsRemaining: 1,
    });
    expect(finalized?.terminal).toBe('victory');
    expect(finalized?.outcome).toBe('victory');
  });

  it('finalizes rout when any match shattered the roster', () => {
    const finalized = finalizeCampaignIfComplete({
      matches: [match('WIN', 1), match('ROUT', 2)],
      campaignTarget: 2,
      kingsRemaining: 0,
    });
    expect(finalized).toEqual({
      terminal: 'rout',
      outcome: 'exhausted',
    });
  });
});
