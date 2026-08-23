import { describe, expect, it } from 'vitest';

import {
  DRAFT_CONFIG,
  acceptanceDiscountPermille,
  acceptedPrice,
  carryPurse,
  clearDraft,
  draftPriority,
} from '../src/orchestration';
import {
  draftEconomyDegeneracyFindings,
  type DraftEconomyObservations,
} from '../sim/degeneracy';
import type { CredenceState } from '../src/psychology';

const credence = (tauBenev: number): CredenceState => ({
  tauAbil: 50,
  tauBenev,
  abilityObservationCount: 0,
});

const economyObservations = (
  overrides: Partial<DraftEconomyObservations> = {},
): DraftEconomyObservations => ({
  cycles: [
    {
      cycle: 1,
      contestedLots: 2,
      winsByCommander: { a: 1, b: 1 },
      standingOrder: ['a', 'b'],
      clearingPrices: [
        { clearingPrice: 2, minimumBid: 1 },
        { clearingPrice: 3, minimumBid: 1 },
      ],
    },
    {
      cycle: 2,
      contestedLots: 2,
      winsByCommander: { a: 1, b: 1 },
      standingOrder: ['b', 'a'],
      clearingPrices: [
        { clearingPrice: 2, minimumBid: 1 },
        { clearingPrice: 3, minimumBid: 1 },
      ],
    },
  ],
  standingSeries: [
    { policy: 'tanking', cycle: 1, standing: 1 },
    { policy: 'tanking', cycle: 2, standing: 2 },
    { policy: 'balanced', cycle: 1, standing: 2 },
    { policy: 'balanced', cycle: 2, standing: 3 },
  ],
  ...overrides,
});

describe('draft economy', () => {
  it('orders the worst standing first and gives it the larger purse', () => {
    const priorities = draftPriority([
      { commanderId: 'dominant', standing: 90, cohortExternality: 90 },
      { commanderId: 'worst', standing: 10, cohortExternality: 10 },
    ]);
    expect(priorities.map((entry) => entry.commanderId)).toEqual([
      'worst',
      'dominant',
    ]);
    expect(priorities[0]?.purse).toBeGreaterThan(priorities[1]?.purse ?? 0);
  });

  it('uses cohort externalities and stable ids as priority tie-breakers', () => {
    const externalityOrder = draftPriority([
      { commanderId: 'a', standing: 50, cohortExternality: 10 },
      { commanderId: 'b', standing: 50, cohortExternality: 20 },
    ]);
    expect(externalityOrder[0]?.commanderId).toBe('a');
    const tied = draftPriority([
      { commanderId: 'b', standing: 50, cohortExternality: 10 },
      { commanderId: 'a', standing: 50, cohortExternality: 10 },
    ]);
    expect(tied.map((entry) => entry.commanderId)).toEqual(['a', 'b']);
    expect(Object.keys(tied[0] ?? {})).toEqual([
      'commanderId',
      'standing',
      'cohortExternality',
      'priorityScore',
      'priorityRank',
      'purse',
    ]);
  });

  it('keeps commendation identifiers out of the priority input', () => {
    const input = {
      commanderId: 'a',
      standing: 1,
      cohortExternality: 2,
    };
    expect(Object.keys(input)).toEqual([
      'commanderId',
      'standing',
      'cohortExternality',
    ]);
    expect(draftPriority([input])).toHaveLength(1);
  });

  it('uses served relationship reputation and unserved prior testimony', () => {
    const servedBadly = acceptanceDiscountPermille({
      relationshipAccount: credence(10),
      disposition: credence(90),
      rosterTestimony: 90,
    });
    const servedWell = acceptanceDiscountPermille({
      relationshipAccount: credence(90),
      disposition: credence(10),
      rosterTestimony: 10,
    });
    const unserved = acceptanceDiscountPermille({
      disposition: credence(60),
      rosterTestimony: 80,
    });
    expect(servedBadly).toBeLessThan(servedWell);
    expect(unserved).toBeGreaterThan(0);
    expect(acceptedPrice(100, servedBadly)).toBeGreaterThan(
      acceptedPrice(100, servedWell),
    );
  });

  it('wires each economy magnitude to a quantitative result', () => {
    const baseline = draftPriority([
      { commanderId: 'a', standing: 1, cohortExternality: 1 },
      { commanderId: 'b', standing: 2, cohortExternality: 2 },
    ]);
    const steeper = draftPriority(
      [
        { commanderId: 'a', standing: 1, cohortExternality: 1 },
        { commanderId: 'b', standing: 2, cohortExternality: 2 },
      ],
      { ...DRAFT_CONFIG, PURSE_SPREAD: DRAFT_CONFIG.PURSE_SPREAD + 20 },
    );
    expect(steeper[0]?.purse).not.toBe(baseline[0]?.purse);
    expect(
      acceptanceDiscountPermille(
        { disposition: credence(80), rosterTestimony: 80 },
        { ...DRAFT_CONFIG, ACCEPTANCE_DISCOUNT_PERMILLE: 800 },
      ),
    ).not.toBe(
      acceptanceDiscountPermille({
        disposition: credence(80),
        rosterTestimony: 80,
      }),
    );
    expect(
      carryPurse(100, { ...DRAFT_CONFIG, PURSE_CARRY_PERMILLE: 0 }),
    ).not.toBe(carryPurse(100));
    expect(
      carryPurse(100, { ...DRAFT_CONFIG, PURSE_CARRY_PERMILLE: 1000 }),
    ).toBe(100);
    expect(
      clearDraft(
        [{ lotId: 'lot', basePrice: 5 }],
        [
          {
            commanderId: 'a',
            priorityRank: 0,
            purse: 10,
            style: 'balanced',
            acceptanceDiscountPermille: 0,
          },
        ],
        { ...DRAFT_CONFIG, MINIMUM_BID: 10 },
      ).lots[0]?.minimumBid,
    ).toBe(10);
  });

  it('clears deterministically by bid and then reverse priority', () => {
    const clearing = clearDraft(
      [{ lotId: 'lot', basePrice: 10, minimumBid: 1 }],
      [
        {
          commanderId: 'later',
          priorityRank: 1,
          purse: 20,
          style: 'balanced',
          acceptanceDiscountPermille: 0,
        },
        {
          commanderId: 'first',
          priorityRank: 0,
          purse: 20,
          style: 'balanced',
          acceptanceDiscountPermille: 0,
        },
      ],
    );
    expect(clearing.lots[0]?.winnerId).toBe('first');
    expect(clearing.remainingPurses.first).toBe(10);
    expect(carryPurse(clearing.remainingPurses.later ?? 0)).toBe(10);
    const unfilled = clearDraft(
      [{ lotId: 'expensive', basePrice: 100, minimumBid: 20 }],
      [
        {
          commanderId: 'short',
          priorityRank: 0,
          purse: 10,
          style: 'balanced',
          acceptanceDiscountPermille: 0,
        },
      ],
    );
    expect(unfilled.lots[0]?.winnerId).toBeUndefined();
    expect(unfilled.lots[0]?.clearingPrice).toBe(0);
  });

  it('detects purse runaway and price collapse, with sample guards', () => {
    const purseRunaway = economyObservations({
      cycles: economyObservations().cycles.map((cycle) => ({
        ...cycle,
        winsByCommander: { a: 2 },
      })),
    });
    const collapse = economyObservations({
      cycles: economyObservations().cycles.map((cycle) => ({
        ...cycle,
        clearingPrices: [
          { clearingPrice: 1, minimumBid: 1 },
          { clearingPrice: 1, minimumBid: 1 },
        ],
      })),
    });
    expect(
      draftEconomyDegeneracyFindings(purseRunaway).map(
        (finding) => finding.code,
      ),
    ).toContain('purse-runaway');
    expect(
      draftEconomyDegeneracyFindings(collapse).map((finding) => finding.code),
    ).toContain('price-collapse');
    expect(
      draftEconomyDegeneracyFindings(collapse, {
        priceCollapseMinimumLots: 5,
      }),
    ).toEqual([]);
  });

  it('detects tanking dominance only across the configured number of cycles', () => {
    const dominant = economyObservations({
      standingSeries: [
        { policy: 'tanking', cycle: 1, standing: 3 },
        { policy: 'tanking', cycle: 2, standing: 4 },
        { policy: 'balanced', cycle: 1, standing: 2 },
        { policy: 'balanced', cycle: 2, standing: 3 },
      ],
    });
    expect(
      draftEconomyDegeneracyFindings(dominant).map((finding) => finding.code),
    ).toContain('tanking-dominance');
    expect(
      draftEconomyDegeneracyFindings(dominant, {
        tankingMinimumCycles: 3,
      }),
    ).toEqual([]);
    expect(
      draftEconomyDegeneracyFindings(economyObservations(), {
        minimumCycles: 3,
      }),
    ).toEqual([]);
  });

  it('stays silent on healthy economy observations', () => {
    expect(draftEconomyDegeneracyFindings(economyObservations())).toEqual([]);
    expect(
      draftEconomyDegeneracyFindings(economyObservations(), {
        purseRunawayFraction: 0.9,
      }),
    ).toEqual([]);
  });
});
