import { ENGINE_CONFIG } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';

export interface SeminarLonelinessOwnerResult {
  readonly lonely: readonly {
    readonly pieceId: string;
    readonly week: number;
    readonly lostPeers: readonly string[];
    readonly lostAffinity: number;
  }[];
}

export interface SeminarLonelinessWeek {
  readonly week: number;
  readonly records: Readonly<Record<string, readonly MatchRecord[]>>;
}

const EMPTY: SeminarLonelinessOwnerResult = { lonely: [] };

export function foldSeminarLoneliness(
  weeks: readonly SeminarLonelinessWeek[],
  threshold: number = ENGINE_CONFIG.LONELINESS_AFFINITY_THRESHOLD,
): Readonly<Record<string, SeminarLonelinessOwnerResult>> {
  const affinityThreshold = Math.trunc(threshold);
  if (affinityThreshold <= 0) return {};
  const byOwner = new Map<
    string,
    SeminarLonelinessOwnerResult['lonely'][number][]
  >();
  for (const week of weeks) {
    for (const [ownerId, records] of Object.entries(week.records)) {
      const lonely = byOwner.get(ownerId) ?? [];
      for (const record of records) {
        const fieldedIds = new Set(
          record.rosterSnapshot.map((piece) => piece.id),
        );
        const departed = new Set<string>();
        for (const event of record.events) {
          if (event.t === 'DESERTION') {
            departed.add(event.pieceId);
          } else if (event.t === 'CAPTURE' && fieldedIds.has(event.victim)) {
            departed.add(event.victim);
          }
        }
        const survivors = record.rosterEnd.filter(
          (piece) => !departed.has(piece.id),
        );
        for (const survivor of survivors) {
          const lostPeers = [...departed]
            .filter(
              (peerId) =>
                (survivor.dyadicAffinity[peerId] ?? 0) >= affinityThreshold,
            )
            .sort((left, right) => left.localeCompare(right));
          if (lostPeers.length === 0) continue;
          const survivorsAbove = survivors.filter(
            (peer) =>
              peer.id !== survivor.id &&
              (survivor.dyadicAffinity[peer.id] ?? 0) >= affinityThreshold,
          );
          if (survivorsAbove.length > 0) continue;
          lonely.push({
            pieceId: survivor.id,
            week: week.week,
            lostPeers,
            lostAffinity: lostPeers.reduce(
              (sum, peerId) => sum + (survivor.dyadicAffinity[peerId] ?? 0),
              0,
            ),
          });
        }
      }
      byOwner.set(ownerId, lonely);
    }
  }
  return Object.fromEntries(
    [...byOwner.entries()].map(([ownerId, lonely]) => [
      ownerId,
      {
        lonely: [...lonely].sort(
          (left, right) =>
            left.week - right.week || left.pieceId.localeCompare(right.pieceId),
        ),
      },
    ]),
  );
}

export { EMPTY as EMPTY_SEMINAR_LONELINESS };
