# The curdle and the floor — what an override actually costs the room

**Date:** 2026-08-28
**Tree:** override benevolence telemetry (`free_override_count`,
`benev_loss_target`, `benev_loss_witness`, `free_insistence_ply_fraction`)
**Command:**

```bash
pnpm sim --matches=20 --leader=<style> --opponent=tyrannical --engine=fake --seed=7 --out=<style>.csv
```

No coefficient changed for this pass. `BENEV_REGARD_STEP` and
`BENEV_REPAIR_STEP` remain at `0`, so this measures the shipped override
mechanic as it stands, not a candidate D166 setting.

## Why this pass exists

The D166 instrumentation pass found that no regard magnitude moves end-of-
campaign benevolence, because an override broadcasts a saturated betrayal cliff
to every witness while care credits one piece at a time. The reading offered
then — *the broadcast is the feature, the floor underneath it is the defect* —
was a hypothesis. These four fields make it measurable: benevolence loss is
now attributed to the overridden piece versus the bystanders, an override that
costs nothing at all is counted, and the share of a match played after the
first such override is recorded.

## What was measured

20 matches per style, seed 7, `--opponent=tyrannical`, fake engine. Totals are
per campaign; `tgt%` is the target's share of all benevolence lost to
overrides; `post-floor plies` is the mean per-match fraction of plies played
strictly after the first free override.

| Style | Overrides | Free | Free % | Target loss | Witness loss | tgt% | Post-floor plies | `τ_benev` end |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `exacting` | 866 | 496 | 57.3 | 2012 | 13019 | 13.4 | 0.735 | 2.35 |
| `steady` | 695 | 351 | 50.5 | 3241 | 15297 | 17.5 | 0.650 | 1.88 |
| `tyrannical` | 728 | 360 | 49.5 | 3247 | 16114 | 16.8 | 0.778 | 4.22 |
| `cold_winner` | 692 | 291 | 42.1 | 3921 | 13683 | 22.3 | 0.622 | 6.46 |
| `supportive` | 0 | 0 | 0.0 | 0 | 0 | — | 0.000 | 80.18 |

## Three findings

**1. Roughly half of all overrides are free.** Between 42% and 57% of overrides
across the four insisting styles cost the roster exactly zero benevolence,
because every piece that would have paid is already clamped at `0`. The mirror
the D165 ruling asked for is present for the first handful of overrides in a
match and absent for the rest.

**2. Most of a match is played after the sanction has stopped.** The floor is
not an end-of-campaign condition; it arrives early inside each individual
match. 62%–78% of plies happen after the first free override, so for the
majority of a match the group can no longer register anything the commander
does. Per-match starting benevolence recovers to roughly 25–50 between matches
and is driven back to `0` within the match, every match — the group re-forms
and is re-flattened rather than staying curdled.

**3. The curdle is overwhelmingly a bystander cost.** The overridden piece
bears only 13%–22% of the benevolence lost; 78%–87% is paid by pieces the
commander never gave an order to. Being rough with one person really does
curdle the team here, and the effect dominates the dyad. Note that the trust
channel already grades the same act 4.4:1 (`−35` target vs `−8` witness) — the
benevolence channel sends both the identical saturated cliff, so the grading
intent exists in one channel and was never carried into the other.

`supportive` is the control and behaves as the only off-floor style: zero
overrides, `τ_benev` ending at 80.2. The emotional axis is still two points,
and the reason is now measured rather than inferred — it is not that care is
too small, it is that the channel stops recording partway through the first
match of any insisting style.

## What this does and does not settle

It supports the hypothesis's second half and leaves the first half intact:

- The broadcast is defensible as modelled sociology — group legitimacy is
  spent in public, and the audience prices the defection.
- The floor is where the model stops being sociology. A real curdled team keeps
  scoring; this one loses the ability to sanction, which is why insisting
  becomes free and why the emotional axis cannot widen.

It does **not** settle the shape of a fix, and no coefficient should be chosen
from this table alone. Three candidates remain open and are recorded as D167:
grading the witness cliff the way trust already grades it; making the cliff
proportional to remaining benevolence rather than saturating; and pricing the
override by the target's standing, which the current model treats as identical
for a pawn and for the Queen.

## Reproduction

Per-style CSVs and shard artifacts are reproducible from the command above;
the four telemetry columns are folds over the event log
(`OVERRIDE` plus `PSYCH_DELTA`/`tauBenev`), not side counters, so any
divergence is auditable against the log itself.
