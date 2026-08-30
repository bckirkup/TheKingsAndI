import type { LivingBoard, Side } from '../chess';
import { compareCodeUnits } from '../core/canonicalJson';
import type {
  ObjectionStrengthWord,
  MoraleBandWord,
  TraumaBandWord,
  TrustBandWord,
} from '../core/qualitativeBands';
import {
  moraleBandWord,
  traumaBandWord,
  trustBandWord,
} from '../core/qualitativeBands';
import type { PieceState } from '../psychology';

export interface ObservationPiece {
  readonly id: string;
  readonly role: PieceState['role'];
  readonly trust: TrustBandWord;
  readonly morale: MoraleBandWord;
  readonly trauma: TraumaBandWord;
}

export interface MoveObservation {
  readonly kind: 'move';
  readonly ply: number;
  readonly side: Side;
  readonly fen: string;
  readonly roster: readonly ObservationPiece[];
}

export interface OverrideObservation {
  readonly kind: 'override';
  readonly ply: number;
  readonly side: Side;
  readonly fen: string;
  readonly roster: readonly ObservationPiece[];
  readonly refusingPieceId: string;
  readonly candidateSan: string;
  readonly objectionStrength: ObjectionStrengthWord;
}

export type Observation = MoveObservation | OverrideObservation;

function projectRoster(
  board: LivingBoard,
  side: Side,
  roster: readonly PieceState[],
): ObservationPiece[] {
  const activeIds = new Set(board.piecesOf(side).map((piece) => piece.id));
  return roster
    .filter((piece) => activeIds.has(piece.id))
    .map((piece) => ({
      id: piece.id,
      role: piece.role,
      trust: trustBandWord(piece.T_i),
      morale: moraleBandWord(piece.M_i),
      trauma: traumaBandWord(piece.B_i),
    }))
    .sort((left, right) => compareCodeUnits(left.id, right.id));
}

export function projectMoveObservation(input: {
  readonly board: LivingBoard;
  readonly side: Side;
  readonly ply: number;
  readonly roster: readonly PieceState[];
}): MoveObservation {
  return {
    kind: 'move',
    ply: input.ply,
    side: input.side,
    fen: input.board.fen(),
    roster: projectRoster(input.board, input.side, input.roster),
  };
}

export function projectOverrideObservation(input: {
  readonly board: LivingBoard;
  readonly side: Side;
  readonly ply: number;
  readonly roster: readonly PieceState[];
  readonly refusingPieceId: string;
  readonly candidateSan: string;
  readonly objectionStrength: ObjectionStrengthWord;
}): OverrideObservation {
  return {
    kind: 'override',
    ply: input.ply,
    side: input.side,
    fen: input.board.fen(),
    roster: projectRoster(input.board, input.side, input.roster),
    refusingPieceId: input.refusingPieceId,
    candidateSan: input.candidateSan,
    objectionStrength: input.objectionStrength,
  };
}
