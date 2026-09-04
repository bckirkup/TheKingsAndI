import type { PieceId } from '../core/ids';
import { ENGINE_CONFIG } from './config';
import type { MatchEvent } from './types';
import type { DreadExposure } from './trauma';

export function reliefEventsForPly(
  input: {
    readonly ply: number;
    readonly previousExposure: Readonly<
      Record<PieceId, DreadExposure | undefined>
    >;
    readonly captureRiskByPiece: Readonly<Record<PieceId, number>>;
  },
  riskPermille: number = ENGINE_CONFIG.RELIEF_CAPTURE_RISK_PERMILLE,
): readonly Extract<MatchEvent, { t: 'RELIEF' }>[] {
  const floor = Math.trunc(riskPermille);
  if (floor <= 0) return [];
  return Object.keys(input.captureRiskByPiece)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((pieceId) => {
      const previous = input.previousExposure[pieceId];
      if (previous === undefined) return [];
      const prior = Math.trunc(previous.risk * 1_000);
      const riskPermilleNow = Math.trunc(
        (input.captureRiskByPiece[pieceId] ?? 0) * 1_000,
      );
      if (prior < floor || riskPermilleNow >= floor) return [];
      return [
        {
          t: 'RELIEF',
          ply: input.ply,
          pieceId,
          priorRiskPermille: prior,
          riskPermille: riskPermilleNow,
        },
      ];
    });
}
