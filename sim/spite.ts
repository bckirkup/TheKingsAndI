import {
  foldSpite,
  type MatchEvent,
  type SpiteIncident,
} from '../src/psychology';
import type { MatchRecord } from '../src/persistence';

export interface SeminarSpiteIncident extends SpiteIncident {
  readonly week: number;
  readonly match: number;
}

function fieldedPieceIds(match: MatchRecord): readonly string[] {
  const fielding = match.events.filter(
    (event): event is Extract<MatchEvent, { t: 'SQUAD_FIELDING' }> =>
      event.t === 'SQUAD_FIELDING' && event.side === 'w',
  );
  if (fielding.length > 0) {
    return fielding
      .filter((event) => event.decision === 'fielded')
      .map((event) => event.pieceId);
  }
  return match.rosterSnapshot
    .filter((piece) => piece.status === 'ACTIVE')
    .map((piece) => piece.id);
}

export function foldSeminarSpite(
  weeks: readonly {
    readonly week: number;
    readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
  }[],
): Readonly<Record<string, readonly SeminarSpiteIncident[]>> {
  const byOwner = new Map<string, SeminarSpiteIncident[]>();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const incidents = byOwner.get(ownerId) ?? [];
      for (const record of records) {
        const folded = foldSpite(record.events, fieldedPieceIds(record));
        incidents.push(
          ...folded.incidents.map((incident) => ({
            ...incident,
            week: week.week,
            match: record.matchIndex,
          })),
        );
      }
      byOwner.set(ownerId, incidents);
    }
  }
  return Object.fromEntries(
    [...byOwner.entries()].map(([ownerId, incidents]) => [
      ownerId,
      incidents.sort(
        (left, right) =>
          left.pieceId.localeCompare(right.pieceId) ||
          left.week - right.week ||
          left.match - right.match ||
          left.ply - right.ply,
      ),
    ]),
  );
}
