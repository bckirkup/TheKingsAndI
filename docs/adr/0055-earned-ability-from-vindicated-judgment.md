# ADR 0055 — Earned ability from vindicated judgment

Status: Accepted direction; mechanism shipped at zero magnitude

## Decision

A piece's ability `E_i` is earnable from her own read of the position being
proved right. The existing vindication truth is reused rather than recomputed:
for an objector, `wasRight = !vindicated`; for a non-objector,
`wasRight = vindicated`. Only the acting objector and existing near-refusal
pieces stake judgments and are graded.

The reducer follows ADR 0043's integer-rational, curved asymmetry. Being wrong
costs ability quickly, while being right rebuilds it slowly and gains diminish
near the ceiling. The mechanism is deterministic, integer-valued, and clamped
to the existing `[1, 100]` range. It is wired at zero shipped magnitude:
the default step scale is `0`, so default behavior remains bit-identical to the
pre-mechanism harness. The calibrated nonzero magnitude remains open.

An `ABILITY_GRADE` event records the piece, ply, polarity, and applied delta.
Campaign ability spread metrics fold the resulting state, while the pool ranks
fielding ability relative to the origin role's starting ability so promotion
does not preserve a permanent birth-role handicap.

## Implementation

- `src/psychology/reducers.ts:65-108`
- `src/orchestration/psychologyHooks.ts:270-285`
- `src/psychology/types.ts:236-243`
- `sim/pool.ts:252-277`
- `sim/metrics.ts:526-650`

## Consequences

Ability can form a quality gradient over service, and a promoted pawn can
compete on demonstrated ability rather than absolute birth-role ability.
Because the shipped scale is zero, no calibration claim or balance threshold is
made here. D148 (promotion's campaign-scale meaning and clamp ceiling) and D150
(what a commander may know about a piece) remain open.
