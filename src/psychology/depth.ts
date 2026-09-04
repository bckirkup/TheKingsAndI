import { ENGINE_CONFIG } from './config';
import { applyGriefDepthSuppression } from './grief';

/**
 * D_i = max(1, floor(D_min + η_i · (E_i / 100) · (D_max - D_min)))
 * (docs/psychology_engine.md §3)
 */
export function calculateEngineSearchDepth(
  experienceLevel: number,
  engagementFactor: number,
  dMin: number = ENGINE_CONFIG.MIN_SEARCH_DEPTH,
  dMax: number = ENGINE_CONFIG.MAX_SEARCH_DEPTH,
  griefLoad?: number,
): number {
  const boundedExperience = Math.max(1, Math.min(100, experienceLevel));
  const boundedEngagement = Math.max(0.1, Math.min(1.0, engagementFactor));
  const span = dMax - dMin;
  const rawDepth = dMin + boundedEngagement * (boundedExperience / 100) * span;
  return applyGriefDepthSuppression(
    Math.max(1, Math.floor(rawDepth)),
    griefLoad,
  );
}
