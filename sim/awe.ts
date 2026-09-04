import { ENGINE_CONFIG } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';

export interface SeminarAweOwnerResult {
  readonly heroes: readonly {
    readonly pieceId: string;
    readonly week: number;
    readonly nominations: number;
    readonly witnesses: number;
  }[];
}

export interface SeminarAweWeek {
  readonly week: number;
  readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
}

const EMPTY: SeminarAweOwnerResult = { heroes: [] };

export function foldSeminarAwe(
  weeks: readonly SeminarAweWeek[],
  floor: number = ENGINE_CONFIG.AWE_NOMINATION_FLOOR,
): Readonly<Record<string, SeminarAweOwnerResult>> {
  const threshold = Math.trunc(floor);
  if (threshold <= 0) return {};
  const byOwner = new Map<string, SeminarAweOwnerResult['heroes'][number][]>();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const heroes = byOwner.get(ownerId) ?? [];
      for (const record of records) {
        const nominations = new Map<string, number>();
        for (const event of record.events) {
          if (event.t !== 'HEROISM_NOMINATION') continue;
          nominations.set(
            event.pieceId,
            (nominations.get(event.pieceId) ?? 0) + 1,
          );
        }
        for (const [pieceId, count] of nominations) {
          if (count < threshold) continue;
          heroes.push({
            pieceId,
            week: week.week,
            nominations: count,
            witnesses: record.rosterSnapshot.length - 1,
          });
        }
      }
      byOwner.set(ownerId, heroes);
    }
  }
  return Object.fromEntries(
    [...byOwner.entries()].map(([ownerId, heroes]) => [
      ownerId,
      {
        heroes: [...heroes].sort(
          (left, right) =>
            left.week - right.week || left.pieceId.localeCompare(right.pieceId),
        ),
      },
    ]),
  );
}

export { EMPTY as EMPTY_SEMINAR_AWE };
