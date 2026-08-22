import Dexie, { type Table } from 'dexie';

import type {
  ActRecord,
  CampaignRecord,
  CareerRecord,
  MatchRecord,
  PieceIdentityRecord,
  StoredPieceState,
} from './types';

export class LivingChessDatabase extends Dexie {
  careers!: Table<CareerRecord, string>;
  acts!: Table<ActRecord, string>;
  campaigns!: Table<CampaignRecord, string>;
  matches!: Table<MatchRecord, string>;
  pieceIdentities!: Table<PieceIdentityRecord, string>;
  pieceStates!: Table<StoredPieceState, string>;
  settings!: Table<{ readonly key: string; readonly value: string }, string>;

  constructor(name = 'living-chess') {
    super(name);
    this.version(1).stores({
      careers: 'id, createdAt',
      acts: 'id, careerId',
      campaigns: 'id, actId',
      matches: 'id, campaignId, actId, schemaVersion',
      pieceIdentities: 'id',
      pieceStates: 'id, status',
      settings: 'key',
    });
    this.version(2).stores({
      careers: 'id, createdAt',
      acts: 'id, careerId',
      campaigns: 'id, actId',
      matches: 'id, campaignId, actId, schemaVersion',
      pieceIdentities: 'id',
      pieceStates: 'id, status',
      settings: 'key',
    });
  }
}

let sharedDb: LivingChessDatabase | undefined;

export function getDatabase(name?: string): LivingChessDatabase {
  sharedDb ??= new LivingChessDatabase(name);
  return sharedDb;
}

export function resetDatabaseForTests(name?: string): LivingChessDatabase {
  sharedDb = new LivingChessDatabase(name ?? `living-chess-test-${Date.now()}`);
  return sharedDb;
}
