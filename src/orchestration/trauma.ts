import {
  applyCaptureInjury,
  applySustainedDread,
  type DreadExposure,
  type MatchEvent,
  type PieceState,
} from '../psychology';

export type DreadExposureByPiece = Readonly<
  Record<string, DreadExposure | undefined>
>;

export function applyMoveTrauma(
  roster: readonly PieceState[],
  priorExposure: DreadExposureByPiece,
  privateCaptureRiskByPiece: Readonly<Record<string, number>>,
  capturedPieceId: string | undefined,
  ply: number,
): {
  readonly roster: PieceState[];
  readonly exposure: DreadExposureByPiece;
  readonly events: readonly MatchEvent[];
} {
  const exposure: Record<string, DreadExposure | undefined> = {};
  const events: MatchEvent[] = [];
  let updated = roster.map((piece) => {
    const risk = privateCaptureRiskByPiece[piece.id] ?? 0;
    const dread = applySustainedDread(piece, priorExposure[piece.id], risk);
    exposure[piece.id] = dread.exposure;
    if (dread.injured) {
      events.push({
        t: 'PSYCH_DELTA',
        ply,
        pieceId: piece.id,
        field: 'B_i',
        delta: dread.piece.B_i - piece.B_i,
      });
    }
    return dread.piece;
  });
  if (capturedPieceId !== undefined) {
    updated = updated.map((piece) => {
      if (piece.id !== capturedPieceId) return piece;
      const injured = applyCaptureInjury(piece);
      events.push({
        t: 'PSYCH_DELTA',
        ply,
        pieceId: piece.id,
        field: 'B_i',
        delta: injured.B_i - piece.B_i,
      });
      return injured;
    });
  }
  return { roster: updated, exposure, events };
}
