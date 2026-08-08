import { describe, expect, it } from 'vitest';

import { createFakeEnginePort } from '../src/engine/fake';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('coherent fake engine', () => {
  it('converges toward the deep-limit score as depth rises', async () => {
    const port = createFakeEnginePort();
    const shallow = await port.evaluate(START, 2);
    const medium = await port.evaluate(START, 8);
    const deep = await port.evaluate(START, 16);

    expect(deep.scoreCp).toBe(-182);
    expect(Math.abs(medium.scoreCp - deep.scoreCp)).toBeLessThan(
      Math.abs(shallow.scoreCp - deep.scoreCp),
    );
  });

  it('keeps depth disagreement bounded for the same position', async () => {
    const port = createFakeEnginePort();
    const shallow = await port.evaluate(START, 2);
    const deep = await port.evaluate(START, 16);

    expect(shallow.scoreCp).not.toBe(deep.scoreCp);
    expect(Math.abs(shallow.scoreCp - deep.scoreCp)).toBeLessThanOrEqual(56);
  });

  it('is bit-reproducible across repeated calls', async () => {
    const port = createFakeEnginePort();
    const first = await port.evaluate(START, 8);
    const second = await port.evaluate(START, 8);

    expect(second).toEqual(first);
  });

  it('provides deterministic per-rung MultiPV lines', async () => {
    const port = createFakeEnginePort();
    const shallow = await port.multiPvAt?.(START, 2);
    const deep = await port.multiPvAt?.(START, 6);

    expect(shallow?.length).toBeGreaterThan(1);
    expect(shallow).toEqual(await port.multiPvAt?.(START, 2));
    expect(shallow?.every((line) => line.pv.length <= 2)).toBe(true);
    expect(deep?.every((line) => line.pv.length <= 4)).toBe(true);
  });
});
