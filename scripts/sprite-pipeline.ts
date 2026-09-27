/**
 * sprite-pipeline — offline post-processing for AI-generated sprite raws.
 *
 *   pnpm assets -- --set <pack> [--input <dir>] [--size <WxH>] [--skip-cutout]
 *   pnpm assets -- --set <pack> --check
 *
 * Raws go in assets-src/<pack>/ (gitignored). Each image is cut out with rembg
 * (u2net), trimmed to its alpha bounding box, and fit into the tile box under
 * public/assets/packs/<pack>/. The pack gets a manifest.json (names, sizes,
 * sha256 of every sprite) and a labelled contact-sheet.png for review.
 * --check re-verifies every manifest entry against the file on disk.
 *
 * Requires on PATH: rembg (pipx install 'rembg[cpu,cli]'), and ImageMagick
 * (magick, or the IM6 convert/montage/identify trio).
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));

const SOURCE_EXTS = new Set(['.png', '.webp', '.jpg', '.jpeg']);
const DEFAULT_SIZE = '128x160';

interface Options {
  readonly set: string;
  readonly inputDir: string;
  readonly width: number;
  readonly height: number;
  readonly skipCutout: boolean;
  readonly check: boolean;
}

interface SpriteEntry {
  readonly file: string;
  readonly source: string;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  /** 1 − mean alpha; near 0 means the cutout failed. */
  readonly alphaMean: number;
}

interface Manifest {
  readonly schema: 1;
  readonly set: string;
  readonly tile: { readonly width: number; readonly height: number };
  readonly sprites: readonly SpriteEntry[];
}

function usage(message: string): never {
  console.error(`sprite-pipeline: ${message}`);
  console.error(
    'usage: --set <pack> [--input <dir>] [--size <WxH>] [--skip-cutout] [--check]',
  );
  process.exit(2);
}

function parseArgs(argv: readonly string[]): Options {
  let set: string | undefined;
  let inputDir: string | undefined;
  let size = DEFAULT_SIZE;
  let skipCutout = false;
  let check = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      continue;
    }
    if (arg === '--set') {
      i += 1;
      set = argv[i];
    } else if (arg === '--input') {
      i += 1;
      inputDir = argv[i];
    } else if (arg === '--size') {
      i += 1;
      size = argv[i] ?? '';
    } else if (arg === '--skip-cutout') {
      skipCutout = true;
    } else if (arg === '--check') {
      check = true;
    } else {
      usage(`unknown argument: ${String(arg)}`);
    }
  }
  if (set === undefined || set === '') usage('--set <pack> is required');
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (match === null) usage(`--size must be WxH, got "${size}"`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  return {
    set,
    inputDir: inputDir ?? join(root, 'assets-src', set),
    width,
    height,
    skipCutout,
    check,
  };
}

async function onPath(command: string): Promise<boolean> {
  try {
    await run('which', [command]);
    return true;
  } catch {
    return false;
  }
}

interface Tools {
  readonly rembg: string;
  readonly convert: string;
  readonly montage: string;
  readonly identify: string;
}

async function resolveTools(): Promise<Tools> {
  if (!(await onPath('rembg'))) {
    throw new Error("rembg not found on PATH (pipx install 'rembg[cpu,cli]')");
  }
  if (await onPath('magick')) {
    return {
      rembg: 'rembg',
      convert: 'magick',
      montage: 'magick montage',
      identify: 'magick identify',
    };
  }
  for (const tool of ['convert', 'montage', 'identify'] as const) {
    if (!(await onPath(tool))) {
      throw new Error(`ImageMagick tool not found on PATH: ${tool}`);
    }
  }
  return {
    rembg: 'rembg',
    convert: 'convert',
    montage: 'montage',
    identify: 'identify',
  };
}

function spriteName(filename: string): string {
  const stem = basename(filename, extname(filename));
  const normalized = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (normalized === '') {
    throw new Error(`cannot derive a sprite name from "${filename}"`);
  }
  return normalized;
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function build(opts: Options, tools: Tools): Promise<void> {
  const outDir = join(root, 'public', 'assets', 'packs', opts.set);
  const tmpDir = join(outDir, '.work');
  await mkdir(tmpDir, { recursive: true });
  const sources = (await readdir(opts.inputDir))
    .filter((f) => SOURCE_EXTS.has(extname(f).toLowerCase()))
    .sort();
  if (sources.length === 0) {
    throw new Error(`no source images in ${opts.inputDir}`);
  }
  const sprites: SpriteEntry[] = [];
  for (const source of sources) {
    const name = spriteName(source);
    const cutout = join(tmpDir, `${name}.cut.png`);
    const target = join(outDir, `${name}.png`);
    if (opts.skipCutout) {
      await run('cp', [join(opts.inputDir, source), cutout]);
    } else {
      await run(tools.rembg, ['i', join(opts.inputDir, source), cutout]);
    }
    await run(tools.convert, [
      cutout,
      '-trim',
      '+repage',
      '-resize',
      `${opts.width}x${opts.height}`,
      '-background',
      'none',
      '-gravity',
      'center',
      '-extent',
      `${opts.width}x${opts.height}`,
      target,
    ]);
    const info = await identify(tools, target);
    sprites.push({
      file: `${name}.png`,
      source,
      width: opts.width,
      height: opts.height,
      sha256: await sha256(target),
      alphaMean: info.alphaMean,
    });
    console.log(`${opts.set}/${name}.png <- ${source}`);
  }
  const manifest: Manifest = {
    schema: 1,
    set: opts.set,
    tile: { width: opts.width, height: opts.height },
    sprites,
  };
  await writeFile(
    join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const [magickCmd, ...magickBase] = tools.montage.split(' ');
  await run(magickCmd ?? 'montage', [
    ...magickBase,
    '-label',
    '%f',
    '-font',
    'DejaVu-Sans',
    '-pointsize',
    '14',
    ...sprites.map((s) => join(outDir, s.file)),
    '-tile',
    '6x',
    '-geometry',
    '+8+8',
    '-background',
    '#202020',
    '-fill',
    'white',
    join(outDir, 'contact-sheet.png'),
  ]);
  await rm(tmpDir, { recursive: true, force: true });
  console.log(
    `wrote ${sprites.length} sprites + manifest.json + contact-sheet.png to ${outDir}`,
  );
}

interface IdentifyInfo {
  readonly width: number;
  readonly height: number;
  readonly opaque: boolean;
  readonly alphaMean: number;
}

async function identify(tools: Tools, path: string): Promise<IdentifyInfo> {
  const [cmd, ...base] = tools.identify.split(' ');
  const { stdout } = await run(cmd ?? 'identify', [
    ...base,
    '-format',
    '%w %h %[opaque] %[fx:1-mean.a]',
    path,
  ]);
  const parts = stdout.trim().split(/\s+/);
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  return {
    width,
    height,
    opaque: parts[2] === 'True',
    alphaMean: Number(parts[3]),
  };
}

async function check(opts: Options, tools: Tools): Promise<void> {
  const outDir = join(root, 'public', 'assets', 'packs', opts.set);
  const manifest = JSON.parse(
    await readFile(join(outDir, 'manifest.json'), 'utf8'),
  ) as Manifest;
  const findings: string[] = [];
  const listed = new Set(manifest.sprites.map((s) => s.file));
  for (const entry of manifest.sprites) {
    const path = join(outDir, entry.file);
    let info: IdentifyInfo;
    try {
      info = await identify(tools, path);
    } catch {
      findings.push(`${entry.file}: missing or unreadable`);
      continue;
    }
    if (
      info.width !== manifest.tile.width ||
      info.height !== manifest.tile.height
    ) {
      findings.push(
        `${entry.file}: size ${info.width}x${info.height} != tile ${manifest.tile.width}x${manifest.tile.height}`,
      );
    }
    if (info.opaque || info.alphaMean < 0.05) {
      findings.push(
        `${entry.file}: no transparent pixels (alphaMean=${info.alphaMean.toFixed(3)}) — background removal failed`,
      );
    }
    if ((await sha256(path)) !== entry.sha256) {
      findings.push(`${entry.file}: sha256 drifted from manifest`);
    }
  }
  for (const file of await readdir(outDir)) {
    if (
      SOURCE_EXTS.has(extname(file).toLowerCase()) &&
      file !== 'contact-sheet.png' &&
      !listed.has(file)
    ) {
      findings.push(`${file}: on disk but absent from manifest`);
    }
  }
  for (const finding of findings) console.error(`FAIL ${finding}`);
  if (findings.length > 0) process.exitCode = 1;
  else
    console.log(
      `pack ${opts.set}: ${manifest.sprites.length} sprites verified against manifest`,
    );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const tools = await resolveTools();
  if (opts.check) await check(opts, tools);
  else await build(opts, tools);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
