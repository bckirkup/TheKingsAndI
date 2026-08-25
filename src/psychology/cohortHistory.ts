import {
  COHORT_HISTORY_CONFIG,
  type CohortHistory,
  type CohortHistoryConfig,
} from '../core/cohortHistory';
import { clampAffinity } from './clamp';
import { normalizePieceState } from './reducers';
import type { PieceState } from './types';

const OFFICER_ROLES: readonly PieceState['role'][] = [
  'Knight',
  'Bishop',
  'Rook',
  'Queen',
];

/**
 * Fold the private ledger into one piece's existing memories. Relations are
 * directed, so each piece receives only the rows whose `from` is its id.
 */
export function applyCohortHistory(
  piece: PieceState,
  history: CohortHistory,
  config: CohortHistoryConfig = COHORT_HISTORY_CONFIG,
): PieceState {
  if (history.relations.length === 0) return piece;
  const dyadicAffinity = { ...piece.dyadicAffinity };
  const classPrestige = { ...piece.classPrestige };
  const prestigeShove = Math.max(0, Math.trunc(config.BEREAVED_PRESTIGE_SHOVE));
  for (const relation of history.relations) {
    if (relation.from !== piece.id) continue;
    const weight = Math.max(0, Math.trunc(relation.weight));
    const signedWeight = relation.type === 'resents' ? -weight : weight;
    dyadicAffinity[relation.to] = clampAffinity(
      (dyadicAffinity[relation.to] ?? 0) + signedWeight,
    );
    if (relation.type !== 'bereaved_together' || prestigeShove === 0) continue;
    for (const role of OFFICER_ROLES) {
      classPrestige[role] = clampAffinity(classPrestige[role] - prestigeShove);
    }
  }
  return normalizePieceState({
    ...piece,
    dyadicAffinity,
    classPrestige,
  });
}
