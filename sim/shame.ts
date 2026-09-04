import type { MatchEvent } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';

export interface SeminarShameWeek {
  readonly week: number;
  readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
}

export interface SeminarShameOwnerResult {
  readonly incidents: readonly {
    readonly pieceId: string;
    readonly ply: number;
    readonly witnesses: number;
    readonly shamePermille: number;
  }[];
}

const EMPTY: SeminarShameOwnerResult = { incidents: [] };

function incident(
  event: Extract<MatchEvent, { t: 'SHAME_EXPOSURE' }>,
): SeminarShameOwnerResult['incidents'][number] {
  return {
    pieceId: event.pieceId,
    ply: event.ply,
    witnesses: event.witnesses,
    shamePermille: event.shamePermille,
  };
}

export function foldSeminarShame(
  weeks: readonly SeminarShameWeek[],
): Readonly<Record<string, SeminarShameOwnerResult>> {
  const byOwner = new Map<
    string,
    SeminarShameOwnerResult['incidents'][number][]
  >();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const incidents = byOwner.get(ownerId) ?? [];
      for (const record of records) {
        for (const event of record.events) {
          if (event.t === 'SHAME_EXPOSURE') incidents.push(incident(event));
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
            left.pieceId.localeCompare(right.pieceId) ||
            left.ply - right.ply ||
            left.shamePermille - right.shamePermille,
        ),
      },
    ]),
  );
}

export { EMPTY as EMPTY_SEMINAR_SHAME };
