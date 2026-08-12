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
import { matchSeedForCampaign } from '../sim/campaign';
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
    });
    const b = plainChessMeanWinScore({
      matches: 3,
      seed: 7,
      whiteLeader: 'tyrannical',
    });
    expect(a).toBe(b);
  });

  it('golden: horizon prefixes use the campaign match seed derivation', () => {
    const scores = plainChessWinScores({
      matches: 3,
      seed: 7,
      whiteLeader: 'tyrannical',
    });
    expect(scores).toEqual(
      [1, 2, 3].map(
        (match) =>
          runPlainChessMatch({
            seed: matchSeedForCampaign(7, match),
            whiteLeader: 'tyrannical',
          }).winScore,
      ),
    );
    expect(
      plainChessHorizonSeries({
        matches: 3,
        seed: 7,
        whiteLeader: 'tyrannical',
      }),
    ).toEqual([
      { horizon: 1, meanWinScore: 0, winRate: 0, drawRate: 0, lossRate: 1 },
      {
        horizon: 2,
        meanWinScore: 50,
        winRate: 0.5,
        drawRate: 0,
        lossRate: 0.5,
      },
      {
        horizon: 3,
        meanWinScore: 33.333333333333336,
        winRate: 1 / 3,
        drawRate: 0,
        lossRate: 2 / 3,
      },
    ]);
  });

  it('sensitivity: changing the campaign seed changes control output', () => {
    const first = plainChessHorizonSeries({
      matches: 5,
      seed: 7,
      whiteLeader: 'supportive',
    });
    const second = plainChessHorizonSeries({
      matches: 5,
      seed: 8,
      whiteLeader: 'supportive',
    });
    expect(second).not.toEqual(first);
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

  it('runs a campaign sweep and reports plain-chess win delta', async () => {
    const points = await runCoefficientSweep({
      knob: 'OUTCOME_TRUST_LOSS_SCALE',
      values: [6, 18],
      matches: 2,
      seed: 7,
      leader: 'tyrannical',
      engineKind: 'fake',
    });
    expect(points).toHaveLength(2);
    expect(points[0]?.knob).toBe('OUTCOME_TRUST_LOSS_SCALE');
    expect(typeof points[0]?.plainChessWinDelta).toBe('number');
  }, 60_000);
});
