import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  TACTICAL_BLUEPRINT_PACK_ID,
  tacticalBlueprintTheme,
  tacticalBlueprintTokens,
  type ThemeTokens,
} from '../src/ui/theme/tacticalBlueprint';
import { TRUST_AURA_SHAPE } from '../src/ui/overlays/PieceOverlay';
import type { TrustBandWord } from '../src/ui/qualitativeLabels';

const TOKEN_GROUPS = {
  atmosphere: ['--bg', '--surface', '--text', '--accent', '--grid-line'],
  typography: [
    '--font-display',
    '--font-ui',
    '--font-mono',
    '--font-size-brand',
    '--letter-spacing-brand',
  ],
  board: [
    '--board-size',
    '--board-light',
    '--board-dark',
    '--board-frame',
    '--board-coord',
    '--board-lastmove',
  ],
} as const;

describe('tactical-blueprint themeTokens (S1a)', () => {
  it('exports pack id and every required token group', () => {
    expect(TACTICAL_BLUEPRINT_PACK_ID).toBe('tactical-blueprint');
    for (const keys of Object.values(TOKEN_GROUPS)) {
      for (const key of keys) {
        expect(tacticalBlueprintTokens[key as keyof ThemeTokens]).toEqual(
          expect.any(String),
        );
        expect(
          String(tacticalBlueprintTokens[key as keyof ThemeTokens]).length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('grades board square contrast when light/dark tokens change', () => {
    const parseHex = (hex: string): number => Number.parseInt(hex.slice(1), 16);
    const lights = ['#1e2d4a', '#2a3f66', '#3d5a8a'].map(parseHex);
    const dark = parseHex(tacticalBlueprintTokens['--board-dark']);
    const deltas = lights.map((light) => light - dark);
    // Distinct gaps and monotone: lighter squares stay above dark, and
    // raising the light token widens the gap (wiring probe for board chrome).
    expect(new Set(deltas).size).toBe(deltas.length);
    expect(deltas).toEqual([...deltas].sort((a, b) => a - b));
    expect(deltas[0]).toBeGreaterThan(0);
  });

  it('keeps display font off generic AI stacks', () => {
    const display = tacticalBlueprintTokens['--font-display'].toLowerCase();
    for (const banned of ['inter', 'roboto', 'arial,', 'system-ui']) {
      expect(display.includes(banned)).toBe(false);
    }
    expect(display).toContain('barlow condensed');
  });
});

describe('trust aura shape encoding (S1, colour-safe prep for M7.3)', () => {
  it('grades distinct aura shape classes per trust band', () => {
    const bands: TrustBandWord[] = ['hostile', 'wary', 'loyal'];
    const shapes = bands.map((band) => TRUST_AURA_SHAPE[band]);
    expect(new Set(shapes).size).toBe(bands.length);
    expect(TRUST_AURA_SHAPE.hostile).toContain('hostile');
    expect(TRUST_AURA_SHAPE.wary).toContain('wary');
    expect(TRUST_AURA_SHAPE.loyal).toContain('loyal');
  });
});

describe('military pack themeTokens (D223, pack-as-data)', () => {
  it('keeps the military JSON in sync with the live token object', () => {
    const packPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../public/assets/packs/military/themeTokens.json',
    );
    const pack = JSON.parse(readFileSync(packPath, 'utf8')) as {
      readonly packId: string;
      readonly extends?: string;
      readonly themeTokens: Record<string, string>;
    };
    expect(pack.packId).toBe('military');
    expect(pack.extends).toBe(TACTICAL_BLUEPRINT_PACK_ID);
    expect(tacticalBlueprintTheme.packId).toBe(TACTICAL_BLUEPRINT_PACK_ID);
    for (const [key, value] of Object.entries(tacticalBlueprintTokens)) {
      expect(pack.themeTokens[key], key).toBe(value);
    }
  });
});

describe('board overlay hit-testing contract (S1 / S2a)', () => {
  const cssPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../src/app/tacticalBlueprint.css',
  );
  const css = readFileSync(cssPath, 'utf8');

  it('keeps overlay shell pointer-events none so chessground receives drags', () => {
    expect(css).toMatch(
      /\.board-stack__overlays\s*\{[^}]*pointer-events:\s*none/s,
    );
    expect(css).toMatch(/\.piece-overlay\s*\{[^}]*pointer-events:\s*none/s);
  });

  it('exposes only the select chip as the hit target', () => {
    expect(css).toMatch(
      /\.piece-overlay__select\s*\{[^}]*pointer-events:\s*auto/s,
    );
    // Regression: full-square auto on the shell or the old descendant rule.
    expect(css).not.toMatch(
      /\.board-stack__overlays\s+\.piece-overlay\s*\{[^}]*pointer-events:\s*auto/s,
    );
  });
});
