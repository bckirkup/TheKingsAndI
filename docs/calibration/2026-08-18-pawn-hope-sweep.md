# D147 pawn-hope calibration

## Question

Does deterministic promotion prospect restore a measurable stake for pawns
without changing behavior while its standing weight is zero?

## Method

The initial fake-engine sweep uses:

```text
DESERTION_PROMOTION_HOPE_PERMILLE = 0,250,500,1000,2000
matches=6 seed=7
```

Raw outputs are retained under `/home/ubuntu/kai-measure/d147/`.

## Decision

The chosen promotion-hope default is **TBD** pending owner review of the raw
sweep. The “why this number” paragraph is **TBD**.

The diagnostic found that real deserters have `τ_abil` values of 0–2. The
original raw `τ_abil / 100` gate therefore reduced effective hope to 0–20
permille, producing prospective standing costs around `0.013` or exactly zero
against observed desertion margins of `0.27–1.22`. The term's ceiling was not
the problem; the gate was structurally inert.

D147 now uses a provisional credence floor. Effective ability credence is the
integer interpolation from
`DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE` to `1000` using
`τ_abil`. Floor `0` preserves the pure gate, while floor `1000` removes
leadership dependence. The floor default is provisional at `250`; the paired
hope and floor selections remain **TBD** pending owner review.

The posthumous class-shift default is intentionally smaller than the living
heroic-sacrifice class shift; the exact calibration rationale remains **TBD**.

## Implementation status

CAPTURE events, posthumous class credit, promotion prospect, and prospective
standing telemetry are shipped in the D147 branch. See ADR 0053.
