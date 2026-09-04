import { describe, expect, it } from 'vitest';

import { foldSeminarLoneliness } from '../sim/loneliness';
import type { MatchRecord } from '../src/persistence';

function piece(id: string, dyadicAffinity: Readonly<Record<string, number>>) {
  return { id, dyadicAffinity };
}

function record(
  rosterSnapshot: readonly { id: string }[],
  rosterEnd: readonly {
    id: string;
    dyadicAffinity: Readonly<Record<string, number>>;
  }[],
  events: readonly MatchRecord['events'][number][],
): MatchRecord {
  return { rosterSnapshot, rosterEnd, events } as unknown as MatchRecord;
}

describe('D217 loneliness recognition', () => {
  it('is inert at the default threshold', () => {
    const match = record(
      [piece('survivor', { lost: 70 })],
      [piece('survivor', { lost: 70 })],
      [],
    );
    expect(
      foldSeminarLoneliness([{ week: 1, records: { owner: [match] } }]),
    ).toEqual({});
  });

  it('grades the lost-peer affinity threshold', () => {
    const match = record(
      [piece('survivor', { lost: 70 }), piece('lost', {})],
      [piece('survivor', { lost: 70 })],
      [{ t: 'CAPTURE', ply: 1, victim: 'lost', by: 'enemy' }],
    );
    const weeks = [{ week: 1, records: { owner: [match] } }];
    expect(
      [50, 70, 71].map(
        (threshold) =>
          foldSeminarLoneliness(weeks, threshold).owner?.lonely.length ?? 0,
      ),
    ).toEqual([1, 1, 0]);
  });

  it('requires no surviving peer at or above the threshold', () => {
    const match = record(
      [
        piece('survivor', { lost: 70, peer: 60 }),
        piece('lost', {}),
        piece('peer', {}),
      ],
      [piece('survivor', { lost: 70, peer: 60 }), piece('peer', {})],
      [{ t: 'CAPTURE', ply: 1, victim: 'lost', by: 'enemy' }],
    );
    const weeks = [{ week: 1, records: { owner: [match] } }];
    expect(foldSeminarLoneliness(weeks, 50).owner?.lonely.length ?? 0).toBe(0);
    expect(foldSeminarLoneliness(weeks, 61).owner?.lonely.length ?? 0).toBe(1);
  });

  it('uses own departures, ignores enemy captures, and sorts lost peers', () => {
    const match = record(
      [piece('survivor', { z: 80, a: 60 }), piece('z', {}), piece('a', {})],
      [piece('survivor', { z: 80, a: 60 })],
      [
        { t: 'CAPTURE', ply: 1, victim: 'enemy', by: 'survivor' },
        { t: 'CAPTURE', ply: 2, victim: 'z', by: 'enemy' },
        {
          t: 'DESERTION',
          ply: 3,
          pieceId: 'a',
          refusedMove: 'a',
          uStay: 0,
          uDesert: 1,
          departureKind: 'first',
        },
      ],
    );
    expect(
      foldSeminarLoneliness([{ week: 1, records: { owner: [match] } }], 50),
    ).toEqual({
      owner: {
        lonely: [
          {
            pieceId: 'survivor',
            week: 1,
            lostPeers: ['a', 'z'],
            lostAffinity: 140,
          },
        ],
      },
    });
  });
});
