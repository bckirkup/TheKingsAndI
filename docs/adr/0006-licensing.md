# ADR 0006 — Licensing: dual-license AGPL-3.0 + commercial

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D16)
- **Date:** 2026-07-26

## Context
The repository is AGPL-3.0. The leadership-training path implies possible
commercial/white-label licensing, which corporate and government buyers
frequently refuse under AGPL. Dual-licensing requires single-copyright
ownership, so it had to be decided before outside contributions arrive.

## Decision
**Dual-license.** AGPL-3.0 remains the open build; commercial terms are
available separately from the copyright holder. Declared now, before any outside
contribution exists. See [`LICENSING.md`](../../LICENSING.md).

## Consequences
- Every contribution needs an explicit relicensing grant. `CONTRIBUTING.md` now
  carries those terms and requires `git commit -s`. Merging an outside PR without
  it silently forecloses the commercial track.
- **Dependency licenses become a gate.** Prefer MIT/BSD/Apache-2.0/ISC.
- **Stockfish is GPL-3.0** and cannot be linked into a proprietary build. This is
  the largest practical constraint on the commercial track and needs a plan
  before it is real: keep the engine only in the AGPL build, isolate it as a
  separate GPL component behind a process boundary, substitute a permissive
  engine, or keep the commercial offering AGPL-compliant and sell content and
  support instead. Discovering this late would be expensive.
- ADR 0012 (Steam) makes the commercial build a real artifact rather than a
  hypothetical, so the Stockfish question is on the Milestone 1 critical path.

## Alternatives considered
Keep AGPL only (forecloses the corporate path); relicense to MIT/Apache-2.0
(maximum adoption, no leverage, and irreversible).
