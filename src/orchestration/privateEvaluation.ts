import {
  extractThreatMap,
  LivingBoard,
  type Role,
  type Square,
} from '../chess';
import { attentionWeight, ENGINE_CONFIG, type PieceState } from '../psychology';
import type { EngineEvaluation, EvalProfile } from '../engine/types';

const PROFILE_SCALE = 1_000;
const MATE_SCORE_FLOOR = 29_000;
const ROLE_NAMES: readonly PieceState['role'][] = [
  'Pawn',
  'Knight',
  'Bishop',
  'Rook',
  'Queen',
  'King',
];
const ROLE_BY_PIECE_ROLE: Readonly<Record<PieceState['role'], Role>> = {
  Pawn: 'P',
  Knight: 'N',
  Bishop: 'B',
  Rook: 'R',
  Queen: 'Q',
  King: 'K',
};

export interface PrivateProfileOptions {
  readonly traumaDrift?: boolean;
}

function quantize(value: number): number {
  return Math.trunc(value * PROFILE_SCALE);
}

function quantizeSigned(value: number): number {
  return Math.max(-PROFILE_SCALE, Math.min(PROFILE_SCALE, quantize(value)));
}

function coordinates(square: Square): readonly [number, number] {
  return [square.charCodeAt(0) - 97, square.charCodeAt(1) - 49];
}

function boardDistance(left: Square, right: Square): number {
  const [leftFile, leftRank] = coordinates(left);
  const [rightFile, rightRank] = coordinates(right);
  return Math.max(
    Math.abs(leftFile - rightFile),
    Math.abs(leftRank - rightRank),
  );
}

function lineBlocked(board: LivingBoard, from: Square, to: Square): boolean {
  const [fromFile, fromRank] = coordinates(from);
  const [toFile, toRank] = coordinates(to);
  const fileStep = Math.sign(toFile - fromFile);
  const rankStep = Math.sign(toRank - fromRank);
  if (
    fileStep !== 0 &&
    rankStep !== 0 &&
    Math.abs(toFile - fromFile) !== Math.abs(toRank - fromRank)
  ) {
    return false;
  }
  let file = fromFile + fileStep;
  let rank = fromRank + rankStep;
  while (file !== toFile || rank !== toRank) {
    const square = `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
    if (board.pieceAt(square) !== undefined) return true;
    file += fileStep;
    rank += rankStep;
  }
  return false;
}

function profileValue(profile: EvalProfile, key: string, fallback = 0): number {
  const value = profile[key];
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : fallback;
}

function positionScore(
  board: LivingBoard,
  actor: PieceState,
  profile: EvalProfile,
): number {
  const side = board.pieceOf(actor.id)?.side;
  if (side === undefined) return -1;
  const threatMap = extractThreatMap(board, side);
  const actorThreat = threatMap.pieces[actor.id];
  const actorSquare = board.squareOf(actor.id);
  const ownSafety =
    actorThreat === undefined ? -1 : 1 - actorThreat.captureRisk;
  const ownMobility =
    actorSquare === undefined || side === undefined
      ? 0
      : mobilityFor(board, side, actorSquare);
  const ownClass = Object.values(threatMap.pieces)
    .filter(
      (piece) =>
        piece.role === ROLE_BY_PIECE_ROLE[actor.role] &&
        piece.pieceId !== actor.id,
    )
    .reduce((sum, piece) => sum + (1 - piece.captureRisk), 0);
  const classCount = Object.values(threatMap.pieces).filter(
    (piece) => piece.role === ROLE_BY_PIECE_ROLE[actor.role],
  ).length;
  const classSafety = classCount === 0 ? 0 : ownClass / classCount;
  const kingSafety = 1 - threatMap.kingExposure;
  let weighted = 0;
  let totalWeight = 0;
  const add = (key: string, feature: number): void => {
    const weight = profileValue(profile, key);
    weighted += weight * feature;
    totalWeight += Math.abs(weight);
  };
  add('weight:ownSafety', ownSafety);
  add('weight:ownMobility', ownMobility);
  add('weight:ownClass', classSafety);
  add('weight:kingSafety', kingSafety);

  for (const peer of board.piecesOf(side)) {
    if (peer.id === actor.id) continue;
    const peerThreat = threatMap.pieces[peer.id];
    const attention = profileValue(
      profile,
      `attention:${peer.id}`,
      PROFILE_SCALE,
    );
    add(
      `weight:peer:${peer.id}`,
      (peerThreat === undefined ? -1 : 1 - peerThreat.captureRisk) *
        (attention / PROFILE_SCALE),
    );
  }
  if (totalWeight === 0) return 0;
  return weighted / totalWeight;
}

function mobilityFor(
  board: LivingBoard,
  side: 'w' | 'b',
  square: Square,
): number {
  const fields = board.fen().split(' ');
  fields[1] = side;
  fields[3] = '-';
  const sideToMove = LivingBoard.fromFen(fields.join(' '));
  return Math.min(
    1,
    sideToMove.legalMoves().filter((move) => move.from === square).length / 8,
  );
}

function endpointFor(
  board: LivingBoard,
  pv: readonly string[],
):
  | { readonly board: LivingBoard; readonly movedIds: ReadonlySet<string> }
  | undefined {
  const endpoint = board.clone();
  const movedIds = new Set<string>();
  try {
    for (const lan of pv) {
      if (lan.length < 4) return undefined;
      const intent = {
        from: lan.slice(0, 2) as Square,
        to: lan.slice(2, 4) as Square,
        ...(lan.length > 4
          ? {
              promotion: lan.slice(4, 5).toUpperCase() as 'Q' | 'R' | 'B' | 'N',
            }
          : {}),
      };
      const applied = endpoint.applyMove(intent);
      movedIds.add(applied.moverId);
    }
  } catch {
    return undefined;
  }
  return { board: endpoint, movedIds };
}

function relevantPeerIds(
  board: LivingBoard,
  actor: PieceState,
  profile: EvalProfile,
): readonly string[] {
  return board
    .piecesOf(board.pieceOf(actor.id)?.side ?? 'w')
    .map((piece) => piece.id)
    .filter(
      (pieceId) =>
        pieceId !== actor.id &&
        profileValue(profile, `weight:peer:${pieceId}`) > 0,
    )
    .sort();
}

function lineIsAttended(
  board: LivingBoard,
  actor: PieceState,
  profile: EvalProfile,
  movedIds: ReadonlySet<string>,
): boolean {
  if (actor.role === 'King' || movedIds.has(actor.id)) return true;
  return relevantPeerIds(board, actor, profile).some((id) => movedIds.has(id));
}

/**
 * Build the canonical, integer-quantized profile carried through the engine
 * barrier. Geometry affects only attention salience; board facts remain public.
 */
export function evalProfileFor(
  piece: PieceState,
  board: LivingBoard,
  options: PrivateProfileOptions = {},
): EvalProfile {
  const drift = options.traumaDrift ?? ENGINE_CONFIG.PRIVATE_EVAL_TRAUMA_DRIFT;
  const traumaMultiplier = drift ? 1 + piece.B_i / 100 : 1;
  const engagement = Math.max(0.1, Math.min(1, piece.engagementFactor));
  const safetyBase =
    piece.role === 'King' ? 1 : 0.35 + (1 - piece.traits.w_courage) * 0.65;
  const profile: Record<string, number> = {};
  for (const role of ROLE_NAMES) {
    profile[`role:${role}`] = role === piece.role ? PROFILE_SCALE : 0;
  }
  profile['weight:ownSafety'] = quantizeSigned(
    safetyBase * traumaMultiplier * engagement,
  );
  profile['weight:ownMobility'] = quantizeSigned(
    (0.2 + piece.traits.w_honor * 0.8) * engagement,
  );
  profile['weight:ownClass'] = quantizeSigned(
    (0.2 + piece.traits.w_prestige * 0.8) * engagement,
  );
  profile['weight:kingSafety'] = quantizeSigned(
    (piece.role === 'King' ? 1 : 0.25 + piece.traits.w_honor * 0.25) *
      engagement,
  );
  const side = board.pieceOf(piece.id)?.side;
  for (const peer of side === undefined ? [] : board.piecesOf(side)) {
    if (peer.id === piece.id) continue;
    const affinity = piece.dyadicAffinity[peer.id] ?? 0;
    const prestige =
      piece.classPrestige[
        ROLE_NAMES.find((role) => ROLE_BY_PIECE_ROLE[role] === peer.role) ??
          'Pawn'
      ];
    profile[`weight:peer:${peer.id}`] = quantizeSigned(
      ((affinity + piece.traits.w_prestige * prestige) / 200) *
        piece.traits.w_empathy *
        engagement,
    );
    const actorSquare = board.squareOf(piece.id);
    if (actorSquare === undefined) continue;
    const distance = boardDistance(actorSquare, peer.square);
    const blocked = lineBlocked(board, actorSquare, peer.square);
    const salience = attentionWeight(distance) * (blocked ? 0.5 : 1);
    profile[`attention:${peer.id}`] = quantizeSigned(salience);
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(profile).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ),
  );
}

export function applyPrivateEvaluation(
  base: EngineEvaluation,
  board: LivingBoard,
  actor: PieceState,
  profile: EvalProfile,
  lines: readonly EngineEvaluation[] = [],
  distortionBoundCp: number = ENGINE_CONFIG.PRIVATE_EVAL_DISTORTION_BOUND_CP,
): EngineEvaluation {
  if (Math.abs(base.scoreCp) >= MATE_SCORE_FLOOR) {
    return Object.freeze({
      scoreCp: base.scoreCp,
      pv: Object.freeze([...base.pv]),
    });
  }
  if (!Number.isSafeInteger(distortionBoundCp) || distortionBoundCp < 0) {
    throw new RangeError('distortionBoundCp must be a non-negative integer.');
  }
  const baseline = positionScore(board, actor, profile);
  const candidates = lines
    .map((line) => {
      const endpoint = endpointFor(board, line.pv);
      if (
        endpoint === undefined ||
        !lineIsAttended(board, actor, profile, endpoint.movedIds)
      ) {
        return undefined;
      }
      const distortion = Math.max(
        -distortionBoundCp,
        Math.min(
          distortionBoundCp,
          Math.trunc(
            ((positionScore(endpoint.board, actor, profile) - baseline) *
              distortionBoundCp) /
              2,
          ),
        ),
      );
      return { line, distortion };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        readonly line: EngineEvaluation;
        readonly distortion: number;
      } => candidate !== undefined,
    )
    .sort((left, right) => {
      if (right.distortion !== left.distortion) {
        return right.distortion - left.distortion;
      }
      return left.line.pv.join(' ') < right.line.pv.join(' ') ? -1 : 1;
    });
  const chosen = candidates[0];
  if (chosen === undefined) {
    const fallback = Math.max(
      -distortionBoundCp,
      Math.min(
        distortionBoundCp,
        Math.trunc(
          (positionScore(board, actor, profile) * distortionBoundCp) / 2,
        ),
      ),
    );
    return Object.freeze({
      scoreCp: base.scoreCp + fallback,
      pv: Object.freeze([...base.pv]),
    });
  }
  return Object.freeze({
    scoreCp: base.scoreCp + chosen.distortion,
    pv: Object.freeze([...chosen.line.pv]),
  });
}
