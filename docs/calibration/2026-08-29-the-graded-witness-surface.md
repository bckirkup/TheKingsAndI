# 2026-08-29 — The graded witness surface (D176 evidence)

**Read before choosing any D170/D174 magnitude.** ADR 0070 shipped both knobs
inert; this is the joint measurement that must precede a live value. It also
corrects, with numbers, the reading recorded when the acceptance test was
written: at unit scale, grading the witness *down* widens the region where the
proportional cliff truncates to zero (`tests/curdle.floor.test.ts` records the
threshold moving from `tauBenev = 4` to `8` at half charge), and the natural
inference was that a cheaper witness therefore buys back free insistence over a
campaign. **The campaign measurement inverts that inference.**

## Method

Fake engine, seed 7, `--opponent=tyrannical`, 4 matches per cell, all knobs set
explicitly through `--grid`/`--fixed` so the table does not depend on which
defaults the tree carries:

```
pnpm -s sim:sweep \
  --grid='OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE=250,500,1000,2000;OVERRIDE_STANDING_PRICE_PERMILLE=0,500,1000' \
  --matches=4 --seed=7 --leader=<style> --opponent=tyrannical --engine=fake \
  --fixed=BENEV_REGARD_STEP=50,BENEV_REPAIR_STEP=30,BENEV_BETRAYAL_CLIFF_PERMILLE=250
```

Two conditions, chosen because they are the only styles that still carry
residual free insistence after #151: `tyrannical` (0.3411 of plies) and
`redeemer` (0.0731). The `1000 / 0` cell reproduces the post-#151 baseline
exactly on both, which is the sanity check that the arms are comparable.
A second pass extends the standing axis to `2000, 4000, 8000` at the
recommended multiplier.

## The surface

`tyrannical`, 12 cells (mult × standing):

| mult | standing | free insistence | free overrides | benev loss target | benev loss witness | `tau_benev` end |
|---:|---:|---:|---:|---:|---:|---:|
| 250 | 0 | **0.0000** | 0.00 | 420.50 | 435.75 | 33.50 |
| 250 | 500 | **0.0000** | 0.00 | 415.25 | 447.75 | 32.44 |
| 250 | 1000 | **0.0000** | 0.00 | 408.75 | 462.75 | 31.19 |
| 500 | 0 | **0.0000** | 0.00 | 320.75 | 699.00 | 24.81 |
| 500 | 500 | **0.0000** | 0.00 | 317.75 | 708.00 | 24.38 |
| 500 | 1000 | **0.0000** | 0.00 | 311.25 | 722.00 | 23.44 |
| 1000 | 0 | 0.3411 | 0.75 | 222.00 | 931.50 | 19.75 |
| 1000 | 500 | 0.3704 | 1.00 | 218.50 | 936.75 | 19.31 |
| 1000 | 1000 | 0.3704 | 1.00 | 215.75 | 942.00 | 19.19 |
| 2000 | 0 | 0.3816 | 2.50 | 148.00 | 1095.00 | 15.63 |
| 2000 | 500 | 0.3816 | 2.50 | 145.50 | 1099.25 | 15.56 |
| 2000 | 1000 | 0.3816 | 2.50 | 142.50 | 1104.50 | 15.50 |

`redeemer`, same grid, condensed to the axis that moves:

| mult | standing | free insistence | free overrides | override count | benev loss target | benev loss witness | `tau_benev` end |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 250 | 0 | **0.0000** | 0.00 | 18.50 | 221.00 | 254.00 | 66.50 |
| 500 | 0 | **0.0000** | 0.00 | 18.50 | 183.00 | 447.75 | 58.50 |
| 500 | 1000 | **0.0000** | 0.00 | 18.50 | 178.75 | 466.50 | 56.75 |
| 1000 | 0 | 0.0731 | 0.25 | 18.50 | 140.00 | 654.50 | 48.75 |
| 2000 | 0 | 0.0731 | 0.25 | **32.25** | 306.50 | 927.00 | 30.25 |

Extended standing axis at `mult = 500`:

| standing | style | free insistence | benev loss target | benev loss witness | `tau_benev` end |
|---:|---|---:|---:|---:|---:|
| 2000 | tyrannical | **0.0000** | 301.00 | 740.50 | 22.69 |
| 4000 | tyrannical | **0.0000** | 284.25 | 773.50 | 21.13 |
| 8000 | tyrannical | 0.2019 | 259.75 | 824.75 | 19.56 |
| 2000 | redeemer | **0.0000** | 175.00 | 481.50 | 55.00 |
| 4000 | redeemer | **0.0000** | 169.00 | 509.00 | 53.25 |
| 8000 | redeemer | **0.0000** | 159.25 | 553.25 | 49.75 |

## What the surface says

**1. Depletion dominates truncation, so the unit-scale intuition is backwards.**
A cheaper witness charge does widen the per-state zero-charge band, but the
thing that actually makes an override free over a campaign is a room already
drained to zero — and today's multiplier is what drains it. Halving the witness
charge removes free insistence *entirely* on both conditions (0.3411 → 0.0000,
0.0731 → 0.0000) while doubling it makes the floor worse (0.3816, 2.50 free
overrides per campaign). The witness multiplier is therefore the load-bearing
knob for the D176 gate, and its safe direction is *down*.

**2. Charging witnesses less does not charge the roster less.** Total measured
benevolence loss still rises with the multiplier (856 → 1020 → 1153 → 1243 for
`tyrannical` at standing 0), but at a low multiplier it is spread rather than
concentrated: target loss rises 222 → 320 as the witness share falls 931 → 699,
because every piece is a witness to the *other* overrides, so a room kept above
the floor keeps paying for what happens next. The ledger gets longer, not
shorter — which is what the D167 argument wanted and what saturation prevented.

**3. The standing price is on the same depletion axis, weaker.** It moves loss
from the target to the attached witnesses monotonically and by a few percent at
`500`–`1000` (320.75 → 311.25 target, 699.00 → 722.00 witness), by ~11% at
`4000`, and at `8000` it re-opens the free-insistence floor for `tyrannical`
(0.2019) while `redeemer` stays clear. So D170 has real headroom, but it is
bounded by the same gate as D174 and the bound is style-dependent.

**4. Conduct is unmoved except in one cell, and that cell is worse.** Refusal,
desertion, quiet quitting, win score, trust delta, and mean plies are identical
across the whole `tyrannical` surface, and across `redeemer` except at
`mult = 2000`, where the campaign lengthens (60.3 → 90.8 plies), overrides rise
(18.50 → 32.25), and refusal rises (0.2187 → 0.2608). This remains a ledger
surface, not a conduct surface: as in the D166 pass, the desertion knife edge at
`tauBenev = 50` is not reached by the `tyrannical` condition in any cell
(best 33.50), which is the standing hypothesis for why behaviour does not move.

## Recommendation for the D176 ruling

`OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE = 500`,
`OVERRIDE_STANDING_PRICE_PERMILLE = 2000`.

- It passes the D176 gate on both residual conditions with margin: free
  insistence is `0.0000` versus a `0.3411`/`0.0731` post-#151 baseline, and the
  nearest failing cell on the standing axis is 4× away (`8000`).
- It makes D170 do visible work rather than shipping the ruled mechanism inert
  (target 320.75 → 301.00, witness 699.00 → 740.50 on `tyrannical`).
- It does not move any behavioural metric, so it cannot be defended as a
  conduct improvement and is not offered as one.

Rejected: `250` (removes the floor but flattens the witness signal the D167
broadcast exists to carry — witness loss falls below target loss, inverting the
78–87% witness share the curdle measured); `1000`/`2000` (leave or worsen the
floor); standing `8000` (fails the gate on `tyrannical`).

## Limits of this evidence

Two styles, 4 matches, one seed, fake engine — enough to rule the ledger
magnitudes, not enough to claim a retention or outcome effect. Raw CSVs were
retained outside the repository, as with the earlier sweeps; the commands above
reproduce them deterministically.
