import type { MatchEvent } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';

export interface SeminarGriefWeek {
  readonly week: number;
  readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
}

export interface SeminarGriefOwnerResult {
  readonly incidents: readonly {
    readonly pieceId: string;
    readonly mournedId: string;
    readonly cause: 'captured' | 'deserted' | 'career_ended';
    readonly weekOrMatch: number;
  }[];
}

const EMPTY: SeminarGriefOwnerResult = { incidents: [] };

function eventIncident(
  event: Extract<MatchEvent, { t: 'GRIEF_MOURNING' }>,
): SeminarGriefOwnerResult['incidents'][number] {
  return {
    pieceId: event.pieceId,
    mournedId: event.mournedId,
    cause: event.cause,
    weekOrMatch: event.weekOrMatch,
  };
}

export function foldSeminarGrief(
  weeks: readonly SeminarGriefWeek[],
): Readonly<Record<string, SeminarGriefOwnerResult>> {
  const byOwner = new Map<
    string,
    { incidents: SeminarGriefOwnerResult['incidents'][number][] }
  >();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const incidents = byOwner.get(ownerId) ?? { incidents: [] };
      for (const record of records) {
        for (const event of record.events) {
          if (event.t === 'GRIEF_MOURNING') {
            incidents.incidents.push(eventIncident(event));
            continue;
          }
        }
      }
      byOwner.set(ownerId, incidents);
    }
  }
  return Object.fromEntries(
    [...byOwner.entries()].map(([ownerId, result]) => [
      ownerId,
      {
        incidents: [...result.incidents].sort(
          (left, right) =>
            left.pieceId.localeCompare(right.pieceId) ||
            left.weekOrMatch - right.weekOrMatch ||
            left.mournedId.localeCompare(right.mournedId),
        ),
      },
    ]),
  );
}

export { EMPTY as EMPTY_SEMINAR_GRIEF };
