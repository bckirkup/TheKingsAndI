# ADR 0005 — Engine determinism accepted; topology still open

- **Status:** partially accepted — D10 accepted 2026-07-26; **D9 resolved by
  ADR 0017** (shared search, private scoring). The topology discussion below is
  superseded; the determinism half stands.
- **Date:** 2026-07-26

## Context
A literal "each piece is its own Stockfish evaluator" implementation means up to
16 WASM instances per side: memory blowup plus largely duplicated search of the
same position. Separately, time-based search would make every golden test flaky
and every replay non-reproducible.

## Decision — determinism (D10, accepted)
Depth-limited search only: `go depth N`, single thread, fixed hash, pinned
stockfish.wasm version, with `deterministic` recorded in every `MatchRecord`.
No time-based search, ever.

## Still open — topology (D9)
The owner has not ruled. The recommendation stands: a worker pool of
`min(hardwareConcurrency - 1, 4)`, one canonical multi-PV search per position at
`D_max`, with per-piece insight as a truncation of that tree to `D_i` plus a
bias/noise model — and optionally genuine shallow searches for the few pieces the
player is actively consulting.

Two later decisions raise the stakes: ADR 0012 sets the memory budget from the
*web* build, and D5 (symmetric opponent psychology) roughly doubles engine work.
Both argue against the per-piece reading.

## Consequences
Reproducible goldens and replays are guaranteed by the accepted half. "Novice
pieces are wrong in a plausible way" becomes an explicit model to design rather
than an emergent property of shallow search — and under ADR 0008 that wrongness
surfaces as advice and as willingness to obey, never as a substituted move.
