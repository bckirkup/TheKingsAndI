import type { CommanderPool } from './pool';
import type { RansomLedgerEntry } from './ransom';

export interface ExchangeHopeRealized {
  readonly kind: 'realized';
  readonly pieceId: string;
  readonly weeksHeld: number;
  readonly payer: 'commander' | 'split';
}

export interface ExchangeHopeSelfSprung {
  readonly kind: 'self_sprung';
  readonly pieceId: string;
  readonly weeksHeld: number;
  readonly tauBenev: number;
}

export interface ExchangeHopeExtinguished {
  readonly kind: 'extinguished';
  readonly pieceId: string;
  readonly weeksHeld: number;
  readonly reason: 'career_ended' | 'semester_closed';
  readonly tauBenev: number;
}

export interface ExchangeHopeOwnerResult {
  readonly realized: readonly ExchangeHopeRealized[];
  readonly selfSprung: readonly ExchangeHopeSelfSprung[];
  readonly extinguished: readonly ExchangeHopeExtinguished[];
}

export interface ExchangeHopeWeek {
  readonly ransomLedger: readonly RansomLedgerEntry[];
}

const EMPTY_RESULT: ExchangeHopeOwnerResult = {
  realized: [],
  selfSprung: [],
  extinguished: [],
};

function terminalTauBenev(
  pool: CommanderPool | undefined,
  pieceId: string,
): number {
  return (
    pool?.members.find((member) => member.state.id === pieceId)?.state.credence
      .tauBenev ?? 0
  );
}

function byPieceId(
  left: { readonly pieceId: string },
  right: { readonly pieceId: string },
): number {
  return left.pieceId.localeCompare(right.pieceId);
}

export function foldExchangeHope(
  weeks: readonly ExchangeHopeWeek[],
  finalPools: ReadonlyMap<string, CommanderPool>,
): Readonly<Record<string, ExchangeHopeOwnerResult>> {
  const byOwner = new Map<
    string,
    {
      readonly realized: ExchangeHopeRealized[];
      readonly selfSprung: ExchangeHopeSelfSprung[];
      readonly extinguished: ExchangeHopeExtinguished[];
    }
  >();
  const finalWeek = weeks.length;
  const ensureOwner = (ownerId: string) => {
    const existing = byOwner.get(ownerId);
    if (existing !== undefined) return existing;
    const created = {
      realized: [],
      selfSprung: [],
      extinguished: [],
    };
    byOwner.set(ownerId, created);
    return created;
  };

  for (const week of weeks) {
    for (const entry of week.ransomLedger) {
      if (entry.payer === 'commander' || entry.payer === 'split') {
        ensureOwner(entry.ownerId).realized.push({
          kind: 'realized',
          pieceId: entry.captiveId,
          weeksHeld: entry.weeksHeld,
          payer: entry.payer,
        });
        continue;
      }
      ensureOwner(entry.ownerId).selfSprung.push({
        kind: 'self_sprung',
        pieceId: entry.captiveId,
        weeksHeld: entry.weeksHeld,
        tauBenev: terminalTauBenev(
          finalPools.get(entry.ownerId),
          entry.captiveId,
        ),
      });
    }
  }

  for (const [ownerId, pool] of finalPools) {
    for (const member of pool.members) {
      if (member.heldBy === undefined) continue;
      const reason =
        member.retirementCause === undefined
          ? member.status === 'captive'
            ? 'semester_closed'
            : undefined
          : 'career_ended';
      if (reason === undefined) continue;
      ensureOwner(ownerId).extinguished.push({
        kind: 'extinguished',
        pieceId: member.state.id,
        weeksHeld: Math.max(0, finalWeek - (member.heldSinceWeek ?? finalWeek)),
        reason,
        tauBenev: member.state.credence.tauBenev,
      });
    }
  }

  return Object.fromEntries(
    [...byOwner.entries()].map(([ownerId, incidents]) => [
      ownerId,
      {
        realized: [...incidents.realized].sort(byPieceId),
        selfSprung: [...incidents.selfSprung].sort(byPieceId),
        extinguished: [...incidents.extinguished].sort(byPieceId),
      },
    ]),
  );
}

export { EMPTY_RESULT as EMPTY_EXCHANGE_HOPE };
