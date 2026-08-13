# ADR 0051: Non-selection, redemption, and obsolescence

## Status

Accepted for the season-pool slice; coefficient and threshold calibration
remains open.

## Decision

An available pool member records consecutive matches in which the commander
does not select it. Recovery absence is not non-selection. Being selected
resets the streak and can provide weaker trust redemption after a sustained
run, while a sustained run also produces a season-boundary trust consequence
for the passed-over piece and smaller bonded-peer consequences using the
existing shared-bond and empathy shape.

Non-selection trust effects do not change morale. D22 remains open and is not
resolved by this mechanism.

A non-King that remains available and unchosen for the obsolescence threshold
becomes obsolete. Obsolescence is a distinct recorded pool event and career
ending, separate from trauma retirement and desertion. The existing
trauma-threshold retirement remains unchanged.

## Consequences

- Selection history remains pool state, not a new `PieceState` field.
- Trust changes are integer-valued and clamped; no passive recovery is added.
- `PoolEvent` records are the season-boundary event-log evidence for trust
  adjustments and obsolescence.
- Fielding policies do not read reputation or obsolescence signals.
- Defaults are calibration hypotheses, not settled psychological constants.
