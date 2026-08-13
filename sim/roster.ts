import { LivingBoard } from '../src/chess';
import type { PieceId, Role, Side } from '../src/chess';
import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type PieceRole,
  type PieceState,
  type PieceTraits,
} from '../src/psychology';

const ROLE_MAP: Record<Role, PieceRole> = {
  P: 'Pawn',
  N: 'Knight',
  B: 'Bishop',
  R: 'Rook',
  Q: 'Queen',
  K: 'King',
};

const CHESS_ROLE_MAP: Record<PieceRole, Role> = {
  Pawn: 'P',
  Knight: 'N',
  Bishop: 'B',
  Rook: 'R',
  Queen: 'Q',
  King: 'K',
};

function traitsForRole(role: Role, randomUnit: number): PieceTraits {
  const jitter = (base: number): number =>
    Math.max(0.1, Math.min(1, base + (randomUnit - 0.5) * 0.2));
  const pawnLike = role === 'P';
  const officer = role === 'N' || role === 'B' || role === 'R' || role === 'Q';
  return {
    w_honor: jitter(pawnLike ? 0.55 : 0.65),
    w_courage: jitter(pawnLike ? 0.45 : 0.6),
    w_ambition: jitter(officer ? 0.7 : 0.35),
    w_loyalty: jitter(0.5),
    w_empathy: jitter(pawnLike ? 0.65 : 0.45),
    w_prestige: jitter(officer ? 0.55 : 0.35),
  };
}

function classPrestigeFor(role: Role): PieceState['classPrestige'] {
  let pawnBias: number;
  if (role === 'P') pawnBias = -10;
  else if (role === 'N' || role === 'B') pawnBias = 5;
  else pawnBias = 15;
  return {
    Pawn: pawnBias - 20,
    Knight: pawnBias,
    Bishop: pawnBias,
    Rook: pawnBias + 10,
    Queen: pawnBias + 20,
    King: 50,
  };
}

function experienceForRole(role: Role): number {
  if (role === 'P') return 20;
  if (role === 'K') return 80;
  return 55;
}

export function createFreshPieceState(
  id: PieceId,
  role: PieceRole,
  initialTrust: number,
  randomUnit: number,
): PieceState {
  const chessRole = CHESS_ROLE_MAP[role];
  return normalizePieceState({
    id,
    role,
    traits: traitsForRole(chessRole, randomUnit),
    E_i: experienceForRole(chessRole),
    T_i: initialTrust,
    M_i: 70,
    B_i: 0,
    dyadicAffinity: {},
    classPrestige: classPrestigeFor(chessRole),
    engagementFactor: 1,
    credence: defaultCredence(),
    rumor: defaultRumor(),
  });
}

export function createStartingRoster(
  board: LivingBoard,
  side: Side,
  initialTrust: number,
  randomUnit: number,
): PieceState[] {
  return board
    .piecesOf(side)
    .map((piece) =>
      createFreshPieceState(
        piece.id,
        ROLE_MAP[piece.role],
        initialTrust,
        randomUnit,
      ),
    );
}

/** Restore a full starting lineup while preserving carried psychological state. */
export function mergeCampaignRoster(
  board: LivingBoard,
  side: Side,
  carried: readonly PieceState[],
  initialTrust: number,
  randomUnit: number,
): PieceState[] {
  const carriedById = new Map(carried.map((piece) => [piece.id, piece]));
  return createStartingRoster(board, side, initialTrust, randomUnit).map(
    (piece) => {
      const previous = carriedById.get(piece.id);
      if (previous === undefined) return piece;
      return normalizePieceState({
        ...piece,
        traits: previous.traits,
        T_i: previous.T_i,
        M_i: previous.M_i,
        B_i: previous.B_i,
        dyadicAffinity: { ...previous.dyadicAffinity },
        classPrestige: { ...previous.classPrestige },
        engagementFactor: previous.engagementFactor,
        credence: { ...previous.credence },
        rumor: { ...previous.rumor },
      });
    },
  );
}

export function rosterForSide(
  roster: readonly PieceState[],
  pieceIds: readonly PieceId[],
): PieceState[] {
  const active = new Set(pieceIds);
  return roster.filter((piece) => active.has(piece.id));
}

export function meanTrust(roster: readonly PieceState[]): number {
  return meanRosterValue(roster, (piece) => piece.T_i);
}

export function meanTauAbil(roster: readonly PieceState[]): number {
  return meanRosterValue(roster, (piece) => piece.credence.tauAbil);
}

export function meanTauBenev(roster: readonly PieceState[]): number {
  return meanRosterValue(roster, (piece) => piece.credence.tauBenev);
}

export function meanRosterValue(
  roster: readonly PieceState[],
  pick: (piece: PieceState) => number,
): number {
  if (roster.length === 0) return 0;
  const total = roster.reduce((sum, piece) => sum + pick(piece), 0);
  return total / roster.length;
}

export function meanClassContempt(roster: readonly PieceState[]): number {
  if (roster.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const piece of roster) {
    total += piece.classPrestige.Pawn;
    count += 1;
  }
  return total / count;
}

export { startingSquarePieceId } from '../src/chess';
