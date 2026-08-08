import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import {
  applyPrivateEvaluation,
  evalProfileFor,
} from '../src/orchestration/privateEvaluation';
import { ENGINE_CONFIG, type PieceState } from '../src/psychology';

const BOARD = LivingBoard.fromFen('4k3/8/8/8/8/3p4/4P3/4K3 w - - 0 1');
const POST_MOVE = BOARD.clone();
POST_MOVE.applyMove({ from: 'e2', to: 'e4' });

const ACTOR: PieceState = {
  id: 'w:P:e2',
  role: 'Pawn',
  traits: {
    w_honor: 0.8,
    w_courage: 0.2,
    w_ambition: 0.5,
    w_loyalty: 0.5,
    w_empathy: 0.7,
    w_prestige: 0.6,
  },
  E_i: 50,
  T_i: 50,
  M_i: 70,
  B_i: 40,
  dyadicAffinity: {},
  classPrestige: {
    Pawn: -20,
    Knight: 0,
    Bishop: 0,
    Rook: 10,
    Queen: 20,
    King: 50,
  },
  engagementFactor: 1,
  credence: { tauBenev: 50, tauAbil: 50 },
  rumor: { pLossTeam: 0, leaderAppraisal: 0 },
};

describe('private evaluation profile', () => {
  it('produces deterministic integer-quantized profile data', () => {
    const first = evalProfileFor(ACTOR, POST_MOVE, { traumaDrift: false });
    const second = evalProfileFor(ACTOR, POST_MOVE, { traumaDrift: false });
    expect(first).toEqual(second);
    expect(Object.keys(first)).toEqual([...Object.keys(first)].sort());
    expect(Object.values(first).every(Number.isSafeInteger)).toBe(true);
    expect(first['weight:ownSafety']).toBe(870);
  });

  it('keeps trauma drift behind a sensitive configuration branch', () => {
    const withoutDrift = evalProfileFor(ACTOR, POST_MOVE, {
      traumaDrift: false,
    });
    const withDrift = evalProfileFor(ACTOR, POST_MOVE, { traumaDrift: true });
    expect(withoutDrift['weight:ownSafety']).toBe(870);
    expect(withDrift['weight:ownSafety']).toBe(1_000);
    expect(withDrift['weight:ownSafety']).not.toBe(
      withoutDrift['weight:ownSafety'],
    );
  });

  it('prunes unattended lines and lets attended lines change preference', () => {
    const profile = evalProfileFor(ACTOR, POST_MOVE);
    const base = { scoreCp: 80, pv: ['e8e7'] as const };
    const result = applyPrivateEvaluation(
      base,
      POST_MOVE,
      ACTOR,
      profile,
      [
        { scoreCp: 80, pv: ['e8e7', 'e4e5'] },
        { scoreCp: 80, pv: ['d3d2', 'e4e5'] },
      ],
      ENGINE_CONFIG.PRIVATE_EVAL_DISTORTION_BOUND_CP,
    );
    expect(result.pv).toEqual(['e8e7', 'e4e5']);
    expect(Math.abs(result.scoreCp - base.scoreCp)).toBeLessThanOrEqual(
      ENGINE_CONFIG.PRIVATE_EVAL_DISTORTION_BOUND_CP,
    );
  });

  it('gives ordinary attended lines distinct graded distortions', () => {
    const profile = evalProfileFor(ACTOR, POST_MOVE);
    const base = { scoreCp: 80, pv: ['e8e7'] as const };
    const first = applyPrivateEvaluation(
      base,
      POST_MOVE,
      ACTOR,
      profile,
      [{ scoreCp: 80, pv: ['e8e7', 'e4e5'] }],
      30,
    );
    const second = applyPrivateEvaluation(
      base,
      POST_MOVE,
      ACTOR,
      profile,
      [{ scoreCp: 80, pv: ['d3d2', 'e4e5'] }],
      30,
    );
    expect(first.scoreCp).not.toBe(second.scoreCp);
  });

  it('falls back to a defined distorted shared view when no line survives', () => {
    const profile = evalProfileFor(ACTOR, POST_MOVE);
    const base = { scoreCp: 80, pv: ['e8e7'] as const };
    const result = applyPrivateEvaluation(base, POST_MOVE, ACTOR, profile, [
      { scoreCp: 80, pv: ['d3d2', 'e8e7'] },
    ]);
    expect(result.pv).toEqual(base.pv);
    expect(Number.isSafeInteger(result.scoreCp)).toBe(true);
  });

  it('passes mate scores through without distortion', () => {
    const profile = evalProfileFor(ACTOR, POST_MOVE);
    const base = { scoreCp: 29_999, pv: ['e8e7'] as const };
    expect(
      applyPrivateEvaluation(
        base,
        POST_MOVE,
        ACTOR,
        profile,
        [{ scoreCp: 80, pv: ['e8e7', 'e4e5'] }],
        1,
      ),
    ).toEqual(base);
  });

  it('changes output when the distortion bound changes', () => {
    const profile = evalProfileFor(ACTOR, POST_MOVE);
    const base = { scoreCp: 80, pv: ['e8e7'] as const };
    const low = applyPrivateEvaluation(base, POST_MOVE, ACTOR, profile, [], 10);
    const high = applyPrivateEvaluation(
      base,
      POST_MOVE,
      ACTOR,
      profile,
      [],
      200,
    );
    expect(low.scoreCp).toBe(82);
    expect(high.scoreCp).toBe(128);
    expect(high.scoreCp).not.toBe(low.scoreCp);
  });
});
