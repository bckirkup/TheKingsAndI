import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  TACTICAL_BLUEPRINT_PACK_ID,
  tacticalBlueprintTheme,
  tacticalBlueprintTokens,
} from '../src/ui/theme/tacticalBlueprint';
import { TRUST_AURA_SHAPE } from '../src/ui/overlays/PieceOverlay';
import type { TrustBandWord } from '../src/ui/qualitativeLabels';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

describe('S1 themeTokens (tactical-blueprint / military)', () => {
  it('exports a pack-shaped themeTokens map with typography and board chrome', () => {
    expect(tacticalBlueprintTheme.packId).toBe(TACTICAL_BLUEPRINT_PACK_ID);
    expect(tacticalBlueprintTokens['--font-display']).toMatch(
      /Barlow Condensed/,
    );
    expect(tacticalBlueprintTokens['--font-body']).toMatch(/Barlow/);
    expect(tacticalBlueprintTokens['--font-mono']).toMatch(/IBM Plex Mono/);
    expect(tacticalBlueprintTokens['--board-frame']).toMatch(/^#/);
    expect(tacticalBlueprintTokens['--font-size-brand']).toMatch(/clamp/);
  });

  it('grades distinct aura shape classes per trust band (colour-safe prep)', () => {
    const bands: TrustBandWord[] = ['hostile', 'wary', 'loyal'];
    const shapes = bands.map((band) => TRUST_AURA_SHAPE[band]);
    expect(new Set(shapes).size).toBe(bands.length);
    expect(TRUST_AURA_SHAPE.hostile).toContain('hostile');
    expect(TRUST_AURA_SHAPE.wary).toContain('wary');
    expect(TRUST_AURA_SHAPE.loyal).toContain('loyal');
  });

  it('keeps military pack themeTokens in sync with the live token object', () => {
    const packPath = join(
      repoRoot,
      'public/assets/packs/military/themeTokens.json',
    );
    const pack = JSON.parse(readFileSync(packPath, 'utf8')) as {
      readonly packId: string;
      readonly themeTokens: Record<string, string>;
    };
    expect(pack.packId).toBe('military');
    for (const [key, value] of Object.entries(tacticalBlueprintTokens)) {
      expect(pack.themeTokens[key], key).toBe(value);
    }
  });

  it('documents board overlay hit-testing as non-blocking for chessground', () => {
    const css = readFileSync(
      join(repoRoot, 'src/app/tacticalBlueprint.css'),
      'utf8',
    );
    expect(css).toMatch(
      /\.board-stack__overlays\s*\{[^}]*pointer-events:\s*none/s,
    );
    expect(css).toMatch(/\.piece-overlay\s*\{[^}]*pointer-events:\s*none/s);
    expect(css).toMatch(
      /\.piece-overlay__inspect\s*\{[^}]*pointer-events:\s*auto/s,
    );
  });
});
