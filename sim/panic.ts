import type { MatchEvent } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';

export interface SeminarPanicWeek {
  readonly week: number;
  readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
}

export interface SeminarPanicOwnerResult {
  readonly incidents: readonly {
    readonly ply: number;
    readonly week: number;
    readonly trigger: 'dread' | 'king_danger';
    readonly dreading: number;
    readonly fielded: number;
  }[];
}

const EMPTY: SeminarPanicOwnerResult = { incidents: [] };

function incident(
  week: number,
  event: Extract<MatchEvent, { t: 'PANIC_ONSET' }>,
): SeminarPanicOwnerResult['incidents'][number] {
  return {
    ply: event.ply,
    week,
    trigger: event.trigger,
    dreading: event.dreading.length,
    fielded: event.fielded,
  };
}

export function foldSeminarPanic(
  weeks: readonly SeminarPanicWeek[],
): Readonly<Record<string, SeminarPanicOwnerResult>> {
  const byOwner = new Map<
    string,
    SeminarPanicOwnerResult['incidents'][number][]
  >();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const incidents = byOwner.get(ownerId) ?? [];
      for (const record of records) {
        for (const event of record.events) {
          if (event.t === 'PANIC_ONSET')
            incidents.push(incident(week.week, event));
        }
      }
      byOwner.set(ownerId, incidents);
    }
  }
  return Object.fromEntries(
    [...byOwner.entries()].map(([ownerId, incidents]) => [
      ownerId,
      {
        incidents: [...incidents].sort(
          (left, right) =>
            left.week - right.week ||
            left.ply - right.ply ||
            left.trigger.localeCompare(right.trigger),
        ),
      },
    ]),
  );
}

export { EMPTY as EMPTY_SEMINAR_PANIC };
