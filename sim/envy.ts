import { ENGINE_CONFIG, type PieceRole } from '../src/psychology';
import type { DraftSettlement } from './seminarDraft';

export interface EnvyIncident {
  readonly cycle: number;
  readonly pieceId: string;
  readonly role: PieceRole;
  readonly clearingPrice: number;
  readonly peerId: string;
  readonly peerClearingPrice: number;
  readonly gap: number;
}

export function foldEnvy(
  cycles: readonly {
    readonly cycle: number;
    readonly settlements: readonly DraftSettlement[];
  }[],
  floor: number = ENGINE_CONFIG.ENVY_PRICE_GAP_FLOOR,
): Readonly<Record<string, readonly EnvyIncident[]>> {
  const threshold = Math.trunc(floor);
  if (threshold <= 0) return {};

  const byOwner = new Map<string, EnvyIncident[]>();
  for (const cycle of cycles) {
    const groups = new Map<string, DraftSettlement[]>();
    for (const settlement of cycle.settlements) {
      const key = `${settlement.ownerId}\u0000${settlement.role}`;
      const group = groups.get(key) ?? [];
      group.push(settlement);
      groups.set(key, group);
    }
    for (const settlement of cycle.settlements) {
      const key = `${settlement.ownerId}\u0000${settlement.role}`;
      const peer = (groups.get(key) ?? [])
        .filter(
          (candidate) => candidate.clearingPrice > settlement.clearingPrice,
        )
        .sort(
          (left, right) =>
            right.clearingPrice - left.clearingPrice ||
            left.pieceId.localeCompare(right.pieceId),
        )[0];
      if (peer === undefined) continue;
      const gap = peer.clearingPrice - settlement.clearingPrice;
      if (gap < threshold) continue;
      const incident: EnvyIncident = {
        cycle: cycle.cycle,
        pieceId: settlement.pieceId,
        role: settlement.role,
        clearingPrice: settlement.clearingPrice,
        peerId: peer.pieceId,
        peerClearingPrice: peer.clearingPrice,
        gap,
      };
      const incidents = byOwner.get(settlement.ownerId) ?? [];
      incidents.push(incident);
      byOwner.set(settlement.ownerId, incidents);
    }
  }

  return Object.fromEntries(
    [...byOwner.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ownerId, incidents]) => [
        ownerId,
        incidents.sort(
          (left, right) =>
            left.cycle - right.cycle ||
            left.pieceId.localeCompare(right.pieceId) ||
            left.peerId.localeCompare(right.peerId),
        ),
      ]),
  );
}
