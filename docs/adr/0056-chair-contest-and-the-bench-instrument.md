# ADR 0056 — Origin-inclusive chair contests and the bench instrument

- **Status:** Accepted and wired in the harness/pool path
- **Date:** 2026-08-19
- **Scope:** `sim/` season pools and degeneracy instrumentation only
- **Related:** ADR 0054 (D148), ADR 0051 (non-selection), ADR 0055 (earned ability)

## Context

The first pool implementation treated a member's match-local `state.role` as
her only bracket. After promotion this moved a pawn from eight origin chairs
into the single queen chair. The measured post-promotion selection rates versus
unpromoted same-origin controls were:

| Leader / policy | Post-promotion | Unpromoted control |
|---|---:|---:|
| supportive / `rest_traumatised` | 0.09 | 0.67 |
| supportive / `veteran_first` | 0.26 | 0.77 |
| supportive / `strongest_available` | 0.40 | 0.87 |
| tyrannical / `strongest_available`, seed 7 | 0.20 | 0.65 |

This was an elevation trap rather than an ordinary consequence of bench
competition: a crowned member who lost the queen chair could no longer contest
her origin chair and was eventually retired for obsolescence.

ADR 0055's relative-origin ability ordering is intentional. A pawn whose
earned ability is `+18` can outrank a queen whose earned ability is `+5`;
the crown is therefore contestable rather than an unconditional appointment.

## Decision

The harness pool stores `PoolMember.attainedRole`, the highest role reached by
that member through folded `PROMOTION` events. `originRole` remains permanent.
For a chair role `R`, eligibility is:

```text
member.originRole === R || member.attainedRole === R
```

Chairs are filled highest-first in this explicit order:

```text
King, Queen, Rook, Bishop, Knight, Pawn
```

Selected IDs are deduplicated across brackets. A crowned member therefore
contests the attained-role chair first and falls back to the origin chair only
when not selected. The selected chair role is written into the fielded
`PieceState.role`; the persistent attained role remains separate. This
reconciles the harness with `PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES = false`:
the role is match-local, while attainment is historical.

The pool snapshots and season result expose distinct members fielded, bench
utilisation, lineup churn, post-promotion selection, unpromoted origin-role
control, crowned pieces never fielded again, and crowned obsolescence
retirement. The named detectors `promotion-decoration`, `promotion-trap`, and
`frozen-bench` are wired through the existing degeneracy options.

## Consequences

Promotion preserves a member's original chair access instead of making
elevation itself a retirement hazard. Non-selection, trust erosion, and
obsolescence rules are unchanged. Fielding policy still controls which
eligible member wins each chair, and ability remains relative to origin-role
starting ability.

The metrics are season/window measurements, not player-facing telemetry. The
event log remains authoritative for promotion identity; pool folds derive
attainment from those events.

ADR 0054's app persistence and UI bench work remains outside this slice. D148
and D150 remain open.

## Implementation

- `sim/pool.ts:39-206` — attained-role state, chair order, fold, snapshots, and
  season metrics
- `sim/season.ts:40-157` — lineup, promotion-window, and season metric wiring
- `sim/degeneracy.ts:1-420` — named pool degeneracy findings
- `tests/season.test.ts` — chair contest, fallback, deduplication, and role
  write-back probes
- `tests/sim.test.ts` — degenerate/healthy detector probes

ADR 0055 already occupies number 0055 for D149, so this decision is recorded
under the next genuinely free ADR number rather than overwriting that history.
