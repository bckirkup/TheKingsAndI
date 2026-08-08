import { describe, expect, it } from 'vitest';

import { createFakeEnginePort } from '../src/engine/fake';
import { LivingBoard, type MoveFeatures } from '../src/chess';
import {
  applyPrivateEvaluation,
  evalProfileFor,
} from '../src/orchestration/privateEvaluation';
import { insightToEvaluation } from '../src/orchestration/evaluation';
import {
  createInsightRoundHandle,
  resolveMoverInsights,
} from '../src/orchestration/insight';
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
  it('preserves leader-implied bias in the psychology evaluation', () => {
    const features: MoveFeatures = {
      moverId: 'w:P:e2',
      san: 'e4',
      deltaVCapture: 0,
      materialDelta: 0,
      pCaptured: 0.1,
      pCapturedDelta: 0,
      captureRiskByPiece: {},
      peerSafetyDeltas: {},
      kingSafetyDelta: 0,
    };
    const result = insightToEvaluation(
      features,
      { scoreCp: 20, pv: [] },
      { scoreCp: 30, pv: [] },
      1.25,
    );
    expect(result.vLeaderImplied).toBe(1.55);
  });

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

  it('collects the pre-move best-line seat in the same barrier round', async () => {
    const handle = createInsightRoundHandle();
    const baseEngine = createFakeEnginePort();
    let bestLineCalls = 0;
    const engine = {
      ...baseEngine,
      async bestAt(fen: string, depth: number) {
        bestLineCalls += 1;
        return baseEngine.bestAt?.(fen, depth) ?? { scoreCp: 0, pv: [] };
      },
    };
    const features: MoveFeatures = {
      moverId: ACTOR.id,
      san: 'e4',
      deltaVCapture: 0,
      materialDelta: 0,
      pCaptured: 0.1,
      pCapturedDelta: 0,
      captureRiskByPiece: {},
      peerSafetyDeltas: {},
      kingSafetyDelta: 0,
    };
    await resolveMoverInsights(
      engine,
      BOARD,
      { from: 'e2', to: 'e4' },
      ACTOR,
      handle,
      [ACTOR],
      features,
    );
    expect(bestLineCalls).toBe(1);
    expect(handle.round).toBe(1);
  });
});
