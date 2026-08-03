import type { LivingBoard } from './board';
import type {
  BoardPiece,
  MoveIntent,
  PieceId,
  Role,
  Side,
  Square,
} from './types';

/**
 * Board features consumed by `psychology/` as plain data (ADR 0013). Nothing
 * here consults an engine: these are geometric facts about the position, so a
 * piece's *interpretation* of them stays a psychology concern.
 *
 * Risk is computed in integer thousandths and only divided on the way out, so a
 * comparison that decides a verdict can never be flipped by a last-bit float
 * difference.
 */

export interface FeatureConfig {
  /** Capture/material values, in pawns. The King is never capturable. */
  readonly pieceValues: Readonly<Record<Role, number>>;
  /** Value the King counts as when it is the *attacker* of a defended piece. */
  readonly kingAttackerValue: number;
  /** Risk when the cheapest attacker is worth less than the target. */
  readonly riskFavourableTrade: number;
  /** Risk when the target is attacked and undefended. */
  readonly riskUndefended: number;
  /** Risk when attackers outnumber defenders. */
  readonly riskOutnumbered: number;
  /** Risk when the target is attacked but adequately defended. */
  readonly riskDefended: number;
  /** Exposure charged per attacked square in the King's ring. */
  readonly kingRingExposure: number;
  /** Exposure charged when the King stands in check. */
  readonly kingCheckExposure: number;
}

export const RISK_SCALE = 1000;

export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  pieceValues: { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 },
  kingAttackerValue: 10,
  riskFavourableTrade: 900,
  riskUndefended: 800,
  riskOutnumbered: 600,
  riskDefended: 250,
  kingRingExposure: 110,
  kingCheckExposure: 450,
};

export interface PieceThreat {
  readonly pieceId: PieceId;
  readonly square: Square;
  readonly role: Role;
  /** 0..1, quantized to `1 / RISK_SCALE`. */
  readonly captureRisk: number;
  readonly attackerCount: number;
  readonly defenderCount: number;
}

export interface ThreatMap {
  readonly side: Side;
  /** Keyed by `PieceId`; insertion order is sorted. */
  readonly pieces: Record<PieceId, PieceThreat>;
  /** Material balance from `side`'s perspective, in pawns. */
  readonly materialBalance: number;
  /** 0..1 King exposure, quantized to `1 / RISK_SCALE`. */
  readonly kingExposure: number;
}

export interface MoveFeatures {
  readonly moverId: PieceId;
  readonly san: string;
  /** Value of the piece captured by this move; 0 when nothing is captured. */
  readonly deltaVCapture: number;
  /** Change in material balance for the mover's side, in pawns. */
  readonly materialDelta: number;
  /** The mover's own post-move capture risk, 0..1. */
  readonly pCaptured: number;
  /** Post-move minus pre-move capture risk for the mover, -1..1. */
  readonly pCapturedDelta: number;
  /** Post-move capture risk for every surviving friendly piece, 0..1. */
  readonly captureRiskByPiece: Record<PieceId, number>;
  /**
   * `ΔSafety_j(m)` in -1..1 for every friendly piece other than the mover:
   * positive means the peer got safer. A captured or deserted peer is absent.
   */
  readonly peerSafetyDeltas: Record<PieceId, number>;
  /** Positive means the mover's own King got safer, -1..1. */
  readonly kingSafetyDelta: number;
}

function valueOf(role: Role, config: FeatureConfig): number {
  return config.pieceValues[role];
}

function attackerValueOf(role: Role, config: FeatureConfig): number {
  return role === 'K' ? config.kingAttackerValue : valueOf(role, config);
}

function opponent(side: Side): Side {
  return side === 'w' ? 'b' : 'w';
}

function quantized(thousandths: number): number {
  return thousandths / RISK_SCALE;
}

function ringSquaresOf(square: Square): Square[] {
  const file = square.charCodeAt(0);
  const rank = square.charCodeAt(1);
  const squares: Square[] = [];
  for (const fileStep of [-1, 0, 1]) {
    for (const rankStep of [-1, 0, 1]) {
      if (fileStep === 0 && rankStep === 0) continue;
      const nextFile = file + fileStep;
      const nextRank = rank + rankStep;
      if (nextFile < 97 || nextFile > 104) continue;
      if (nextRank < 49 || nextRank > 56) continue;
      squares.push(
        `${String.fromCharCode(nextFile)}${String.fromCharCode(nextRank)}` as Square,
      );
    }
  }
  return squares;
}

/**
 * Capture risk in thousandths for the piece standing on `square`. Kings are
 * never capturable and always score 0; use `kingExposureThousandths` for them.
 */
export function captureRiskThousandths(
  board: LivingBoard,
  square: Square,
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG,
): number {
  const piece = board.pieceAt(square);
  if (piece === undefined || piece.role === 'K') return 0;
  const attackers = board.attackersOf(square, opponent(piece.side));
  if (attackers.length === 0) return 0;
  const defenders = board.attackersOf(square, piece.side);
  const cheapestAttacker = attackers.reduce(
    (cheapest, attacker) =>
      Math.min(cheapest, attackerValueOf(attacker.role, config)),
    Number.MAX_SAFE_INTEGER,
  );
  if (cheapestAttacker < valueOf(piece.role, config)) {
    return config.riskFavourableTrade;
  }
  if (defenders.length === 0) return config.riskUndefended;
  if (attackers.length > defenders.length) return config.riskOutnumbered;
  return config.riskDefended;
}

/** King exposure in thousandths: attacked ring squares plus being in check. */
export function kingExposureThousandths(
  board: LivingBoard,
  side: Side,
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG,
): number {
  const king = board
    .piecesOf(side)
    .find((piece): piece is BoardPiece => piece.role === 'K');
  if (king === undefined) return 0;
  const enemy = opponent(side);
  const attackedRing = ringSquaresOf(king.square).filter((square) =>
    board.isAttacked(square, enemy),
  ).length;
  const check = board.isAttacked(king.square, enemy)
    ? config.kingCheckExposure
    : 0;
  return Math.min(RISK_SCALE, attackedRing * config.kingRingExposure + check);
}

export function materialBalance(
  board: LivingBoard,
  side: Side,
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG,
): number {
  return board
    .pieces()
    .reduce(
      (total, piece) =>
        total + (piece.side === side ? 1 : -1) * valueOf(piece.role, config),
      0,
    );
}

/** Every friendly piece's threat picture — the golden-test surface for 1.2. */
export function extractThreatMap(
  board: LivingBoard,
  side: Side,
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG,
): ThreatMap {
  const pieces: Record<PieceId, PieceThreat> = {};
  for (const piece of board.piecesOf(side)) {
    pieces[piece.id] = {
      pieceId: piece.id,
      square: piece.square,
      role: piece.role,
      captureRisk: quantized(
        captureRiskThousandths(board, piece.square, config),
      ),
      attackerCount: board.attackersOf(piece.square, opponent(side)).length,
      defenderCount: board.attackersOf(piece.square, side).length,
    };
  }
  return {
    side,
    pieces,
    materialBalance: materialBalance(board, side, config),
    kingExposure: quantized(kingExposureThousandths(board, side, config)),
  };
}

function riskByPieceThousandths(
  board: LivingBoard,
  side: Side,
  config: FeatureConfig,
): Map<PieceId, number> {
  const risks = new Map<PieceId, number>();
  for (const piece of board.piecesOf(side)) {
    risks.set(piece.id, captureRiskThousandths(board, piece.square, config));
  }
  return risks;
}

/**
 * Features for a single candidate move. The board is not mutated: the move is
 * applied to a clone, so this is safe to call for every legal move each ply.
 */
export function extractMoveFeatures(
  board: LivingBoard,
  intent: MoveIntent,
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG,
): MoveFeatures {
  const mover = board.pieceAt(intent.from);
  if (mover === undefined) {
    throw new Error(`No piece on ${intent.from}`);
  }
  const side = mover.side;
  const beforeRisks = riskByPieceThousandths(board, side, config);
  const beforeMaterial = materialBalance(board, side, config);
  const beforeKingExposure = kingExposureThousandths(board, side, config);

  const probe = board.clone();
  const applied = probe.applyMove(intent);
  const afterRisks = riskByPieceThousandths(probe, side, config);
  const afterMaterial = materialBalance(probe, side, config);
  const afterKingExposure = kingExposureThousandths(probe, side, config);

  const captureRiskByPiece: Record<PieceId, number> = {};
  const peerSafetyDeltas: Record<PieceId, number> = {};
  for (const [pieceId, after] of [...afterRisks.entries()].sort(
    ([left], [right]) => (left < right ? -1 : 1),
  )) {
    captureRiskByPiece[pieceId] = quantized(after);
    if (pieceId === applied.moverId) continue;
    const before = beforeRisks.get(pieceId) ?? 0;
    peerSafetyDeltas[pieceId] = quantized(before - after);
  }

  const moverRiskAfter = afterRisks.get(applied.moverId) ?? 0;
  const moverRiskBefore = beforeRisks.get(applied.moverId) ?? 0;

  return {
    moverId: applied.moverId,
    san: applied.san,
    deltaVCapture:
      applied.capture === undefined ? 0 : valueOf(applied.capture.role, config),
    materialDelta: afterMaterial - beforeMaterial,
    pCaptured: quantized(moverRiskAfter),
    pCapturedDelta: quantized(moverRiskAfter - moverRiskBefore),
    captureRiskByPiece,
    peerSafetyDeltas,
    kingSafetyDelta: quantized(beforeKingExposure - afterKingExposure),
  };
}

/** Features for every legal move of the side to move, in canonical order. */
export function extractAllMoveFeatures(
  board: LivingBoard,
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG,
): MoveFeatures[] {
  return board
    .legalMoves()
    .map((intent) => extractMoveFeatures(board, intent, config));
}
