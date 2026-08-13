import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  assertCalibrationBounds,
  assertSmokeBounds,
  detectDegeneracy,
} from './degeneracy';
import { aggregateShardArtifacts, readShardArtifact } from './parallel';
import { canonicalJson } from '../src/core/canonicalJson';

function parseArguments(argumentsList: readonly string[]): {
  inputs: string[];
  out: string | undefined;
  enforceCalibration: boolean;
} {
  const values = new Map<string, string>();
  for (const argument of argumentsList) {
    if (!argument.startsWith('--')) {
      throw new Error(`Unrecognised argument: ${argument}`);
    }
    const separator = argument.indexOf('=');
    if (separator < 3) {
      throw new Error(`Expected --flag=value form: ${argument}`);
    }
    const key = argument.slice(2, separator);
    if (!['inputs', 'out', 'enforce-calibration'].includes(key)) {
      throw new Error(`Unrecognised flag: --${key}`);
    }
    values.set(key, argument.slice(separator + 1));
  }
  const inputs = (values.get('inputs') ?? '')
    .split(',')
    .map((input) => input.trim())
    .filter((input) => input.length > 0);
  if (inputs.length === 0) {
    throw new Error('--inputs must contain at least one artifact path.');
  }
  const enforcement = values.get('enforce-calibration') ?? 'false';
  if (enforcement !== 'true' && enforcement !== 'false') {
    throw new Error('--enforce-calibration must be true or false.');
  }
  return {
    inputs,
    out: values.get('out'),
    enforceCalibration: enforcement === 'true',
  };
}

export { parseArguments };

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const artifacts = await Promise.all(
    options.inputs.map((input) => readShardArtifact(input)),
  );
  const result = aggregateShardArtifacts(artifacts);
  if (options.enforceCalibration) {
    assertCalibrationBounds(result.manifest.leader, result.summary);
  } else if (result.summary.matches <= 20) {
    assertSmokeBounds(result.manifest.leader, result.summary);
  }
  for (const finding of detectDegeneracy(
    result.manifest.leader,
    result.summary.matchMetrics,
    result.summary,
  )) {
    console.log(`degeneracy=${finding.code} ${finding.message}`);
  }
  const output = `${canonicalJson(result)}\n`;
  if (options.out !== undefined) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
