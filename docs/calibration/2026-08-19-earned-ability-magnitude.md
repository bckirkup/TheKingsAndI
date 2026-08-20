# D149 earned ability — magnitude calibration on the corrected grading base

Harness: `probe/probe-earned.ts`, fake engine, opponent `tyrannical`, 6 matches
per cell, seeds 0 / 7 / 11, curvature 2, heeded gain multiplier 2. Control is
scale 0 (no-op).

## What the two channels measure

| leader | forced right rate | heeded right rate |
|---|---:|---:|
| supportive | 0.861 – 0.881 | 0.959 – 1.000 |
| tyrannical | 0.825 – 0.855 | 0.385 – 0.491 |

The forced channel barely separates the styles (both leaders overrule roughly-right
pieces ~85% of the time). The separation lives almost entirely in the heeded
channel: a supportive commander accepts refusals that reality then vindicates; a
tyrant accepts the wrong ones and forces the rest. Being listened to is what
distinguishes leadership.

## Final-state ability (King, and the officer band)

| scale | loss mult | supportive King | tyrannical King (depth) | tyrannical worst per-match min |
|---:|---:|---|---|---:|
| 0 | – | 80 | 80 (13) | 20 |
| 2 | 1 | 80 / 83 / 85 | 47 / 56 / 70 (8 / 9 / 11) | 20 |
| 2 | 2 | 80 / 83 | 15 / 29 (4 / 6) | 15 |
| 3 | 1 | 80 / 86 / 90 | 36 / 44 / 64 (7 / 8 / 10) | 19 |
| 3 | 2 | 80 / 86 | 63 / 70 | 1 |
| 3 | 3 | 80 / 86 | 43 / 63 | 1 |

Officers under supportive command rise from the 55 baseline to 62–70; pawns
that are never consulted stay at 20. Nothing reaches the ceiling of 100 in any
cell, so there is no runaway competence spiral at these scales.

## Why loss multiplier 1

Curvature already supplies the ADR 0043 asymmetry: at mid-ability a loss step
is roughly three times a gain step, before any multiplier. Multiplying on top
of that drives the tyrant's King to 15–29 — sight of 4–6 plies, i.e. worse than
a starting pawn — and at scale 3 pins whole rosters to 1 (2 plies). That is the
collapse regime, not a gradient.

## Match-level consequences (scale 2, loss mult 1 vs control)

Win score, plies, refusals and desertions are unchanged from the control in five
of six leader×seed cells; the sixth (seed 11, tyrannical) shifts desertions 12 →
8 and win 16.7 → 8.3. Promotions stay in the 0.33–0.67 per match band
established after the harness fix.

## Adopted defaults

```text
ABIL_EARNED_STEP_SCALE = 2      (from 0)
ABIL_EARNED_LOSS_MULTIPLIER = 1 (from 2)
ABIL_EARNED_CURVATURE = 2       (unchanged)
ABIL_EARNED_HEEDED_GAIN_MULTIPLIER = 2 (unchanged)
```

Still open: D148 (cohort prestige), D150 (testimony / knowledge visibility),
and whether the forced channel deserves its own weight given how little it
separates styles.
