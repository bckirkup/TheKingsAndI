import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CORPUS } from '../src/narrative/authoring/corpus';
import { renderTreeJson } from '../src/narrative/authoring/generate';
import { DEFAULT_TREE } from '../src/narrative/authoredProvider';
import { validateCoverage } from '../src/narrative/coverage';
import { reachableSituations } from '../src/narrative/situations';

const TREE_JSON_URL = new URL(
  '../src/narrative/data/dialogue-tree.json',
  import.meta.url,
);

describe('dialogue tree coverage', () => {
  it('covers every reachable situation with a non-empty line', () => {
    const report = validateCoverage(DEFAULT_TREE);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('enumerates the reachable situation set deterministically', () => {
    // 2 positive verdicts + 4 negative × 6 grievances × 3 × 3 credence bands.
    expect(reachableSituations()).toHaveLength(2 + 4 * 6 * 3 * 3);
  });

  it('keeps the committed JSON in sync with the reviewed corpus', () => {
    const committed = readFileSync(fileURLToPath(TREE_JSON_URL), 'utf8');
    expect(committed).toBe(renderTreeJson(CORPUS));
  });
});
