import { clampPermille } from './clamp';
import type { PieceState } from './types';

// Distinct from calculateStandingCostComponents in desertion.ts:235-252,
// which computes a roster-normalised aggregate of the piece's own standing.
// Each witness prices the override by its own bond to the overridden piece:
// dyadic affinity plus the prestige it grants that piece's class.
export function witnessAttachmentPermille(
  witness: PieceState,
  target: PieceState,
): number {
  const affinity = witness.dyadicAffinity[target.id] ?? 0;
  const prestige = witness.classPrestige[target.role] ?? 0;
  return clampPermille(Math.trunc((affinity + prestige) * 5));
}
