import { LivingBoard } from '../chess';
import type { PieceId, Role, Side } from '../chess';
import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  startingAbilityForRole,
  type PieceRole,
  type PieceState,
  type PieceTraits,
} from '../psychology';

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

export function createFreshPieceState(
  id: PieceId,
  role: PieceRole,
  initialTrust: number,
  randomUnit: number,
  abilityOffset = 0,
): PieceState {
  const chessRole = CHESS_ROLE_MAP[role];
  return normalizePieceState({
    id,
    role,
    traits: traitsForRole(chessRole, randomUnit),
    E_i: startingAbilityForRole(role) + Math.trunc(abilityOffset),
    T_i: initialTrust,
    M_i: 70,
    B_i: 0,
    dyadicAffinity: {},
    classPrestige: classPrestigeFor(chessRole),
    engagementFactor: 1,
    credence: defaultCredence(),
    rumor: defaultRumor(),
    cash: 0,
  });
}

export function unitForIndex(base: number, index: number): number {
  let value = index + 1;
  let denominator = 1;
  let reflected = 0;
  while (value > 0) {
    denominator *= 2;
    reflected += (value % 2) / denominator;
    value = Math.floor(value / 2);
  }
  return (base + reflected) % 1;
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
