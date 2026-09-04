import { clampMorale, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import { applyBetrayalSignal } from './credence';
import {
  calculateShamePermille,
  scaleOwnLoss,
  type ShameOptions,
} from './shame';
import { formBitterness, shouldFormRuptureBitterness } from './bitterness';
import { witnessAttachmentPermille } from './standing';
import type { MatchEvent, PieceState } from './types';

export interface OverrideResult {
  readonly overriddenPiece: PieceState;
  readonly witnesses: PieceState[];
  readonly event: MatchEvent;
  readonly witnessEvents: readonly MatchEvent[];
  readonly shameEvent?: Extract<MatchEvent, { t: 'SHAME_EXPOSURE' }>;
  readonly bitternessEvent:
    | Extract<MatchEvent, { t: 'BITTERNESS_FORMED' }>
    | undefined;
}

export function applyOverride(
  piece: PieceState,
  witnesses: readonly PieceState[],
  ply: number,
  san: string,
  vindicated = false,
  shameOptions: ShameOptions = {},
): OverrideResult {
  const shamePermille = vindicated
    ? 0
    : calculateShamePermille(piece, witnesses, shameOptions);
  const trustAfterBasePenalty = clampTrust(
    piece.T_i + ENGINE_CONFIG.OVERRIDE_PIECE_TRUST_PENALTY,
  );
  const trustAfterShame = scaleOwnLoss(
    piece.T_i,
    trustAfterBasePenalty,
    shamePermille,
  );
  const credence =
    shamePermille === 0
      ? applyBetrayalSignal(
          piece.credence,
          ENGINE_CONFIG.OVERRIDE_BENEV_CLIFF_INPUT,
        )
      : applyBetrayalSignal(
          piece.credence,
          ENGINE_CONFIG.OVERRIDE_BENEV_CLIFF_INPUT,
          1_000 + shamePermille,
        );
  const overriddenPiece: PieceState = {
    ...piece,
    T_i: trustAfterShame,
    M_i: clampMorale(piece.M_i - 10),
    credence,
  };
  const bitterness =
    !vindicated && shouldFormRuptureBitterness(overriddenPiece)
      ? formBitterness(overriddenPiece, 'rupture_floor', { ply })
      : { piece: overriddenPiece, event: undefined };
  const updatedWitnesses = witnesses.map((witness) => {
    const attachment = witnessAttachmentPermille(witness, piece);
    const standingFactor = Math.max(
      1_000,
      1_000 +
        Math.trunc(
          (ENGINE_CONFIG.OVERRIDE_STANDING_PRICE_PERMILLE * attachment) / 1_000,
        ),
    );
    const witnessScale = Math.trunc(
      (Math.max(
        0,
        Math.trunc(ENGINE_CONFIG.OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE),
      ) *
        standingFactor) /
        1_000,
    );
    return {
      ...witness,
      T_i: clampTrust(
        witness.T_i + ENGINE_CONFIG.OVERRIDE_WITNESS_TRUST_PENALTY,
      ),
      credence: applyBetrayalSignal(
        witness.credence,
        ENGINE_CONFIG.OVERRIDE_WITNESS_BENEV_CLIFF_INPUT,
        witnessScale,
      ),
    };
  });
  const overriddenBenevDelta = credence.tauBenev - piece.credence.tauBenev;
  const event: MatchEvent = {
    t: 'OVERRIDE',
    ply,
    pieceId: piece.id,
    san,
    pieceTrustDelta:
      shamePermille === 0
        ? ENGINE_CONFIG.OVERRIDE_PIECE_TRUST_PENALTY
        : trustAfterShame - piece.T_i,
    vindicated,
  };
  const witnessEvents: MatchEvent[] = [];
  if (overriddenBenevDelta !== 0) {
    witnessEvents.push({
      t: 'PSYCH_DELTA',
      ply,
      pieceId: piece.id,
      field: 'tauBenev',
      delta: overriddenBenevDelta,
    });
  }
  const shameEvent: MatchEvent | undefined =
    shamePermille === 0
      ? undefined
      : {
          t: 'SHAME_EXPOSURE',
          ply,
          pieceId: piece.id,
          witnesses: witnesses.length,
          shamePermille,
        };
  updatedWitnesses.forEach((witness, index) => {
    const originalWitness = witnesses[index];
    if (originalWitness === undefined) return;
    witnessEvents.push({
      t: 'PSYCH_DELTA',
      ply,
      pieceId: witness.id,
      field: 'T_i',
      delta: ENGINE_CONFIG.OVERRIDE_WITNESS_TRUST_PENALTY,
    });
    const benevDelta =
      witness.credence.tauBenev - originalWitness.credence.tauBenev;
    if (benevDelta !== 0) {
      witnessEvents.push({
        t: 'PSYCH_DELTA',
        ply,
        pieceId: witness.id,
        field: 'tauBenev',
        delta: benevDelta,
      });
    }
  });
  return {
    overriddenPiece: bitterness.piece,
    witnesses: updatedWitnesses,
    event,
    witnessEvents,
    ...(shameEvent === undefined ? {} : { shameEvent }),
    bitternessEvent: bitterness.event,
  };
}
