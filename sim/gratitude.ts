import type { MatchRecord } from '../src/persistence';
import type { MatchEvent } from '../src/psychology';
import type { RansomLedgerEntry } from './ransom';

export interface GratitudeFormed {
  readonly kind: 'formed';
  readonly pieceId: string;
  readonly week: number;
  readonly magnitude: number;
}

export interface GratitudeHonored {
  readonly kind: 'honored';
  readonly pieceId: string;
  readonly week: number;
  readonly magnitude: number;
  readonly ply: number;
}

export interface GratitudeVoided {
  readonly kind: 'voided';
  readonly pieceId: string;
  readonly week: number;
  readonly magnitude: number;
}

export interface GratitudeOwed {
  readonly kind: 'owed';
  readonly pieceId: string;
  readonly week: number;
  readonly magnitude: number;
}

export interface GratitudeOwnerResult {
  readonly formed: readonly GratitudeFormed[];
  readonly honored: readonly GratitudeHonored[];
  readonly voided: readonly GratitudeVoided[];
  readonly owed: readonly GratitudeOwed[];
}

export interface GratitudeWeek {
  readonly week: number;
  /** First match after the prior week's matches, used as the terminal boundary. */
  readonly firstMatch: number;
  readonly ransomLedger: readonly RansomLedgerEntry[];
}

const EMPTY_GRATITUDE: GratitudeOwnerResult = {
  formed: [],
  honored: [],
  voided: [],
  owed: [],
};

interface IndexedEvent {
  readonly matchIndex: number;
  readonly eventIndex: number;
  readonly event: MatchEvent;
}

interface GratitudeDebt {
  readonly ownerId: string;
  readonly pieceId: string;
  readonly week: number;
  readonly magnitude: number;
  readonly afterMatch: number;
}

function eventPly(event: MatchEvent): number {
  return 'ply' in event ? event.ply : 0;
}

function byPieceThenWeek(
  left: { readonly pieceId: string; readonly week: number },
  right: { readonly pieceId: string; readonly week: number },
): number {
  return left.pieceId.localeCompare(right.pieceId) || left.week - right.week;
}

function indexedEventsAfter(
  records: readonly MatchRecord[],
  pieceId: string,
  afterMatch: number,
): readonly IndexedEvent[] {
  return records
    .filter((record) => record.matchIndex >= afterMatch)
    .flatMap((record) =>
      record.events.map((event, eventIndex) => ({
        matchIndex: record.matchIndex,
        eventIndex,
        event,
      })),
    )
    .filter(
      ({ event }) =>
        (event.t === 'MOVE' &&
          event.pieceId === pieceId &&
          event.courage !== undefined &&
          event.courage.margin > 0) ||
        (event.t === 'OVERRIDE' &&
          event.pieceId === pieceId &&
          event.vindicated !== true),
    )
    .sort(
      (left, right) =>
        left.matchIndex - right.matchIndex ||
        eventPly(left.event) - eventPly(right.event) ||
        left.eventIndex - right.eventIndex,
    );
}

export function foldGratitude(
  weeks: readonly GratitudeWeek[],
  recordsByCommander: ReadonlyMap<string, readonly MatchRecord[]>,
): Readonly<Record<string, GratitudeOwnerResult>> {
  const debtsByOwner = new Map<string, GratitudeDebt[]>();
  const ensureOwner = (ownerId: string): GratitudeDebt[] => {
    const existing = debtsByOwner.get(ownerId);
    if (existing !== undefined) return existing;
    const created: GratitudeDebt[] = [];
    debtsByOwner.set(ownerId, created);
    return created;
  };

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const week = weeks[weekIndex];
    if (week === undefined) continue;
    const afterMatch =
      weeks[weekIndex + 1]?.firstMatch ?? Number.MAX_SAFE_INTEGER;
    for (const entry of week.ransomLedger) {
      if (entry.payer === 'self') continue;
      ensureOwner(entry.ownerId).push({
        ownerId: entry.ownerId,
        pieceId: entry.captiveId,
        week: week.week,
        magnitude: entry.commanderAmount,
        afterMatch,
      });
    }
  }

  const result = new Map<string, GratitudeOwnerResult>();
  for (const [ownerId, debts] of debtsByOwner) {
    const records = recordsByCommander.get(ownerId) ?? [];
    const consumedEvents = new Set<string>();
    const formed: GratitudeFormed[] = [];
    const honored: GratitudeHonored[] = [];
    const voided: GratitudeVoided[] = [];
    const owed: GratitudeOwed[] = [];
    for (const debt of debts) {
      formed.push({
        kind: 'formed',
        pieceId: debt.pieceId,
        week: debt.week,
        magnitude: debt.magnitude,
      });
      const candidate = indexedEventsAfter(
        records,
        debt.pieceId,
        debt.afterMatch,
      ).find((indexed) => {
        const key = `${indexed.matchIndex}:${indexed.eventIndex}`;
        return !consumedEvents.has(key);
      });
      if (candidate === undefined) {
        owed.push({
          kind: 'owed',
          pieceId: debt.pieceId,
          week: debt.week,
          magnitude: debt.magnitude,
        });
        continue;
      }
      const eventKey = `${candidate.matchIndex}:${candidate.eventIndex}`;
      consumedEvents.add(eventKey);
      if (candidate.event.t === 'MOVE') {
        honored.push({
          kind: 'honored',
          pieceId: debt.pieceId,
          week: debt.week,
          magnitude: debt.magnitude,
          ply: candidate.event.ply,
        });
      } else {
        voided.push({
          kind: 'voided',
          pieceId: debt.pieceId,
          week: debt.week,
          magnitude: debt.magnitude,
        });
      }
    }
    result.set(ownerId, {
      formed: formed.sort(byPieceThenWeek),
      honored: honored.sort(byPieceThenWeek),
      voided: voided.sort(byPieceThenWeek),
      owed: owed.sort(byPieceThenWeek),
    });
  }
  return Object.fromEntries(result);
}

export { EMPTY_GRATITUDE };
