/**
 * tactical-blueprint pack `themeTokens` (Milestone 4.6 / ADR 0023 §4).
 * Military (D223 first pack) extends this skin; tokens are presentation-only.
 */
export const TACTICAL_BLUEPRINT_PACK_ID = 'tactical-blueprint' as const;

export const tacticalBlueprintTokens = {
  /* Colour */
  '--bg': '#0b1220',
  '--bg-mid': '#0f1a30',
  '--bg-glow': '#152848',
  '--surface': '#111a2e',
  '--surface-elevated': '#18233b',
  '--surface-raised': '#1c2a45',
  '--text': '#d9e6ff',
  '--text-muted': '#8fa3c7',
  '--accent': '#4da3ff',
  '--accent-danger': '#ff5c7a',
  '--accent-warn': '#c9a227',
  '--accent-muted': '#6b7c93',
  '--border': '#2a3f66',
  '--grid-line': '#2a3f66',
  '--trust-loyal': '#4de1a0',
  '--trust-wary': '#f5c542',
  '--trust-hostile': '#ff5c7a',
  '--heat-cold': '#5b8def',
  '--heat-neutral': '#8fa3c7',
  '--heat-hot': '#ff8f4d',
  /* Board chrome */
  '--board-size': 'min(72vmin, 640px)',
  '--board-light': '#1a2740',
  '--board-dark': '#111a2e',
  '--board-frame': '#243858',
  '--board-frame-glow': 'rgba(77, 163, 255, 0.18)',
  '--board-coord': '#6b82a8',
  /* Typography (self-hosted OFL faces under public/assets/fonts/) */
  '--font-display': "'Barlow Condensed', 'Arial Narrow', sans-serif",
  '--font-body': "'Barlow', 'Helvetica Neue', sans-serif",
  '--font-mono':
    "'IBM Plex Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace",
  '--font-size-brand': 'clamp(2.75rem, 8vw, 4.5rem)',
  '--font-size-headline': 'clamp(1.35rem, 3vw, 1.75rem)',
  '--font-size-body': '1.05rem',
  '--letter-brand': '0.06em',
  '--letter-eyebrow': '0.18em',
} as const;

export type ThemeTokenName = keyof typeof tacticalBlueprintTokens;
export type ThemeTokens = typeof tacticalBlueprintTokens;

/** Pack-shaped export for ADR 0023 content-pack consumers (S1a). */
export const tacticalBlueprintTheme = {
  packId: TACTICAL_BLUEPRINT_PACK_ID,
  themeTokens: tacticalBlueprintTokens,
} as const;
