import { LivingBoard } from '../chess';
import type { Role, Side } from '../chess';
import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
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

export function createStartingRoster(
  board: LivingBoard,
  side: Side,
  initialTrust: number,
  randomUnit: number,
): PieceState[] {
  return board.piecesOf(side).map((piece) => {
    let initialAbility = 55;
    if (piece.role === 'P') initialAbility = 20;
    else if (piece.role === 'K') initialAbility = 80;
    return normalizePieceState({
      id: piece.id,
      role: ROLE_MAP[piece.role],
      traits: traitsForRole(piece.role, randomUnit),
      E_i: initialAbility,
      T_i: initialTrust,
      M_i: 70,
      B_i: 0,
      dyadicAffinity: {},
      classPrestige: classPrestigeFor(piece.role),
      engagementFactor: 1,
      credence: defaultCredence(),
      rumor: defaultRumor(),
    });
  });
}
