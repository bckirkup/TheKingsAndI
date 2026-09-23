/**
 * tactical-blueprint theme tokens (Milestone 4.6 / UI plan S1a).
 *
 * These are the pack-shaped `themeTokens` surface for the military-first
 * skin: colour, typography, and board chrome. Later packs swap this object;
 * layout components read CSS variables only.
 */
export const tacticalBlueprintTokens = {
  /* Atmosphere */
  '--bg': '#0a101c',
  '--bg-mid': '#0f1a2e',
  '--surface': '#111a2e',
  '--surface-elevated': '#18233b',
  '--surface-raised': '#1c2a45',
  '--text': '#d9e6ff',
  '--text-muted': '#8fa3c7',
  '--accent': '#3d9aef',
  '--accent-danger': '#e85d6f',
  '--accent-warn': '#d4a017',
  '--accent-muted': '#6b7c93',
  '--grid-line': '#2a3f66',
  '--border': '#2a3f66',

  /* Qualitative bands */
  '--trust-loyal': '#3dcc96',
  '--trust-wary': '#e0b53a',
  '--trust-hostile': '#e85d6f',
  '--heat-cold': '#5b8def',
  '--heat-neutral': '#8fa3c7',
  '--heat-hot': '#e8894d',

  /* Typography — OFL self-hosted via @fontsource (see ThemeProvider) */
  '--font-display':
    '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", sans-serif',
  '--font-ui': '"IBM Plex Sans", "Segoe UI", "Helvetica Neue", sans-serif',
  '--font-mono':
    '"IBM Plex Mono", "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace',
  '--font-size-brand': 'clamp(2.75rem, 8vw, 4.5rem)',
  '--font-size-title': '1.35rem',
  '--font-size-body': '1rem',
  '--font-size-caption': '0.8rem',
  '--letter-spacing-brand': '0.04em',
  '--letter-spacing-caps': '0.12em',
  '--line-height-body': '1.55',

  /* Board chrome */
  '--board-size': 'min(72vmin, 640px)',
  '--board-light': '#1e2d4a',
  '--board-dark': '#121c30',
  '--board-frame': '#243554',
  '--board-coord': '#6f84a8',
  '--board-lastmove': 'rgba(61, 154, 239, 0.28)',
} as const;

export type ThemeTokens = typeof tacticalBlueprintTokens;

/** Pack id this token set belongs to (ADR 0023 / D223 military-first). */
export const TACTICAL_BLUEPRINT_PACK_ID = 'tactical-blueprint' as const;
