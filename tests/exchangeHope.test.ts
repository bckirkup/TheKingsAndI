import { describe, expect, it } from 'vitest';

import { createCommanderPool, type CommanderPool } from '../sim/pool';
import { decayCaptiveBenevolence, type RansomLedgerEntry } from '../sim/ransom';
import { EMPTY_EXCHANGE_HOPE, foldExchangeHope } from '../sim/exchangeHope';

function poolWithMembers(members: CommanderPool['members']): CommanderPool {
  const pool = createCommanderPool({
    id: 'w:commander:00',
    side: 'w',
    style: 'supportive',
    reserveDepth: 0,
  });
  return { ...pool, members };
}

function ledgerEntry(
  captiveId: string,
  payer: RansomLedgerEntry['payer'],
): RansomLedgerEntry {
  return {
    captiveId,
    ownerId: 'w:commander:00',
    heldBy: 'b:commander:00',
    weeksHeld: 2,
    price: 10,
    payer,
    commanderAmount: payer === 'self' ? 0 : 10,
    pieceAmount: payer === 'self' ? 10 : 0,
  };
}

describe('seminar exchange hope', () => {
  it('folds commander ransom and self-sprung outcomes by owner', () => {
    const pool = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'supportive',
      reserveDepth: 0,
    });
    const [first, second, third] = pool.members;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Missing exchange-hope fixture members.');
    }
    const finalPool = {
      ...pool,
      members: [
        { ...first, state: { ...first.state, cash: 0 } },
        {
          ...second,
          state: {
            ...second.state,
            cash: 0,
            credence: { ...second.state.credence, tauBenev: 23 },
          },
        },
        { ...third, state: { ...third.state, cash: 0 } },
      ],
    };
    const result = foldExchangeHope(
      [
        {
          ransomLedger: [
            ledgerEntry(first.state.id, 'commander'),
            ledgerEntry(second.state.id, 'self'),
            ledgerEntry(third.state.id, 'split'),
          ],
        },
      ],
      new Map([[finalPool.id, finalPool]]),
    );
    expect(result[finalPool.id]?.realized).toEqual(
      [
        {
          kind: 'realized',
          pieceId: first.state.id,
          weeksHeld: 2,
          payer: 'commander',
        },
        {
          kind: 'realized',
          pieceId: third.state.id,
          weeksHeld: 2,
          payer: 'split',
        },
      ].sort((left, right) => left.pieceId.localeCompare(right.pieceId)),
    );
    expect(result[finalPool.id]?.selfSprung).toEqual([
      {
        kind: 'self_sprung',
        pieceId: second.state.id,
        weeksHeld: 2,
        tauBenev: 23,
      },
    ]);
  });

  it('names career-end and semester-close extinguishments', () => {
    const pool = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'supportive',
      reserveDepth: 0,
    });
    const [careerEnded, semesterClosed] = pool.members;
    if (careerEnded === undefined || semesterClosed === undefined) {
      throw new Error('Missing extinguishment fixture members.');
    }
    const finalPool = {
      ...pool,
      members: [
        {
          ...careerEnded,
          heldBy: 'b:commander:00',
          heldSinceWeek: 1,
          retirementCause: 'trauma' as const,
          status: 'retired' as const,
          state: {
            ...careerEnded.state,
            credence: { ...careerEnded.state.credence, tauBenev: 31 },
          },
        },
        {
          ...semesterClosed,
          heldBy: 'b:commander:00',
          heldSinceWeek: 2,
          status: 'captive' as const,
          state: {
            ...semesterClosed.state,
            credence: { ...semesterClosed.state.credence, tauBenev: 17 },
          },
        },
      ],
    };
    expect(
      foldExchangeHope(
        [{ ransomLedger: [] }, { ransomLedger: [] }, { ransomLedger: [] }],
        new Map([[finalPool.id, finalPool]]),
      )[finalPool.id]?.extinguished,
    ).toEqual([
      {
        kind: 'extinguished',
        pieceId: careerEnded.state.id,
        weeksHeld: 2,
        reason: 'career_ended',
        tauBenev: 31,
      },
      {
        kind: 'extinguished',
        pieceId: semesterClosed.state.id,
        weeksHeld: 1,
        reason: 'semester_closed',
        tauBenev: 17,
      },
    ]);
  });

  it('sorts incidents by piece id and stays empty without captivity', () => {
    const pool = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'supportive',
      reserveDepth: 0,
    });
    const reversed = pool.members.slice(0, 2).reverse();
    expect(
      foldExchangeHope(
        [
          {
            ransomLedger: reversed.map((member) =>
              ledgerEntry(member.state.id, 'commander'),
            ),
          },
        ],
        new Map([[pool.id, pool]]),
      )[pool.id]?.realized.map((incident) => incident.pieceId),
    ).toEqual(
      [...reversed.map((member) => member.state.id)].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
    expect(foldExchangeHope([], new Map())).toEqual({});
    expect(EMPTY_EXCHANGE_HOPE).toEqual({
      realized: [],
      selfSprung: [],
      extinguished: [],
    });
  });

  it('makes terminal benevolence sensitive to configured decay', () => {
    const pool = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'supportive',
      reserveDepth: 0,
    });
    const member = pool.members[0];
    if (member === undefined) throw new Error('Missing decay fixture member.');
    const held = {
      ...member,
      heldBy: 'b:commander:00',
      heldSinceWeek: 1,
      status: 'captive' as const,
      state: {
        ...member.state,
        credence: { ...member.state.credence, tauBenev: 40 },
      },
    };
    const base = poolWithMembers([held]);
    const readTerminalTau = (decay: number) => {
      const decayed = decayCaptiveBenevolence(
        new Map([[base.id, base]]),
        decay,
      );
      return foldExchangeHope(
        [{ ransomLedger: [] }, { ransomLedger: [] }],
        decayed,
      )[base.id]?.extinguished[0]?.tauBenev;
    };
    expect(readTerminalTau(0)).toBe(40);
    expect(readTerminalTau(15)).toBe(25);
    expect(readTerminalTau(100)).toBe(0);
  });
});
