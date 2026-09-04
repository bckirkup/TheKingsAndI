import type { MatchEvent } from '../src/psychology';
import type { MatchRecord } from '../src/persistence';
import type { CommanderPool } from './pool';

export interface BitternessIncident {
  readonly pieceId: string;
  readonly trigger: 'rupture_floor' | 'not_ransomed';
  readonly bitternessPermille: number;
  readonly ply?: number;
  readonly week?: number;
  readonly match?: number;
}

export interface SeminarBitternessWeek {
  readonly week: number;
  readonly bitternessEvents: readonly Extract<
    MatchEvent,
    { t: 'BITTERNESS_FORMED' }
  >[];
}

function incidentFromEvent(
  event: Extract<MatchEvent, { t: 'BITTERNESS_FORMED' }>,
  extra: { readonly match?: number; readonly week?: number } = {},
): BitternessIncident {
  return {
    pieceId: event.pieceId,
    trigger: event.trigger,
    bitternessPermille: event.bitternessPermille,
    ...(event.ply === undefined ? {} : { ply: event.ply }),
    ...(event.week === undefined ? {} : { week: event.week }),
    ...(extra.match === undefined ? {} : { match: extra.match }),
    ...(extra.week === undefined ? {} : { week: extra.week }),
  };
}

export function foldCampaignBitterness(
  matches: readonly MatchRecord[],
): readonly BitternessIncident[] {
  return matches.flatMap((match) =>
    match.events
      .filter(
        (event): event is Extract<MatchEvent, { t: 'BITTERNESS_FORMED' }> =>
          event.t === 'BITTERNESS_FORMED',
      )
      .map((event) => incidentFromEvent(event, { match: match.matchIndex })),
  );
}

export function foldSeminarBitterness(
  weeks: readonly SeminarBitternessWeek[],
  finalPools: ReadonlyMap<string, CommanderPool>,
): Readonly<Record<string, readonly BitternessIncident[]>> {
  const ownerByPiece = new Map<string, string>();
  for (const [ownerId, pool] of finalPools) {
    for (const member of pool.members)
      ownerByPiece.set(member.state.id, ownerId);
  }
  const byOwner = new Map<string, BitternessIncident[]>();
  for (const week of weeks) {
    for (const event of week.bitternessEvents) {
      const ownerId = ownerByPiece.get(event.pieceId);
      if (ownerId === undefined) continue;
      const incidents = byOwner.get(ownerId) ?? [];
      incidents.push(incidentFromEvent(event, { week: week.week }));
      byOwner.set(ownerId, incidents);
    }
  }
  return Object.fromEntries(
    [...byOwner.entries()].map(([pieceId, incidents]) => [
      pieceId,
      incidents.sort(
        (left, right) =>
          left.pieceId.localeCompare(right.pieceId) ||
          (left.week ?? 0) - (right.week ?? 0) ||
          (left.ply ?? 0) - (right.ply ?? 0),
      ),
    ]),
  );
}
