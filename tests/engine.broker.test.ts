import { afterAll, describe, expect, it } from 'vitest';

import {
  applyPrivateScoring,
  createStockfishPort,
  disposeStockfishPort,
  resolveInsightRound,
  buildInsightRound,
  requireComplete,
  SHARED_SEARCH_D_MAX,
  STOCKFISH_DETERMINISM_ID,
  stockfishDeterminismId,
} from '../src/engine';
import type { PieceId } from '../src/core/ids';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('shared-search broker (Stockfish)', () => {
  afterAll(async () => {
    await disposeStockfishPort();
  });

  it('truncates a shared D_max search to per-seat depths', async () => {
    const port = await createStockfishPort({ poolSize: 1, dMax: 6 });
    const shallow = await port.evaluate(START, 2, {});
    const deep = await port.evaluate(START, 6, {});
    expect(Number.isSafeInteger(shallow.scoreCp)).toBe(true);
    expect(Number.isSafeInteger(deep.scoreCp)).toBe(true);
    // Depth sensitivity: deeper truncation exposes a longer (or equal) PV.
    expect(deep.pv.length).toBeGreaterThanOrEqual(shallow.pv.length);
  }, 60_000);

  it('keeps true D_max eval off the psychology-facing evaluate path shape', async () => {
    const port = await createStockfishPort({ poolSize: 1, dMax: 4 });
    const trueEval = await port.evaluateTrue(START);
    const pieceView = await port.evaluate(START, 2, { safety: 0 });
    expect(Number.isSafeInteger(trueEval.scoreCp)).toBe(true);
    expect(pieceView.pv.length).toBeGreaterThan(0);
    expect(SHARED_SEARCH_D_MAX).toBe(16);
  }, 60_000);

  it('derives the Stockfish determinism ID from the configured ceiling', () => {
    expect(STOCKFISH_DETERMINISM_ID).toContain('dmax-16');
    expect(stockfishDeterminismId(8)).toContain('dmax-8');
    expect(stockfishDeterminismId(8)).not.toBe(STOCKFISH_DETERMINISM_ID);
    expect(STOCKFISH_DETERMINISM_ID).toContain('multipv-8');
    expect(stockfishDeterminismId(16, 4)).not.toBe(STOCKFISH_DETERMINISM_ID);
  });

  it('keeps engine transport profile-agnostic', () => {
    const base = { scoreCp: 40, pv: ['e2e4'] as const };
    const plain = applyPrivateScoring(base, {});
    const biased = applyPrivateScoring(base, { safety: 2, material: -1 });
    expect(plain.scoreCp).toBe(40);
    expect(biased.scoreCp).toBe(40);
  });

  it('serves a barrier round from one shared search', async () => {
    const port = await createStockfishPort({ poolSize: 2, dMax: 4 });
    const seats = [
      {
        pieceId: 'wP_a2' as PieceId,
        depth: 2,
        evalProfile: { a: 0 },
      },
      {
        pieceId: 'wP_b2' as PieceId,
        depth: 4,
        evalProfile: { a: 1 },
      },
    ];
    const requests = buildInsightRound({ fen: START, seats });
    const bundle = requireComplete(
      await resolveInsightRound(port, requests, { round: 0 }),
    );
    expect(bundle.insights).toHaveLength(2);
    expect(bundle.determinismId).toContain('stockfish-js-18');
  }, 60_000);
});
