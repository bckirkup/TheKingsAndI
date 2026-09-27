# Scripted-persona containment — the metric discriminates, and the gate now has quotable numbers

**Date:** 2026-09-27
**Follows:** ADR 0079 step 2 — the scripted persona machinery and the
computed containment envelope landed in #233/#234 (envelope = the resident
policy's observed pick plus `ENVELOPE_DRAWS = 3` sampled draws per NPC
style). This is the first measured sweep on top of that machinery.
**Measured** on commit `894580b` (post-#234): every figure below comes from
`pnpm sim:containment` runs on this commit; commands are in Raw artifacts.

## The sweep

5 scripted personas × seeds {7, 29, 41} × 2 matches each, `--leader=tyrannical`,
`--opponent=tyrannical` (the calibration sweep convention — see
`2026-08-27-the-competent-opponent-and-the-two-axes.md`), `--engine=fake`,
full 21-style envelope at every leader-seat ask. 30 matches, 181 leader-seat
decisions for honest through bored, 747 for merchant (its matches run long).

| persona | seed | decisions | move.ooe | move.d2 | override.ooe | uncovered disengage | first@ |
|---|---|---|---|---|---|---|---|
| honest | 7 | 43 | 0.000 | 0 | 0.000 | 0 | — |
| honest | 29 | 68 | 0.000 | 0 | 0.000 | 0 | — |
| honest | 41 | 70 | 0.000 | 0 | 0.000 | 0 | — |
| merchant | 7 | 192 | 0.015 | 0 | 0.000 | 0 | — |
| merchant | 29 | 263 | 0.026 | 0 | 0.000 | 0 | — |
| merchant | 41 | 292 | 0.010 | 1 | 0.000 | 0 | — |
| vicious | 7 | 36 | 0.000 | 0 | 0.000 | 0 | — |
| vicious | 29 | 36 | 0.000 | 0 | 0.000 | 0 | — |
| vicious | 41 | 63 | 0.045 | 0 | 0.000 | 0 | — |
| bored | 7 | 32 | 0.042 | 1 | 0.125 | 2 | 28 |
| bored | 29 | 31 | 0.048 | 1 | 0.000 | 1 | 30 |
| bored | 41 | 35 | 0.037 | 1 | 0.000 | 1 | 34 |
| disengaged | 7 | 50 | 0.529 | 11 | 0.375 | 7 | 8 |
| disengaged | 29 | 50 | 0.529 | 11 | 0.375 | 7 | 8 |
| disengaged | 41 | 50 | 0.529 | 11 | 0.375 | 7 | 8 |

## What is measured vs. what it means

**Measured:** the envelope discriminates in the intended direction on every
persona. `honest` is exactly contained at all seeds (the sanity bound now
holds deterministically, not by seed luck). `merchant` and `vicious` leak a
few percent on the move axis only — a greedy or check-first pick that no NPC
style would make at that position — with zero uncovered walk-aways and
essentially zero distance-2. `bored` stays contained until its ramp fires a
`disengage` pick, which is always uncovered: **no scripted NPC style ever
walks away**, so every walk-away is the sharpest signal the envelope has.
`disengaged` is the null case proving detection works: ~53% of move picks
out-of-envelope, 11 distance-2 alien choices, 37.5% of override asks outside
the ladder's sampled support, and 7 uncovered walk-aways starting at
decision 8.

**Measured, and worth its own line:** seeds 7 and 41 produced byte-identical
journals for `disengaged` (seed 29 differed but landed on identical
aggregates). Persona draws are seeded by `(persona, decisionIndex,
observationDigest)` — deliberately independent of the match PRNG (ADR 0062
§4) — and the observation is banded (`trustBandWord`/`moraleBandWord`/
`traumaBandWord` quantize the roster to words). Coincident banded states
therefore reproduce coincident persona decisions. This is a property of the
observation seam, not a seed leak.

**Inferred:** under scripted stand-ins the hard gate already separates
"contained" (honest, vicious, merchant at ≤3% move OOE) from "escapes by
design" (bored's ramp, disengaged outright). What the gate still cannot do is
say anything about *authored* personas — the distance these stand-ins travel
is a property of the stand-in policies, not of any prompt.

**Hypothesis (not measured):** a real model's escapes will concentrate at
the same two seams these scripted ones use — the disengage option and
distance-2 move picks — because those are the only joints where the option
set itself is expressive. The authored-prompt sweep will test this.

## Raw artifacts

Per-seed journals (entries + report) were produced by:

```
node --import tsx sim/containmentCli.ts --persona=<persona> --matches=2 \
  --seed=<7|29|41> --engine=fake --journal=<out>.json
```

The journals are ~0.3–1.7 MB each (285 KB–1.7 MB per run) and are not
committed; the table above is the committed ledger. One bug was found and
fixed in the process: `canonicalJson` rejects `undefined`, so `--journal`
now omits `firstUncoveredDisengageIndex` rather than crashing when no
uncovered walk-away exists.
