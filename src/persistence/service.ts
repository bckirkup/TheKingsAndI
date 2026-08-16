import { SERVICE_RECORD_FOLD_VERSION, type MatchRecord } from './types';

export interface PieceServiceRecord {
  readonly matchesServed: number;
  readonly ordersCarriedOut: number;
  readonly ordersRefused: number;
  readonly ordersOverridden: number;
  readonly capturesMade: number;
  readonly timesTaken: number;
  readonly timesCoveredComrade: number;
  readonly heroismNominations: number;
  readonly timesBenched: number;
  readonly timesFired: number;
  readonly timesRecruited: number;
  readonly deserted: boolean;
}

export interface PieceServiceRecordSet {
  readonly foldVersion: typeof SERVICE_RECORD_FOLD_VERSION;
  readonly records: ReadonlyMap<string, PieceServiceRecord>;
}

function emptyRecord(): PieceServiceRecord {
  return {
    matchesServed: 0,
    ordersCarriedOut: 0,
    ordersRefused: 0,
    ordersOverridden: 0,
    capturesMade: 0,
    timesTaken: 0,
    timesCoveredComrade: 0,
    heroismNominations: 0,
    timesBenched: 0,
    timesFired: 0,
    timesRecruited: 0,
    deserted: false,
  };
}

/**
 * Fold observable service from campaign match logs (ADR 0054 slice 1).
 * The roster snapshots define which pieces belong to this campaign; event
 * records provide the witnessed deeds and actions.
 */
export function foldPieceServiceRecords(
  matches: readonly MatchRecord[],
): PieceServiceRecordSet {
  const records = new Map<string, PieceServiceRecord>();
  for (const match of matches) {
    for (const piece of match.rosterSnapshot) {
      if (!records.has(piece.id)) records.set(piece.id, emptyRecord());
      const current = records.get(piece.id);
      if (current === undefined) continue;
      records.set(piece.id, {
        ...current,
        matchesServed: current.matchesServed + 1,
      });
    }

    for (const event of match.events) {
      const update = (
        pieceId: string,
        change: (record: PieceServiceRecord) => PieceServiceRecord,
      ): void => {
        const current = records.get(pieceId);
        if (current !== undefined) records.set(pieceId, change(current));
      };

      if (event.t === 'CAPTURE') {
        update(event.by, (record) => ({
          ...record,
          capturesMade: record.capturesMade + 1,
        }));
        update(event.victim, (record) => ({
          ...record,
          timesTaken: record.timesTaken + 1,
        }));
        continue;
      }

      const pieceId =
        'pieceId' in event
          ? event.pieceId
          : event.t === 'SACRIFICE_WITNESSED'
            ? event.hero
            : undefined;
      if (pieceId === undefined || !records.has(pieceId)) continue;

      switch (event.t) {
        case 'MOVE':
          update(pieceId, (record) => ({
            ...record,
            ordersCarriedOut: record.ordersCarriedOut + 1,
          }));
          break;
        case 'REFUSAL':
          update(pieceId, (record) => ({
            ...record,
            ordersRefused: record.ordersRefused + 1,
          }));
          break;
        case 'OVERRIDE':
          update(pieceId, (record) => ({
            ...record,
            ordersOverridden: record.ordersOverridden + 1,
          }));
          break;
        case 'SACRIFICE_WITNESSED':
          update(pieceId, (record) => ({
            ...record,
            timesCoveredComrade: record.timesCoveredComrade + 1,
          }));
          break;
        case 'ROSTER_BENCH':
          update(pieceId, (record) => ({
            ...record,
            timesBenched: record.timesBenched + 1,
          }));
          break;
        case 'ROSTER_FIRE':
          update(pieceId, (record) => ({
            ...record,
            timesFired: record.timesFired + 1,
          }));
          break;
        case 'ROSTER_RECRUIT':
          update(pieceId, (record) => ({
            ...record,
            timesRecruited: record.timesRecruited + 1,
          }));
          break;
        case 'DESERTION':
          update(pieceId, (record) => ({ ...record, deserted: true }));
          break;
        case 'HEROISM_NOMINATION':
          update(pieceId, (record) => ({
            ...record,
            heroismNominations: record.heroismNominations + 1,
          }));
          break;
        default:
          break;
      }
    }
  }
  return {
    foldVersion: SERVICE_RECORD_FOLD_VERSION,
    records,
  };
}
