import { describe, expect, it } from 'vitest';

import { ENGINE_CONFIG } from '../src/psychology';
import { createCommanderPool } from '../sim/pool';
import {
  EMPTY_PRIDE,
  foldPride,
  pricingEventsForCycle,
  type PricingEvent,
} from '../sim/pride';
import { roleExpectationPrice } from '../sim/seminarDraft';
import { SEMINAR_CONFIG } from '../sim/seminarConfig';

function ev(
  cycle: number,
  kind: PricingEvent['kind'],
  ownerId: string,
  pieceId: string,
  role: PricingEvent['role'],
  price: number,
): PricingEvent {
  return { cycle, kind, ownerId, pieceId, role, price };
}

describe('D182/D215 pride', () => {
  it('is inert at a zero EMA', () => {
    expect(
      foldPride(
        [ev(1, 'draft', 'owner', 'piece', 'Queen', 1_000)],
        SEMINAR_CONFIG,
        0,
      ),
    ).toEqual({});
    expect(ENGINE_CONFIG.PRIDE_EXPECTATION_EMA_PERMILLE).toBe(250);
  });

  it('uses role expectation instead of absolute price', () => {
    const reading = foldPride(
      [
        ev(1, 'draft', 'owner', 'pawn', 'Pawn', 40),
        ev(1, 'draft', 'owner', 'queen', 'Queen', 40),
      ],
      SEMINAR_CONFIG,
      500,
    );
    expect(reading.owner?.proud.map((career) => career.pieceId)).toEqual([
      'pawn',
    ]);
    expect(reading.owner?.wounded.map((career) => career.pieceId)).toEqual([
      'queen',
    ]);
    expect(reading.owner?.proud[0]?.appraisal).toBe(1_000);
    expect(reading.owner?.wounded[0]?.appraisal).toBe(-600);
  });

  it('moves expectation before measuring the next price', () => {
    const events = [
      ev(1, 'draft', 'owner', 'pawn', 'Pawn', 60),
      ev(2, 'ransom', 'owner', 'pawn', 'Pawn', 20),
    ];
    const atQuarter = foldPride(events, SEMINAR_CONFIG, 250);
    const atFull = foldPride(events, SEMINAR_CONFIG, 1_000);
    expect(atQuarter.owner?.proud[0]?.steps).toEqual([
      {
        cycle: 1,
        kind: 'draft',
        price: 60,
        expectation: 20,
        delta: 1_000,
      },
      {
        cycle: 2,
        kind: 'ransom',
        price: 20,
        expectation: 30,
        delta: -333,
      },
    ]);
    expect(atFull.owner?.proud[0]?.steps[0]?.expectation).toBe(20);
    expect(atFull.owner?.proud[0]?.steps[1]?.delta).toBe(-666);
  });

  it('applies the naming floor to positive and negative appraisals', () => {
    const events = [
      ev(1, 'draft', 'owner', 'plus-100', 'Pawn', 22),
      ev(1, 'draft', 'owner', 'minus-300', 'Pawn', 14),
      ev(1, 'draft', 'owner', 'plus-900', 'Pawn', 38),
    ];
    const counts = [0, 200, 500].map((floor) => {
      const reading = foldPride(events, SEMINAR_CONFIG, 1_000, floor);
      return (
        (reading.owner?.proud.length ?? 0) +
        (reading.owner?.wounded.length ?? 0)
      );
    });
    expect(counts).toEqual([3, 2, 1]);
  });

  it('clamps each delta and the accumulated appraisal', () => {
    const proud = foldPride(
      [ev(1, 'draft', 'owner', 'rich', 'Pawn', 1_000_000)],
      SEMINAR_CONFIG,
      500,
    );
    expect(proud.owner?.proud[0]?.appraisal).toBe(1_000);
    expect(proud.owner?.proud[0]?.steps[0]?.delta).toBe(1_000);

    const wounded = foldPride(
      [
        ev(1, 'draft', 'owner', 'poor', 'Pawn', 0),
        ev(2, 'draft', 'owner', 'poor', 'Pawn', 0),
      ],
      SEMINAR_CONFIG,
      500,
    );
    expect(wounded.owner?.wounded[0]?.appraisal).toBe(-1_000);
  });

  it('groups a career under its last owner', () => {
    const reading = foldPride(
      [
        ev(1, 'draft', 'a', 'piece', 'Pawn', 60),
        ev(2, 'ransom', 'b', 'piece', 'Pawn', 20),
      ],
      SEMINAR_CONFIG,
      500,
    );
    expect(reading.a).toBeUndefined();
    expect(reading.b?.proud.map((career) => career.pieceId)).toEqual(['piece']);
  });

  it('orders ransom events before draft events and rejects unknown captives', () => {
    const owner = createCommanderPool({
      id: 'owner',
      side: 'w',
      style: 'servant',
      careerSeed: 1,
    });
    const captive = owner.members[0];
    if (captive === undefined) throw new Error('Missing pool fixture member.');
    const ransom = {
      captiveId: captive.state.id,
      ownerId: owner.id,
      heldBy: 'captor',
      weeksHeld: 1,
      price: 17,
      payer: 'commander' as const,
      commanderAmount: 17,
      pieceAmount: 0,
    };
    expect(
      pricingEventsForCycle(
        3,
        [ransom],
        [
          {
            ownerId: owner.id,
            side: 'w',
            pieceId: 'drafted',
            role: 'Queen',
            clearingPrice: 40,
          },
        ],
        new Map([[owner.id, owner]]),
      ).map((event) => event.kind),
    ).toEqual(['ransom', 'draft']);
    expect(() =>
      pricingEventsForCycle(
        3,
        [{ ...ransom, captiveId: 'missing' }],
        [],
        new Map([[owner.id, owner]]),
      ),
    ).toThrow('Missing ransom captive missing');
  });

  it('is deterministic and sorts named careers', () => {
    const events = [
      ev(1, 'draft', 'z-owner', 'z-piece', 'Pawn', 40),
      ev(1, 'draft', 'a-owner', 'b-piece', 'Pawn', 40),
      ev(1, 'draft', 'a-owner', 'a-piece', 'Pawn', 40),
    ];
    const first = foldPride(events, SEMINAR_CONFIG, 500);
    const second = foldPride(events, SEMINAR_CONFIG, 500);
    expect(first).toEqual(second);
    expect(Object.keys(first)).toEqual(['a-owner', 'z-owner']);
    expect(first['a-owner']?.proud.map((career) => career.pieceId)).toEqual([
      'a-piece',
      'b-piece',
    ]);
    expect(EMPTY_PRIDE).toEqual({ proud: [], wounded: [] });
    expect(roleExpectationPrice('Pawn', SEMINAR_CONFIG)).toBe(20);
  });
});
