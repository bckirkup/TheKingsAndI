import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanTraitLeakage,
  type TraitLeakageFinding,
} from '../src/narrative/traitLeakage';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const SOURCES = [
  'src/narrative/dialoguePack.json',
  'src/narrative/audit.ts',
  'src/persistence/certificate.ts',
] as const;

async function main(): Promise<void> {
  const findings: TraitLeakageFinding[] = [];
  for (const relativePath of SOURCES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    findings.push(...scanTraitLeakage(source, relativePath));
  }
  for (const finding of findings) {
    console.log(
      `degeneracy=${finding.code} ${finding.source}:${finding.line} contains "${finding.phrase}"`,
    );
  }
  if (findings.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(
    'Trait leakage check passed: no banned disposition phrases found.',
  );
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
