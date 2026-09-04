import type { MatchEvent } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';

export interface SeminarReliefOwnerResult {
  readonly incidents: readonly {
    readonly pieceId: string;
    readonly week: number;
    readonly ply: number;
    readonly priorRiskPermille: number;
    readonly riskPermille: number;
  }[];
}

export interface SeminarReliefWeek {
  readonly week: number;
  readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
}

const EMPTY: SeminarReliefOwnerResult = { incidents: [] };

function incident(
  week: number,
  event: Extract<MatchEvent, { t: 'RELIEF' }>,
): SeminarReliefOwnerResult['incidents'][number] {
  return {
    pieceId: event.pieceId,
    week,
    ply: event.ply,
    priorRiskPermille: event.priorRiskPermille,
    riskPermille: event.riskPermille,
  };
}

export function foldSeminarRelief(
  weeks: readonly SeminarReliefWeek[],
): Readonly<Record<string, SeminarReliefOwnerResult>> {
  const byOwner = new Map<
    string,
    SeminarReliefOwnerResult['incidents'][number][]
  >();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const incidents = byOwner.get(ownerId) ?? [];
      for (const record of records) {
        for (const event of record.events) {
          if (event.t === 'RELIEF') incidents.push(incident(week.week, event));
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
            left.pieceId.localeCompare(right.pieceId),
        ),
      },
    ]),
  );
}

export { EMPTY as EMPTY_SEMINAR_RELIEF };
