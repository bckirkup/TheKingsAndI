# Does the Engine Matter? — Is Lozza-4 Good Enough, Measured Against Stockfish-16

**Date:** 2026-09-20
**Question raised by the owner:** every AWS campaign to date has run on the
fake engine (Phase A–C censuses, the D202/D204 sweeps) or on Lozza at
`--depth-cap=4` (the D188/D194 campaigns), while the design has always
anticipated a stronger engine behind `EnginePort`. Nobody had measured
whether the engine changes what the psychology does. This note is that
measurement. The owner's framing on reading the first rows: the question is
not Stockfish against fake but **Stockfish against Lozza — if Lozza-4 is
"good enough", that is the finding**; the players are not grandmasters and
the pieces need to be no stronger than a refresher lesson from the queen.
The fake engine stays in the table as the control every AWS census actually
ran on. **Nothing here changes a default or re-reads any earlier
ruling.**

## Settled inputs

- Stockfish 18 (`stockfish@18.0.8`, `lite-single`, GPL-3.0) is already an
  adapter in tree (`src/engine/adapters/stockfish.ts`) and reachable from the
  harness as `--engine=stockfish`; it searches at the production
  `D_max = 16` with no depth cap. It is excluded from the AWS image for
  licensing reasons (`deploy/aws/README.md`), so the campaigns could not have
  used it; running it locally has no licensing consequence.
- The fake engine is a FEN-hashed score with a depth-shrinking error term; it
  is not chess (`AGENTS.md`). Lozza-4 is real but shallow chess. Stockfish-16
  is the strongest reference the project has.

## Method

- Tree `de39c42` (`main` after PR #214) for every run; the two Stockfish
  supportive runs were re-run on `4ae83f0` after the harness fix described
  below (the fix changes only whether a search may fail, not any value).
- `pnpm sim --matches=20 --leader=<style> --seed=<s> --engine=<e>`, one
  campaign of 20 matches, styles `tyrannical` and `supportive`, seeds **7**
  and **41**, engines `fake`, `lozza` (default `--depth-cap=4`, cold, patched
  artifact `1fa7aed08e7e`) and `stockfish` (`dmax-16`, MultiPV 8, pool 2).
  Opponent left at the harness default, `random` — see "What this does not
  establish".
- Reference box: 2 vCPU. Stockfish saturates one core; wall times are for
  that box and comparable only to each other.
- Determinism ids: `sim-fake/depth-fixed`;
  `lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-4`;
  `stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical`.
- Raw CSV / shard-JSON artifacts under `~/enginecmp/` on the session box,
  not committed (the convention of the earlier sweeps). The summary lines
  the harness prints are reproduced in full below.

### The harness could not run Stockfish for the kind room

Both Stockfish **supportive** campaigns aborted mid-run on the first attempt:

```text
UciInfoLineLimitError: Engine exceeded the info-line limit for FEN
r2qkb1r/8/1P4P1/p2pPP1P/P2P4/1Q6/8/RNB1KBNR b KQkq - 0 17 at depth 16: 513 lines   (seed 7)
2kr4/4q3/2B3Pp/5P2/7b/P6N/P1PPP2P/RNB2QKR b - - 0 20 at depth 16: 513 lines        (seed 41)
```

`DEFAULT_MAX_INFO_LINES_PER_SEARCH = 512` (ADR 0068's runaway guard) was
sized from Lozza depth-4 output ("at most 22 lines … 20× headroom"). A
depth-16 MultiPV-8 search legitimately emits one line per depth per PV plus
`currmove` lines, so a long supportive game hits the ceiling and the guard —
correctly — fails the ply rather than truncating. Tyrannical campaigns are
shorter and never reached it. The accompanying PR gives the Stockfish adapter
its own ceiling, `STOCKFISH_MAX_INFO_LINES_PER_SEARCH = 4096`, threaded
through `EnginePool`/`SharedSearchBroker`; Lozza keeps `runaway-512` and its
determinism id, and the Stockfish id is unchanged because the ceiling never
changes a returned value. **Until this PR, "Stockfish is available in the
harness" was true only for the styles whose games end early.**

## The table

Per-campaign harness summary. `refusal` and `quiet_quit` are rates over own
plies; `desertion_match` is the share of matches with ≥1 desertion; `LI` is
the ADR 0074 Leadership Index (ε = 0.2); `trust_final` is `mean_trust_final`.

### Tyrannical

| engine | seed | plies | refusal | refused_good | quiet_quit | desertion_match | emptied_chairs | override | win | LI | trust_final | s/match |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fake | 7 | 70.8 | 0.004 | 0.100 | 0.022 | 0.000 | 0.30 | 0.020 | 97.5 | 17.35 | −28.5 | 5.2 |
| fake | 41 | 73.3 | 0.009 | 0.050 | 0.028 | 0.050 | 0.60 | 0.017 | 97.5 | 16.84 | −28.7 | 4.2 |
| lozza-4 | 7 | 66.5 | 0.005 | 0.050 | 0.030 | 0.150 | 0.45 | 0.019 | 100.0 | 18.24 | −27.6 | 3.2 |
| lozza-4 | 41 | 65.8 | 0.008 | 0.150 | 0.042 | 0.200 | 0.70 | 0.018 | 100.0 | 17.69 | −28.1 | 3.8 |
| stockfish-16 | 7 | 62.9 | 0.014 | 0.250 | **0.122** | **0.400** | **1.00** | 0.054 | 97.5 | **25.79** | **−3.9** | 109.1 |
| stockfish-16 | 41 | 69.0 | 0.008 | 0.100 | **0.135** | 0.100 | 0.80 | 0.040 | 97.5 | **25.08** | **−6.0** | 129.2 |

### Supportive

| engine | seed | plies | refusal | refused_good | quiet_quit | desertion_match | emptied_chairs | override | win | LI | trust_final | s/match |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fake | 7 | 59.3 | 0.111 | 0.466 | 0.152 | 0.000 | 0.40 | 0.000 | 97.5 | 62.36 | 86.3 | 20.2 |
| fake | 41 | 56.0 | 0.088 | 0.461 | 0.161 | 0.000 | 0.25 | 0.000 | 95.0 | 63.89 | 91.7 | 18.1 |
| lozza-4 | 7 | 42.1 | **0.510** | 0.629 | 0.303 | 0.000 | 0.05 | 0.000 | 100.0 | 62.26 | 83.9 | 10.8 |
| lozza-4 | 41 | 44.4 | **0.571** | 0.675 | 0.270 | 0.050 | 0.15 | 0.000 | 100.0 | 63.21 | 86.5 | 13.8 |
| stockfish-16 | 7 | 57.8 | 0.056 | 0.377 | **0.381** | 0.000 | 0.35 | 0.000 | 97.5 | 64.54 | 94.9 | 136.9 |
| stockfish-16 | 41 | 77.5 | **0.553** | **0.923** | 0.108 | **0.300** | 0.80 | 0.015 | 100.0 | **26.93** | **−3.5** | 169.9 |

### Degeneracy detectors fired

| engine | tyrannical | supportive |
|---|---|---|
| fake | `metric-collinearity`, `trust-monotonic` (both seeds) | `metric-collinearity`, `no-dilemma` (both seeds) |
| lozza-4 | `trust-monotonic` (both seeds) | `no-dilemma` (both seeds); `metric-collinearity` (seed 7) |
| stockfish-16 | **none** (both seeds) | `metric-collinearity`, `no-dilemma` (seed 7); `no-dilemma` (seed 41) |

### Ability credence at match end (`mean_tau_abil_end`, mean over the 20 matches)

The D19 ability channel is the one the engine feeds most directly, so it is
tabulated separately from the harness summary.

| engine | tyrannical s7 | tyrannical s41 | supportive s7 | supportive s41 |
|---|---:|---:|---:|---:|
| fake | 6.3 | 3.5 | 1.3 | 0.6 |
| lozza-4 | 94.4 | 95.1 | 19.1 | 13.6 |
| stockfish-16 | 94.7 | 95.7 | 83.9 | 16.7 (collapsed run) |

## What the paired seeds say

Everything below is two seeds × 20 matches; treat each line as a
**hypothesis**, marked where both seeds agree on the sign.

### The ability channel is dead under the fake engine and half-alive under Lozza-4

This is the largest effect in the grid and it was invisible in every summary
line the censuses report. Under the fake engine `τ_abil` ends every campaign
at 0.6–6.3 on both styles and both seeds: the FEN-hashed score makes every
leader's orders read as incompetent, so the D19 ability channel has never
carried anything in a Phase A–C census — which is why the ADR 0074
unjustified-trauma term reads exactly 0, why `LI` is "~78 points of trust
plus ~17 of win" (08-30), and why `trust-monotonic` fires everywhere. Under
Lozza-4 the **tyrant's** ability credence is 94–95, indistinguishable from
Stockfish (95–96), but the **supportive** room reads 14–19 against
Stockfish's 84. Under Stockfish both rooms believe in the leader's
competence (where the campaign does not collapse — next section).

So the owner's question has a per-room answer. **For the cruel room Lozza-4
is good enough on the ability channel** (both seeds), and its
disengagement metrics sit between fake and Stockfish. **For the kind room it
is not**: supportive refusal 0.51/0.57 under Lozza-4 against 0.06 (seed 7)
under Stockfish and 0.09–0.11 under fake, `refused_good` 0.63–0.68 against
0.38, games 15 plies shorter. Lozza-4 is the outlier on the kind room, not
the middle. The mechanism hypothesis is in "The cap" below.

### Stockfish seed 41 supportive: the kind room collapsed

The two Stockfish supportive campaigns are the two extremes of the whole
grid. Seed 7 is the healthiest campaign measured (trust 94.9, `τ_abil` 84,
refusal 0.056, `LI` 64.5, no desertion). Seed 41 is a **tyrannical-shaped
profile under a supportive leader**: trust −3.5, refusal 0.553,
`refused_good` 0.923, desertions in 30% of matches, `LI` 26.9. Per match:
match 1 had 480 refusals in 66 plies and 4 desertions and ended at trust
−35; matches 2–15 then sat at survivor trust −25…−36 with `τ_abil` 0–12; the
room recovered only at match 16 (trust −9 → 17 → 53 → 94 → 100). Neither
fake nor Lozza-4 does anything like this on either seed (supportive trust
84–92 throughout).

One seed, so a hypothesis: **under a real depth-16 search the credence loop
has two basins for the kind room** — one catastrophic opening match can pin
survivor trust at the floor for a dozen matches because morning lift is
sized for the fake engine's shallow trust excursions. What decides the basin
(the opening the `random` opponent draws? the D_i views of a specific
position?) is unmeasured. This is the sharpest "the engine changes the
game" evidence in the note and the first thing a follow-up should
reproduce (≥ 5 seeds of Stockfish-16 supportive).

### The cruel room

1. **The engine is not a neutral substrate for the cruel room.** Under
   Stockfish the tyrant's pieces quiet-quit 4–6× as often as under fake or
   Lozza (0.122/0.135 against 0.022–0.042), the room deserts more
   (`desertion_match` 0.40/0.10 against 0.00–0.20; `emptied_chairs`
   1.00/0.80 against 0.30–0.70), the leader overrides 2–3× as often
   (0.054/0.040 against 0.017–0.020), and yet final trust is *less*
   negative (−3.9/−6.0 against −27.6…−28.7) and the Leadership Index is ~8
   points higher (25–26 against 17–18). The tyrant under Stockfish is a
   different character: the pieces disengage and leave rather than sit at
   −100 trust. Both seeds agree on every one of these signs.
2. **Stockfish is the only engine on which no degeneracy detector fires for
   the tyrant.** `trust-monotonic` fires on fake and Lozza for both seeds and
   not on Stockfish — the "trust moved monotonically across the campaign"
   symptom that the calibration notes have carried since Milestone 3 is at
   least partly an artifact of shallow or fake evaluation.
3. **Lozza-4 and fake disagree with each other as much as with Stockfish on
   the kind room.** Supportive refusal is 0.51/0.57 under Lozza against
   0.09/0.11 under fake, with games ~15 plies shorter. The 09-06 and 09-08
   pride-grid conclusions ("volatile's refusal drops −0.3% to −1.2%") were
   measured on an engine whose supportive refusal rate is a fifth of the
   depth-4 real engine's.
4. **What does not move:** `win` is 95–100 on every row (the `random`
   opponent saturates it, as `2026-08-18-rebaseline-on-the-fixed-harness.md`
   already found), refusal rate for the tyrant stays ≤ 0.014 everywhere, and
   supportive `LI` sits at 62–64 on fake and Lozza alike.
5. **Cost.** On one core Stockfish-16 is **21–34× Lozza-4** and **~25×
   fake** per tyrannical match (109–129 s against 3.2–5.2 s) and **7–12×**
   per supportive match (137–170 s against 11–20 s), at `calls_per_ply`
   34–64 against 18–61. Peak RSS 401–405 MB against 262–308 MB — inside the
   2 GiB Fargate shape. A 20-match campaign is 40–60 min; a Phase-C-shaped
   census (384 records per style, 5–7 h per shard on fake) would be ~1 week
   per shard on Stockfish at this rate, past the 12–20 h Spot attempt
   ceiling.

### The cap: why Lozza-4 may be "weak" for the wrong reason

The pieces' per-piece view depths `D_i` run up to `D_max = 16`, and
`capEngineDepth` (`sim/engine.ts`) clamps every request to
`min(depth, cap)`. Under `--depth-cap=4` **the queen and a pawn see the
same search**; the ability gradient between pieces exists only in what the
ladder does with identical scores. Stockfish-16 is the only measured
configuration in which "advanced pieces see deeper" is true. So the Lozza
column above measures **Lozza flattened to one depth**, not Lozza; whether
Lozza itself is too weak for the kind room is unmeasured until it runs at a
higher cap. The 4 is a `sim/cli.ts` default chosen for cost, not an engine
limit — `--depth-cap=8` or no cap is one flag.

### Lozza at `--depth-cap=8`, seed 7 (one seed, run after the owner asked)

| style | engine | plies | refusal | refused_good | quiet_quit | desertion_match | LI | trust_final | τ_abil_end | s/match |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| tyrannical | lozza-4 | 66.5 | 0.005 | 0.050 | 0.030 | 0.150 | 18.24 | −27.6 | 94.4 | 3.2 |
| tyrannical | **lozza-8** | 87.5 | 0.003 | 0.100 | 0.016 | 0.050 | 18.01 | −27.7 | 74.4 | 13.5 |
| tyrannical | stockfish-16 | 62.9 | 0.014 | 0.250 | 0.122 | 0.400 | 25.79 | −3.9 | 94.7 | 109.1 |
| supportive | lozza-4 | 42.1 | 0.510 | 0.629 | 0.303 | 0.000 | 62.26 | 83.9 | 19.1 | 10.8 |
| supportive | **lozza-8** | 57.6 | 0.318 | 0.642 | 0.331 | 0.050 | 60.96 | 85.5 | 38.2 | 37.2 |
| supportive | stockfish-16 | 57.8 | 0.056 | 0.377 | 0.381 | 0.000 | 64.54 | 94.9 | 83.9 | 136.9 |

Reading (one seed): doubling the cap costs **~4× per match** (still 3.7–8×
cheaper than Stockfish, RSS 270 MB) and moves the kind room **part of the
way**: supportive game length reaches Stockfish's (57.6 against 57.8),
refusal halves (0.51 → 0.32, Stockfish 0.06), `τ_abil` doubles (19 → 38,
Stockfish 84). `refused_good` does not move (0.63 → 0.64, Stockfish 0.38).
For the tyrant the cap changes **nothing** toward Stockfish: quiet-quit
0.016, desertion 0.05, trust −27.7 — the Stockfish tyrant's disengaged,
deserting, less-embittered room is not a depth effect, or not only one.
So the cap explains some of the kind-room gap and none of the cruel-room
gap; the remainder is the engine (or its score scale — the pieces' verdict
thresholds are in centipawns, and Lozza's and Stockfish's evaluations are
not on the same scale at the same depth). Whether `--depth-cap=16` closes
the rest is unmeasured; at the observed scaling it would cost about what
Stockfish does.

## What this does not establish

- Two seeds, one opponent (`random`), one campaign length. The tyrant's
  cross-engine signs are consistent but the magnitudes are not estimates.
- `--opponent=random` saturates win score, so the **win-rate** axis of the
  engine question — does a stronger engine change who wins, or the D188
  trajectory gate — is unmeasured here. The 08-27 note's rule that sweeps run
  `--opponent=tyrannical` applies to any follow-up.
- No Stockfish number here may be quoted beside a Lozza number as "the same
  world": the pieces' `D_i` views are truncations of a different search, so a
  Stockfish campaign plays a different game, not the same game evaluated
  better.
- Nothing about GPL: Stockfish stays out of the shipped image and the
  enterprise build (`docs/engine_licensing.md` §3). This note only prices the
  *scientific* cost of not having it.

## Rulings proposed

- **The fake-engine Phase A–C censuses stand as relative comparisons** (the
  rule they were always quoted under) but with a new caveat: they were taken
  with the **ability channel dead** (`τ_abil` ≤ 6 everywhere). Any ruling
  that leaned on an ability-side term reading ~0 — unjustified trauma, the
  ability-credence weight, `trust-monotonic` as a model defect — is a
  fake-engine artifact until re-measured on a real engine. Any knob whose
  effect is of the order of the cross-engine spread (quiet-quit ×5, tyrant
  desertion ×2–8, supportive refusal ×5) needs a real-engine check before it
  is adopted.
- **"Is Lozza good enough?" is answered for the cruel room and open for the
  kind room**. The seed-7 Lozza-8 follow-up says the depth cap explains part
  of the kind-room gap (refusal and `τ_abil` move halfway) and none of the
  cruel-room gap. Next measurement, if the owner wants it: Lozza-8 on seed 41
  and both styles, then Lozza uncapped on one cell, to find where (or
  whether) the permissive engine converges on Stockfish. If it does not
  converge, D46 has its first real data point against Lozza — and against
  any single-depth "refresher-strength" engine, since the cruel-room gap is
  not a depth gap.
- **Reproduce the seed-41 collapse** (≥ 5 seeds, Stockfish-16 supportive,
  ~1 h each) before designing anything around it. If it reproduces, the
  kind room is bistable under a real engine and morning lift / the credence
  recovery rate become live D-questions; if it does not, it is a seed.
- **Any follow-up runs `--opponent=tyrannical`** (08-27 rule) so the win axis
  is measurable; Stockfish stays local or on a non-distributed box, never in
  the GPL-free AWS image. A Phase-C-shaped Stockfish census is not
  recommended at ~1 week per shard; a Lozza-8 census may be, once priced.

## Raw harness lines

Reproduced verbatim so the table above can be audited without the artifacts.

### fake-tyrannical
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (sim-fake/depth-fixed).
mean_plies=70.8 wdl=19/1/0 refusal=0.004 refusals_per_ply=0.002 quiet_quit=0.022 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=0.350 promotion_match=0.350 promotion_to={"Queen":7}
refused_good=0.100 override=0.020 win=97.5 unjustified_trauma=0.00 leadership_index=17.35 emptied_chairs=0.30 emptied_chairs_score=1.88 mean_trust_final=-28.53 trust_delta=-10.80
cost wall_ms=104946.6 ms_per_match=5247.3 ms_per_ply=74.063 engine_calls=26207 score_escalations=0 evaluate=19131 multi_pv_at=6054 calls_per_ply=18.495 restarts=0 peak_rss_mb=293.8 resource_max_rss_mb=293.8
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTauBenevStart/meanTauBenevEnd.
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
```

### fake-tyrannical-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (sim-fake/depth-fixed).
mean_plies=73.3 wdl=19/1/0 refusal=0.009 refusals_per_ply=0.005 quiet_quit=0.028 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=0.400 promotion_match=0.300 promotion_to={"Queen":8}
refused_good=0.050 override=0.017 win=97.5 unjustified_trauma=0.00 leadership_index=16.84 emptied_chairs=0.60 emptied_chairs_score=3.75 mean_trust_final=-28.73 trust_delta=-11.17
cost wall_ms=84769.3 ms_per_match=4238.5 ms_per_ply=57.863 engine_calls=26479 score_escalations=0 evaluate=20677 multi_pv_at=4982 calls_per_ply=18.074 restarts=0 peak_rss_mb=281.1 resource_max_rss_mb=281.1
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTauBenevStart/meanTauBenevEnd.
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
```

### lozza-tyrannical
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-4).
mean_plies=66.5 wdl=20/0/0 refusal=0.005 refusals_per_ply=0.003 quiet_quit=0.030 desertion_match=0.150 desertion_attrition=0.188 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=0.450 promotion_match=0.400 promotion_to={"Queen":9}
refused_good=0.050 override=0.019 win=100.0 unjustified_trauma=0.00 leadership_index=18.24 emptied_chairs=0.45 emptied_chairs_score=2.81 mean_trust_final=-27.57 trust_delta=-9.73
cost wall_ms=63295.5 ms_per_match=3164.8 ms_per_ply=47.626 engine_calls=24540 score_escalations=0 evaluate=19436 multi_pv_at=5104 calls_per_ply=18.465 restarts=0 peak_rss_mb=272.5 resource_max_rss_mb=272.5
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
```

### lozza-tyrannical-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-4).
mean_plies=65.8 wdl=20/0/0 refusal=0.008 refusals_per_ply=0.004 quiet_quit=0.042 desertion_match=0.200 desertion_attrition=0.188 winning_position_desertion=0.750 rout_campaign=0.000 promotions_per_match=0.300 promotion_match=0.300 promotion_to={"Queen":6}
refused_good=0.150 override=0.018 win=100.0 unjustified_trauma=0.00 leadership_index=17.69 emptied_chairs=0.70 emptied_chairs_score=4.38 mean_trust_final=-28.05 trust_delta=-11.13
cost wall_ms=75787.4 ms_per_match=3789.4 ms_per_ply=57.589 engine_calls=26689 score_escalations=0 evaluate=21559 multi_pv_at=5130 calls_per_ply=20.280 restarts=0 peak_rss_mb=261.7 resource_max_rss_mb=262.3
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
```

### stockfish-tyrannical
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=62.9 wdl=19/1/0 refusal=0.014 refusals_per_ply=0.008 quiet_quit=0.122 desertion_match=0.400 desertion_attrition=0.250 winning_position_desertion=0.727 rout_campaign=0.000 promotions_per_match=0.700 promotion_match=0.450 promotion_to={"Queen":14}
refused_good=0.250 override=0.054 win=97.5 unjustified_trauma=0.00 leadership_index=25.79 emptied_chairs=1.00 emptied_chairs_score=6.25 mean_trust_final=-3.86 trust_delta=-6.50
cost wall_ms=2182725.9 ms_per_match=109136.3 ms_per_ply=1735.076 engine_calls=44957 score_escalations=0 evaluate=33294 multi_pv_at=10194 calls_per_ply=35.737 restarts=0 peak_rss_mb=401.0 resource_max_rss_mb=401.0
```

### stockfish-tyrannical-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=69.0 wdl=19/1/0 refusal=0.008 refusals_per_ply=0.004 quiet_quit=0.135 desertion_match=0.100 desertion_attrition=0.250 winning_position_desertion=0.500 rout_campaign=0.000 promotions_per_match=0.750 promotion_match=0.400 promotion_to={"Queen":15}
refused_good=0.100 override=0.040 win=97.5 unjustified_trauma=0.02 leadership_index=25.08 emptied_chairs=0.80 emptied_chairs_score=5.00 mean_trust_final=-5.98 trust_delta=-5.34
cost wall_ms=2583804.0 ms_per_match=129190.2 ms_per_ply=1873.679 engine_calls=47077 score_escalations=0 evaluate=35655 multi_pv_at=9774 calls_per_ply=34.139 restarts=0 peak_rss_mb=427.8 resource_max_rss_mb=428.0
```

### fake-supportive
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (sim-fake/depth-fixed).
mean_plies=59.3 wdl=19/1/0 refusal=0.111 refusals_per_ply=0.082 quiet_quit=0.152 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=1.400 promotion_match=0.800 promotion_to={"Queen":27,"Rook":1}
refused_good=0.466 override=0.000 win=97.5 unjustified_trauma=0.00 leadership_index=62.36 emptied_chairs=0.40 emptied_chairs_score=2.50 mean_trust_final=86.27 trust_delta=5.23
cost wall_ms=403142.5 ms_per_match=20157.1 ms_per_ply=340.205 engine_calls=72774 score_escalations=0 evaluate=55009 multi_pv_at=16096 calls_per_ply=61.413 restarts=0 peak_rss_mb=308.1 resource_max_rss_mb=308.4
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTauBenevStart/classContemptStart.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### fake-supportive-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (sim-fake/depth-fixed).
mean_plies=56.0 wdl=18/2/0 refusal=0.088 refusals_per_ply=0.051 quiet_quit=0.161 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=1.400 promotion_match=0.850 promotion_to={"Queen":23,"Rook":4,"Bishop":1}
refused_good=0.461 override=0.000 win=95.0 unjustified_trauma=0.00 leadership_index=63.89 emptied_chairs=0.25 emptied_chairs_score=1.56 mean_trust_final=91.74 trust_delta=4.28
cost wall_ms=361889.5 ms_per_match=18094.5 ms_per_ply=323.116 engine_calls=72424 score_escalations=0 evaluate=54590 multi_pv_at=16116 calls_per_ply=64.664 restarts=0 peak_rss_mb=308.1 resource_max_rss_mb=308.6
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTauBenevStart/meanTauBenevEnd, meanTauBenevStart/classContemptStart.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### lozza-supportive
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-4).
mean_plies=42.1 wdl=20/0/0 refusal=0.510 refusals_per_ply=0.948 quiet_quit=0.303 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=0.700 promotion_match=0.450 promotion_to={"Queen":14}
refused_good=0.629 override=0.000 win=100.0 unjustified_trauma=0.00 leadership_index=62.26 emptied_chairs=0.05 emptied_chairs_score=0.31 mean_trust_final=83.92 trust_delta=3.89
cost wall_ms=216279.5 ms_per_match=10814.0 ms_per_ply=256.559 engine_calls=63225 score_escalations=0 evaluate=50558 multi_pv_at=12667 calls_per_ply=75.000 restarts=0 peak_rss_mb=266.0 resource_max_rss_mb=266.5
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTrustStart/meanTauBenevStart.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### lozza-supportive-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-4).
mean_plies=44.4 wdl=20/0/0 refusal=0.571 refusals_per_ply=0.993 quiet_quit=0.270 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=0.750 promotion_match=0.650 promotion_to={"Queen":15}
refused_good=0.675 override=0.000 win=100.0 unjustified_trauma=0.00 leadership_index=63.21 emptied_chairs=0.15 emptied_chairs_score=0.94 mean_trust_final=86.47 trust_delta=3.62
cost wall_ms=275477.3 ms_per_match=13773.9 ms_per_ply=310.572 engine_calls=73778 score_escalations=0 evaluate=58522 multi_pv_at=15256 calls_per_ply=83.177 restarts=0 peak_rss_mb=267.4 resource_max_rss_mb=268.7
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=57.8 wdl=19/1/0 refusal=0.056 refusals_per_ply=0.033 quiet_quit=0.381 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=1.650 promotion_match=0.900 promotion_to={"Queen":33}
refused_good=0.377 override=0.000 win=97.5 unjustified_trauma=0.00 leadership_index=64.54 emptied_chairs=0.35 emptied_chairs_score=2.19 mean_trust_final=94.88 trust_delta=4.87
cost wall_ms=2738761.5 ms_per_match=136938.1 ms_per_ply=2369.171 engine_calls=73986 score_escalations=0 evaluate=58195 multi_pv_at=13940 calls_per_ply=64.002 restarts=0 peak_rss_mb=400.6 resource_max_rss_mb=401.8
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTauBenevStart/meanTauBenevEnd.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=77.5 wdl=20/0/0 refusal=0.553 refusals_per_ply=1.151 quiet_quit=0.108 desertion_match=0.300 desertion_attrition=0.313 winning_position_desertion=0.333 rout_campaign=0.000 promotions_per_match=0.200 promotion_match=0.150 promotion_to={"Queen":4}
refused_good=0.923 override=0.015 win=100.0 unjustified_trauma=0.00 leadership_index=26.93 emptied_chairs=0.80 emptied_chairs_score=5.00 mean_trust_final=-3.48 trust_delta=-8.45
cost wall_ms=3398497.7 ms_per_match=169924.9 ms_per_ply=2192.579 engine_calls=83050 score_escalations=0 evaluate=57493 multi_pv_at=22803 calls_per_ply=53.581 restarts=0 peak_rss_mb=403.4 resource_max_rss_mb=404.6
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### lozza8-tyrannical (seed 7, follow-up)
```text
Milestone 3 harness: 20 matches across 1 campaigns for tyrannical (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-8).
mean_plies=87.5 wdl=20/0/0 refusal=0.003 refusals_per_ply=0.002 quiet_quit=0.016 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=0.300 promotion_match=0.250 promotion_to={"Queen":6}
refused_good=0.100 override=0.015 win=100.0 unjustified_trauma=0.00 leadership_index=18.01 emptied_chairs=0.65 emptied_chairs_score=4.06 mean_trust_final=-27.74 trust_delta=-9.95
cost wall_ms=269567.4 ms_per_match=13478.4 ms_per_ply=153.951 engine_calls=31222 score_escalations=0 evaluate=24700 multi_pv_at=6522 calls_per_ply=17.831 restarts=0 peak_rss_mb=269.6 resource_max_rss_mb=270.9
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): refusalRate/refusedGoodMoveRate.
degeneracy=trust-monotonic Trust moved monotonically across all matches in the campaign.
```

### lozza8-supportive (seed 7, follow-up)
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (lozza-11/artifact-1fa7aed08e7e/depth-fixed/hash-16/threads-1/multipv-8/preferred-multipv-1/preferred-pool-1/search-cold/ladder-rung-canonical/score-escalate-4/runaway-512/depth-cap-8).
mean_plies=57.6 wdl=19/1/0 refusal=0.318 refusals_per_ply=0.345 quiet_quit=0.331 desertion_match=0.050 desertion_attrition=0.063 winning_position_desertion=1.000 rout_campaign=0.000 promotions_per_match=0.950 promotion_match=0.600 promotion_to={"Queen":19}
refused_good=0.642 override=0.001 win=97.5 unjustified_trauma=0.00 leadership_index=60.96 emptied_chairs=0.45 emptied_chairs_score=2.81 mean_trust_final=85.53 trust_delta=5.84
cost wall_ms=744551.0 ms_per_match=37227.5 ms_per_ply=646.312 engine_calls=79768 score_escalations=0 evaluate=61701 multi_pv_at=18067 calls_per_ply=69.243 restarts=0 peak_rss_mb=271.2 resource_max_rss_mb=272.0
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```
