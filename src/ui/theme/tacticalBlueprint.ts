/** tactical-blueprint theme tokens (Milestone 4.6). */
export const tacticalBlueprintTokens = {
  '--bg': '#0b1220',
  '--surface': '#111a2e',
  '--surface-elevated': '#18233b',
  '--text': '#d9e6ff',
  '--text-muted': '#8fa3c7',
  '--accent': '#4da3ff',
  '--accent-danger': '#ff5c7a',
  '--grid-line': '#2a3f66',
  '--trust-loyal': '#4de1a0',
  '--trust-wary': '#f5c542',
  '--trust-hostile': '#ff5c7a',
  '--heat-cold': '#5b8def',
  '--heat-neutral': '#8fa3c7',
  '--heat-hot': '#ff8f4d',
  '--board-size': 'min(72vmin, 640px)',
} as const;

export type ThemeTokens = typeof tacticalBlueprintTokens;
