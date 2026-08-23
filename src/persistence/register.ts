import { parsePieceId } from '../chess';
import type { Role } from '../chess';
import type { PieceRole } from '../psychology';
import type { MatchRecord, MatchResult } from './types';

export const PUBLIC_REGISTER_FOLD_VERSION = 'public-register-v1';

export type PublicMatchEvent =
  | {
      readonly t: 'CAPTURE';
      readonly victim: string;
      readonly by: string;
    }
  | {
      readonly t: 'PROMOTION';
      readonly pieceId: string;
      readonly fromRole: PieceRole;
      readonly toRole: PieceRole;
    };

export interface PublicMatchFacts {
  readonly side: 'w' | 'b';
  readonly result: MatchResult;
  readonly startingRoles: readonly {
    readonly pieceId: string;
    readonly role: PieceRole;
  }[];
  readonly events: readonly PublicMatchEvent[];
}

export interface PublicRegister {
  readonly foldVersion: string;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly routs: number;
  readonly materialTaken: number;
  readonly materialLost: number;
  readonly largestMaterialMargin: number;
  readonly ownPiecesLost: number;
  readonly unattributedCaptures: number;
  readonly promotionsReached: number;
  readonly currentWinStreak: number;
  readonly longestWinStreak: number;
}

export const PUBLIC_REGISTER_COLUMNS = [
  'matchesPlayed',
  'wins',
  'losses',
  'draws',
  'routs',
  'materialTaken',
  'materialLost',
  'largestMaterialMargin',
  'ownPiecesLost',
  'unattributedCaptures',
  'promotionsReached',
  'currentWinStreak',
  'longestWinStreak',
] as const satisfies readonly (keyof Omit<PublicRegister, 'foldVersion'>)[];

const ROLE_VALUES: Readonly<Record<Role, number>> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0,
};

const ROLE_BY_PIECE_ROLE: Readonly<Record<PieceRole, Role>> = {
  Pawn: 'P',
  Knight: 'N',
  Bishop: 'B',
  Rook: 'R',
  Queen: 'Q',
  King: 'K',
};

/** Public chess value used by folds and the draft's public lot pricing. */
export function publicRoleValue(role: PieceRole): number {
  return ROLE_VALUES[ROLE_BY_PIECE_ROLE[role]];
}

/**
 * Extract public, non-psychological facts for the commander represented by
 * `side`; the record result is already that commander's result.
 */
export function publicMatchFactsFromRecord(
  match: MatchRecord,
  side: 'w' | 'b',
): PublicMatchFacts {
  const events: PublicMatchEvent[] = [];
  for (const event of match.events) {
    if (event.t === 'CAPTURE') {
      events.push({
        t: 'CAPTURE',
        victim: event.victim,
        by: event.by,
      });
    } else if (event.t === 'PROMOTION') {
      events.push({
        t: 'PROMOTION',
        pieceId: event.pieceId,
        fromRole: event.fromRole,
        toRole: event.toRole,
      });
    }
  }
  return {
    side,
    result: match.result,
    startingRoles: match.rosterSnapshot.map((piece) => ({
      pieceId: piece.id,
      role: piece.role,
    })),
    events,
  };
}

function emptyRegister(): PublicRegister {
  return {
    foldVersion: PUBLIC_REGISTER_FOLD_VERSION,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    routs: 0,
    materialTaken: 0,
    materialLost: 0,
    largestMaterialMargin: 0,
    ownPiecesLost: 0,
    unattributedCaptures: 0,
    promotionsReached: 0,
    currentWinStreak: 0,
    longestWinStreak: 0,
  };
}

/**
 * Fold narrow public facts; psychology and engine truth are not inputs.
 * Material values use each piece's role at capture time. Role state is rebuilt
 * independently for every match from public starting chairs and promotions.
 * Enemy pieces have no public starting chair in the record and remain
 * origin-valued when captured.
 */
export function foldPublicRegister(
  matches: readonly PublicMatchFacts[],
): PublicRegister {
  const register = emptyRegister();
  let currentWinStreak = 0;
  let longestWinStreak = 0;
  let largestMaterialMargin = 0;
  let materialTaken = 0;
  let materialLost = 0;
  let ownPiecesLost = 0;
  let unattributedCaptures = 0;
  let promotionsReached = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let routs = 0;
  let hasMargin = false;
  for (const match of matches) {
    if (match.result === 'WIN') {
      wins += 1;
      currentWinStreak += 1;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else {
      currentWinStreak = 0;
      if (match.result === 'LOSS') losses += 1;
      if (match.result === 'DRAW') draws += 1;
      if (match.result === 'ROUT') routs += 1;
    }
    let taken = 0;
    let lost = 0;
    const currentRoles = new Map<string, Role>();
    for (const startingRole of match.startingRoles) {
      currentRoles.set(
        startingRole.pieceId,
        ROLE_BY_PIECE_ROLE[startingRole.role],
      );
    }
    for (const event of match.events) {
      if (event.t === 'PROMOTION') {
        currentRoles.set(event.pieceId, ROLE_BY_PIECE_ROLE[event.toRole]);
        if (parsePieceId(event.pieceId)?.side === match.side) {
          promotionsReached += 1;
        }
        continue;
      }
      const victim = parsePieceId(event.victim);
      const by = parsePieceId(event.by);
      if (victim === null || by === null) unattributedCaptures += 1;
      const victimRole =
        victim === null
          ? undefined
          : (currentRoles.get(event.victim) ?? victim.role);
      const victimValue =
        victimRole === undefined ? 0 : ROLE_VALUES[victimRole];
      if (by?.side === match.side && victim !== null) taken += victimValue;
      if (victim?.side === match.side && victimRole !== undefined) {
        lost += victimValue;
        ownPiecesLost += 1;
      }
    }
    materialTaken += taken;
    materialLost += lost;
    const margin = taken - lost;
    largestMaterialMargin = hasMargin
      ? Math.max(largestMaterialMargin, margin)
      : margin;
    hasMargin = true;
  }
  return {
    ...register,
    matchesPlayed: matches.length,
    wins,
    losses,
    draws,
    routs,
    materialTaken,
    materialLost,
    largestMaterialMargin,
    ownPiecesLost,
    unattributedCaptures,
    promotionsReached,
    currentWinStreak,
    longestWinStreak,
  };
}
