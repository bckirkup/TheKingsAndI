import { describe, expect, it } from 'vitest';

import { draftPriority } from '../src/core/draftEconomy';
import { createCommanderPool } from '../sim/pool';
import { decayCaptiveBenevolence, ransomCaptives } from '../sim/ransom';
import { SEMINAR_CONFIG } from '../sim/seminarConfig';
import { runSeminar, seminarPayload } from '../sim/seminar';

function captivePool() {
  const pool = createCommanderPool({
    id: 'w:commander:00',
    side: 'w',
    style: 'supportive',
    reserveDepth: 0,
  });
  const member = pool.members.find(
    (candidate) => candidate.state.role === 'Queen',
  );
  if (member === undefined) throw new Error('queen missing');
  return {
    pool: {
      ...pool,
      members: [
        {
          ...member,
          status: 'captive' as const,
          heldBy: 'b:commander:00',
          heldSinceWeek: 1,
          state: {
            ...member.state,
            cash: 100,
            credence: { ...member.state.credence, tauBenev: 50 },
          },
        },
      ],
    },
    member,
  };
}

function ransomPriceForBenevolence(tauBenev: number): number {
  const { pool } = captivePool();
  const adjustedPool = {
    ...pool,
    members: pool.members.map((member) => ({
      ...member,
      state: {
        ...member.state,
        credence: { ...member.state.credence, tauBenev },
      },
    })),
  };
  const result = ransomCaptives({
    pools: new Map([
      [adjustedPool.id, adjustedPool],
      [
        'b:commander:00',
        createCommanderPool({
          id: 'b:commander:00',
          side: 'b',
          style: 'supportive',
          reserveDepth: 0,
        }),
      ],
    ]),
    purses: new Map([[adjustedPool.id, 1000]]),
    priorities: draftPriority([
      { commanderId: adjustedPool.id, standing: 0, cohortExternality: 0 },
    ]),
    week: 2,
    firstMatch: 3,
    config: SEMINAR_CONFIG,
  });
  const price = result.ledger[0]?.price;
  if (price === undefined) throw new Error('ransom price missing');
  return price;
}

describe('seminar ransom', () => {
  it('settles an exact split and credits the captor', () => {
    const { pool } = captivePool();
    const priorities = draftPriority([
      { commanderId: pool.id, standing: 0, cohortExternality: 0 },
    ]);
    const result = ransomCaptives({
      pools: new Map([
        [pool.id, pool],
        [
          'b:commander:00',
          createCommanderPool({
            id: 'b:commander:00',
            side: 'b',
            style: 'supportive',
            reserveDepth: 0,
          }),
        ],
      ]),
      purses: new Map([[pool.id, 10]]),
      priorities,
      week: 2,
      firstMatch: 3,
      config: SEMINAR_CONFIG,
    });
    const entry = result.ledger[0];
    expect(entry?.payer).toBe('split');
    expect(entry?.commanderAmount).toBe(10);
    expect(entry?.pieceAmount).toBe((entry?.price ?? 0) - 10);
    expect(result.purses.get('b:commander:00')).toBe(entry?.price);
    expect(result.pools.get(pool.id)?.members[0]?.status).toBe('available');
  });

  it('decays benevolence only when configured and clamps at zero', () => {
    const { pool } = captivePool();
    const pools = new Map([[pool.id, pool]]);
    expect(
      decayCaptiveBenevolence(pools, 0).get(pool.id)?.members[0]?.state.credence
        .tauBenev,
    ).toBe(50);
    expect(
      decayCaptiveBenevolence(pools, 60).get(pool.id)?.members[0]?.state
        .credence.tauBenev,
    ).toBe(0);
  });

  it('prices a more benevolent captive more cheaply', () => {
    expect(ransomPriceForBenevolence(90)).toBeLessThan(
      ransomPriceForBenevolence(10),
    );
  });

  it('is deterministic and never fields an unreleased captive', async () => {
    const config = {
      ...SEMINAR_CONFIG,
      WEEKS_PER_SEMESTER: 2,
      MATCHES_PER_WEEK: 1,
      COMMANDERS_PER_COHORT: 1,
      DRAFT_AT_CYCLE_ONE: true,
      CAPTIVITY_HOLD_ENABLED: true,
    };
    const first = await runSeminar({ seed: 7, config, engineKind: 'fake' });
    const second = await runSeminar({ seed: 7, config, engineKind: 'fake' });
    expect(first.weeks.flatMap((week) => week.ransomLedger)).toEqual(
      second.weeks.flatMap((week) => week.ransomLedger),
    );
    for (let index = 0; index < first.weeks.length - 1; index += 1) {
      const week = first.weeks[index];
      const nextWeek = first.weeks[index + 1];
      if (week === undefined || nextWeek === undefined) continue;
      const captiveIds = new Set(
        Object.values(week.poolStates)
          .flatMap((pool) => pool.members)
          .filter((member) => member.status === 'captive')
          .map((member) => member.state.id),
      );
      expect(
        Object.values(nextWeek.fieldedLineups)
          .flat()
          .flat()
          .some((id) => captiveIds.has(id)),
      ).toBe(false);
    }
    expect(seminarPayload(first)).toBe(seminarPayload(second));
  });

  it('conserves money across a seeded enabled two-week run', async () => {
    const result = await runSeminar({
      seed: 7,
      config: {
        ...SEMINAR_CONFIG,
        WEEKS_PER_SEMESTER: 2,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 2,
        CAPTIVITY_HOLD_ENABLED: true,
        DRAFT_AT_CYCLE_ONE: true,
      },
      engineKind: 'fake',
    });
    const ledger = result.weeks.flatMap((week) => week.ransomLedger);
    expect(ledger.length).toBeGreaterThan(0);
    const commanderSpends = ledger.reduce(
      (total, entry) => total + entry.commanderAmount,
      0,
    );
    const pieceCashDebits = ledger.reduce(
      (total, entry) => total + entry.pieceAmount,
      0,
    );
    const captorCredits = ledger.reduce(
      (total, entry) => total + entry.price,
      0,
    );
    const ledgerPrices = ledger.reduce(
      (total, entry) => total + entry.price,
      0,
    );
    expect(commanderSpends + pieceCashDebits).toBe(captorCredits);
    expect(captorCredits).toBe(ledgerPrices);
  });
});
