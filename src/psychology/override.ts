import { clampMorale, clampTrust } from './clamp';
import { ENGINE_CONFIG } from './config';
import { applyBetrayalSignal } from './credence';
import type { MatchEvent, PieceState } from './types';

export interface OverrideResult {
  readonly overriddenPiece: PieceState;
  readonly witnesses: PieceState[];
  readonly event: MatchEvent;
  readonly witnessEvents: readonly MatchEvent[];
}

export function applyOverride(
  piece: PieceState,
  witnesses: readonly PieceState[],
  ply: number,
  san: string,
  vindicated = false,
): OverrideResult {
  const credence = applyBetrayalSignal(
    piece.credence,
    ENGINE_CONFIG.OVERRIDE_BENEV_CLIFF_INPUT,
  );
  const overriddenPiece: PieceState = {
    ...piece,
    T_i: clampTrust(piece.T_i + ENGINE_CONFIG.OVERRIDE_PIECE_TRUST_PENALTY),
    M_i: clampMorale(piece.M_i - 10),
    credence,
  };
  const updatedWitnesses = witnesses.map((witness) => ({
    ...witness,
    T_i: clampTrust(witness.T_i + ENGINE_CONFIG.OVERRIDE_WITNESS_TRUST_PENALTY),
    credence: applyBetrayalSignal(
      witness.credence,
      ENGINE_CONFIG.OVERRIDE_WITNESS_BENEV_CLIFF_INPUT,
    ),
  }));
  const overriddenBenevDelta = credence.tauBenev - piece.credence.tauBenev;
  const event: MatchEvent = {
    t: 'OVERRIDE',
    ply,
    pieceId: piece.id,
    san,
    pieceTrustDelta: ENGINE_CONFIG.OVERRIDE_PIECE_TRUST_PENALTY,
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
    overriddenPiece,
    witnesses: updatedWitnesses,
    event,
    witnessEvents,
  };
}
