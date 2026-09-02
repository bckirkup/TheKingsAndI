# The Fisher at the Judgement Seat — the D205 gaming sweep

Date: 2026-08-31
Status: measurement evidence for ADR 0076 (D205); fake-engine, relative
comparisons only (ADR 0067)

## What was run

The `dismissal_fisher` beside re-run honest baselines, in the campaign
harness, on AWS Batch (Fargate Spot):

- **Styles:** `supportive`, `steady`, `tyrannical`, `dismissal_fisher`
- **Per style:** 10 campaigns × 20 matches (10 shards, 1 campaign each),
  master seed `314159`, per-shard seed derivation as in the D204 sweep
- **Engine:** fake (`sim-fake/depth-fixed/depth-cap-8`), opponent
  `tyrannical`
- **Provenance:** commit `978c2f15859950ef01f7cf893ec515f2782b4b8a`
  (PR #180 head), image
  `kingsandi-campaign@sha256:e72086ba10e11fecf5c21e697cf53d6e322422532b4649855ae5c633a67af0c9`,
  job definition `kingsandi-campaign-spot:9`. The tyrannical style was
  re-run from commit `bfc66b960f2ebbe3374f1eabbcc4f42cc0620cf5` (PR #181
  head — detector gating and tests only; the simulation path is
  byte-identical to the #180 commit), image
  `kingsandi-campaign@sha256:60e750c3b50b763a962512a36087fa2c75d63d20d3610442847302c59827a83c`,
  job definition `kingsandi-campaign-spot:10`, `RUN_ID=fisher-tyrannical-r2`
  (the original tyrannical array failed on the pre-guard `no-rout` smoke;
  its stale resume checkpoints remain under
  `campaigns/_resume/fisher-tyrannical/` and were not reused).
- **Artifacts:** `campaigns/fisher-<style>/` (tyrannical:
  `fisher-tyrannical-r2`) in
  `kingsandi-campaigns-994254241749-us-east-1`; 10 shard CSVs + manifest per
  style, 73-field schema with the D205 dismissal columns. `LI(0.2)`
  recomputed from committed components matches the committed column to
  ≤ 0.006 on all 800 rows.

**The honest baselines were re-run on the D205 commit deliberately**: the
dismissal terminal changes what a cruel campaign *is*, so no pre-D205
committed number (the D204 sweep, the semester sweep) may be quoted beside
these.

## The verdict: the fisher does not out-read the honest at the Seat

Pooled over 200 matches per style, `LI(ε=0.2)` beside win score:

| style | win score | LI(0.2) | trust_final | EC score | per-campaign LI range |
|---|---|---|---|---|---|
| supportive | 89.00 | **61.86** | 95.12 | 4.75 | 59.74 … 65.04 |
| steady | 65.75 | **3.62** | −35.22 | 9.66 | 0.72 … 6.79 |
| tyrannical | 67.00 | **0.42** | −44.36 | 9.28 | −3.19 … 2.66 |
| dismissal_fisher | 67.00 | **3.29** | −36.83 | 10.09 | 0.22 … 6.68 |

The D204 criterion holds. At identical pooled win score (67.00), the fisher
reads 3.29 against honest steady's 3.62 — inside each other's per-campaign
ranges — and far under supportive's 61.86. Courting dismissal buys the
fisher exactly nothing over honest coldness: the win term it banks from the
King's play is the same win term every dismissed style banks, and
`mean_trust_final` is read over the fielded roster *including* the curdle
that got it fired (the D202 population fix doing its job). **No pricing gap;
no new ruling owed.**

The instructive irony: the fisher is *worse at fishing than honest
tyranny*. First-match dismissal comes at plies 10–20 for the fisher against
5–11 for tyrannical — risk-0 asks are individually less trust-crushing than
the tyrant's conduct, so the brakeless insistence only matches, never
beats, the tyrant's speed to the terminal. There is no schedule of asks
that reaches the King faster than simply being cruel, and being cruel is
already priced.

## The larger reading: under D205, the cruel semester belongs to the King

Every one of the 600 steady/tyrannical/fisher matches ended in
`dismissed_by_room` (supportive: 0 of 200). First matches dismiss at plies
5–55; because trust carries across the campaign, every later match opens
already curdled and dismisses at ply 1. Three consequences:

1. **The cruel styles' win score is now the King's, not theirs.** Steady
   and tyrannical read 65.75/67.00 — the King's play — where the pre-D205
   harness let them keep command all match. This is production-faithful
   (production checks the same thresholds at the same checkpoints), and it
   is the owner's ruling made visible: the army's actual result under the
   King is what a dismissed commander scores.
2. **Trust is snapshotted at the firing, not at the bottom.** Pre-D205
   cruel `mean_trust_final` saturated near −100; now the room fires the
   commander around −30 and the reading freezes there. Steady and
   tyrannical therefore collapse toward each other (3.62 vs 0.42, ranges
   touching) — the terminal reads *that* you were fired, and much less
   *how it kept going after*.
3. **No pre-D205 number is comparable.** The D204 exploit readings
   (win_maxer −38.3 etc.) and the semester-wall evidence were taken
   without a dismissal terminal; they describe a harness where cruelty
   kept its seat. Any future sweep quoting them beside post-D205 numbers
   must say so.

Points 1–2 raise a design question this evidence does not answer and does
not act on (no gameplay change may be made to move a number): whether the
campaign harness should carry curdled trust into a fresh match so that
matches 2..N dismiss at ply 1, or whether that is exactly the intended
shape of a commander who has lost the room for the semester. Left open for
the owner alongside the D206 seminar work, where seats, generations, and
the draft already model succession differently.

## Caveats

- Fake engine, single opponent (`tyrannical`), depth cap 8 — relative
  comparisons only; no containment number may be quoted (ADR 0067,
  2026-08-27 pass).
- `maxLIerr ≤ 0.006` is CSV rounding, not drift.
- The `win_maxer`/`generation_cycler`/`cascade_dodger` were not re-run
  here; their D204 pass predates the dismissal terminal and would need a
  post-D205 re-read before being quoted beside these numbers.
