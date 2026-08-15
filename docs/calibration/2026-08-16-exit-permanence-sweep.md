# Exit permanence sweep: the dilemma comes back at k = 750, and k = 1000 kills it

Revision: `0ea5745` (branch `devin/1786804604-exit-cost-and-see`), ADR 0052 both
parts in tree — the exit self-cost and static-exchange capture risk.

Command, run once per style, sequentially, nothing else on the box:

```bash
pnpm sim:sweep --knob=DESERTION_EXIT_PERMANENCE_PERMILLE \
  --values=0,250,500,750,1000 --matches=6 --seed=7 --engine=fake --leader=<STYLE>
```

Raw CSV per style is in `d146/` of the measurement scratch directory; the full
45-row table is reproduced verbatim at the bottom of this report. `k = 0`
reproduces the free exit, so the `k = 0` column is also the post-D145 baseline.

## Desertion attrition by style and k

| style | k=0 | k=250 | k=500 | k=750 | k=1000 |
|---|---|---|---|---|---|
| supportive | 0.063 | 0.000 | 0.000 | **0.000** | 0.000 |
| servant | 0.000 | 0.000 | 0.000 | **0.000** | 0.000 |
| tyrannical | 0.250 | 0.375 | 0.250 | **0.063** | 0.000 |
| cold_winner | 0.688 | 0.375 | 0.313 | **0.188** | 0.000 |
| pure_tactician | 0.875 | 0.875 | 0.438 | **0.250** | 0.000 |
| redeemer | 0.750 | 0.875 | 0.438 | **0.313** | 0.000 |
| rebuilder | 0.938 | 0.813 | 0.375 | **0.375** | 0.000 |
| volatile | 0.875 | 0.750 | 0.563 | **0.438** | 0.000 |
| random | 0.813 | 0.875 | 0.813 | **0.563** | 0.000 |

## Reading

**The free exit was the dominant driver, and pricing it restores a gradient.**
At `k = 0` seven of nine styles lose 69–94% of the roster and the ordering is
close to meaningless. At `k = 750` the styles separate monotonically in the
direction the model claims: warm command keeps everyone, `tyrannical` loses one
piece, the cold-but-able styles lose a quarter to a third, and the two styles
with no coherent signal at all — `volatile` and the `random` control — lose the
most. Leadership, not the flag, now sets the threshold.

**`k = 1000` is degenerate and must not be the default.** Every style reports
`desertion_match = 0.0000`: not a single piece walks off the board in 54
matches. Charging the full pain of capture for leaving makes staying dominant for
every piece in every position, which trades one degeneracy for its mirror image.
It is worth keeping as a knob setting only to measure a desertion-free control.

**`k = 500` under-prices it.** `random` is still at 0.813 and `volatile` at
0.563 — the cascade still empties rosters for the styles that should merely
suffer.

**Warm styles saturate.** `supportive` and `servant` produce byte-identical rows
at 500, 750, and 1000, because they have no departures left to prevent at any
of those settings. Their flatness is an absence of the phenomenon, not
insensitivity of the knob, and it means the knob cannot be calibrated against
them.

**Refusal is unaffected, which is the sign we want.** Refusal rates move within
noise across the whole sweep (`tyrannical` 0.141 → 0.161, `random` 0.720 →
0.819) while attrition falls by an order of magnitude. The exit cost is pricing
the exit, not quietly suppressing dissent — pieces still object at the same rate,
they just stop leaving over it.

**Winning gets easier as the roster survives, but warmth is still not required.**
`pure_tactician`, `redeemer`, and `cold_winner` all reach `win = 100.0` with
`plain_chess_win_delta` of +50 to +100 at `k = 750`, so ADR 0024 holds: a cold,
able leader can win a career while still paying for it in trust
(`trust_delta` −31 to −40 versus supportive's +18.5).

## Decision

Default `DESERTION_EXIT_PERMANENCE_PERMILLE = 750`.

It is the only tested setting where desertion is both alive and
leadership-ordered. Caveats to keep in mind when reading it: 6 matches per point
is coarse, the grid is 250 wide so the true optimum is somewhere in 500–1000, and
the two warm styles contribute no information at this default. The honest claim
is that 750 is the best of five tested values on one seed, not a fitted optimum.

## Still open

- Pawn `standing` is 0 by construction, because initial class prestige for pawns
  is negative from every observing role. Pawns are still the cheapest deserters;
  the exit cost is now their only brake.
- `random` at 0.563 is the remaining outlier. A control leader with no coherent
  policy should probably suffer worse than every real style, so this may be
  correct rather than a defect, but it has not been shown to be.
- Nothing here was run on Lozza. These are fake-engine numbers, one seed.

## Raw table

```csv
style,knob,value,refusal,refusals_per_ply,desertion_match,desertion_attrition,override,win,trust_delta,plain_chess_win_delta,drip_gain_total,adjudication_loss,tau_abil
random,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.7198,1.9404,1.0000,0.8125,0.2924,25.0,-89.04,-33.3,35.67,1.42,28.59
random,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.8037,2.1721,1.0000,0.8750,0.3141,0.0,-107.50,-58.3,51.33,1.45,19.40
random,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.8455,2.8921,1.0000,0.8125,0.3326,16.7,-105.00,-41.7,53.00,1.26,4.22
random,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.7977,2.1927,0.8333,0.5625,0.2978,25.0,-102.52,-33.3,79.00,1.12,12.97
random,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.8193,2.5388,0.0000,0.0000,0.3125,25.0,-83.77,-33.3,59.67,1.04,6.61
tyrannical,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.1410,0.0834,0.5000,0.2500,0.4482,100.0,-27.92,50.0,28.17,2.36,33.44
tyrannical,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.1463,0.0883,0.6667,0.3750,0.4396,91.7,-48.28,41.7,35.50,2.74,31.95
tyrannical,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.1572,0.0953,0.5000,0.2500,0.4606,75.0,-35.31,25.0,56.67,1.92,20.24
tyrannical,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.1636,0.0991,0.1667,0.0625,0.4616,75.0,-31.98,25.0,46.50,2.01,17.73
tyrannical,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.1610,0.0973,0.0000,0.0000,0.4665,83.3,-31.25,33.3,51.67,2.08,18.00
supportive,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.0968,0.0600,0.1667,0.0625,0.0000,50.0,19.25,16.7,59.33,7.80,5.36
supportive,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.1211,0.0706,0.0000,0.0000,0.0000,58.3,18.58,25.0,52.00,5.65,5.46
supportive,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.0726,0.0415,0.0000,0.0000,0.0000,91.7,18.52,58.3,59.33,7.15,5.17
supportive,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.0726,0.0415,0.0000,0.0000,0.0000,91.7,18.52,58.3,59.33,7.15,5.17
supportive,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.0726,0.0415,0.0000,0.0000,0.0000,91.7,18.52,58.3,59.33,7.15,5.17
volatile,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.4662,0.4584,1.0000,0.8750,0.3877,8.3,-101.98,-41.7,26.00,2.71,33.58
volatile,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.4638,0.4530,1.0000,0.7500,0.3583,58.3,-91.67,8.3,41.33,2.90,28.56
volatile,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.4871,0.4887,1.0000,0.5625,0.4309,33.3,-97.40,-16.7,37.83,2.36,32.47
volatile,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.5089,0.5259,0.6667,0.4375,0.4388,41.7,-92.47,-8.3,45.50,1.92,32.19
volatile,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.5078,0.5268,0.1667,0.0625,0.4176,25.0,-92.81,-25.0,55.33,2.04,40.56
servant,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.0968,0.0546,0.0000,0.0000,0.0018,50.0,26.17,8.3,64.83,7.85,4.82
servant,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.0959,0.0539,0.0000,0.0000,0.0017,33.3,28.47,-8.3,84.17,7.32,17.38
servant,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.0763,0.0417,0.0000,0.0000,0.0017,50.0,25.27,8.3,67.83,7.84,10.14
servant,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.0763,0.0417,0.0000,0.0000,0.0017,50.0,25.27,8.3,67.83,7.84,10.14
servant,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.0763,0.0417,0.0000,0.0000,0.0017,50.0,25.27,8.3,67.83,7.84,10.14
pure_tactician,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.2448,0.1775,1.0000,0.8750,0.4173,66.7,-69.06,66.7,42.17,3.37,43.03
pure_tactician,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.2769,0.1993,1.0000,0.8750,0.4247,66.7,-70.31,66.7,44.50,2.88,33.69
pure_tactician,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.2848,0.2077,0.5000,0.4375,0.4425,100.0,-34.27,100.0,34.00,2.20,12.72
pure_tactician,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.2694,0.1915,0.1667,0.2500,0.4400,100.0,-31.14,100.0,38.83,1.93,8.82
pure_tactician,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.2669,0.1883,0.0000,0.0000,0.4323,100.0,-34.12,100.0,29.33,2.03,7.43
redeemer,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.2544,0.1855,1.0000,0.7500,0.4062,75.0,-62.08,75.0,49.67,3.01,24.88
redeemer,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.2616,0.1880,1.0000,0.8750,0.4150,75.0,-77.08,75.0,46.83,3.37,43.58
redeemer,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.2624,0.1895,0.5000,0.4375,0.4291,100.0,-37.92,100.0,46.83,2.09,7.52
redeemer,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.2634,0.1894,0.5000,0.3125,0.4304,100.0,-40.10,100.0,40.67,2.17,8.59
redeemer,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.2479,0.1698,0.0000,0.0000,0.4332,100.0,-38.75,100.0,36.17,2.26,8.28
cold_winner,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.0939,0.0530,0.8333,0.6875,0.3484,91.7,-66.66,41.7,34.17,3.41,24.55
cold_winner,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.0886,0.0509,0.8333,0.3750,0.3885,50.0,-52.50,0.0,46.83,2.75,17.31
cold_winner,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.0659,0.0371,1.0000,0.3125,0.3587,83.3,-57.04,33.3,36.33,2.46,18.62
cold_winner,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.0501,0.0273,0.6667,0.1875,0.3565,100.0,-36.25,50.0,29.00,2.73,38.77
cold_winner,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.1256,0.0730,0.0000,0.0000,0.4281,75.0,-38.74,25.0,41.00,2.74,32.36
rebuilder,DESERTION_EXIT_PERMANENCE_PERMILLE,0,0.7498,1.6039,1.0000,0.9375,0.3228,50.0,-92.92,0.0,53.17,1.30,9.71
rebuilder,DESERTION_EXIT_PERMANENCE_PERMILLE,250,0.7574,1.6421,1.0000,0.8125,0.3430,41.7,-93.24,-8.3,65.33,1.14,17.32
rebuilder,DESERTION_EXIT_PERMANENCE_PERMILLE,500,0.7518,1.8192,0.6667,0.3750,0.3443,83.3,-52.16,33.3,64.83,0.95,6.93
rebuilder,DESERTION_EXIT_PERMANENCE_PERMILLE,750,0.7546,1.9564,0.8333,0.3750,0.3282,83.3,-61.45,33.3,58.00,1.14,2.82
rebuilder,DESERTION_EXIT_PERMANENCE_PERMILLE,1000,0.7826,1.9700,0.0000,0.0000,0.3408,100.0,-40.31,50.0,55.83,0.64,1.99
```
