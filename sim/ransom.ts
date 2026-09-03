import {
  acceptedPrice,
  acceptanceDiscountPermille,
  type DraftPriority,
} from '../src/core/draftEconomy';
import { publicRoleValue } from '../src/persistence/register';
import { clampCredence, type CredenceState } from '../src/psychology';
import type { CommanderPool } from './pool';
import { publicLotBasePrice } from './seminarDraft';
import type { SeminarConfig } from './seminarConfig';

const ROSTER_TESTIMONY = 50;

export type RansomPayer = 'commander' | 'split' | 'self';

export interface RansomLedgerEntry {
  /** A fengr is the captive held as the captor's prize. */
  readonly captiveId: string;
  readonly ownerId: string;
  readonly heldBy: string;
  readonly weeksHeld: number;
  readonly price: number;
  readonly payer: RansomPayer;
  readonly commanderAmount: number;
  readonly pieceAmount: number;
}

export interface RansomResult {
  readonly pools: ReadonlyMap<string, CommanderPool>;
  readonly purses: ReadonlyMap<string, number>;
  readonly ledger: readonly RansomLedgerEntry[];
}

function acceptancePriceForCaptive(
  member: CommanderPool['members'][number],
  ownerId: string,
  config: SeminarConfig,
): number {
  const relationshipAccount =
    member.credenceIdentity?.relationshipAccounts?.[ownerId];
  const discount = acceptanceDiscountPermille({
    ...(relationshipAccount === undefined ? {} : { relationshipAccount }),
    disposition: member.state.credence,
    rosterTestimony: ROSTER_TESTIMONY,
  });
  return acceptedPrice(publicLotBasePrice(member, config), discount);
}

function replaceMember(
  pools: ReadonlyMap<string, CommanderPool>,
  ownerId: string,
  pieceId: string,
  update: (
    member: CommanderPool['members'][number],
  ) => CommanderPool['members'][number],
): Map<string, CommanderPool> {
  const next = new Map(pools);
  const pool = next.get(ownerId);
  if (pool === undefined) return next;
  next.set(ownerId, {
    ...pool,
    members: pool.members.map((member) =>
      member.state.id === pieceId ? update(member) : member,
    ),
  });
  return next;
}

function captiveCandidates(
  pools: ReadonlyMap<string, CommanderPool>,
  ownerId?: string,
): {
  readonly ownerId: string;
  readonly member: CommanderPool['members'][number];
}[] {
  return [...pools.entries()].flatMap(([candidateOwnerId, pool]) =>
    ownerId !== undefined && candidateOwnerId !== ownerId
      ? []
      : pool.members
          .filter(
            (member) =>
              member.status === 'captive' ||
              (member.status === 'retired' && member.heldBy !== undefined),
          )
          .map((member) => ({ ownerId: candidateOwnerId, member })),
  );
}

function compareCaptives(
  left: {
    readonly member: CommanderPool['members'][number];
  },
  right: {
    readonly member: CommanderPool['members'][number];
  },
): number {
  return (
    (left.member.heldSinceWeek ?? 0) - (right.member.heldSinceWeek ?? 0) ||
    publicRoleValue(right.member.state.role) -
      publicRoleValue(left.member.state.role) ||
    left.member.state.id.localeCompare(right.member.state.id)
  );
}

function redeem(
  pools: ReadonlyMap<string, CommanderPool>,
  ownerId: string,
  member: CommanderPool['members'][number],
  firstMatch: number,
  pieceAmount: number,
): Map<string, CommanderPool> {
  return replaceMember(pools, ownerId, member.state.id, (current) => ({
    ...(() => {
      const { heldBy, heldSinceWeek, ...withoutHold } = current;
      void heldBy;
      void heldSinceWeek;
      return withoutHold;
    })(),
    status: 'available',
    availableAtMatch: firstMatch,
    state: {
      ...current.state,
      cash: Math.max(0, Math.trunc(current.state.cash ?? 0) - pieceAmount),
    },
  }));
}

export function decayCaptiveBenevolence(
  pools: ReadonlyMap<string, CommanderPool>,
  decayPerWeek: number,
): ReadonlyMap<string, CommanderPool> {
  const decay = Math.max(0, Math.trunc(decayPerWeek));
  if (decay === 0) return pools;
  return new Map(
    [...pools.entries()].map(([id, pool]) => [
      id,
      {
        ...pool,
        members: pool.members.map((member) =>
          member.heldBy === undefined
            ? member
            : {
                ...member,
                state: {
                  ...member.state,
                  credence: {
                    ...member.state.credence,
                    tauBenev: clampCredence(
                      member.state.credence.tauBenev - decay,
                    ),
                  } satisfies CredenceState,
                },
              },
        ),
      },
    ]),
  );
}

export function ransomCaptives(input: {
  readonly pools: ReadonlyMap<string, CommanderPool>;
  readonly purses: ReadonlyMap<string, number>;
  readonly priorities: readonly DraftPriority[];
  readonly week: number;
  readonly firstMatch: number;
  readonly config: SeminarConfig;
}): RansomResult {
  let pools = new Map(input.pools);
  const purses = new Map(
    [...input.purses.entries()].map(([id, purse]) => [
      id,
      Math.max(0, Math.trunc(purse)),
    ]),
  );
  const ledger: RansomLedgerEntry[] = [];
  const redeemOne = (
    ownerId: string,
    candidate: {
      readonly ownerId: string;
      readonly member: CommanderPool['members'][number];
    },
    payer: RansomPayer,
    commanderAmount: number,
    pieceAmount: number,
    price: number,
  ): void => {
    pools = redeem(
      pools,
      ownerId,
      candidate.member,
      input.firstMatch,
      pieceAmount,
    );
    const captor = candidate.member.heldBy;
    if (captor !== undefined) {
      purses.set(captor, (purses.get(captor) ?? 0) + price);
    }
    ledger.push({
      captiveId: candidate.member.state.id,
      ownerId,
      heldBy: captor ?? '',
      weeksHeld: Math.max(
        0,
        input.week - (candidate.member.heldSinceWeek ?? input.week),
      ),
      price,
      payer,
      commanderAmount,
      pieceAmount,
    });
  };

  for (const priority of input.priorities) {
    const ownerId = priority.commanderId;
    const candidates = [...captiveCandidates(pools, ownerId)].sort(
      compareCaptives,
    );
    for (const candidate of candidates) {
      if (candidate.member.retirementCause !== undefined) continue;
      const price = acceptancePriceForCaptive(
        candidate.member,
        ownerId,
        input.config,
      );
      const purse = purses.get(ownerId) ?? 0;
      const commanderAmount = Math.min(purse, price);
      const remaining = price - commanderAmount;
      const cash = Math.max(0, Math.trunc(candidate.member.state.cash ?? 0));
      if (remaining > cash) continue;
      purses.set(ownerId, purse - commanderAmount);
      redeemOne(
        ownerId,
        candidate,
        remaining === 0 ? 'commander' : 'split',
        commanderAmount,
        remaining,
        price,
      );
    }
  }

  for (const candidate of [...captiveCandidates(pools)].sort(compareCaptives)) {
    if (candidate.member.retirementCause !== undefined) continue;
    const price = acceptancePriceForCaptive(
      candidate.member,
      candidate.ownerId,
      input.config,
    );
    const cash = Math.max(0, Math.trunc(candidate.member.state.cash ?? 0));
    if (cash < price) continue;
    redeemOne(candidate.ownerId, candidate, 'self', 0, price, price);
  }
  return { pools, purses, ledger };
}
