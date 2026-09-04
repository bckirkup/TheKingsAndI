import { describe, expect, it } from 'vitest';

import { ENGINE_CONFIG, panicOnsetForPly } from '../src/psychology';
import { foldSeminarPanic } from '../sim/panic';
import type { MatchRecord } from '../src/persistence';

describe('D216 panic recognition', () => {
  it('is inert at the default roster floor', () => {
    expect(
      panicOnsetForPly({
        ply: 4,
        side: 'w',
        captureRiskByPiece: { a: 1, b: 1 },
        kingDanger: true,
      }),
    ).toBeUndefined();
    expect(ENGINE_CONFIG.PANIC_ROSTER_FLOOR).toBe(0);
  });

  it('grades the roster floor and falls back to King danger', () => {
    const input = {
      ply: 4,
      side: 'w' as const,
      captureRiskByPiece: { a: 0.9, b: 0.8, c: 0.2 },
      kingDanger: true,
    };
    expect(panicOnsetForPly(input, 1, 750)?.trigger).toBe('dread');
    expect(panicOnsetForPly(input, 2, 750)?.trigger).toBe('dread');
    expect(panicOnsetForPly(input, 3, 750)).toMatchObject({
      trigger: 'king_danger',
      dreading: ['a', 'b'],
    });
  });

  it('grades the capture-risk permille threshold', () => {
    const risks = { a: 0.9, b: 0.8, c: 0.2 };
    expect(
      panicOnsetForPly(
        { ply: 1, side: 'b', captureRiskByPiece: risks, kingDanger: true },
        2,
        100,
      )?.dreading,
    ).toHaveLength(3);
    expect(
      panicOnsetForPly(
        { ply: 1, side: 'b', captureRiskByPiece: risks, kingDanger: true },
        2,
        850,
      )?.dreading,
    ).toHaveLength(1);
    expect(
      panicOnsetForPly(
        { ply: 1, side: 'b', captureRiskByPiece: risks, kingDanger: true },
        2,
        1_000,
      ),
    ).toMatchObject({ trigger: 'king_danger', dreading: [] });
  });

  it('clamps inputs and sorts dreading ids', () => {
    expect(
      panicOnsetForPly(
        {
          ply: 2,
          side: 'w',
          captureRiskByPiece: { z: 0.001, a: 0 },
          kingDanger: false,
        },
        1.9,
        0,
      ),
    ).toMatchObject({ trigger: 'dread', dreading: ['z'], fielded: 2 });
    expect(
      panicOnsetForPly(
        {
          ply: 2,
          side: 'w',
          captureRiskByPiece: { a: 0, b: 0 },
          kingDanger: true,
        },
        -2,
        750,
      ),
    ).toBeUndefined();
  });

  it('folds owner partitions and orders incidents by week, ply, trigger', () => {
    const events = [
      {
        t: 'PANIC_ONSET' as const,
        ply: 5,
        side: 'w' as const,
        trigger: 'king_danger' as const,
        dreading: [],
        fielded: 4,
      },
      {
        t: 'PANIC_ONSET' as const,
        ply: 2,
        side: 'w' as const,
        trigger: 'dread' as const,
        dreading: ['a'],
        fielded: 2,
      },
      {
        t: 'PANIC_ONSET' as const,
        ply: 5,
        side: 'w' as const,
        trigger: 'dread' as const,
        dreading: ['a', 'b'],
        fielded: 4,
      },
    ];
    const record = { events } as unknown as MatchRecord;
    expect(
      foldSeminarPanic([
        {
          week: 2,
          records: { b: [record] },
        },
        {
          week: 1,
          records: { a: [record] },
        },
      ]),
    ).toEqual({
      a: {
        incidents: [
          { week: 1, ply: 2, trigger: 'dread', dreading: 1, fielded: 2 },
          {
            week: 1,
            ply: 5,
            trigger: 'dread',
            dreading: 2,
            fielded: 4,
          },
          {
            week: 1,
            ply: 5,
            trigger: 'king_danger',
            dreading: 0,
            fielded: 4,
          },
        ],
      },
      b: {
        incidents: [
          { week: 2, ply: 2, trigger: 'dread', dreading: 1, fielded: 2 },
          {
            week: 2,
            ply: 5,
            trigger: 'dread',
            dreading: 2,
            fielded: 4,
          },
          {
            week: 2,
            ply: 5,
            trigger: 'king_danger',
            dreading: 0,
            fielded: 4,
          },
        ],
      },
    });
    expect(foldSeminarPanic([])).toEqual({});
  });
});
