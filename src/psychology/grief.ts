import { ENGINE_CONFIG } from './config';
import { clampInt, clampPermille } from './clamp';
import { normalizePieceState } from './reducers';
import type { PieceState } from './types';

export type GriefCause = 'captured' | 'deserted' | 'career_ended';

export interface GriefIncident {
  readonly pieceId: string;
  readonly mournedId: string;
  readonly cause: GriefCause;
  readonly weekOrMatch: number;
}

export interface GriefTransition {
  readonly roster: readonly PieceState[];
  readonly incidents: readonly GriefIncident[];
}

function griefAmount(
  weightPermille: number,
  loadPerLossPermille: number = ENGINE_CONFIG.GRIEF_LOAD_PER_LOSS_PERMILLE,
): number {
  return clampInt(
    (clampPermille(loadPerLossPermille) * clampPermille(weightPermille)) /
      1_000,
    0,
    1_000,
  );
}

/**
 * Apply one deterministic peer-loss reading. The incident is emitted only
 * when the configured load is non-zero, keeping the default event payload
 * unchanged while the mechanism is inert.
 */
export function applyGriefLoss(
  roster: readonly PieceState[],
  mournedId: string,
  cause: GriefCause,
  weekOrMatch: number,
  weightPermille: number = 1_000,
  options: {
    readonly affinityThreshold?: number;
    readonly loadPerLossPermille?: number;
  } = {},
): GriefTransition {
  const amount = clampInt(
    (clampPermille(
      options.loadPerLossPermille ?? ENGINE_CONFIG.GRIEF_LOAD_PER_LOSS_PERMILLE,
    ) *
      clampPermille(weightPermille)) /
      1_000,
    0,
    1_000,
  );
  if (amount === 0) return { roster, incidents: [] };
  const threshold = clampInt(
    options.affinityThreshold ?? ENGINE_CONFIG.GRIEF_AFFINITY_THRESHOLD,
    -100,
    100,
  );
  const incidents: GriefIncident[] = [];
  const next = roster.map((piece) => {
    if (
      piece.id === mournedId ||
      (piece.dyadicAffinity[mournedId] ?? 0) < threshold
    ) {
      return piece;
    }
    incidents.push({ pieceId: piece.id, mournedId, cause, weekOrMatch });
    return normalizePieceState({
      ...piece,
      griefLoad: clampPermille((piece.griefLoad ?? 0) + amount),
    });
  });
  return { roster: next, incidents };
}

export function releaseCaptiveGrief(
  piece: PieceState,
  weightPermille: number = ENGINE_CONFIG.GRIEF_CAPTIVE_WEIGHT_PERMILLE,
  loadPerLossPermille: number = ENGINE_CONFIG.GRIEF_LOAD_PER_LOSS_PERMILLE,
): PieceState {
  const amount = griefAmount(weightPermille, loadPerLossPermille);
  if (amount === 0) return piece;
  return normalizePieceState({
    ...piece,
    griefLoad: Math.max(0, (piece.griefLoad ?? 0) - amount),
  });
}

export function decayGrief(
  piece: PieceState,
  decayPermille: number = ENGINE_CONFIG.GRIEF_DECAY_PERMILLE_PER_MATCH,
): PieceState {
  const decay = clampPermille(decayPermille);
  if (decay === 0 || piece.griefLoad === undefined) return piece;
  return normalizePieceState({
    ...piece,
    griefLoad: Math.max(0, piece.griefLoad - decay),
  });
}

export function applyGriefDecay(
  roster: readonly PieceState[],
  decayPermille: number = ENGINE_CONFIG.GRIEF_DECAY_PERMILLE_PER_MATCH,
): PieceState[] {
  return roster.map((piece) => decayGrief(piece, decayPermille));
}

/**
 * Apply grief after any existing quiet-quit depth adjustment. This helper
 * changes only the depth number; verdict classification remains untouched.
 */
export function applyGriefDepthSuppression(
  depth: number,
  griefLoad: number | undefined,
  suppressionPermille: number = ENGINE_CONFIG.GRIEF_ENGAGEMENT_SUPPRESSION_PERMILLE,
): number {
  const load = clampPermille(griefLoad ?? 0);
  const suppression = clampPermille(suppressionPermille);
  const multiplierNumerator = Math.max(0, 1_000_000 - load * suppression);
  return Math.max(
    1,
    Math.trunc(
      (Math.max(1, Math.trunc(depth)) * multiplierNumerator) / 1_000_000,
    ),
  );
}

export function calculateGriefSearchDepth(
  experienceLevel: number,
  engagementFactor: number,
  griefLoad?: number,
  panicPermille?: number,
): number {
  const boundedExperience = Math.max(1, Math.min(100, experienceLevel));
  const boundedEngagement = Math.max(0.1, Math.min(1, engagementFactor));
  const base = Math.max(
    1,
    Math.floor(
      ENGINE_CONFIG.MIN_SEARCH_DEPTH +
        boundedEngagement *
          (boundedExperience / 100) *
          (ENGINE_CONFIG.MAX_SEARCH_DEPTH - ENGINE_CONFIG.MIN_SEARCH_DEPTH),
    ),
  );
  const griefDepth = applyGriefDepthSuppression(base, griefLoad);
  const panic = Math.max(0, Math.min(1_000, Math.trunc(panicPermille ?? 0)));
  return Math.max(1, Math.trunc((griefDepth * (1_000 - panic)) / 1_000));
}
