import { createSeededRandom } from '../core/random';

import { foldMatchAudit } from './folds';
import {
  DETERMINISM_ID,
  PSYCH_CONFIG_VERSION,
  SCHEMA_VERSION,
  type MatchRecord,
  type StoredPieceState,
} from './types';

export function deterministicId(
  prefix: string,
  seed: number,
  counter: number,
): string {
  const rng = createSeededRandom(seed ^ (counter * 0x9e3779b9));
  return `${prefix}-${rng.nextUint32().toString(16)}`;
}

function meanTrust(roster: readonly StoredPieceState[]): number {
  if (roster.length === 0) return 0;
  return roster.reduce((sum, piece) => sum + piece.T_i, 0) / roster.length;
}

export interface MatchRecordAssemblyInput {
  readonly campaignId: string;
  readonly actId: string;
  readonly matchIndex: number;
  readonly seed: number;
  readonly rosterSnapshot: readonly StoredPieceState[];
  readonly rosterEnd: readonly StoredPieceState[];
  readonly events: MatchRecord['events'];
  readonly engineAudit?: MatchRecord['engineAudit'];
  readonly result: MatchRecord['result'];
}

/** Assemble the canonical persisted match record without performing I/O. */
export function assembleMatchRecord(
  input: MatchRecordAssemblyInput,
): MatchRecord {
  const matchId = deterministicId(
    'match',
    input.seed,
    input.matchIndex * 1_000_003,
  );
  const audit = foldMatchAudit(
    input.events,
    meanTrust(input.rosterSnapshot),
    meanTrust(input.rosterEnd),
    new Set(input.rosterSnapshot.map((piece) => piece.id)),
  );
  return {
    id: matchId,
    campaignId: input.campaignId,
    actId: input.actId,
    matchIndex: input.matchIndex,
    seed: input.seed,
    rosterSnapshot: input.rosterSnapshot,
    rosterEnd: input.rosterEnd,
    events: input.events,
    engineAudit: input.engineAudit ?? [],
    result: input.result,
    audit,
    determinismId: DETERMINISM_ID,
    psychConfigVersion: PSYCH_CONFIG_VERSION,
    schemaVersion: SCHEMA_VERSION,
  };
}
