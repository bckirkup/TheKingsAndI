# D147 pawn-hope calibration

## Question

Does deterministic promotion prospect restore a measurable stake for pawns
without changing behavior while its standing weight is zero?

## Method

The nine-style fake-engine sweep uses:

```text
DESERTION_PROMOTION_HOPE_PERMILLE = 0,250,500,1000,2000
matches=6 seed=7
```

Raw outputs are retained under `/home/ubuntu/kai-measure/d147/`.

## Decision

The chosen promotion-hope default is **TBD** pending owner review of the raw
sweep. The “why this number” paragraph is **TBD**.

The posthumous class-shift default is intentionally smaller than the living
heroic-sacrifice class shift; the exact calibration rationale remains **TBD**.

## Implementation status

CAPTURE events, posthumous class credit, promotion prospect, and prospective
standing telemetry are shipped in the D147 branch. See ADR 0053.
