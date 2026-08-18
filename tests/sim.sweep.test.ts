import { describe, expect, it } from 'vitest';

import {
  applyMatchOutcomeTrust,
  defaultCredence,
  defaultRumor,
  ENGINE_CONFIG,
  normalizePieceState,
} from '../src/psychology';
import {
  plainChessHorizonSeries,
  plainChessMeanWinScore,
  runPlainChessMatch,
  plainChessWinScores,
} from '../sim/baseline';
import { matchSeedForCampaign, runCampaign } from '../sim/campaign';
import { disposeSimEngine } from '../sim/engine';
import { runCoefficientSweep } from '../sim/sweep';

const samplePiece = normalizePieceState({
  id: 'w:P:a2',
  role: 'Pawn',
  E_i: 40,
  traits: {
    w_honor: 0.5,
    w_courage: 0.5,
    w_ambition: 0.5,
    w_loyalty: 0.5,
    w_empathy: 0.5,
    w_prestige: 0.5,
  },
  T_i: 50,
  M_i: 50,
  B_i: 0,
  dyadicAffinity: {},
  classPrestige: {
    King: 0,
    Queen: 0,
    Rook: 0,
    Bishop: 0,
    Knight: 0,
    Pawn: 0,
  },
  engagementFactor: 1,
  credence: defaultCredence(),
  rumor: defaultRumor(),
});

describe('plain-chess baseline', () => {
  it('is deterministic for a fixed seed', () => {
    const a = plainChessMeanWinScore({
      matches: 3,
      seed: 7,
      whiteLeader: 'tyrannical',
      blackLeader: 'random',
    });
    const b = plainChessMeanWinScore({
      matches: 3,
      seed: 7,
      whiteLeader: 'tyrannical',
      blackLeader: 'random',
    });
    expect(a).toBe(b);
  });

  it('golden: horizon prefixes use the campaign match seed derivation', () => {
    const scores = plainChessWinScores({
      matches: 3,
      seed: 7,
      whiteLeader: 'tyrannical',
      blackLeader: 'random',
    });
    expect(scores).toEqual(
      [1, 2, 3].map(
        (match) =>
          runPlainChessMatch({
            seed: matchSeedForCampaign(7, match),
            whiteLeader: 'tyrannical',
            blackLeader: 'random',
          }).winScore,
      ),
    );
    // Truthful terminal scoring classifies these non-checkmate control games
    // as draws rather than using the old turn-parity outcome.
    expect(
      plainChessHorizonSeries({
        matches: 3,
        seed: 7,
        whiteLeader: 'tyrannical',
        blackLeader: 'random',
      }),
    ).toEqual(
      [1, 2, 3].map((horizon) => ({
        horizon,
        meanWinScore: 50,
        winRate: 0,
        drawRate: 1,
        lossRate: 0,
      })),
    );
  });

  it('sensitivity: changing the campaign seed changes control output', () => {
    const first = plainChessHorizonSeries({
      matches: 5,
      seed: 7,
      whiteLeader: 'supportive',
      blackLeader: 'random',
    });
    const second = plainChessHorizonSeries({
      matches: 5,
      seed: 8,
      whiteLeader: 'supportive',
      blackLeader: 'random',
    });
    expect(second).not.toEqual(first);
  });

  it('sensitivity: the control receives the opposing leader', () => {
    const randomOpponent = plainChessMeanWinScore({
      matches: 20,
      seed: 0,
      whiteLeader: 'tyrannical',
      blackLeader: 'random',
    });
    const tyrannicalOpponent = plainChessMeanWinScore({
      matches: 20,
      seed: 0,
      whiteLeader: 'tyrannical',
      blackLeader: 'tyrannical',
    });
    expect(Math.abs(randomOpponent - tyrannicalOpponent)).toBeGreaterThan(5);
  });
});

describe('coefficient sweep', () => {
  it('golden: OUTCOME_TRUST_LOSS_SCALE default is 12', () => {
    expect(ENGINE_CONFIG.OUTCOME_TRUST_LOSS_SCALE).toBe(12);
  });

  it('sensitivity: OUTCOME_TRUST_LOSS_SCALE changes match-end trust', () => {
    const cfg = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = cfg.OUTCOME_TRUST_LOSS_SCALE ?? 12;
    try {
      cfg.OUTCOME_TRUST_LOSS_SCALE = 0;
      const flat = applyMatchOutcomeTrust([samplePiece], 0)[0]?.T_i;
      cfg.OUTCOME_TRUST_LOSS_SCALE = 40;
      const steep = applyMatchOutcomeTrust([samplePiece], 0)[0]?.T_i;
      expect(flat).toBe(50);
      expect(steep).toBeLessThan(50);
    } finally {
      cfg.OUTCOME_TRUST_LOSS_SCALE = original;
    }
  });

  it('runs a campaign sweep and reports campaign summary metrics', async () => {
    const cfg = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = cfg.OUTCOME_TRUST_LOSS_SCALE ?? 12;
    let campaignSummary;
    const points = await runCoefficientSweep({
      knob: 'OUTCOME_TRUST_LOSS_SCALE',
      values: [6],
      matches: 2,
      seed: 7,
      leader: 'tyrannical',
      opponent: 'tyrannical',
      engineKind: 'fake',
    });
    try {
      cfg.OUTCOME_TRUST_LOSS_SCALE = 6;
      campaignSummary = (
        await runCampaign({
          matches: 2,
          leader: 'tyrannical',
          opponent: 'tyrannical',
          seed: 7,
          engineKind: 'fake',
        })
      ).summary;
    } finally {
      cfg.OUTCOME_TRUST_LOSS_SCALE = original;
      await disposeSimEngine('fake');
    }
    const point = points[0];
    expect(point).toBeDefined();
    if (point === undefined || campaignSummary === undefined) return;
    expect(point.knob).toBe('OUTCOME_TRUST_LOSS_SCALE');
    expect(point.meanPlies).toBe(campaignSummary.meanPlies);
    expect(point.winCount).toBe(campaignSummary.winCount);
    expect(point.drawCount).toBe(campaignSummary.drawCount);
    expect(point.lossCount).toBe(campaignSummary.lossCount);
    expect(point.meanPromotionsPerMatch).toBe(
      campaignSummary.meanPromotionsPerMatch,
    );
    expect(point.promotionMatchRate).toBe(campaignSummary.promotionMatchRate);
    expect(point.promotionToRoleCounts).toEqual(
      campaignSummary.promotionToRoleCounts,
    );
    expect(point.enemyDesertionAttrition).toBe(
      campaignSummary.enemyDesertionAttrition,
    );
    expect(point.meanEnemyDesertions).toBe(campaignSummary.meanEnemyDesertions);
    expect(typeof point.plainChessWinDelta).toBe('number');
  }, 60_000);
});
