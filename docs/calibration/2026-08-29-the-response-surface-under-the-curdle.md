# 2026-08-29 — The response surface under the curdle (D166/D167 magnitudes)

**Read before ruling D166 or choosing any D167 magnitude.** This is the first
measurement of the five D166/D167 knobs *jointly*. It supersedes nothing; it
supplies the evidence that
`docs/calibration/2026-08-28-the-curdle-and-the-floor.md` said was missing, and
it reports two knobs that cannot do the job the ADR assigned them.

## Method

Full cartesian grid via `pnpm sim:sweep --grid=…` (the harness added for exactly
this purpose), fake engine, seed 7, `--leader=tyrannical --opponent=tyrannical`,
4 matches per cell, run as two deterministic shards (`--skip`/`--limit`).

| pass | axes | cells | wall clock | engine calls |
|---|---|---:|---:|---:|
| coarse | regard × repair × witness input × permille × debt ceiling | 162 | 10 490 s (2.9 h CPU) | 2 475 036 |
| refinement | regard × repair × permille (witness input pinned at 1) | 32 | 2 217 s | 488 896 |

Coarse levels: `BENEV_REGARD_STEP` 0/15/50, `BENEV_REPAIR_STEP` 0/10/30,
`OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` 6/3/1,
`BENEV_BETRAYAL_CLIFF_PERMILLE` 0/300/600,
`BENEV_RUPTURE_DEBT_CEILING` 100/300. Refinement levels: regard 15/50/150/300,
repair 10/30, permille 150/250/350/450.

Two cores, two cells at a time, ~70 s per cell — the grid is embarrassingly
parallel and shards reassemble exactly, so this is the first study in the corpus
whose cost is a scheduling question rather than a limit.

## The control

All five knobs at today's defaults (the shipped game):

| metric | value |
|---|---:|
| `override_count` | 40.75 |
| `free_override_count` | **19.00** (46.6% of overrides cost the roster nothing) |
| `free_insistence_ply_fraction` | **0.7879** |
| `benev_loss_target` / `benev_loss_witness` | 137.50 / 887.50 (witness share 86.6%) |
| `tau_benev` (roster mean, end of campaign) | 4.69 |

## Main effects (means over the 162 coarse cells)

| knob | levels | `free_override_count` | `free_insistence_ply_fraction` | `tau_benev` | `benev_loss_target` |
|---|---|---:|---:|---:|---:|
| `BENEV_BETRAYAL_CLIFF_PERMILLE` | 0 / 300 / 600 | 15.10 / **1.94** / 3.83 | 0.788 / **0.381** / 0.512 | 4.69 / **14.61** / 7.94 | 201.7 / 171.8 / 186.8 |
| `BENEV_REPAIR_STEP` | 0 / 10 / 30 | 8.42 / 6.47 / 5.99 | 0.579 / 0.559 / 0.543 | 8.92 / 9.06 / 9.25 | 151.1 / 177.4 / 231.9 |
| `BENEV_REGARD_STEP` | 0 / 15 / 50 | 7.72 / 6.72 / 6.44 | 0.565 / 0.558 / 0.558 | 8.40 / 8.92 / 9.91 | 166.4 / 181.0 / 213.0 |
| `OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` | 6 / 3 / 1 | 7.02 / 7.02 / 6.84 | 0.563 / 0.563 / 0.555 | 9.07 / 9.07 / 9.09 | 186.0 / 186.0 / 188.4 |
| `BENEV_RUPTURE_DEBT_CEILING` | 100 / 300 | 6.96 / 6.96 | 0.560 / 0.560 | 9.08 / 9.08 | 186.8 / 186.8 |

Four results, in order of consequence.

### 1. The proportional cliff is the only knob that removes the floor, and it is non-monotone

Permille dominates every other axis by an order of magnitude, and *more* is not
better: 300 leaves 1.94 free overrides, 600 leaves 3.83. A proportional charge
makes benevolence decay geometrically, so a large fraction empties the channel
faster than a small one and re-creates the very floor it was introduced to
remove. There is an interior window, and the refinement pass locates it:

| permille (regard 50, repair 30) | `free_override_count` | `free_insistence_ply_fraction` | `tau_benev` |
|---:|---:|---:|---:|
| 150 | **0.00** | **0.0000** | 30.63 |
| 250 | **0.00** | **0.0000** | 20.31 |
| 350 | 1.50 | 0.3732 | 12.50 |
| 450 | 2.00 | 0.3816 | 10.38 |

At or below 250 permille the free-insistence regime disappears entirely: every
override in a campaign is paid for. That is the D167 defect closed.

### 2. `OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` cannot grade the witness hit

Inputs 6 and 3 produce **byte-identical** results in every column, and 1 barely
differs. The reason is in the code, not the roster: the cliff is
`logistic(severity * BENEV_BETRAYAL_CLIFF_SCALE)` with scale 4, and the logistic
is already saturated at every severity the knob can express —

```
severity:            1     2     3     4     6     8
drop (permille=0):  39    39    40    40    40    40      # of a 40 maximum
```

so the "grade the witness the way trust grades it 4.4:1" limb of ADR 0066 is
un-expressible through this parameter. Grading needs a *multiplier* on the
witness drop, not a different input to a saturated sigmoid. Recorded as a new
decision rather than fixed here.

(The severity-2 row above reads 39 only after the deterministic-`exp`
correction; the divergent Taylor series this study also uncovered returned a
drop of **60** against a maximum of 40 there. Shipped severities all sit in the
short-circuit, so no committed number moved.)

### 3. `BENEV_RUPTURE_DEBT_CEILING` is unreachable in this regime

Identical in every column at 100 and 300, at every repair level. The ledger is
repaid at `min(debt, BENEV_REPAIR_STEP)` and debt accrues ≥39 per override, so
with repair ≤30 the debt never approaches even the low ceiling: the clamp cannot
bind until repair can outpace accrual. The knob is wired (`clampRuptureDebt`),
not inert by omission — it is simply out of reach, which is the empirical form
of the constraint ADR 0066 already stated.

### 4. Regard and repair both work, and both *enlarge* the fall

Each reduces free insistence monotonically, and each raises the absolute
benevolence lost to an override (`benev_loss_target` 151 → 232 across repair;
166 → 213 across regard). This is the finding the 2×2 smoke hinted at, now
confirmed across 162 cells: **kindness does not cushion the cliff, it builds
the height you fall from.** With a proportional cliff that is coherent rather
than perverse — a commander who has earned standing has more standing to spend,
and spends it at the same rate — and it is the arithmetic of "in leadership,
almost nothing is free".

Regard also saturates on *opportunity*, not magnitude: steps of 150 and 300 give
identical results, because a tyrannical campaign only affords 2.25 regard events
per match. Buying more emotional range through the regard step alone is capped
by how often the leader does anything worth regarding.

## The result that limits every recommendation below

Across all 194 cells, **not one behavioural metric moved**:

| metric | every cell |
|---|---:|
| `refusal` | 0.1251 |
| `desertion_attrition` | 0.1875 |
| `desertion_match` | 0.750 |
| `quiet_quit` | 0.0787 |
| `win` | 25.0 |
| `mean_plies` | 97.3 |

The whole surface moves the *ledger* and nothing else. Conduct is unchanged, so
these magnitudes cannot yet be chosen on the grounds that matter (does a
curdled room behave differently?), only on the grounds that the ledger stops
lying about what an override costs.

The likely mechanism — stated as a **hypothesis**, not a finding — is the
attachment knife edge recorded in
`docs/calibration/2026-08-15-desertion-gradient.md`: the desertion comparison
discriminates at `tauBenev = 50`, and the best cell here ends at a roster mean of
30.6, so no piece crosses the threshold in either direction. If that is the
cause, the emotional axis will stay behaviourally silent until either the
threshold is revisited or a leader style that operates near it is measured; the
next pass should therefore sweep the *caring* styles, not the tyrannical one.

## Recommended magnitudes (for the owner's D166 ruling — not applied)

| knob | today | recommended | why |
|---|---:|---:|---|
| `BENEV_BETRAYAL_CLIFF_PERMILLE` | 0 | **250** | inside the interior window; free insistence goes to zero, and 250 keeps a sharper first-override cost than 150 |
| `BENEV_REGARD_STEP` | 0 | **50** | 150 and 300 are indistinguishable (opportunity-capped); 50 already yields 112 regard gain per campaign |
| `BENEV_REPAIR_STEP` | 0 | **30** | best free-insistence and `tau_benev` of the levels measured, and it raises witness loss rather than lowering it |
| `OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` | 6 | **6 (unchanged)** | cannot grade anything from inside a saturated logistic — needs a multiplier, see below |
| `BENEV_RUPTURE_DEBT_CEILING` | 100 | **100 (unchanged)** | unreachable while repair ≤ 30 |

That cell measures:

| metric | control | recommended | change |
|---|---:|---:|---|
| `free_override_count` | 19.00 | **0.00** | floor removed |
| `free_insistence_ply_fraction` | 0.7879 | **0.0000** | free-insistence regime gone |
| `benev_loss_target` | 137.50 | 230.25 | overrides cost more, not less |
| `benev_loss_witness` | 887.50 | 916.25 | the curdle is preserved and slightly stronger |
| witness share of total loss | 86.6% | 79.9% | still overwhelmingly a bystander cost |
| `tau_benev` | 4.69 | 20.31 | the room can still register conduct at the end |

This passes the acceptance test ADR 0066 wrote for itself: the zero-cost share
falls to nothing **without** weakening what witnesses pay — witness loss rises
in absolute terms (887.50 → 916.25), and its share falls only because the
overridden piece finally pays a proportionate amount too.

## Open, and deliberately not settled here

- **D166** — the magnitudes above are a recommendation for an owner ruling; no
  default is changed by this document.
- **New decision needed:** the witness cliff needs a multiplier if the graded
  witness limb of ADR 0066 is to exist at all.
- **D170** (status-priced overrides) and **D173** (ladder-rung reuse) unchanged.
- Every number here is fake-engine and therefore unaffected by the cold-engine
  re-baseline (ADR 0067); none of it may be quoted beside a Lozza run.
