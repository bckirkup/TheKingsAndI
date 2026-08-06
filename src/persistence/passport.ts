import { digest } from '../core/digest';

import type {
  PieceIdentityRecord,
  PiecePassport,
  StoredPieceState,
} from './types';
import { PASSPORT_VERSION } from './types';

export function exportPiecePassport(input: {
  readonly piece: StoredPieceState;
  readonly identity: PieceIdentityRecord;
  readonly provenance?: readonly string[];
}): PiecePassport {
  const payload = {
    version: PASSPORT_VERSION,
    piece: input.piece,
    identity: input.identity,
    provenance: input.provenance ?? [],
  };
  return {
    ...payload,
    contentDigest: digest(payload),
  };
}

export function importPiecePassport(
  passport: PiecePassport,
): {
  readonly piece: StoredPieceState;
  readonly identity: PieceIdentityRecord;
} | null {
  const { contentDigest, ...payload } = passport;
  void contentDigest;
  if (digest(payload) !== passport.contentDigest) return null;
  if (passport.version !== PASSPORT_VERSION) return null;
  return { piece: passport.piece, identity: passport.identity };
}

export function passportToJson(passport: PiecePassport): string {
  return JSON.stringify(passport, null, 2);
}
