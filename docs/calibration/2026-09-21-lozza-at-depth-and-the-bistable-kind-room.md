# Lozza at Depth, and the Bistable Kind Room — Follow-up to "Does the Engine Matter?"

**Date:** 2026-09-21
**Follows:** `2026-09-20-does-the-engine-matter.md` (PR #215). That note left
two questions open and proposed exactly these measurements: (1) does the
Lozza–Stockfish gap close when Lozza's `--depth-cap` is raised toward the
production `D_max = 16` — i.e. is Lozza *weak* or merely *flattened*; and
(2) does the Stockfish-16 supportive collapse on seed 41 reproduce, or was it
a seed. The owner approved both ("Both, Lozza first then Stockfish").
**Nothing here changes a default or re-reads an earlier ruling.**

## Settled inputs (from the 09-20 note, not re-derived)

- Fake engine: `τ_abil` 0.6–6.3 in every campaign (ability channel dead).
- Lozza-4: tyrant `τ_abil` 94–95 ≈ Stockfish; kind room `τ_abil` 14–19
  against Stockfish's 84 (seed 7); supportive refusal 0.51/0.57 against 0.06.
- Lozza-8 seed 7: kind room moves halfway (`τ_abil` 38, refusal 0.32); tyrant
  unmoved toward Stockfish.
- Stockfish-16 supportive: seed 7 healthiest campaign in the grid
  (trust 94.9, LI 64.5); seed 41 collapsed (trust −3.5, LI 26.9,
  refusal 0.55, desertion 0.30) — one seed.
- Stockfish 18 is GPL-3.0 and stays out of the AWS image and the enterprise
  build (`docs/engine_licensing.md` §3). All Stockfish runs here are local.

## Method

- Tree `bd860ec` (`main` after PR #216) for every run.
- `pnpm sim --matches=20 --leader=<style> --seed=<s> --engine=<e> [--depth-cap=N]`,
  opponent left at the harness default `random` (same limitation as 09-20:
  the win axis is saturated and unmeasured).
- Nine cells, run as two sequential lanes on a 2-vCPU box (one engine
  process each), ~7.5 h wall in total:
  - Lozza `--depth-cap=8`, seed **41**, tyrannical and supportive
    (pairs with the seed-7 Lozza-8 cells of 09-20).
  - Lozza `--depth-cap=16`, seed **7**, tyrannical and supportive. Since
    `D_max = 16`, the cap never binds: this is **uncapped-equivalent Lozza**,
    the "advanced pieces see deeper" configuration on the permissive engine.
  - Stockfish-16 supportive, seeds **3, 11, 19, 23, 29**.
- Determinism ids (Lozza differs from the 09-20 id only in the trailing cap):
  `lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-8`,
  `…/depth-cap-16`;
  `stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical`.
- Raw CSVs and logs under `~/enginecmp/followup/` on the session box, not
  committed; the harness summary lines are reproduced in full at the end.

## The table

`τ_abil_end` is the fourth-quartile (matches 16–20) ability credence. Rows
marked † are copied from the 09-20 note for pairing; everything else is new.

### Lozza by depth cap, both rooms

| style | engine | seed | plies | refusal | refused_good | quiet_quit | desertion_match | LI | trust_final | τ_abil_end | s/match |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| tyrannical | lozza-4 † | 7 | 66.5 | 0.005 | 0.050 | 0.030 | 0.150 | 18.24 | −27.6 | 94.4 | 3.2 |
| tyrannical | lozza-8 † | 7 | 87.5 | 0.003 | 0.100 | 0.016 | 0.050 | 18.01 | −27.7 | 74.4 | 13.5 |
| tyrannical | **lozza-16** | 7 | 64.0 | 0.005 | 0.100 | 0.022 | 0.200 | 18.26 | −27.3 | 82.6 | 129.0 |
| tyrannical | stockfish-16 † | 7 | 62.9 | 0.014 | 0.250 | 0.122 | 0.400 | 25.79 | −3.9 | 94.7 | 109.1 |
| tyrannical | lozza-4 † | 41 | 65.8 | 0.008 | 0.150 | 0.042 | 0.200 | 17.69 | −28.1 | 95.1 | 3.8 |
| tyrannical | **lozza-8** | 41 | 81.1 | 0.004 | 0.050 | 0.028 | 0.200 | 16.37 | −29.4 | 86.3 | 24.4 |
| tyrannical | stockfish-16 † | 41 | 69.0 | 0.008 | 0.100 | 0.135 | 0.100 | 25.08 | −6.0 | 95.7 | 129.2 |
| supportive | lozza-4 † | 7 | 42.1 | 0.510 | 0.629 | 0.303 | 0.000 | 62.26 | 83.9 | 19.1 | 10.8 |
| supportive | lozza-8 † | 7 | 57.6 | 0.318 | 0.642 | 0.331 | 0.050 | 60.96 | 85.5 | 38.2 | 37.2 |
| supportive | **lozza-16** | 7 | 45.0 | 0.284 | 0.497 | 0.290 | 0.050 | 62.87 | 88.3 | 16.9 | 89.6 |
| supportive | stockfish-16 † | 7 | 57.8 | 0.056 | 0.377 | 0.381 | 0.000 | 64.54 | 94.9 | 83.9 | 136.9 |
| supportive | lozza-4 † | 41 | 44.4 | 0.571 | 0.675 | 0.270 | 0.050 | 63.21 | 86.5 | 13.6 | 13.8 |
| supportive | **lozza-8** | 41 | 51.5 | 0.453 | 0.513 | 0.300 | 0.050 | 66.65 | 95.9 | 20.6 | 49.0 |
| supportive | stockfish-16 † | 41 | 77.5 | 0.553 | 0.923 | 0.108 | 0.300 | 26.93 | −3.5 | 16.7 | 169.9 |

### Stockfish-16 supportive across seven seeds

| seed | plies | refusal | refused_good | quiet_quit | desertion_match | LI | trust_final | τ_abil Q1 | τ_abil Q4 | τ_benev Q4 | s/match | reading |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 7 † | 57.8 | 0.056 | 0.377 | 0.381 | 0.000 | 64.54 | 94.9 | — | 83.9 | — | 136.9 | healthy |
| 3 | 65.5 | 0.138 | 0.468 | 0.358 | 0.050 | 63.89 | 94.6 | 70.1 | 75.2 | 96.8 | 204.9 | healthy |
| 11 | 58.5 | 0.007 | 0.100 | 0.372 | 0.050 | 64.92 | 96.4 | 90.6 | 96.2 | 90.9 | 173.5 | healthy |
| 19 | 62.3 | 0.086 | 0.319 | 0.385 | 0.050 | 63.57 | 94.5 | 81.7 | 50.8 | 99.0 | 143.8 | healthy |
| 23 | 62.5 | 0.024 | 0.294 | 0.387 | 0.000 | 65.03 | 97.2 | 88.4 | 93.3 | 97.9 | 166.3 | healthy |
| 41 † | 77.5 | 0.553 | 0.923 | 0.108 | 0.300 | 26.93 | −3.5 | 5.7 | 16.7 | — | 169.9 | **collapsed**, partial recovery from match 16 |
| **29** | 77.6 | 0.506 | 0.978 | 0.022 | 0.450 | 16.14 | −29.1 | 9.7 | 4.9 | 9.3 | 137.8 | **collapsed**, no recovery |

## What the runs say

Each line is marked measured / inferred / hypothesis. Twenty matches per
cell; the Lozza depth series is one seed per cap, so its per-cap magnitudes
are not estimates.

### 1. Raising Lozza's cap does not move it toward Stockfish (measured, seeds 7 and 41)

**Tyrant.** Lozza at depth 16 on seed 7 reproduces the Lozza tyrant, not the
Stockfish one: quiet-quit 0.022 (Lozza-4 0.030, Stockfish 0.122), trust −27.3
(−27.6, −3.9), LI 18.26 (18.24, 25.79), `refused_good` 0.10 (0.05, 0.25),
override 0.018 (Stockfish 0.054). `trust-monotonic` fires, as it does for
Lozza-4 and fake and never for Stockfish. Lozza-8 on seed 41 says the same
(quiet-quit 0.028, trust −29.4, LI 16.37). The 09-20 hypothesis that the
cruel-room gap "is not a depth effect, or not only one" is now the reading on
both seeds at three caps: **the Stockfish tyrant's disengaged, deserting,
less-embittered room is an engine-family property**, at Stockfish-order cost
(129 s/match at cap 16 against Stockfish's 109 s).

**Kind room.** The 09-20 note's halfway result at cap 8 does not continue at
cap 16. On seed 7, `τ_abil_end` goes 19.1 → **38.2** → **16.9** for caps
4 → 8 → 16; Stockfish reads 83.9. Refusal goes 0.51 → 0.32 → 0.28
(Stockfish 0.06), `refused_good` 0.63 → 0.64 → 0.50 (0.38), trust 83.9 →
85.5 → 88.3 (94.9). On seed 41 cap 8 lifts `τ_abil_end` only 13.6 → 20.6
and refusal 0.57 → 0.45. So (inferred) **Lozza's ability credence in the kind
room is non-monotone in depth and never approaches Stockfish's at any cap**;
the cap-8 doubling on seed 7 reads as a depth-8 coincidence rather than the
first step of a convergence. The 09-20 "the cap explains about half the
kind-room gap" sentence is superseded: the cap explains some refusal and
some trust, and none of the ability channel.

**Reading of the D46 question.** With both rooms measured at Lozza's full
depth, "Lozza is flattened" is rejected as the explanation of the gap.
Hypothesis for the mechanism, unmeasured here: Lozza's and Stockfish's
evaluations are not on the same centipawn scale at the same depth, and the
pieces' verdict thresholds, `τ_abil` vindication and `refused_good` are all
in centipawns — so the two engines drive the psychology through different
regions of the ladder regardless of depth. If that is right, the fix is
score-scale calibration per engine (an `EnginePort`-level concern), not a
stronger permissive engine; if it is wrong, D46 has its first real data point
that a refresher-strength engine cannot stand in for a strong one in the kind
room. Either way **Lozza-4 stays adequate for the cruel room and inadequate
for the kind room's ability channel**, and no Lozza cap changes that.

### 2. The Stockfish kind room is bistable (measured, 7 seeds)

The seed-41 collapse reproduces. Of seven Stockfish-16 supportive seeds, five
(3, 7, 11, 19, 23) are healthy and closely clustered — trust 94.5–97.2, LI
63.6–65.0, refusal 0.007–0.138, no more than one deserting match — and two
(29, 41) land in a **tyrant-shaped basin**: trust −29.1/−3.5, LI 16.1/26.9,
refusal 0.51/0.55, `refused_good` 0.98/0.92, desertion in 45%/30% of
matches. Seed 29 is the deeper case: `τ_abil` and `τ_benev` are both ≤ 10
from quartile 1 and never recover (Q4: 4.9 / 9.3), `trust-monotonic` fires,
and the room ends at trust −29 — numerically the Lozza *tyrant's* profile
(−27…−29) under a supportive leader. Seed 41 recovered from match 16.

No fake or Lozza supportive cell — six seeds' worth across three caps — ever
does this (trust 84–96 throughout). There is no intermediate Stockfish
outcome: the seven campaigns are two clusters with nothing between LI 27
and LI 63.

Hypothesis (2 collapses of 7): the basin is decided in the **first
matches**. Seed 29's Q1 already shows `τ_benev` 9.9 and `desertion_match`
0.80 with vindication 0.905 — the pieces found the supportive leader's
orders wrong 90% of the time in matches 1–5 and never formed benevolence
credence, so nothing the supportive style does afterwards (cushion, repair,
morning lift, all sized on the fake engine's trust excursions) reaches
them. This is an early-campaign attractor, not drift. What selects it —
the opening the `random` opponent draws, a specific position's `D_i` views,
or the first override — is unmeasured; per-match transcripts for seeds 29
and 41 are the place to look.

### 3. Cost (measured)

- Lozza cost per match by cap 4 → 8 → 16: tyrant room 3.2 → 13.5 → 129 s
  (seed 7; ×4 then ×10) and 3.8 → 24.4 s (seed 41); kind room 10.8 → 37.2 →
  89.6 s (×3.4 then ×2.4). At cap 16 Lozza costs what Stockfish costs
  (90–129 s against 109–205 s) for none of Stockfish's behaviour.
- Stockfish-16 supportive: 138–205 s/match, 46–68 min per 20-match campaign,
  peak RSS 397–413 MB; Lozza-8 276–288 MB, Lozza-16 199–282 MB.
- Collapsed campaigns are the cheapest Stockfish campaigns (seed 29: 138 s,
  `calls_per_ply` 38 against 62–66) — refused orders skip the ladder.

## What this does not establish

- One seed per Lozza cap above 4; the non-monotonicity in `τ_abil` is one
  seed's curve. It is enough to reject "cap 16 converges on Stockfish" on
  that seed, not to describe the curve.
- 2-of-7 is a collapse rate between roughly 5% and 60% at any reasonable
  interval; it establishes that the basin exists, not how often it is entered.
- Opponent `random` throughout; the win axis is saturated (`no-dilemma`
  fires on every healthy supportive cell) and unmeasured.
- The score-scale mechanism in §1 is a hypothesis with no direct measurement
  behind it.
- Nothing about GPL changes: Stockfish is not made suitable for the AWS
  image or the enterprise build by being the better engine here.

## Rulings proposed

- **The Lozza–Stockfish gap is an engine gap, not a depth gap, in both
  rooms.** Do not raise Lozza's default cap as a remedy; cap 8 buys some
  refusal and trust movement in the kind room at ~4× cost and cap 16 buys
  nothing further at ~10×. Keep `--depth-cap=4` as the Lozza default.
- **Any campaign quoted as evidence about the kind room's ability channel
  must name its engine**, and Lozza numbers may not stand in for Stockfish
  numbers there (the reverse of the 09-20 cruel-room ruling, which stands).
- **The bistable kind room is now a live D-question**, not a seed: under a
  real engine the supportive leader's campaign can be lost in the first five
  matches with no recovery mechanism. Before designing around it: pull the
  per-match transcripts of Stockfish seeds 29 and 41 and identify the
  selecting event; then measure whether the same seeds collapse under
  `--opponent=tyrannical`. That is a two-cell, ~2 h local measurement, not an
  AWS campaign.
- **Next engine decision for D46:** measure the score-scale hypothesis
  directly (the same position set evaluated by Lozza-16 and Stockfish-16,
  compared on the centipawn scale the ladder thresholds use) before
  spending on any third engine. If the scales diverge, an engine-specific
  scale normalisation in the adapter is the cheap experiment; if they do not,
  D46 needs a stronger permissive engine and Lozza is ruled inadequate for
  the kind room.
- **No AWS campaign is warranted by this note.** Everything above ran in
  ~7.5 h on two local cores; the proposed follow-ups are the same size.

## Raw harness lines

Reproduced verbatim (per-role `tau_abil_role` maps elided) so the tables can
be audited without the artifacts.

### lozza8-tyrannical-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-8).
mean_plies=81.1 wdl=19/1/0 refusal=0.004 refusals_per_ply=0.002 quiet_quit=0.028 desertion_match=0.200 desertion_attrition=0.125 winning_position_desertion=0.500 rout_campaign=0.000 promotions_per_match=0.750 promotion_match=0.550 promotion_to={"Queen":15}
refused_good=0.050 override=0.015 win=97.5 unjustified_trauma=0.00 leadership_index=16.37 emptied_chairs=0.75 emptied_chairs_score=4.69 mean_trust_final=-29.39 trust_delta=-11.86
cost wall_ms=488723.7 ms_per_match=24436.2 ms_per_ply=301.309 engine_calls=30925 score_escalations=0 evaluate=25171 multi_pv_at=5754 calls_per_ply=19.066 restarts=0 peak_rss_mb=276.3 resource_max_rss_mb=276.3
quartile=1 matches=1-5 tau_abil=81.88 tau_benev=35.77 vindication=0.918 drip_events=0.00 adjudication_vindication=0.918 refusal=0.000 refusals_per_ply=0.000 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=10.20
quartile=2 matches=6-10 tau_abil=97.33 tau_benev=30.00 vindication=0.974 drip_events=2.20 adjudication_vindication=0.974 refusal=0.000 refusals_per_ply=0.000 desertion_match=0.400 desertion_attrition=0.125 rout=0.000 roster=11.60
quartile=3 matches=11-15 tau_abil=85.83 tau_benev=24.45 vindication=0.838 drip_events=0.00 adjudication_vindication=0.838 refusal=0.003 refusals_per_ply=0.002 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=10.40
quartile=4 matches=16-20 tau_abil=86.25 tau_benev=25.39 vindication=0.874 drip_events=0.00 adjudication_vindication=0.874 refusal=0.011 refusals_per_ply=0.006 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=12.40
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
```

### lozza8-supportive-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-8).
mean_plies=51.5 wdl=20/0/0 refusal=0.453 refusals_per_ply=0.695 quiet_quit=0.300 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=0.800 promotion_match=0.700 promotion_to={"Queen":16}
refused_good=0.513 override=0.002 win=100.0 unjustified_trauma=0.00 leadership_index=66.65 emptied_chairs=0.10 emptied_chairs_score=0.63 mean_trust_final=95.88 trust_delta=3.83
cost wall_ms=980676.6 ms_per_match=49033.8 ms_per_ply=953.039 engine_calls=76580 score_escalations=0 evaluate=61000 multi_pv_at=15580 calls_per_ply=74.422 restarts=0 peak_rss_mb=288.0 resource_max_rss_mb=288.0
quartile=1 matches=1-5 tau_abil=1.79 tau_benev=60.23 vindication=0.130 drip_events=13.80 adjudication_vindication=0.130 refusal=0.549 refusals_per_ply=0.941 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=12.00
quartile=2 matches=6-10 tau_abil=36.28 tau_benev=72.94 vindication=0.672 drip_events=4.60 adjudication_vindication=0.672 refusal=0.525 refusals_per_ply=0.704 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=12.80
quartile=3 matches=11-15 tau_abil=31.55 tau_benev=80.23 vindication=0.304 drip_events=2.00 adjudication_vindication=0.304 refusal=0.270 refusals_per_ply=0.258 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=12.40
quartile=4 matches=16-20 tau_abil=20.59 tau_benev=78.71 vindication=0.494 drip_events=6.60 adjudication_vindication=0.494 refusal=0.466 refusals_per_ply=0.878 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.80
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTrustStart/classContemptEnd.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### lozzaU-tyrannical-s7
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-16).
mean_plies=64.0 wdl=20/0/0 refusal=0.005 refusals_per_ply=0.003 quiet_quit=0.022 desertion_match=0.200 desertion_attrition=0.188 winning_position_desertion=0.750 rout_campaign=0.000 promotions_per_match=0.250 promotion_match=0.150 promotion_to={"Queen":5}
refused_good=0.100 override=0.018 win=100.0 unjustified_trauma=0.00 leadership_index=18.26 emptied_chairs=0.55 emptied_chairs_score=3.44 mean_trust_final=-27.33 trust_delta=-10.77
cost wall_ms=2579175.3 ms_per_match=128958.8 ms_per_ply=2014.981 engine_calls=22327 score_escalations=0 evaluate=18101 multi_pv_at=4226 calls_per_ply=17.443 restarts=0 peak_rss_mb=198.8 resource_max_rss_mb=199.2
quartile=1 matches=1-5 tau_abil=64.34 tau_benev=32.56 vindication=0.948 drip_events=0.00 adjudication_vindication=0.948 refusal=0.000 refusals_per_ply=0.000 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=12.00
quartile=2 matches=6-10 tau_abil=92.55 tau_benev=23.99 vindication=0.981 drip_events=0.00 adjudication_vindication=0.981 refusal=0.014 refusals_per_ply=0.007 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.20
quartile=3 matches=11-15 tau_abil=91.36 tau_benev=25.15 vindication=0.864 drip_events=0.00 adjudication_vindication=0.864 refusal=0.000 refusals_per_ply=0.000 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=13.40
quartile=4 matches=16-20 tau_abil=82.64 tau_benev=28.27 vindication=0.843 drip_events=0.00 adjudication_vindication=0.843 refusal=0.008 refusals_per_ply=0.004 desertion_match=0.400 desertion_attrition=0.125 rout=0.000 roster=11.60
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
```

### lozzaU-supportive-s7
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-16).
mean_plies=45.0 wdl=19/1/0 refusal=0.284 refusals_per_ply=0.301 quiet_quit=0.290 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=0.650 promotion_match=0.500 promotion_to={"Queen":13}
refused_good=0.497 override=0.000 win=97.5 unjustified_trauma=0.00 leadership_index=62.87 emptied_chairs=0.30 emptied_chairs_score=1.88 mean_trust_final=88.26 trust_delta=3.34
cost wall_ms=1791609.1 ms_per_match=89580.5 ms_per_ply=1990.677 engine_calls=62937 score_escalations=0 evaluate=48749 multi_pv_at=14188 calls_per_ply=69.930 restarts=0 peak_rss_mb=280.1 resource_max_rss_mb=281.9
quartile=1 matches=1-5 tau_abil=36.49 tau_benev=74.96 vindication=0.437 drip_events=3.40 adjudication_vindication=0.437 refusal=0.209 refusals_per_ply=0.226 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=11.80
quartile=2 matches=6-10 tau_abil=15.59 tau_benev=78.83 vindication=0.438 drip_events=3.40 adjudication_vindication=0.438 refusal=0.353 refusals_per_ply=0.441 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.20
quartile=3 matches=11-15 tau_abil=57.04 tau_benev=82.16 vindication=0.395 drip_events=1.60 adjudication_vindication=0.395 refusal=0.260 refusals_per_ply=0.213 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.60
quartile=4 matches=16-20 tau_abil=16.86 tau_benev=82.99 vindication=0.367 drip_events=6.20 adjudication_vindication=0.367 refusal=0.315 refusals_per_ply=0.324 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.80
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): classContemptStart/classContemptEnd.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive-s3
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=65.5 wdl=19/1/0 refusal=0.138 refusals_per_ply=0.135 quiet_quit=0.358 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=2.050 promotion_match=0.950 promotion_to={"Queen":41}
refused_good=0.468 override=0.000 win=97.5 unjustified_trauma=0.00 leadership_index=63.89 emptied_chairs=0.60 emptied_chairs_score=3.75 mean_trust_final=94.60 trust_delta=6.57
cost wall_ms=4098493.4 ms_per_match=204924.7 ms_per_ply=3131.011 engine_calls=86392 score_escalations=0 evaluate=67219 multi_pv_at=16901 calls_per_ply=65.998 restarts=0 peak_rss_mb=403.9 resource_max_rss_mb=405.2
quartile=1 matches=1-5 tau_abil=70.10 tau_benev=82.65 vindication=0.870 drip_events=0.00 adjudication_vindication=0.870 refusal=0.156 refusals_per_ply=0.227 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=11.20
quartile=2 matches=6-10 tau_abil=27.76 tau_benev=90.80 vindication=0.592 drip_events=1.80 adjudication_vindication=0.592 refusal=0.136 refusals_per_ply=0.110 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.00
quartile=3 matches=11-15 tau_abil=76.71 tau_benev=87.19 vindication=0.756 drip_events=1.60 adjudication_vindication=0.756 refusal=0.148 refusals_per_ply=0.095 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=9.60
quartile=4 matches=16-20 tau_abil=75.24 tau_benev=96.76 vindication=0.712 drip_events=0.80 adjudication_vindication=0.712 refusal=0.111 refusals_per_ply=0.110 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=12.00
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive-s11
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=58.5 wdl=19/1/0 refusal=0.007 refusals_per_ply=0.004 quiet_quit=0.372 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=1.600 promotion_match=0.900 promotion_to={"Queen":32}
refused_good=0.100 override=0.000 win=97.5 unjustified_trauma=0.00 leadership_index=64.92 emptied_chairs=0.55 emptied_chairs_score=3.44 mean_trust_final=96.42 trust_delta=5.23
cost wall_ms=3469791.8 ms_per_match=173489.6 ms_per_ply=2965.634 engine_calls=72886 score_escalations=0 evaluate=56903 multi_pv_at=14105 calls_per_ply=62.296 restarts=0 peak_rss_mb=396.8 resource_max_rss_mb=396.8
quartile=1 matches=1-5 tau_abil=90.62 tau_benev=83.42 vindication=0.881 drip_events=0.00 adjudication_vindication=0.881 refusal=0.012 refusals_per_ply=0.006 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=12.00
quartile=2 matches=6-10 tau_abil=94.24 tau_benev=91.53 vindication=0.514 drip_events=0.80 adjudication_vindication=0.514 refusal=0.000 refusals_per_ply=0.000 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=10.60
quartile=3 matches=11-15 tau_abil=88.97 tau_benev=90.65 vindication=0.897 drip_events=0.80 adjudication_vindication=0.897 refusal=0.017 refusals_per_ply=0.009 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=11.20
quartile=4 matches=16-20 tau_abil=96.23 tau_benev=90.94 vindication=0.669 drip_events=1.60 adjudication_vindication=0.669 refusal=0.000 refusals_per_ply=0.000 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=11.60
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTrustStart/meanTauBenevStart, meanTrustStart/classContemptStart, meanTrustStart/classContemptEnd, meanTrustEnd/classContemptEnd, meanTauBenevStart/classContemptEnd.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive-s19
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=62.3 wdl=18/2/0 refusal=0.086 refusals_per_ply=0.083 quiet_quit=0.385 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=1.550 promotion_match=0.800 promotion_to={"Queen":31}
refused_good=0.319 override=0.000 win=95.0 unjustified_trauma=0.00 leadership_index=63.57 emptied_chairs=0.25 emptied_chairs_score=1.56 mean_trust_final=94.52 trust_delta=3.42
cost wall_ms=2875928.5 ms_per_match=143796.4 ms_per_ply=2308.129 engine_calls=80449 score_escalations=0 evaluate=62609 multi_pv_at=15688 calls_per_ply=64.566 restarts=0 peak_rss_mb=412.2 resource_max_rss_mb=413.5
quartile=1 matches=1-5 tau_abil=81.71 tau_benev=77.92 vindication=0.863 drip_events=0.00 adjudication_vindication=0.863 refusal=0.128 refusals_per_ply=0.185 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=12.60
quartile=2 matches=6-10 tau_abil=92.22 tau_benev=92.31 vindication=0.830 drip_events=0.00 adjudication_vindication=0.830 refusal=0.067 refusals_per_ply=0.045 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=11.40
quartile=3 matches=11-15 tau_abil=95.74 tau_benev=98.98 vindication=0.856 drip_events=0.00 adjudication_vindication=0.856 refusal=0.017 refusals_per_ply=0.009 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=14.00
quartile=4 matches=16-20 tau_abil=50.76 tau_benev=98.96 vindication=0.845 drip_events=1.00 adjudication_vindication=0.845 refusal=0.133 refusals_per_ply=0.092 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=11.20
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTrustStart/classContemptStart, meanTrustEnd/classContemptEnd, meanTauBenevStart/meanTauBenevEnd.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive-s23
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=62.5 wdl=19/1/0 refusal=0.024 refusals_per_ply=0.013 quiet_quit=0.387 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=1.300 promotion_match=0.800 promotion_to={"Queen":26}
refused_good=0.294 override=0.000 win=97.5 unjustified_trauma=0.00 leadership_index=65.03 emptied_chairs=0.50 emptied_chairs_score=3.13 mean_trust_final=97.18 trust_delta=4.72
cost wall_ms=3325886.7 ms_per_match=166294.3 ms_per_ply=2660.709 engine_calls=82046 score_escalations=0 evaluate=63254 multi_pv_at=16528 calls_per_ply=65.637 restarts=0 peak_rss_mb=401.8 resource_max_rss_mb=403.0
quartile=1 matches=1-5 tau_abil=88.37 tau_benev=79.04 vindication=0.696 drip_events=0.00 adjudication_vindication=0.696 refusal=0.006 refusals_per_ply=0.003 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.00
quartile=2 matches=6-10 tau_abil=90.10 tau_benev=93.65 vindication=0.846 drip_events=0.00 adjudication_vindication=0.846 refusal=0.063 refusals_per_ply=0.036 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=9.20
quartile=3 matches=11-15 tau_abil=97.42 tau_benev=98.32 vindication=0.966 drip_events=1.60 adjudication_vindication=0.966 refusal=0.012 refusals_per_ply=0.006 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=12.00
quartile=4 matches=16-20 tau_abil=93.31 tau_benev=97.87 vindication=0.837 drip_events=0.00 adjudication_vindication=0.837 refusal=0.015 refusals_per_ply=0.008 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=11.20
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTrustStart/classContemptStart.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive-s29
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=77.6 wdl=19/1/0 refusal=0.506 refusals_per_ply=0.717 quiet_quit=0.022 desertion_match=0.450 desertion_attrition=0.375 winning_position_desertion=0.286 rout_campaign=0.000 promotions_per_match=0.250 promotion_match=0.250 promotion_to={"Queen":5}
refused_good=0.978 override=0.017 win=97.5 unjustified_trauma=0.00 leadership_index=16.14 emptied_chairs=1.05 emptied_chairs_score=6.56 mean_trust_final=-29.06 trust_delta=-17.69
cost wall_ms=2755098.2 ms_per_match=137754.9 ms_per_ply=1775.192 engine_calls=58755 score_escalations=0 evaluate=40248 multi_pv_at=16268 calls_per_ply=37.858 restarts=0 peak_rss_mb=405.4 resource_max_rss_mb=405.4
quartile=1 matches=1-5 tau_abil=9.68 tau_benev=9.86 vindication=0.905 drip_events=0.00 adjudication_vindication=0.905 refusal=0.628 refusals_per_ply=1.260 desertion_match=0.800 desertion_attrition=0.313 rout=0.000 roster=11.20
quartile=2 matches=6-10 tau_abil=8.22 tau_benev=7.76 vindication=1.000 drip_events=0.00 adjudication_vindication=1.000 refusal=0.463 refusals_per_ply=0.471 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=13.00
quartile=3 matches=11-15 tau_abil=3.45 tau_benev=6.00 vindication=0.997 drip_events=0.00 adjudication_vindication=0.997 refusal=0.399 refusals_per_ply=0.387 desertion_match=0.400 desertion_attrition=0.125 rout=0.000 roster=10.80
quartile=4 matches=16-20 tau_abil=4.92 tau_benev=9.34 vindication=0.911 drip_events=0.00 adjudication_vindication=0.911 refusal=0.535 refusals_per_ply=0.751 desertion_match=0.600 desertion_attrition=0.188 rout=0.000 roster=11.80
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```
