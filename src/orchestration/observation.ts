import type { LivingBoard, Side } from '../chess';
import { compareCodeUnits } from '../core/canonicalJson';
import type {
  HeatBandWord,
  ObjectionStrengthWord,
  MoraleBandWord,
  TraumaBandWord,
  TrustBandWord,
} from '../core/qualitativeBands';
import {
  heatBandWord,
  moraleBandWord,
  traumaBandWord,
  trustBandWord,
} from '../core/qualitativeBands';
import type { PieceRole, PieceState } from '../psychology';

const CLASS_ROLES = [
  'Pawn',
  'Knight',
  'Bishop',
  'Rook',
  'Queen',
  'King',
] as const satisfies readonly PieceRole[];

export interface ObservationAffinity {
  readonly peerId: string;
  readonly heat: HeatBandWord;
}

export interface ObservationClassHeat {
  readonly role: PieceRole;
  readonly heat: HeatBandWord;
}

export interface ObservationPiece {
  readonly id: string;
  readonly role: PieceRole;
  readonly trust: TrustBandWord;
  readonly morale: MoraleBandWord;
  readonly trauma: TraumaBandWord;
  /** Own-side peers only; heat bands, never raw affinity (D160 / D219). */
  readonly affinities: readonly ObservationAffinity[];
  /** Class-prejudice row for this piece; heat bands only. */
  readonly classHeat: readonly ObservationClassHeat[];
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

function projectAffinities(
  piece: PieceState,
  peerIds: readonly string[],
): ObservationAffinity[] {
  return peerIds
    .filter((peerId) => peerId !== piece.id)
    .map((peerId) => ({
      peerId,
      heat: heatBandWord(piece.dyadicAffinity[peerId] ?? 0),
    }))
    .sort((left, right) => compareCodeUnits(left.peerId, right.peerId));
}

function projectClassHeat(piece: PieceState): ObservationClassHeat[] {
  return CLASS_ROLES.map((role) => ({
    role,
    heat: heatBandWord(piece.classPrestige[role]),
  }));
}

function projectPiece(
  piece: PieceState,
  peerIds: readonly string[],
): ObservationPiece {
  return {
    id: piece.id,
    role: piece.role,
    trust: trustBandWord(piece.T_i),
    morale: moraleBandWord(piece.M_i),
    trauma: traumaBandWord(piece.B_i),
    affinities: projectAffinities(piece, peerIds),
    classHeat: projectClassHeat(piece),
  };
}

function projectRoster(
  board: LivingBoard,
  side: Side,
  roster: readonly PieceState[],
): ObservationPiece[] {
  const activeIds = board
    .piecesOf(side)
    .map((piece) => piece.id)
    .sort(compareCodeUnits);
  const activeIdSet = new Set(activeIds);
  return roster
    .filter((piece) => activeIdSet.has(piece.id))
    .map((piece) => projectPiece(piece, activeIds))
    .sort((left, right) => compareCodeUnits(left.id, right.id));
}

/** Own-side qualitative roster projection for screens (ADR 0079 glass). */
export function projectOwnRosterObservation(input: {
  readonly board: LivingBoard;
  readonly side: Side;
  readonly roster: readonly PieceState[];
}): readonly ObservationPiece[] {
  return projectRoster(input.board, input.side, input.roster);
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
