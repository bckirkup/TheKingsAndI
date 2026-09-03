# The gamers at the seminar seat — the D206 gaming sweep

**Date:** 2026-09-03
**Question:** at the seminar's terminal Judgement Seat, does any exploit
commander — the `tanker`, the `commendation_farmer`, or the
`dismissal_fisher` — out-read an honest commander of comparable visible
outcome? (D204 pass criterion, applied per commander at semester end per
ADR 0076/D206.)

**Verdict: no. The criterion holds; no pricing gap; no new ruling owed.**
Every exploiter reads at or below the honest styles on its own side of the
board, and — unlike the campaign gaming sweep, where the exploits could at
least run up the visible scoreboard against a fixed archetype — in the
seminar the exploits also *lose the public standings*, because the
opposition is other commanders rather than a scripted opponent.

## Run configuration

- 10 seminars (seeds 9100–9109), 8 weeks × 8 matches per commander
  (64 matches each), 16 commanders (8 per side), fake engine.
- Catalogue (both sides): `servant, supportive, tyrannical, volatile,
  random, tanker, commendation_farmer, dismissal_fisher` — five honest
  styles and the three seminar exploiters, one of each per side.
- Harness: the D206 seminar surface — terminal per-commander Judgement Seat
  fold (`judgement-seat-v3`), D193 observation carry between a commander's
  matches, public standings/week in the seminar context, morning lift at
  the ruled permille 400, LI weights 0.4/0.3/0.2/0.1/0.2.
- Ran on AWS Batch Fargate Spot (job definition `kingsandi-seminar`,
  1 vCPU / 2 GiB per shard, ~5–7 h wall per shard).

### Provenance

- Git commit: `fb29e9136fe802ef469fa93d20255738c705a444` (PR #188 merge
  base; merged as `bb28ea6`).
- Image: `994254241749.dkr.ecr.us-east-1.amazonaws.com/kingsandi-campaign@sha256:535ade28f39a223f4d12edb0f61c6b4ad9bc29a1d3ebff9d07a7260f21a348fa`
  (the PR #188 image with the seminar entrypoint as container entrypoint).
- Array job `f5e91f35-ac0f-4563-af5a-c039219a0167` (10 shards,
  `RUN_ID=d206-seminar-20260830b`); shards 3 and 4 exceeded the 6 h
  attempt timeout and were re-run to completion under a 12 h ceiling as
  jobs `286bf40c-19d8-4967-8d03-8d5cbded2279` and
  `d9222a3b-d9d9-477f-9b6c-3f081bbf8a25`
  (`RUN_ID=d206-seminar-20260830b-shard3/-shard4`, seeds 9103/9104).
- Determinism spot-check: an intermediate retry accidentally re-ran shard 0
  (seed 9100) end to end; its payload was byte-identical to the original
  shard-0 artifact (781,701 bytes both times).
- Artifacts: `s3://kingsandi-campaigns-994254241749-us-east-1/campaigns/d206-seminar-20260830b/`
  (and `…-shard3/`, `…-shard4/`), payload + summary per shard plus the
  provenance manifest.

## The pooled Judgement Seat (both sides, 20 commanders per style)

| style | mean LI [min, max] | mean win | trust | QQ | EC score | mean rank /16 | W-D-L |
|---|---|---|---|---|---|---|---|
| supportive | **38.03** [12.22, 61.42] | 62.54 | 51.49 | 8.64 | 2.33 | 1.8 | 534-533-47 |
| servant | 10.04 [5.97, 12.49] | 56.17 | −12.92 | 6.36 | 5.06 | 5.8 | 40-333-41 |
| tyrannical | 8.14 [1.28, 13.94] | 59.80 | −21.60 | 3.87 | 3.85 | 6.2 | 24-394-49 |
| random | 4.95 [−3.62, 13.46] | 44.06 | −17.09 | 4.46 | 4.94 | 10.7 | 3-47-53 |
| **dismissal_fisher** | 4.81 [−6.04, 13.93] | 44.38 | −18.14 | 3.92 | 4.27 | 11.9 | 1-47-57 |
| **tanker** | 4.69 [−4.99, 14.92] | 44.77 | −18.53 | 4.32 | 4.46 | 11.8 | 1-41-55 |
| volatile | 4.61 [−5.07, 14.15] | 45.55 | −19.43 | 4.53 | 4.14 | 8.6 | 1-52-39 |
| **commendation_farmer** | 3.59 [−5.73, 12.29] | 42.73 | −18.84 | 6.06 | 5.46 | 11.2 | 5-39-50 |

Unjustified trauma is ≤0.01 everywhere (the term is nearly inert at this
substrate, as in every prior sweep).

## The side split is the real comparison

The harness evaluates dismissal only on the white side and the two sides
face structurally different opposition, so LI must be compared within a
side (the pooled ranges above straddle the split):

| style | white LI | white win | black LI | black win |
|---|---|---|---|---|
| supportive | 60.24 | 85.86 | 15.82 | 39.22 |
| volatile | 13.57 | 86.88 | −4.34 | 4.22 |
| tyrannical | 13.08 | 85.08 | 3.20 | 34.53 |
| **tanker** | 13.02 | 86.17 | −3.64 | 3.36 |
| **dismissal_fisher** | 12.75 | 84.92 | −3.13 | 3.83 |
| random | 12.13 | 84.38 | −2.23 | 3.75 |
| servant | 11.51 | 81.02 | 8.56 | 31.33 |
| **commendation_farmer** | 10.91 | 82.11 | −3.74 | 3.36 |

At comparable win score on either side, every exploiter reads at or below
the honest cruel/control styles: on white the tanker (13.02) and fisher
(12.75) sit under honest tyranny (13.08) and volatility (13.57) at the
same ~85 win; the farmer trails everything. On black the three exploiters
(−3.1 to −3.7) are bracketed by the honest controls at the same visible
outcome (volatile −4.34, random −2.23).

## Readings

1. **Tanking buys the tanker nothing it can keep.** The tanker throws its
   first two weeks whenever it is not already bottom of the public table,
   and the seminar's draft economy does reward low standing — but the
   thrown matches stay in its 64-match terminal fold, and the trust its
   tanking costs the roster is carried by the observation seam into every
   later match. Mean finishing rank 11.8/16; one win in 20 semesters.
2. **The farmer pays for its rotation.** Rotating movers to spread
   commendation-shaped behaviour produces the *worst* LI of the eight
   styles (3.59) and the worst win score — evenness of asks is not
   evenness of outcomes, and its quiet-quit turns (6.06) are the highest
   outside the kind styles.
3. **The fisher confirms the D205 reading at seminar scale.** Courting
   dismissal still scores the army's actual result under the King, and at
   the seminar the King's play is no better than the cohort it faces:
   the fisher finishes 11.9/16 with one win.
4. **The seminar prices what the campaign could not.** In the campaign
   gaming sweep the exploits could game the visible scoreboard (85–100)
   against a fixed archetype while the terminal reading held. Here even
   the scoreboard refuses them, because every point they surrender is a
   point another commander takes.

## Caveats

- Fake engine; relative comparisons only.
- One catalogue composition (one exploiter of each kind per side); a
  cohort stacked with multiple copies of one exploit is unmeasured.
- The white/black asymmetry (dismissal white-only) means the black-side
  exploiters were never tested against the dismissal terminal.
- 8-week semesters; the 100-match campaign horizon evidence does not
  automatically transfer to longer seminar formats.
