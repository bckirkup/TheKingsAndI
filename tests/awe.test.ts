import { describe, expect, it } from 'vitest';

import { foldSeminarAwe } from '../sim/awe';
import type { MatchRecord } from '../src/persistence';

function record(
  pieceIds: readonly string[],
  nominations: readonly string[],
): MatchRecord {
  return {
    rosterSnapshot: pieceIds.map((id) => ({ id })),
    events: nominations.map((pieceId) => ({
      t: 'HEROISM_NOMINATION' as const,
      ply: 1,
      pieceId,
      san: 'Nf3',
    })),
  } as unknown as MatchRecord;
}

describe('D217 awe recognition', () => {
  it('is inert at the default floor', () => {
    expect(
      foldSeminarAwe([
        { week: 1, records: { owner: [record(['hero', 'peer'], ['hero'])] } },
      ]),
    ).toEqual({});
  });

  it('grades the nomination floor and records witnesses', () => {
    const weeks = [
      {
        week: 2,
        records: {
          owner: [record(['zeta', 'hero', 'peer'], ['hero', 'hero'])],
        },
      },
    ];
    expect(
      [1, 2, 3].map(
        (floor) => foldSeminarAwe(weeks, floor).owner?.heroes.length ?? 0,
      ),
    ).toEqual([1, 1, 0]);
    expect(foldSeminarAwe(weeks, 1).owner?.heroes[0]).toEqual({
      pieceId: 'hero',
      week: 2,
      nominations: 2,
      witnesses: 2,
    });
  });

  it('partitions owners and sorts heroes by week then piece id', () => {
    const result = foldSeminarAwe(
      [
        {
          week: 2,
          records: {
            ownerB: [record(['z'], ['z'])],
            ownerA: [record(['b', 'a'], ['b'])],
          },
        },
        {
          week: 1,
          records: { ownerA: [record(['a'], ['a'])] },
        },
      ],
      1,
    );
    expect(result.ownerA?.heroes).toEqual([
      { pieceId: 'a', week: 1, nominations: 1, witnesses: 0 },
      { pieceId: 'b', week: 2, nominations: 1, witnesses: 1 },
    ]);
    expect(result.ownerB?.heroes).toEqual([
      { pieceId: 'z', week: 2, nominations: 1, witnesses: 0 },
    ]);
  });
});
