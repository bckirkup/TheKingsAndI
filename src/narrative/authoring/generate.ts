import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCoverage } from '../coverage';
import { loadDialogueTree } from '../tree';
import { CORPUS } from './corpus';

/**
 * Distillation is a build step, not a runtime (ADR 0004 §2). This script is the
 * committed generator: it validates the authored corpus, checks coverage, and
 * emits `data/dialogue-tree.json`. Regenerating the tree is therefore a
 * reviewable diff — nobody ships prose nobody read.
 *
 * Run with `pnpm narrative:generate`.
 */

export function renderTreeJson(tree = CORPUS): string {
  return `${JSON.stringify(tree, null, 2)}\n`;
}

const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'dialogue-tree.json',
);

async function main(): Promise<void> {
  const tree = loadDialogueTree(CORPUS);
  const report = validateCoverage(tree);
  if (!report.ok) {
    console.error('Dialogue tree coverage failed:');
    for (const issue of report.issues) console.error(`  - ${issue}`);
    process.exitCode = 1;
    return;
  }
  const output = renderTreeJson(CORPUS);
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, output, 'utf8');
  console.log(
    `Wrote dialogue tree: ${report.reachableCount} reachable situations, all covered.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
