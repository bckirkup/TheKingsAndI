import { foldGuilt, type GuiltIncident } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';
import { fieldedPieceIds } from './spite';

export type SeminarGuiltIncident = GuiltIncident & {
  readonly week: number;
  readonly match: number;
};

export function foldSeminarGuilt(
  weeks: readonly {
    readonly week: number;
    readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
  }[],
): Readonly<Record<string, readonly SeminarGuiltIncident[]>> {
  const byOwner = new Map<string, SeminarGuiltIncident[]>();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const incidents = byOwner.get(ownerId) ?? [];
      for (const record of records) {
        const folded = foldGuilt(record.events, fieldedPieceIds(record));
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
          left.ply - right.ply ||
          left.kind.localeCompare(right.kind) ||
          (left.kind === 'survivor' ? left.peerId : '').localeCompare(
            right.kind === 'survivor' ? right.peerId : '',
          ) ||
          left.week - right.week ||
          left.match - right.match,
      ),
    ]),
  );
}
