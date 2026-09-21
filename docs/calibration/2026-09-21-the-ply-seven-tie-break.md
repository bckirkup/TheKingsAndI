# The Ply-Seven Tie-Break — What Selects the Stockfish Kind-Room Collapse

**Date:** 2026-09-21
**Follows:** `2026-09-21-lozza-at-depth-and-the-bistable-kind-room.md` (PR #217),
which measured that 2 of 7 Stockfish-16 supportive seeds (29, 41) land in a
tyrant-shaped basin and proposed exactly these two follow-ups: (a) read the
per-match and ply-level transcripts of seeds 29/41 to find the selecting
event; (b) rerun the same seeds at `--opponent=tyrannical`. The owner approved
both ("a and b"). **Nothing here changes a default or re-reads an earlier
ruling; no AWS campaign was run.**

## Settled inputs (from 09-20 and 09-21, not re-derived)

- Stockfish-16 supportive, `--opponent=random` (harness default), 20 matches:
  seeds 3, 7, 11, 19, 23 healthy (pooled trust 94.5–97.2, LI 63.6–65.0);
  seeds 29 and 41 collapsed (trust −29.1 / −3.5, LI 16.1 / 26.9).
- Fake and Lozza (caps 4, 8, 16) supportive never collapse on any tested seed.
- Stockfish 18 is GPL-3.0 and stays out of the AWS image and the enterprise
  build. All runs here are local.

## Method

- Tree `7b00a61` (`main` after PR #217; harness identical to the 09-21 runs).
- Determinism id, every Stockfish run:
  `stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical`.
- (a) Per-match rows of the existing seed 29/41 CSVs (09-21 runs), plus two
  one-match decision journals (ADR 0062 `--journal`) for the healthy control
  seed 7 and the collapsed seed 41:
  `pnpm sim --matches=1 --leader=supportive --seed=<7|41> --engine=stockfish --journal=…`.
  Match 1 of a one-match run is bit-identical to match 1 of the 20-match run
  (same seed, same PRNG prefix), so the journal is the transcript of the
  collapsing match, not a re-sample.
- (b) `pnpm sim --matches=20 --leader=supportive --seed=<29|41> --engine=stockfish --opponent=tyrannical`,
  two parallel lanes, 1 h 20 m / 1 h 27 m wall, peak RSS 397–409 MB.

## Result (a): the collapse is a match-1 dismissal, selected by one tie-break

### Per-match shape (measured, from the 09-21 CSVs)

| seed | match 1 plies | match 1 refusals | match 1 desertions | match 1 trust 40 → | dismissed | matches 2–20 |
|---|---|---|---|---|---|---|
| 29 | 101 | 319 | 5 | −34.3 | `dismissed_by_room` at ply **41** | all 19 re-dismissed within 1–12 plies (start trust −4…−28) |
| 41 | 66 | 480 | 4 | −35.1 | `dismissed_by_room` at ply **45** | 14 re-dismissed within 1–11 plies; matches 16–20 recover (trust −9 → 96) |
| 7 (control) | 43 | 0 | 0 | +44.0 | no | healthy throughout |

So the "collapsed campaign" is not a slow attractor. The supportive leader
loses the room (mean roster trust ≤ −25, ADR 0021/D26) inside the first ~45
plies of match 1, the King plays the match out, and every later match starts
from the inherited trust so the leader is re-dismissed almost at once. Matches
2–20 of a collapsed campaign are King-command games and are **not** independent
evidence about the supportive leader. The 20-match summary (refusal 0.51–0.55,
desertion 0.30–0.45, LI 16–27) is the shadow of one game.

### The selecting event (measured, seed 7 vs seed 41 one-match journals)

Both seeds open identically for three moves — a4, d4, f4 — because the
supportive policy is chess-blind: it scores candidates with
`tacticalScore(feature, 25)` (a pawn-advance bonus dominates a quiet opening),
ties are broken by the campaign's seeded PRNG, and it never overrides
(`shouldOverride: () => false`, `sim/leaders.ts`). At ply 7 the two seeds draw
differently:

- **Seed 7 draws e4.** No piece objects. Zero refusals in the whole match;
  trust 40 → 44.
- **Seed 41 draws h4.** The h2 pawn refuses ("barely beyond the limit"); the
  leader stands; the harness offers the next candidate (e4) which is played.
  From ply 9 on the leader's ordered list is refused candidate after candidate
  — 4 at ply 9, 22 at ply 19, 33 at ply 25, 46 at ply 27, 60 at ply 37, and
  45–49 per ply (i.e. every legal move) at plies 39–45 — with the objection
  words escalating from "barely beyond the limit" through "clearly beyond the
  limit" to "unthinkable to the piece" and the roster bands going
  loyal → wary → hostile. When every candidate is refused the harness plays
  the *first* refused move as an implicit override (`headlessMatch.ts`,
  "Refused candidate disappeared before implicit override"), charging the
  override cost on top of the refusals. Dismissal at ply 45.

Ply-by-ply for seed 41, `played/refusals-this-ply`:

```text
1:a4/0 3:d4/0 5:f4/0 7:e4/1 9:c3/4 11:f5/6 13:fxg6/1 14:Qc2/8 16:Na3/7 18:dxc5/4
19:Nf3/22 21:Bf4/6 23:O-O-O/23 25:Nb5/33 27:Qd3/46 29:Bxc4/30 31:Bxd5/0 33:Bc4/37
35:Rxd7/0 37:Rc7/60 39:Bc7+/49 41:Bd6/49 43:Qf5/49 45:b4/45
```

Seed 29 has the same per-match shape (319 refusals, 5 desertions, dismissed
at ply 41); its journal was not captured, so the exact ply of its first
refusal is **inferred** from the shape, not measured.

### Reading (inferred)

The kind-room collapse is the competence trap of `docs/trust_dynamics.md`,
entered from a single refusal. The supportive policy has no memory of what
was refused and no chess sense: after one refusal it keeps ordering moves the
depth-16 view flags as unacceptable, each refusal lowers trust, lower trust
lowers every piece's tolerance, so the next order is refused by more pieces,
until the whole legal move list is refused every ply and the implicit override
finishes the room off. Fake and Lozza never enter the spiral because their
shallower or noisier evaluations rarely flag a quiet opening pawn push as
"beyond the limit" — the *engine* supplies the trigger; the *leader policy*
supplies the spiral. Under Stockfish the supportive style as scripted is a
"repeat the refused order" leader, which is what turns one refusal into 480.

## Result (b): against a tyrannical opponent neither seed collapses

Same seeds, same engine, same leader, 20 matches, `--opponent=tyrannical`:

| cell | refusal | refused-good | quiet-quit | desertion match | dismissals | trust final | LI | win | τ_abil Q1→Q4 |
|---|---|---|---|---|---|---|---|---|---|
| s29 vs random (09-21) | 0.506 | 0.978 | 0.022 | 0.450 | 20/20 | −29.1 | 16.1 | 97.5 | 9.7 → 4.9 |
| **s29 vs tyrannical** | 0.073 | 0.535 | 0.408 | 0.000 | **0/20** | 97.5 | **63.9** | 97.5 | 31.4 → 86.1 |
| s41 vs random (09-20) | 0.549 | 0.919 | 0.019 | 0.300 | 15/20 | −3.5 | 26.9 | 100 | 5.7 → 47.3 |
| **s41 vs tyrannical** | 0.332 | 0.782 | 0.410 | 0.150 | **0/20** | 95.3 | **63.1** | 97.5 | 37.5 → **5.4** |

Both reruns read as healthy kind rooms by the pooled index (63–64, inside the
63.6–65.0 band of the five healthy random-opponent seeds). Match 1 of each
has 27 / 15 refusals and no desertion, trust 40 → 88 / 80.

**Caveat that limits the reading.** The opponent draws from the *same* seeded
PRNG stream as the leader (`runHeadlessMatch` passes one `random` to both), so
switching the opponent archetype also changes the leader's ply-7 tie-break.
The rerun therefore shows that the collapse is a property of the early
*trajectory*, not of the seed as such — a seed that collapses on one board
history is a model kind room on another — but it does **not** isolate
"opponent archetype" as a causal variable. Collapse frequency against a
tyrannical opponent is untested beyond these two trajectories.

### A new observation in s41 vs tyrannical (measured, one campaign — hypothesis)

Ability credence collapses without the room collapsing: `τ_abil` falls
37.5 → 13.6 → 4.4 → 5.4 across the quartiles (King and Knight at 0.0 in
Q3–Q4, vindication 1.00 → 0.20) while `τ_benev` stays 82–92, trust ends
84–100 in every match, and three matches carry 138–140 refusals each with no
dismissal. This is the first Stockfish kind room in which the pieces have
stopped believing the leader is competent but have not stopped trusting the
leader — a disengaged-but-loyal room, the profile `docs/trust_dynamics.md`
describes as the mid-stage of the trap. One campaign; carried as a hypothesis.

## Conclusions

1. **Measured.** The Stockfish supportive "collapse" is a match-1 room
   dismissal at ply 41–45 (seeds 29, 41), after which the campaign is a
   King-command campaign. It is selected in seed 41 by the ply-7 tie-break
   (h4 vs e4) and sustained by the supportive policy re-ordering refused moves
   until the whole move list is refused.
2. **Measured.** The same two seeds against a tyrannical opponent do not
   collapse (0/40 dismissals, LI 63–64). Collapse is a trajectory property,
   not a seed property.
3. **Inferred.** The engine's role is the trigger: a depth-16 evaluation is
   what makes an early flank pawn push read as "beyond the limit" to the
   pieces, and neither fake nor Lozza-at-any-cap supplies that trigger. The
   spiral itself belongs to the leader policy and the trust dynamics, and
   would run under any engine that fired the first refusal.
4. **Consequence for the engine question (inferred).** The bistability is
   not evidence against Stockfish and not evidence for Lozza; it is evidence
   that the scripted supportive leader is fragile to a single early refusal
   once the engine is good enough to produce one. A pseudo-player that
   re-orders a refused move is a harness-policy defect, not a psychology
   finding, and should be fixed (or measured as a named style) before any
   collapse rate is quoted as a property of the kind room.
5. **No AWS campaign is warranted** from this evidence.

## Proposed next measurements (not started; owner decides)

- (d) Give the supportive pseudo-player a refused-move memory (do not re-order
  a move refused this match by the same piece) and rerun seeds 29/41 under
  Stockfish at `--opponent=random`. If the collapse disappears, conclusion 4
  is confirmed and the 2-of-7 rate was a harness artifact.
- (e) To isolate opponent archetype from the RNG confound, split the opponent
  onto its own derived PRNG stream (a harness change with a determinism-id
  bump) before any opponent-controlled comparison is quoted.
- (c) from 09-21 — the Lozza-vs-Stockfish centipawn-scale comparison on a
  fixed position set — is still the right test of "the trigger is a
  score-scale difference".

## Raw artifacts

Raw CSVs and journals are retained outside the tree at
`~/enginecmp/followup/stockfish-supportive-vsTyr-s{29,41}.{csv,log}` and
`~/enginecmp/journal/sf-sup-s{7,41}.json` on the measuring VM; the pooled
readouts are reproduced below.

### stockfish-supportive-vsTyr-s29
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=83.0 wdl=19/1/0 refusal=0.073 refusals_per_ply=0.051 quiet_quit=0.408 desertion_match=0.000 desertion_attrition=0.000 winning_position_desertion=0.000 rout_campaign=0.000 promotions_per_match=0.150 promotion_match=0.150 promotion_to={"Queen":3}
refused_good=0.535 override=0.000 win=97.5 unjustified_trauma=0.00 leadership_index=63.94 emptied_chairs=0.65 emptied_chairs_score=4.06 mean_trust_final=97.50 trust_delta=6.68
cost wall_ms=4750187.1 ms_per_match=237509.4 ms_per_ply=2861.558 engine_calls=85640 score_escalations=0 evaluate=74534 multi_pv_at=9519 calls_per_ply=51.590 restarts=0 peak_rss_mb=408.5 resource_max_rss_mb=408.5
quartile=1 matches=1-5 tau_abil=31.40 tau_benev=89.71 vindication=0.629 drip_events=1.00 adjudication_vindication=0.629 refusal=0.183 refusals_per_ply=0.143 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=8.60
quartile=2 matches=6-10 tau_abil=71.28 tau_benev=99.25 vindication=0.687 drip_events=0.00 adjudication_vindication=0.687 refusal=0.035 refusals_per_ply=0.019 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=8.00
quartile=3 matches=11-15 tau_abil=93.30 tau_benev=98.72 vindication=0.779 drip_events=0.00 adjudication_vindication=0.779 refusal=0.030 refusals_per_ply=0.016 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=8.60
quartile=4 matches=16-20 tau_abil=86.08 tau_benev=99.71 vindication=0.714 drip_events=0.00 adjudication_vindication=0.714 refusal=0.045 refusals_per_ply=0.026 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=8.80
degeneracy=metric-collinearity Transcript metrics are highly collinear (|r| > 0.95): meanTrustStart/meanTauBenevEnd.
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```

### stockfish-supportive-vsTyr-s41
```text
Milestone 3 harness: 20 matches across 1 campaigns for supportive (stockfish-js-18-lite-single/hash-16/threads-1/dmax-16/multipv-8/preferred-multipv-1/preferred-pool-1/ladder-rung-canonical).
mean_plies=82.8 wdl=19/1/0 refusal=0.332 refusals_per_ply=0.458 quiet_quit=0.410 desertion_match=0.150 desertion_attrition=0.125 winning_position_desertion=0.667 rout_campaign=0.000 promotions_per_match=0.000 promotion_match=0.000 promotion_to={}
refused_good=0.782 override=0.004 win=97.5 unjustified_trauma=0.00 leadership_index=63.10 emptied_chairs=0.65 emptied_chairs_score=4.06 mean_trust_final=95.31 trust_delta=6.25
cost wall_ms=5198409.0 ms_per_match=259920.4 ms_per_ply=3137.241 engine_calls=98231 score_escalations=0 evaluate=83694 multi_pv_at=12215 calls_per_ply=59.282 restarts=0 peak_rss_mb=396.8 resource_max_rss_mb=397.3
quartile=1 matches=1-5 tau_abil=37.45 tau_benev=92.03 vindication=0.737 drip_events=0.00 adjudication_vindication=0.737 tau_abil_role={"Bishop":28,"King":29.2,"Knight":29.9,"Pawn":51,"Queen":17.4,"Rook":43} refusal=0.239 refusals_per_ply=0.199 desertion_match=0.000 desertion_attrition=0.000 rout=0.000 roster=9.80
quartile=2 matches=6-10 tau_abil=13.59 tau_benev=82.30 vindication=1.000 drip_events=0.00 adjudication_vindication=1.000 tau_abil_role={"Bishop":11.8,"King":11.2,"Knight":11.8,"Pawn":6.8,"Queen":11.2,"Rook":25.1} refusal=0.512 refusals_per_ply=0.669 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=8.40
quartile=3 matches=11-15 tau_abil=4.41 tau_benev=88.95 vindication=0.395 drip_events=0.00 adjudication_vindication=0.395 tau_abil_role={"Bishop":3.8,"King":0,"Pawn":3.1,"Queen":19.8,"Rook":2.3,"Knight":0} refusal=0.327 refusals_per_ply=0.500 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=8.00
quartile=4 matches=16-20 tau_abil=5.42 tau_benev=91.63 vindication=0.200 drip_events=0.80 adjudication_vindication=0.200 tau_abil_role={"Bishop":15.6,"King":0,"Knight":0.6,"Pawn":5.95,"Queen":0,"Rook":0.4} refusal=0.250 refusals_per_ply=0.463 desertion_match=0.200 desertion_attrition=0.063 rout=0.000 roster=9.80
degeneracy=no-dilemma Supportive leader mean win score is too high — no morale/tactics tension.
```
