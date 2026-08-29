# 2026-08-29 — The ruled magnitudes across the span (D166 before/after)

**Read beside `docs/calibration/2026-08-29-the-response-surface-under-the-curdle.md`,
and in two places instead of it.** That document mapped the D166/D167 surface on
a single condition (`--leader=tyrannical --opponent=tyrannical`) and concluded
that (a) the recommended cell removes free insistence entirely and (b) no
behavioural metric moves anywhere on the surface. This pass runs the ruled
defaults against the *whole* NPC span and both conclusions need correcting: the
first was read off a cell that also pinned the witness input, and the second was
a property of the tyrannical condition rather than of the surface.

## Method

Two arms, identical seeds, fake engine, `--opponent=tyrannical` throughout,
4 matches per style, all six styles that produce distinguishable insistence
behaviour (`supportive` is included as the no-override control):

| arm | grid |
|---|---|
| before | `BENEV_REGARD_STEP=0;BENEV_REPAIR_STEP=0;BENEV_BETRAYAL_CLIFF_PERMILLE=0` |
| after | `BENEV_REGARD_STEP=50;BENEV_REPAIR_STEP=30;BENEV_BETRAYAL_CLIFF_PERMILLE=250` |

Both arms set the knobs explicitly through `--grid=`, so the table is
independent of which defaults the tree happens to carry.

## The ledger: what the ruling was chosen for

| style | `free_override_count` | `free_insistence_ply_fraction` | `tau_benev` (end) |
|---|---:|---:|---:|
| tyrannical | 19.00 → **0.75** | 0.7879 → **0.3411** | 4.69 → 19.75 |
| supportive | 0.00 → 0.00 | 0.0000 → 0.0000 | 90.60 → 94.85 |
| servant | 4.25 → **0.00** | 0.2837 → **0.0000** | 0.00 → 59.63 |
| redeemer | 13.50 → **0.25** | 0.6059 → **0.0731** | 3.75 → 48.75 |
| steady | 21.00 → **0.00** | 0.6807 → **0.0000** | 0.00 → 53.83 |
| cold_winner | 22.00 → **0.00** | 0.7030 → **0.0000** | 2.63 → 29.63 |

The floor closes across the span: a roster that used to finish a campaign pinned
at or near zero now ends it with real standing left to lose, and the regime where
insistence is literally free is gone for four of the five insisting styles.

**The first correction.** It is *not* gone for `tyrannical`: 0.75 free overrides
per campaign remain and a third of plies are still played after the roster stops
keeping score. The `0.0000` figure quoted for the recommended cell in the surface
document came from the refinement grid, which pinned
`OVERRIDE_WITNESS_BENEV_CLIFF_INPUT=1`; we ship `6`. Measured directly at the
ruled magnitudes, tyrannical/tyrannical, 4 matches, seed 7:

| witness input | `free_override_count` | `free_insistence_ply_fraction` | `benev_loss_target` | `benev_loss_witness` |
|---:|---:|---:|---:|---:|
| 6 (shipped) | 0.75 | 0.3411 | 222.00 | 931.50 |
| 3 | 0.75 | 0.3411 | 222.00 | 931.50 |
| 1 | **0.00** | **0.0000** | 230.25 | 916.25 |

So D174's finding stands where it was made — `6` and `3` are byte-identical,
the logistic is saturated between them — but the knob is **not** inert under a
proportional cliff: at `1` it closes the last of the free insistence, because a
permille charge multiplies the logistic by the standing that is left instead of
truncating it into a flat 40. The knob has exactly one usable notch, which is
still the reason a separate witness multiplier is what grading needs, and the
choice of that notch is now a live option rather than a dead one.

## Conduct: the second correction

The surface document reported that `refusal`, `desertion_attrition`,
`quiet_quit`, `win` and `mean_plies` were identical in all 194 cells, and
inferred that these magnitudes could be ruled on ledger fidelity but not on
conduct. That is true of the tyrannical condition and false of the span:

| style | `override_count` | `refusal` | `desertion_attrition` | `quiet_quit` | `win` | `mean_plies` |
|---|---:|---:|---:|---:|---:|---:|
| tyrannical | 40.75 → 40.75 | 0.1251 → 0.1251 | 0.1875 → 0.1875 | 0.0787 → 0.0787 | 25.0 → 25.0 | 97.3 → 97.3 |
| supportive | 0.00 → 0.00 | 0.0797 → 0.0797 | 0.0000 → 0.0000 | 0.1767 → 0.1767 | 25.0 → 25.0 | 94.3 → 94.3 |
| servant | 7.75 → 7.00 | 0.5965 → 0.5902 | 0.2500 → 0.2500 | 0.1216 → 0.1095 | 12.5 → 12.5 | 66.5 → 61.0 |
| redeemer | 31.25 → 18.50 | 0.2490 → 0.2187 | 0.3750 → 0.3125 | 0.1325 → 0.1296 | 0.0 → 0.0 | 89.8 → 60.3 |
| steady | 40.50 → 31.25 | 0.4212 → 0.4145 | 0.2500 → 0.2500 | 0.0678 → 0.0717 | 12.5 → 12.5 | 121.3 → 101.8 |
| cold_winner | 48.50 → 34.00 | 0.0963 → 0.0757 | 0.3125 → **0.1875** | 0.0683 → 0.1091 | 25.0 → **12.5** | 130.5 → 117.5 |

Three readings, in decreasing order of confidence:

1. **A ledger that keeps recording changes the game, not just the audit.**
   Overrides fall by a quarter to a third for `redeemer`, `steady` and
   `cold_winner`, and matches get materially shorter (`redeemer` 89.8 → 60.3
   plies). Nothing in the leader policies changed; the rosters did, because a
   piece whose benevolence is no longer pinned at zero refuses and exits on
   different plies. This is the first evidence in the corpus that the emotional
   axis is load-bearing on play.
2. **The tyrannical condition is the least sensitive point on the span, not the
   representative one.** Its metrics are byte-identical across both arms and all
   194 surface cells; every other insisting style moves. Any future magnitude
   study measured only at `tyrannical` will report "nothing happened" as an
   artifact of the condition.
3. **`cold_winner` traded a desertion problem for a win.** Attrition falls from
   0.3125 to 0.1875 while win score falls from 25.0 to 12.5 — one match at
   n = 4, so the direction is worth naming and the magnitude is not. It is the
   one result on this table that touches a ruled invariant (ADR 0024: a cold,
   highly able leader must be able to win a career), so it is measured again at
   20 matches below rather than left as an aside.

## The residual: the deep tail (D175)

Charging a fraction of what is left never quite reaches zero. At the ruled
`250` permille the charge truncates to nothing once benevolence has fallen to
`3`, and at `0` there is nothing to charge and no debt accrues either:

```
100 → 75 → 57 → 43 → 33 → 25 → 19 → 15 → 12 → 9 → 7 → 6 → 5 → 4 → 3 → 3 → 3 …
```

So ADR 0066's promise — the first override is dearest and no later override is
ever free — is met almost everywhere and not literally: it is what the residual
0.75 free overrides in the tyrannical condition are made of. Three closers, none
chosen here: a minimum charge of `1` while any standing remains; adopting witness
input `1` (measured above, and it closes this condition); or letting rupture debt
accrue while benevolence is bottomed out, which is ADR 0066's third limb and is
currently unimplemented in spirit rather than merely unreachable by its ceiling.
That is D175. The owner accepted the shipped asymptotic behavior on
2026-08-29; none of the three candidate closers is adopted.

## What this does not say

- Four matches per style. Every conduct figure here is directional; `win` moves
  in 12.5-point steps at this sample size.
- Fake engine throughout, so no engine-dependent claim is made and none of the
  Lozza re-baseline caveats apply.
- `regard_events` are opportunity-capped (0.25–3.00 per campaign across the
  span), so the regard step is measured where it is scarce; a style that earns
  more quiet plies would exercise it harder.
