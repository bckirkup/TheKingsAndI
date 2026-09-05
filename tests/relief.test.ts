import { describe, expect, it } from 'vitest';

import { reliefEventsForPly } from '../src/psychology';

describe('D217 relief recognition', () => {
  it('is inert at a zero floor', () => {
    expect(
      reliefEventsForPly(
        {
          ply: 3,
          previousExposure: { a: { risk: 1, streak: 1 } },
          captureRiskByPiece: { a: 0 },
        },
        0,
      ),
    ).toEqual([]);
  });

  it('grades the prior-risk floor', () => {
    const input = {
      ply: 3,
      previousExposure: { a: { risk: 0.8, streak: 1 } },
      captureRiskByPiece: { a: 0.1 },
    };
    expect(reliefEventsForPly(input, 200)).toHaveLength(1);
    expect(reliefEventsForPly(input, 600)).toHaveLength(1);
    expect(reliefEventsForPly(input, 900)).toHaveLength(0);
  });

  it('requires a fall below the floor and a prior exposure', () => {
    expect(
      reliefEventsForPly(
        {
          ply: 3,
          previousExposure: { a: { risk: 0.8, streak: 1 } },
          captureRiskByPiece: { a: 0.6 },
        },
        600,
      ),
    ).toEqual([]);
    expect(
      reliefEventsForPly(
        {
          ply: 3,
          previousExposure: {},
          captureRiskByPiece: { a: 0.1 },
        },
        600,
      ),
    ).toEqual([]);
  });

  it('considers only current fielded pieces and sorts output by id', () => {
    const events = reliefEventsForPly(
      {
        ply: 7,
        previousExposure: {
          z: { risk: 0.9, streak: 1 },
          a: { risk: 0.9, streak: 1 },
          captured: { risk: 0.9, streak: 1 },
        },
        captureRiskByPiece: { z: 0.1, a: 0.2 },
      },
      750,
    );
    expect(events).toEqual([
      {
        t: 'RELIEF',
        ply: 7,
        pieceId: 'a',
        priorRiskPermille: 900,
        riskPermille: 200,
      },
      {
        t: 'RELIEF',
        ply: 7,
        pieceId: 'z',
        priorRiskPermille: 900,
        riskPermille: 100,
      },
    ]);
  });
});
