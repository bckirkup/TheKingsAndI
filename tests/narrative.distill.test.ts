import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { distillPack } from '../scripts/distill-dialogue';
import { DIALOGUE_LINES, totalDialogueLineCount } from '../src/narrative';

describe('dialogue distillation (6.2)', () => {
  const pack = JSON.parse(
    readFileSync(
      join(process.cwd(), 'src/narrative/dialoguePack.json'),
      'utf8',
    ),
  ) as {
    version: number;
    situations: Record<string, readonly string[]>;
  };

  it('golden: pack expands to at least 200 lines across all situations', () => {
    const tree = distillPack(pack);
    expect(tree.totalLines).toBeGreaterThanOrEqual(200);
    expect(Object.keys(tree.situations).length).toBe(
      Object.keys(DIALOGUE_LINES).length,
    );
  });

  it('sensitivity: adding a stem increases the expanded line count', () => {
    const base = distillPack(pack).totalLines;
    const augmented = distillPack({
      ...pack,
      situations: {
        ...pack.situations,
        'compliant.order': [
          ...(pack.situations['compliant.order'] ?? []),
          'Extra stem for {role}: {san}.',
        ],
      },
    });
    expect(augmented.totalLines).toBe(base + 6);
  });

  it('runtime tree stays in sync with pack expansion counts', () => {
    expect(totalDialogueLineCount()).toBe(distillPack(pack).totalLines);
  });
});
