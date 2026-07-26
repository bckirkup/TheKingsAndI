# ADR 0005 — Engine insight topology

- **Status:** proposed (recommended; see design_decisions.md D9, D10)
- **Date:** 2026-07-26

## Context
A literal "each piece is its own Stockfish evaluator" implementation means up to
16 WASM instances per side: memory blowup on mobile plus largely duplicated
search of the same position.

## Decision (proposed)
A worker pool of `min(hardwareConcurrency - 1, 4)`. One canonical multi-PV search
per position at `d_max`; per-piece insight is a truncation of that tree to `d_i`
plus a bias/noise model for low-experience or disengaged pieces. Optionally run
genuinely separate shallow searches for the few pieces the player is actively
consulting. Search is depth-limited only (`go depth N`), single-threaded, fixed
hash, pinned stockfish.wasm version, and `deterministic` is recorded per match.

## Consequences
Bounded memory; reproducible goldens and replays; "novice pieces are wrong in a
plausible way" becomes an explicit model we must design rather than an emergent
property of shallow search.
