# ADR 0006 — Licensing posture

- **Status:** OPEN — decision required, time-sensitive (design_decisions.md D16)
- **Date:** 2026-07-26

## Context
The repository is AGPL-3.0. The executive-leadership-lab audience track implies
possible commercial/white-label licensing, which corporate and government buyers
frequently refuse under AGPL. Dual-licensing requires single-copyright ownership,
so it must be decided before outside contributions arrive.

## Options
- A. Keep AGPL-3.0
- B. Dual-license: AGPL-3.0 + commercial (requires CLA or sole authorship)
- C. Relicense to MIT/Apache-2.0

## Recommendation
B if there is any chance of pursuing the exec-lab revenue path; otherwise A.
Decide before the first external contribution.

## Consequences (of B)
Needs a CLA/DCO process and copyright hygiene in every PR; enables selling a
non-copyleft license later without re-licensing negotiations.
