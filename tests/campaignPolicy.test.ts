import { describe, expect, it } from 'vitest';

import {
  assertKingDepthInvariant,
  CAMPAIGN_CONFIG,
} from '../src/orchestration/campaignConfig';
import { applyReputationTransfer } from '../src/orchestration/campaignPolicy';
import {
  evaluateCareerVictory,
  evaluateReinstatement,
  resolveCampaignTerminal,
  rosterLaunderingRisk,
  shouldDismiss,
} from '../src/orchestration/campaignPolicy';
import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
} from '../src/psychology';
import type { PieceIdentityRecord, StoredPieceState } from '../src/persistence';

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

function makeStoredPiece(credence = defaultCredence()): StoredPieceState {
  return {
    ...makePiece(40),
    credence,
    status: 'DESERTED',
  };
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

  it('asserts diminished king depth below full king depth', () => {
    expect(CAMPAIGN_CONFIG.DIMINISHED_KING_MAX_SEARCH_DEPTH).toBeLessThan(
      CAMPAIGN_CONFIG.KING_MAX_SEARCH_DEPTH,
    );
  });

  it('detects sustained career victory (5.10)', () => {
    const matches = [
      { audit: { realizedQuality: 80 } },
      { audit: { realizedQuality: 75 } },
      { audit: { realizedQuality: 78 } },
    ];
    expect(evaluateCareerVictory(matches)).toBe(true);
    expect(evaluateCareerVictory(matches.slice(0, 2))).toBe(false);
  });

  it('resolves rout before victory when both could apply', () => {
    const terminal = resolveCampaignTerminal(['ROUT', 'WIN', 'WIN', 'WIN'], 3, [
      { audit: { realizedQuality: 90 } },
      { audit: { realizedQuality: 90 } },
      { audit: { realizedQuality: 90 } },
    ]);
    expect(terminal).toBe('rout');
  });

  it('offers reinstatement when trust recovers after dismissal', () => {
    expect(evaluateReinstatement([makePiece(-10), makePiece(-5)], 5)).toBe(
      true,
    );
    expect(evaluateReinstatement([makePiece(-30), makePiece(-25)], -5)).toBe(
      false,
    );
  });

  it('flags roster laundering on deep bench with high-trust recruits', () => {
    const incoming = Array.from({ length: 16 }, (_, index) => ({
      ...makePiece(80),
      id: `w:N:g${index}`,
      status: 'DESERTED' as const,
    }));
    expect(rosterLaunderingRisk(incoming, 30)).toBe(true);
    expect(rosterLaunderingRisk(incoming.slice(0, 1), 8)).toBe(false);
  });

  it('uses disposition and peer testimony for an unserved commander', () => {
    const piece = makeStoredPiece({
      tauBenev: 20,
      tauAbil: 30,
      abilityObservationCount: 2,
    });
    const identity: PieceIdentityRecord = {
      id: piece.id,
      name: 'Una',
      bornInMatch: 0,
      originRole: 'Knight',
      disposition: {
        tauBenev: 40,
        tauAbil: 60,
        abilityObservationCount: 3,
      },
      relationshipAccounts: {
        'other:commander': {
          tauBenev: 5,
          tauAbil: 5,
          abilityObservationCount: 9,
        },
      },
    };
    const transferred = applyReputationTransfer(
      piece,
      80,
      20,
      identity,
      'new:commander',
    );
    expect(transferred.credence.tauBenev).toBe(30);
    expect(transferred.credence.tauAbil).toBe(70);
    expect(transferred.credence.abilityObservationCount).toBe(3);
  });
});
