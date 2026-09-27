---
name: sprite-asset-pipeline
description: Produce isometric piece sprites and animation frames for The Kings and I — anchor-first generation, deterministic post-processing with `pnpm assets`, and the contact-sheet QC loop. Use whenever creating, restyling, or auditing game art assets (sprites, piece packs, board textures).
---

# Sprite asset pipeline

Goal: AI-generated art lands in `public/assets/packs/<pack>/` as transparent,
tile-sized PNGs the renderer can consume — without a human shuttling files.

## The loop

1. **Style anchor first.** Generate or obtain ONE reference image per pack
   (e.g. the white king) and get the user to approve it before generating
   anything else. Every other sprite is derived from that anchor
   (style-reference / img2img) — never independent text prompts, or the set
   will be twelve different art styles.
2. **Stage raws** in `assets-src/<pack>/` (gitignored). One sprite per file;
   filename becomes the sprite name (normalized to kebab-case).
3. **Process:** `pnpm assets -- --set <pack>` (or `pnpm assets --set <pack>`).
   Each raw → rembg cutout → alpha-trim → fit into the tile box →
   `public/assets/packs/<pack>/<name>.png`, plus `manifest.json` and
   `contact-sheet.png`.
4. **Self-QC:** open `contact-sheet.png` and LOOK at it — fringing, clipped
   pieces, wrong perspective, style drift. `alphaMean` in the manifest flags
   cutouts that silently failed (≈0 = still opaque). Regenerate failures.
5. **Human QC:** commit the pack; the contact sheet renders in the PR diff —
   that one image is the user's review surface, not the individual files.
6. `--check` mode (`pnpm assets -- --set <pack> --check`) re-verifies the pack
   on disk against the manifest: existence, tile size, transparency, sha256.

## Options

- `--input <dir>` — stage raws somewhere other than `assets-src/<pack>/`.
- `--size <WxH>` — tile box (default 128x160, pieces are taller than wide).
- `--skip-cutout` — sources that already have alpha (e.g. Blender renders).

## Toolchain (VM, via blueprint — not repo deps)

- `rembg` — `pipx install 'rembg[cpu,cli]'` (the `[cpu]` extra is what pulls
  onnxruntime; bare `pipx install rembg` misses it and `click`). First run
  downloads the u2net model (~176 MB) to `~/.u2net/`.
- ImageMagick — IM7 `magick`, or IM6 `convert`/`montage`/`identify`; the
  script detects both. Montage labels need a real font:
  `fonts-dejavu` (DejaVu-Sans) or `helvetica` fails.
- `blender` headless (`blender -b --python-expr ...`) for animation frames:
  author ONE scene with a fixed iso camera + lighting rig, then render every
  piece/frame through it — deterministic consistency image models can't match.
  Feed renders in with `--skip-cutout`.

## Conventions

- Packs live under `public/assets/packs/<pack>/` alongside the existing
  `packs/military/themeTokens.json` pattern.
- Raws are NOT committed (gitignored `assets-src/`); the manifest's per-sprite
  `source` filename + output sha256 is the provenance record.
- Generation side: Ludo.ai MCP (sprite + animation tools, `generateWithStyle`
  for the anchor pattern) once the user's API key is installed; Replicate MCP
  for plumbing models; built-in `generate_image` as the zero-setup fallback.
