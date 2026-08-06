import { describe, expect, it } from 'vitest';

import {
  assertKingDepthInvariant,
  CAMPAIGN_CONFIG,
} from '../src/orchestration/campaignConfig';
import {
  evaluateCareerVictory,
  resolveCampaignTerminal,
  shouldDismiss,
} from '../src/orchestration/campaignPolicy';
import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
} from '../src/psychology';

function makePiece(trust: number) {
  return normalizePieceState({
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
  });
}

describe('campaign config', () => {
  it('asserts D_king < D_player_effective (ADR 0022 §4)', () => {
    expect(() => assertKingDepthInvariant()).not.toThrow();
    expect(CAMPAIGN_CONFIG.KING_MAX_SEARCH_DEPTH).toBeLessThan(
      CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH,
    );
  });
});

describe('campaign policy', () => {
  it('detects dismissal when mean trust collapses', () => {
    expect(shouldDismiss([makePiece(-30), makePiece(-20)])).toBe(true);
    expect(shouldDismiss([makePiece(40), makePiece(50)])).toBe(false);
  });

  it('detects sustained career victory (5.10)', () => {
    const matches = [
      { audit: { boardQuality: 80 } },
      { audit: { boardQuality: 75 } },
      { audit: { boardQuality: 78 } },
    ];
    expect(evaluateCareerVictory(matches)).toBe(true);
    expect(evaluateCareerVictory(matches.slice(0, 2))).toBe(false);
  });

  it('resolves rout before victory when both could apply', () => {
    const terminal = resolveCampaignTerminal(['ROUT', 'WIN', 'WIN', 'WIN'], 3, [
      { audit: { boardQuality: 90 } },
      { audit: { boardQuality: 90 } },
      { audit: { boardQuality: 90 } },
    ]);
    expect(terminal).toBe('rout');
  });
});
