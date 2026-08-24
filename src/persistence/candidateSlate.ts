import type { LeaderId } from '../core/ids';
import type { PieceRole } from '../psychology';
import { foldPieceServiceRecords, type PieceServiceRecord } from './service';
import type {
  MatchRecord,
  PieceIdentityRecord,
  PieceStatus,
  StoredPieceState,
} from './types';

/**
 * The only candidate facts disclosed by the draft slate. Psychological state,
 * engine truth, and ability are deliberately absent from this type.
 */
export interface PublicCandidateSlateEntry {
  readonly id: string;
  readonly name: string;
  readonly originRole: PieceRole;
  readonly attainedRole?: PieceRole;
  readonly status: PieceStatus;
  readonly commandersServed: readonly LeaderId[];
  readonly serviceRecord: PieceServiceRecord;
}

export interface PublicCandidateSlate {
  readonly candidates: readonly PublicCandidateSlateEntry[];
}

export type PublicCandidateSlateInput = PublicCandidateSlateEntry;

/**
 * Fold public candidate facts without accepting a psychological or engine
 * state. Callers should provide commandersServed from persisted relationship
 * account keys, which are the existing record of service by commander.
 */
export function foldPublicCandidateSlate(
  candidates: readonly PublicCandidateSlateEntry[],
): PublicCandidateSlate {
  return {
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      originRole: candidate.originRole,
      ...(candidate.attainedRole === undefined
        ? {}
        : { attainedRole: candidate.attainedRole }),
      status: candidate.status,
      commandersServed: [...candidate.commandersServed].sort((left, right) =>
        left.localeCompare(right),
      ),
      serviceRecord: { ...candidate.serviceRecord },
    })),
  };
}

/**
 * Adapt persisted identities and lifecycle state to the narrow public fold.
 * Relationship-account keys are the only stored commander-service evidence;
 * no provenance or schema field is invented when that account is absent.
 */
export function publicCandidateSlateFromRecords(input: {
  readonly identities: readonly PieceIdentityRecord[];
  readonly roster: readonly StoredPieceState[];
  readonly matches: readonly MatchRecord[];
}): PublicCandidateSlate {
  const serviceRecords = foldPieceServiceRecords(input.matches).records;
  const statusById = new Map(
    input.roster.map((piece) => [piece.id, piece.status] as const),
  );
  const candidates = input.identities.flatMap((identity) => {
    const status = statusById.get(identity.id);
    if (status === undefined) return [];
    const serviceRecord = serviceRecords.get(identity.id);
    return [
      {
        id: identity.id,
        name: identity.name,
        originRole: identity.originRole,
        ...(identity.attainedRole === undefined
          ? {}
          : { attainedRole: identity.attainedRole }),
        status,
        commandersServed: Object.keys(
          identity.relationshipAccounts ?? {},
        ) as LeaderId[],
        serviceRecord: serviceRecord ?? emptyServiceRecord(),
      },
    ];
  });
  return foldPublicCandidateSlate(candidates);
}

function emptyServiceRecord(): PieceServiceRecord {
  return {
    matchesServed: 0,
    ordersCarriedOut: 0,
    ordersFatalistic: 0,
    ordersQuietlyQuit: 0,
    ordersRefused: 0,
    ordersOverridden: 0,
    capturesMade: 0,
    timesTaken: 0,
    timesCoveredComrade: 0,
    heroismNominations: 0,
    timesBenched: 0,
    timesFired: 0,
    timesRecruited: 0,
    promotions: 0,
    deserted: false,
    timesPassedOver: 0,
  };
}
