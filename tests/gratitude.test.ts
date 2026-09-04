import { describe, expect, it } from 'vitest';

import type { MatchEvent } from '../src/psychology';
import { AUDIT_FOLD_VERSION, type MatchRecord } from '../src/persistence';
import { foldGratitude, type GratitudeWeek } from '../sim/gratitude';

function record(
  matchIndex: number,
  events: readonly MatchEvent[],
): MatchRecord {
  return {
    id: `match-${matchIndex}`,
    campaignId: 'seminar:7:w:commander:00',
    actId: 'semester:7',
    matchIndex,
    seed: matchIndex,
    rosterSnapshot: [],
    rosterEnd: [],
    events,
    result: 'DRAW',
    audit: {
      boardQuality: 0,
      executionFidelity: 1,
      realizedQuality: 0,
      refusalCount: 0,
      overrideCount: 0,
      desertionCount: 0,
      quietQuitCount: 0,
      promotionCount: 0,
      meanTrustDelta: 0,
      foldVersion: AUDIT_FOLD_VERSION,
    },
    determinismId: 'fake',
    psychConfigVersion: 'engine-config-v1',
    schemaVersion: 1,
  };
}

function ransom(
  captiveId: string,
  payer: 'commander' | 'split' | 'self',
  commanderAmount: number,
): GratitudeWeek['ransomLedger'][number] {
  return {
    captiveId,
    ownerId: 'w:commander:00',
    heldBy: 'b:commander:00',
    weeksHeld: 1,
    price: commanderAmount + (payer === 'split' ? 4 : 0),
    payer,
    commanderAmount,
    pieceAmount: payer === 'split' ? 4 : 0,
  };
}

const courage = (pieceId: string, ply: number): MatchEvent => ({
  t: 'MOVE',
  ply,
  san: 'e4',
  pieceId,
  verdict: 'COMPLIANT_EXECUTION',
  courage: { margin: 2, asked: 4 },
});

const override = (pieceId: string, ply: number): MatchEvent => ({
  t: 'OVERRIDE',
  ply,
  san: 'e4',
  pieceId,
  pieceTrustDelta: -10,
  vindicated: false,
});

describe('seminar gratitude', () => {
  it('forms only for commander and split ransom, honors one debt, and names self-pay nowhere', () => {
    const formed = ransom('piece-formed', 'commander', 8);
    const split = ransom('piece-split', 'split', 5);
    const self = ransom('piece-self', 'self', 0);
    const result = foldGratitude(
      [
        { week: 1, firstMatch: 1, ransomLedger: [formed, split, self] },
        { week: 2, firstMatch: 2, ransomLedger: [] },
      ],
      new Map([
        [
          'w:commander:00',
          [
            record(1, [courage('piece-formed', 1)]),
            record(2, [courage('piece-formed', 3)]),
          ],
        ],
      ]),
    );
    expect(result['w:commander:00']).toEqual({
      formed: [
        { kind: 'formed', pieceId: 'piece-formed', week: 1, magnitude: 8 },
        { kind: 'formed', pieceId: 'piece-split', week: 1, magnitude: 5 },
      ],
      honored: [
        {
          kind: 'honored',
          pieceId: 'piece-formed',
          week: 1,
          magnitude: 8,
          ply: 3,
        },
      ],
      voided: [],
      owed: [{ kind: 'owed', pieceId: 'piece-split', week: 1, magnitude: 5 }],
    });
  });

  it('lets an earlier unvindicated override void before a courage act honors', () => {
    const result = foldGratitude(
      [
        {
          week: 1,
          firstMatch: 1,
          ransomLedger: [ransom('piece-voided', 'commander', 9)],
        },
        { week: 2, firstMatch: 2, ransomLedger: [] },
      ],
      new Map([
        [
          'w:commander:00',
          [
            record(1, [courage('piece-voided', 1)]),
            record(2, [
              override('piece-voided', 2),
              courage('piece-voided', 3),
            ]),
          ],
        ],
      ]),
    );
    expect(result['w:commander:00']?.honored).toEqual([]);
    expect(result['w:commander:00']?.voided).toEqual([
      { kind: 'voided', pieceId: 'piece-voided', week: 1, magnitude: 9 },
    ]);
  });

  it('honors each subsequent debt with at most one courage act', () => {
    const result = foldGratitude(
      [
        {
          week: 1,
          firstMatch: 1,
          ransomLedger: [ransom('piece-repeat', 'commander', 3)],
        },
        {
          week: 2,
          firstMatch: 2,
          ransomLedger: [ransom('piece-repeat', 'commander', 4)],
        },
        { week: 3, firstMatch: 3, ransomLedger: [] },
      ],
      new Map([['w:commander:00', [record(2, [courage('piece-repeat', 3)])]]]),
    );
    expect(result['w:commander:00']?.honored).toHaveLength(1);
    expect(result['w:commander:00']?.owed).toEqual([
      { kind: 'owed', pieceId: 'piece-repeat', week: 2, magnitude: 4 },
    ]);
  });

  it('sorts incidents by piece and formation week despite input order', () => {
    const weeks: readonly GratitudeWeek[] = [
      {
        week: 1,
        firstMatch: 1,
        ransomLedger: [
          ransom('piece-b', 'commander', 3),
          ransom('piece-a', 'split', 2),
        ],
      },
      { week: 2, firstMatch: 2, ransomLedger: [] },
    ];
    const result = foldGratitude(
      weeks,
      new Map([
        [
          'w:commander:00',
          [
            record(2, [courage('piece-b', 2)]),
            record(1, [courage('piece-a', 1)]),
          ],
        ],
      ]),
    );
    expect(
      result['w:commander:00']?.formed.map((incident) => incident.pieceId),
    ).toEqual(['piece-a', 'piece-b']);
    expect(
      result['w:commander:00']?.honored.map((incident) => incident.pieceId),
    ).toEqual(['piece-b']);
  });

  it('is empty for no ransom and stable under repeated inputs', () => {
    const weeks: readonly GratitudeWeek[] = [
      { week: 1, firstMatch: 1, ransomLedger: [] },
      { week: 2, firstMatch: 3, ransomLedger: [] },
    ];
    expect(foldGratitude(weeks, new Map())).toEqual({});
    const input: readonly GratitudeWeek[] = [
      {
        week: 1,
        firstMatch: 1,
        ransomLedger: [
          ransom('piece-b', 'commander', 3),
          ransom('piece-a', 'split', 2),
        ],
      },
    ];
    const records = new Map([
      [
        'w:commander:00',
        [record(1, [courage('piece-b', 5), courage('piece-a', 4)])],
      ],
    ]);
    expect(foldGratitude(input, records)).toEqual(
      foldGratitude(input, records),
    );
  });
});
