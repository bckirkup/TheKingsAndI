# Caissa-16 and the Half-Concordant Collapse

**Date:** 2026-09-22
**Follows:** `2026-09-21-the-permissive-engine-survey.md` (PR #220), which named
MIT Caissa the Stockfish-class permissive candidate and specified this grid,
and `2026-09-21-the-ply-seven-tie-break.md` (PR #218), which read the
Stockfish-16 kind-room collapse as a match-1 dismissal selected by an early
tie-break. The Caissa adapter itself landed in PR #221 (native-spawn UCI mode,
`--engine=caissa`, opt-in through `CAISSA_ENGINE_PATH`). **Nothing here
changes a default, ships Caissa, or touches the AWS image; no AWS campaign was
run.**

## The question

The Stockfish-16 supportive collapse (seeds 29 and 41 against the `random`
opponent) was the only strong-engine evidence in the tree, and Stockfish is
GPL-3.0. Does the same collapse appear under a permissive engine of similar
strength, or was it Stockfish-specific?

## Settled inputs (not re-derived)

- Stockfish-16 supportive vs `random`, 20 matches: seeds 3, 7, 11, 19, 23
  healthy (LI 63.6–65.0); seeds **29 and 41 collapsed** (LI 16.1 / 26.9,
  trust −29.1 / −3.5) as a match-1 `dismissed_by_room` at ply 41 / 45.
- Stockfish-16 tyrannical vs `random`: seed 7 LI 25.8 (trust −3.9), seed 41
  LI 25.1 (trust −6.0).
- Seed 41's Stockfish collapse is selected at ply 7 (h4 drawn and refused after
  a4 d4 f4) and sustained by the supportive policy re-ordering refused moves.
- Fake and Lozza (caps 4, 8, 16) supportive never collapse on any tested seed.

## Method

- Tree `13fb297` (the PR #221 branch head; merged to `main` as `4fdb9d5`
  without further code change). Harness identical to the 09-21 Stockfish runs.
- Engine: Caissa 2.0.1, built locally from
  `Witek902/Caissa@58ee6dcbc81dd883d90d7da1dc99b827b5f61dbb` with `make bmi2`,
  embedded `eval-ml-8-152B-spsa.pnn`, launched natively (not as a Node script).
- Determinism id, every run:
  `caissa-2.0.1/artifact-4b322945d9e5/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-4096`.
  Same D_max, MultiPV width, hash, thread count, and ladder policy as the
  Stockfish id; Caissa additionally records the cold-search contract (ADR
  0067), the unsound-score re-search budget (ADR 0068), and its own 4096-line
  runaway ceiling.
- Grid: `{supportive, tyrannical} × seeds {7, 29, 41} × 20 matches`,
  `--opponent=random` (harness default), no depth cap, one campaign per cell:
  `CAISSA_ENGINE_PATH=… pnpm sim --matches=20 --leader=<L> --seed=<S> --engine=caissa --out=… --journal=…`
- Two lanes on a 2-vCPU box (each `sim` runs a 2-worker shared pool), so the
  wall times below are contended and should be read as upper bounds.
- **None of the six cells hit the info-line ceiling, triggered an
  unsound-score re-search, or restarted an engine** (`score_escalations=0`,
  `restarts=0` on every cost line).

## Result: seed 29 collapses under Caissa, seed 41 does not

### Supportive vs `random` (measured)

| seed | engine | plies | refusal | refused_good | quiet_quit | desertion match | dismissals | trust final | LI | s/match |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7 | stockfish-16 | 57.8 | 0.056 | 0.377 | 0.381 | 0.000 | 0/20 | 94.9 | 64.5 | 137 |
| 7 | **caissa-16** | 52.5 | 0.111 | 0.581 | 0.314 | 0.000 | 0/20 | 92.8 | **63.3** | 166 |
| 29 | stockfish-16 | 77.6 | 0.506 | 0.978 | 0.022 | 0.450 | 20/20 | −29.1 | 16.1 | 138 |
| 29 | **caissa-16** | 79.8 | 0.486 | 0.944 | 0.019 | 0.250 | **20/20** | **−28.0** | **16.8** | 196 |
| 41 | stockfish-16 | 77.5 | 0.553 | 0.923 | 0.108 | 0.300 | 15/20 | −3.5 | 26.9 | 170 |
| 41 | **caissa-16** | 64.3 | 0.133 | 0.499 | 0.343 | 0.100 | **0/20** | **93.4** | **64.2** | 313 |

Seed 29 under Caissa is the Stockfish collapse almost to the decimal: match 1
is `dismissed_by_room` at ply **33** (207 refusals, 5 desertions, trust
40 → −22.8), and all 19 later matches start at inherited trust −7…−19 and are
re-dismissed within 1–18 plies. Pooled LI 16.8 against 16.1; trust −28.0
against −29.1. The collapse is **not Stockfish-specific**.

Seed 41 under Caissa is a healthy kind room by every pooled reading (LI 64.2,
inside the 63.6–65.0 band of the healthy Stockfish seeds). Match 1 is rough
— 47 refusals, 4 desertions, trust 40 → 13 — but the room is **not** lost, and
match 2 recovers to trust 95.7. The collapse is **not a seed property**
either.

### The seed-41 divergence (measured, match-1 decision journals)

Caissa's seed 41 opens exactly as Stockfish's did — a4, d4, f4, then **h4 at
ply 7, refused** by the h2 pawn, with e4 played instead. The ply-7 trigger of
the 09-21 note fires identically under both engines. The trajectories part at
ply 9: Stockfish accepted c3 after four refusals; Caissa refuses h4, c4, g3,
b3 **and c3** (five refusals) and plays d5. From there the Caissa room is
refused about one candidate per ply instead of spiralling to "every legal
move refused":

```text
caissa   s41  1:a4/0 3:d4/0 5:f4/0 7:e4/1 9:d5/5 11:exd5/0 13:c3/5 15:cxb4/0 16:h4/0
              18:Be3/4 20:Qxd5/0 22:Qxf7/1 24:b3/1 26:f5/1 28:g3/1 30:Ke2/1 … 78:Bxg7/0
stockfish s41 1:a4/0 3:d4/0 5:f4/0 7:e4/1 9:c3/4 11:f5/6 13:fxg6/1 14:Qc2/8 16:Na3/7
              18:dxc5/4 19:Nf3/22 21:Bf4/6 23:O-O-O/23 25:Nb5/33 27:Qd3/46 … 45:b4/45
```

(`ply:played/refusals-this-ply`; the Stockfish line is reproduced from the
09-21 note. Ply parity shifts after a piece leaves the board, as recorded in
the journal.)

Seed 29 under Caissa opens h4, a4, g4, gxf5 with no refusal until ply 8, then
20 refusals at ply 20 and 30–38 per ply from ply 26 to the dismissal at 33:

```text
caissa   s29  1:h4/0 3:a4/0 5:g4/0 7:gxf5/0 8:e4/3 10:exf5/0 11:b4/2 13:b5/4 15:bxc6/1
              16:c4/0 18:f3/0 20:Ke2/20 22:Ke1/3 24:Kf2/6 26:Qe2/31 28:Rh3/30 30:Bf4/37
              32:e6+/32 33:Qd3/38
```

The Stockfish seed-29 journal was never captured (09-21 note), so whether the
two engines share the seed-29 opening is **not measured**.

### Tyrannical vs `random` (measured)

| seed | engine | plies | refusal | quiet_quit | desertion match | dismissals | trust final | LI | s/match |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 7 | stockfish-16 | 62.9 | 0.014 | 0.122 | 0.400 | — | −3.9 | 25.8 | 109 |
| 7 | **caissa-16** | 50.0 | 0.014 | 0.181 | 0.200 | 9/20 | 27.4 | 39.6 | 121 |
| 29 | **caissa-16** | 66.0 | 0.007 | 0.142 | 0.100 | 15/20 | −20.9 | 20.3 | 149 |
| 41 | stockfish-16 | 69.0 | 0.008 | 0.135 | 0.100 | — | −6.0 | 25.1 | 129 |
| 41 | **caissa-16** | 61.5 | 0.009 | 0.177 | 0.200 | 9/20 | 17.1 | 35.1 | 165 |

All three tyrannical cells read as cruel rooms (refusal ≤ 0.014, `τ_benev`
falling to 9–11 by Q4, `τ_abil` 86–99), and every cell keeps the supportive /
tyrannical ordering that the D188 trajectory gate requires (LI 63–64 against
20–40 where the kind room stands). The tyrannical rooms under Caissa dismiss
the leader in 9–15 of 20 matches (match 1 at ply 9 / 16 for seeds 41 / 7, from
the tyrant's −10 starting trust); Stockfish dismissal counts were not tabulated
in the 09-21 note, so no engine comparison is drawn there. Caissa's tyrannical
LI is 10–15 points above Stockfish's on seeds 7 and 41 — **one campaign each,
carried as an observation, not a finding**.

### Cost (measured, contended)

121–313 s per match at depth 16 on the 2-vCPU box with two cells sharing it,
peak RSS 394–415 MB per cell, 34–73 engine calls per ply. Comparable to the
Stockfish runs (109–170 s/match); an uncontended Caissa figure was
not measured beyond the 65 s one-match tyrannical smoke in PR #221.

## Conclusions

1. **Measured.** Under Caissa-16, supportive seed 29 collapses (match-1 room
   dismissal, 20/20 dismissals, LI 16.8) and seed 41 does not (0/20, LI 64.2).
   Against Stockfish-16 the concordance is 1 of 2 on the collapsing seeds and
   3 of 3 on the non-collapsing cells (seed 7 supportive, and no tyrannical
   cell is anomalous).
2. **Measured.** The kind-room collapse is not a Stockfish artifact: a second,
   independently written, permissively licensed depth-16 engine reproduces it
   on seed 29 with the same shape and the same pooled numbers.
3. **Measured.** The seed-41 trigger (h4 refused at ply 7) fires identically
   under both engines; the outcome diverges at ply 9 on one candidate (c3)
   that Stockfish accepted and Caissa refused. Whether the room spirals is
   decided by the run of engine evaluations *after* the first refusal, not by
   the first refusal alone.
4. **Inferred.** This strengthens the 09-21 reading — collapse is a trajectory
   property with the engine as trigger and the supportive policy's refused-move
   re-ordering as the spiral — and weakens any per-seed collapse rate further:
   the same seed collapses under one strong engine and is a model kind room
   under another. No collapse rate should be quoted for the supportive style
   until the policy is given refused-move memory (09-21 proposal (d)) or the
   re-ordering is named as a style.
5. **Hypothesis (one campaign per cell).** Caissa reads the tyrannical rooms
   more leniently than Stockfish on seeds 7 and 41 (LI 35–40 vs 25). If this
   held across seeds it would matter for the D188 gate's absolute levels but
   not its ordering; it needs a paired-seed measurement before it is anything
   more than an observation.
6. **Engine question (inferred).** Caissa behaves as a drop-in for Stockfish
   in this harness: identical contract surface (MultiPV-8, cold search,
   depth-limited), no runaway or unsound-score events over 120 matches and
   ~360k engine calls, and the psychology responds to it in the same way it
   responds to Stockfish. The remaining blocker to shipping it is legal, not
   technical: the `.pnn` network's redistribution terms
   (`docs/engine_licensing.md`).

## Proposed next measurements (not started; owner decides)

- (d) from 09-21, now with two engines available: give the supportive
  pseudo-player refused-move memory and rerun seeds 29 and 41 under **both**
  Stockfish and Caissa. If both collapses disappear, conclusion 4 is confirmed
  independent of engine.
- (f) A Caissa-vs-Stockfish paired-seed tyrannical sweep (≥ 10 seeds, one cell)
  to test hypothesis 5 before any absolute LI level from either engine is
  quoted.
- (c) from 09-21 — the centipawn-scale comparison on a fixed position set —
  now has a third engine to include.

## Raw artifacts

CSVs, decision journals (`--journal`), per-cell logs, and the lane scripts are
retained outside the tree at `~/caissa16/` on the measuring VM
(`<leader>-s<seed>.{csv,journal.json,log}`, `run-grid.sh`, `lane.sh`); the
pooled readouts are reproduced below and are the durable record.

### caissa-supportive-s7
```text
mean_plies=52.5 wdl=18/2/0 refusal=0.111 refusals_per_ply=0.089 quiet_quit=0.314 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=1.350 promotion_match=0.750 promotion_to={"Queen":27}
refused_good=0.581 override=0.000 win=95.0 unjustified_trauma=0.00 leadership_index=63.34 emptied_chairs=0.45 emptied_chairs_score=2.81 mean_trust_final=92.76 trust_delta=4.85
cost wall_ms=3322310.4 ms_per_match=166115.5 ms_per_ply=3167.121 engine_calls=66569 score_escalations=0 evaluate=51276 multi_pv_at=13675 calls_per_ply=63.459 restarts=0 peak_rss_mb=393.6 resource_max_rss_mb=393.6
quartile=1 matches=1-5 tau_abil=57.13 tau_benev=80.08 vindication=0.899 refusal=0.118 refusals_per_ply=0.104 desertion_match=0.000 roster=11.80
quartile=2 matches=6-10 tau_abil=66.63 tau_benev=91.59 vindication=0.958 refusal=0.109 refusals_per_ply=0.067 desertion_match=0.000 roster=11.60
quartile=3 matches=11-15 tau_abil=61.50 tau_benev=94.52 vindication=0.812 refusal=0.108 refusals_per_ply=0.119 desertion_match=0.000 roster=12.40
quartile=4 matches=16-20 tau_abil=39.43 tau_benev=90.95 vindication=0.682 drip_events=2.00 refusal=0.110 refusals_per_ply=0.067 desertion_match=0.000 roster=13.80
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTauBenevStart/meanTauBenevEnd.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### caissa-supportive-s29
```text
mean_plies=79.8 wdl=19/1/0 refusal=0.486 refusals_per_ply=0.707 quiet_quit=0.019 desertion_match=0.250 desertion_attrition=0.313 winning_position_desertion=0.200 rout_campaign=0.000 promotions_per_match=0.500 promotion_match=0.450 promotion_to={"Queen":10}
refused_good=0.944 override=0.020 win=97.5 unjustified_trauma=0.00 leadership_index=16.84 emptied_chairs=0.85 emptied_chairs_score=5.31 mean_trust_final=-28.00 trust_delta=-17.34
cost wall_ms=3914117.6 ms_per_match=195705.9 ms_per_ply=2452.455 engine_calls=64392 score_escalations=0 evaluate=40930 multi_pv_at=21286 calls_per_ply=40.346 restarts=0 peak_rss_mb=414.4 resource_max_rss_mb=414.6
quartile=1 matches=1-5 tau_abil=12.31 tau_benev=19.00 vindication=0.957 refusal=0.550 refusals_per_ply=1.166 desertion_match=0.600 roster=11.00
quartile=2 matches=6-10 tau_abil=6.04 tau_benev=11.97 vindication=1.000 refusal=0.464 refusals_per_ply=0.600 desertion_match=0.000 roster=13.60
quartile=3 matches=11-15 tau_abil=3.26 tau_benev=7.47 vindication=1.000 refusal=0.382 refusals_per_ply=0.343 desertion_match=0.200 roster=11.00
quartile=4 matches=16-20 tau_abil=5.69 tau_benev=9.86 vindication=0.959 refusal=0.548 refusals_per_ply=0.719 desertion_match=0.200 roster=10.60
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): quietQuitRate/meanTrustStart.
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```
Per-match: match 1 plies 55, refusals 207, desertions 5, trust 40.00 → −22.78,
`dismissed_by_room` ply 33; matches 2–20 start at trust −7.69…−19.13 and are
dismissed at plies 1–18 (all 20/20 dismissed).

### caissa-supportive-s41
```text
mean_plies=64.3 wdl=20/0/0 refusal=0.133 refusals_per_ply=0.221 quiet_quit=0.343 desertion_match=0.100 desertion_attrition=0.313 winning_position_desertion=0.800 rout_campaign=0.000 promotions_per_match=1.100 promotion_match=0.650 promotion_to={"Queen":22}
refused_good=0.499 override=0.000 win=100.0 unjustified_trauma=0.00 leadership_index=64.15 emptied_chairs=0.75 emptied_chairs_score=4.69 mean_trust_final=93.42 trust_delta=5.23
cost wall_ms=6257891.7 ms_per_match=312894.6 ms_per_ply=4869.955 engine_calls=93213 score_escalations=0 evaluate=69143 multi_pv_at=21416 calls_per_ply=72.539 restarts=0 peak_rss_mb=400.4 resource_max_rss_mb=400.4
quartile=1 matches=1-5 tau_abil=90.20 tau_benev=93.57 vindication=0.991 refusal=0.142 refusals_per_ply=0.141 desertion_match=0.400 roster=11.40
quartile=2 matches=6-10 tau_abil=54.65 tau_benev=98.87 vindication=0.880 refusal=0.119 refusals_per_ply=0.147 desertion_match=0.000 roster=10.60
quartile=3 matches=11-15 tau_abil=71.49 tau_benev=98.94 vindication=0.453 refusal=0.031 refusals_per_ply=0.017 desertion_match=0.000 roster=12.00
quartile=4 matches=16-20 tau_abil=6.45 tau_benev=86.80 vindication=0.767 refusal=0.242 refusals_per_ply=0.579 desertion_match=0.000 roster=12.60
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```
Per-match: match 1 plies 78, refusals 47, desertions 4, trust 40.00 → 13.00,
not dismissed; match 2 plies 125, refusals 12, trust 22.44 → 95.73. Q4 shows
the disengaged-but-loyal profile of the 09-21 s41-vs-tyrannical campaign
(`τ_abil` 6.5 with `τ_benev` 86.8 and trust 93) — second sighting, still a
hypothesis.

### caissa-tyrannical-s7
```text
mean_plies=50.0 wdl=20/0/0 refusal=0.014 refusals_per_ply=0.007 quiet_quit=0.181 desertion_match=0.200 desertion_attrition=0.188 winning_position_desertion=0.500 rout_campaign=0.000 promotions_per_match=0.800 promotion_match=0.550 promotion_to={"Queen":16}
refused_good=0.233 override=0.044 win=100.0 unjustified_trauma=0.00 leadership_index=39.60 emptied_chairs=0.45 emptied_chairs_score=2.81 mean_trust_final=27.38 trust_delta=-2.70
cost wall_ms=2418667.9 ms_per_match=120933.4 ms_per_ply=2421.089 engine_calls=42426 score_escalations=0 evaluate=32652 multi_pv_at=8540 calls_per_ply=42.468 restarts=0 peak_rss_mb=401.1 resource_max_rss_mb=401.1
quartile=1 matches=1-5 tau_abil=86.13 tau_benev=48.24 vindication=0.898 refusal=0.000 desertion_match=0.400 roster=12.60
quartile=2 matches=6-10 tau_abil=99.79 tau_benev=63.31 vindication=0.968 refusal=0.000 desertion_match=0.000 roster=13.80
quartile=3 matches=11-15 tau_abil=95.30 tau_benev=41.60 vindication=0.852 refusal=0.026 desertion_match=0.200 roster=13.80
quartile=4 matches=16-20 tau_abil=98.83 tau_benev=8.81 vindication=0.978 refusal=0.028 desertion_match=0.200 roster=10.00
```
Dismissed 9/20; match 1 `dismissed_by_room` ply 16 (trust −10.00 → −30.29).

### caissa-tyrannical-s29
```text
mean_plies=66.0 wdl=20/0/0 refusal=0.007 refusals_per_ply=0.004 quiet_quit=0.142 desertion_match=0.100 desertion_attrition=0.188 winning_position_desertion=0.667 rout_campaign=0.000 promotions_per_match=0.450 promotion_match=0.300 promotion_to={"Queen":9}
refused_good=0.175 override=0.031 win=100.0 unjustified_trauma=0.00 leadership_index=20.28 emptied_chairs=0.55 emptied_chairs_score=3.44 mean_trust_final=-20.89 trust_delta=-7.56
cost wall_ms=2987707.3 ms_per_match=149385.4 ms_per_ply=2263.415 engine_calls=45500 score_escalations=0 evaluate=33474 multi_pv_at=10312 calls_per_ply=34.470 restarts=0 peak_rss_mb=398.8 resource_max_rss_mb=400.4
quartile=1 matches=1-5 tau_abil=75.92 tau_benev=56.58 vindication=0.860 refusal=0.000 desertion_match=0.400 roster=12.40
quartile=2 matches=6-10 tau_abil=99.82 tau_benev=38.95 vindication=0.971 refusal=0.013 desertion_match=0.000 roster=12.40
quartile=3 matches=11-15 tau_abil=96.98 tau_benev=7.11 vindication=0.904 refusal=0.014 desertion_match=0.000 roster=11.00
quartile=4 matches=16-20 tau_abil=94.48 tau_benev=11.23 vindication=0.949 refusal=0.000 desertion_match=0.000 roster=10.40
```
Dismissed 15/20; first dismissal match 3 at ply 68.

### caissa-tyrannical-s41
```text
mean_plies=61.5 wdl=20/0/0 refusal=0.009 refusals_per_ply=0.005 quiet_quit=0.177 desertion_match=0.200 desertion_attrition=0.188 winning_position_desertion=0.800 rout_campaign=0.000 promotions_per_match=0.750 promotion_match=0.500 promotion_to={"Queen":15}
refused_good=0.100 override=0.048 win=100.0 unjustified_trauma=0.06 leadership_index=35.05 emptied_chairs=0.70 emptied_chairs_score=4.38 mean_trust_final=17.09 trust_delta=-2.78
cost wall_ms=3302911.4 ms_per_match=165145.6 ms_per_ply=2683.112 engine_calls=47899 score_escalations=0 evaluate=36917 multi_pv_at=9580 calls_per_ply=38.911 restarts=0 peak_rss_mb=396.1 resource_max_rss_mb=396.1
quartile=1 matches=1-5 tau_abil=87.92 tau_benev=41.82 vindication=0.886 refusal=0.006 desertion_match=0.400 roster=11.20
quartile=2 matches=6-10 tau_abil=97.06 tau_benev=50.89 vindication=0.906 refusal=0.015 desertion_match=0.400 roster=11.80
quartile=3 matches=11-15 tau_abil=87.79 tau_benev=29.62 vindication=0.911 refusal=0.014 desertion_match=0.000 roster=13.40
quartile=4 matches=16-20 tau_abil=86.15 tau_benev=9.65 vindication=0.921 refusal=0.000 desertion_match=0.000 roster=10.00
```
Dismissed 9/20; match 1 `dismissed_by_room` ply 9 (trust −10.00 → −30.00).
