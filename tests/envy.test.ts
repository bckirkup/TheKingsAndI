import { describe, expect, it } from 'vitest';

import type { Side } from '../src/chess';
import { ENGINE_CONFIG, type PieceRole } from '../src/psychology';
import { foldEnvy, type EnvyIncident } from '../sim/envy';
import type { DraftSettlement } from '../sim/seminarDraft';

function settle(
  ownerId: string,
  pieceId: string,
  role: PieceRole,
  clearingPrice: number,
  side: Side = 'w',
): DraftSettlement {
  return { ownerId, side, pieceId, role, clearingPrice };
}

describe('D214 envy', () => {
  it('is inert at the zero floor', () => {
    expect(
      foldEnvy([
        {
          cycle: 1,
          settlements: [
            settle('owner', 'cheap', 'Knight', 100),
            settle('owner', 'dear', 'Knight', 600),
          ],
        },
      ]),
    ).toEqual({});
    expect(ENGINE_CONFIG.ENVY_PRICE_GAP_FLOOR).toBe(0);
  });

  it('grades sensitivity to the same-role price gap', () => {
    const cycles = [
      {
        cycle: 1,
        settlements: [
          settle('owner', 'price-100', 'Knight', 100),
          settle('owner', 'price-130', 'Knight', 130),
          settle('owner', 'price-200', 'Knight', 200),
        ],
      },
    ];
    const counts = [10, 80, 200].map(
      (floor) => Object.values(foldEnvy(cycles, floor)).flat().length,
    );
    expect(counts).toEqual([2, 1, 0]);
    const incidents = foldEnvy(cycles, 10).owner ?? [];
    expect(incidents).toContainEqual({
      cycle: 1,
      pieceId: 'price-100',
      role: 'Knight',
      clearingPrice: 100,
      peerId: 'price-200',
      peerClearingPrice: 200,
      gap: 100,
    });
    expect(incidents).toContainEqual({
      cycle: 1,
      pieceId: 'price-130',
      role: 'Knight',
      clearingPrice: 130,
      peerId: 'price-200',
      peerClearingPrice: 200,
      gap: 70,
    });
    expect(incidents).not.toContainEqual(
      expect.objectContaining({ pieceId: 'price-200' }),
    );
  });

  it('partitions by owner, role, and side', () => {
    expect(
      foldEnvy(
        [
          {
            cycle: 1,
            settlements: [
              settle('owner', 'knight-cheap', 'Knight', 100, 'w'),
              settle('owner', 'knight-dear', 'Knight', 200, 'w'),
              settle('owner', 'rook-dear', 'Rook', 200, 'w'),
              settle('other', 'knight-dear', 'Knight', 200, 'w'),
              settle('black', 'knight-dear', 'Knight', 200, 'b'),
            ],
          },
        ],
        50,
      ),
    ).toEqual({
      owner: [
        {
          cycle: 1,
          pieceId: 'knight-cheap',
          role: 'Knight',
          clearingPrice: 100,
          peerId: 'knight-dear',
          peerClearingPrice: 200,
          gap: 100,
        },
      ],
    });
  });

  it('breaks equal-price peer ties by peer id', () => {
    expect(
      foldEnvy(
        [
          {
            cycle: 1,
            settlements: [
              settle('owner', 'cheap', 'Knight', 100),
              settle('owner', 'peer-z', 'Knight', 200),
              settle('owner', 'peer-a', 'Knight', 200),
            ],
          },
        ],
        50,
      ).owner,
    ).toEqual([
      {
        cycle: 1,
        pieceId: 'cheap',
        role: 'Knight',
        clearingPrice: 100,
        peerId: 'peer-a',
        peerClearingPrice: 200,
        gap: 100,
      },
    ]);
  });

  it('does not compare settlements across cycles', () => {
    expect(
      foldEnvy(
        [
          { cycle: 1, settlements: [settle('owner', 'dear', 'Knight', 200)] },
          { cycle: 2, settlements: [settle('owner', 'cheap', 'Knight', 100)] },
        ],
        50,
      ),
    ).toEqual({});
  });

  it('sorts output and is deterministic', () => {
    const cycles = [
      {
        cycle: 2,
        settlements: [
          settle('owner', 'b', 'Knight', 100),
          settle('owner', 'z', 'Knight', 200),
          settle('owner', 'zz', 'Knight', 300),
          settle('other', 'a', 'Rook', 100),
          settle('other', 'b', 'Rook', 300),
        ],
      },
      {
        cycle: 1,
        settlements: [
          settle('owner', 'a', 'Knight', 100),
          settle('owner', 'c', 'Knight', 300),
        ],
      },
    ];
    const first = foldEnvy(cycles, 50);
    const second = foldEnvy(cycles, 50);
    expect(first).toEqual(second);
    const ownerIncidents = first.owner as readonly EnvyIncident[];
    expect(ownerIncidents.map((incident) => incident.cycle)).toEqual([1, 2, 2]);
    expect(ownerIncidents.map((incident) => incident.pieceId)).toEqual([
      'a',
      'b',
      'z',
    ]);
  });
});
