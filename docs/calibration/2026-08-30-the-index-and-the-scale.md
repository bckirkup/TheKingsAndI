# The index and the scale (2026-08-30)

First measurement of the ADR 0074 Leadership Index at sweep scale, and the
evidence D202 asked for. Read `docs/adr/0074-the-priced-leader.md` and
`docs/calibration/2026-08-30-does-cruelty-ever-lead.md` first.

## Provenance

- AWS Batch, Fargate Spot, queue `kingsandi-campaign-spot-queue`, job
  definition `kingsandi-campaign-spot:4`, one campaign per array child.
- Image `994254241749.dkr.ecr.us-east-1.amazonaws.com/kingsandi-campaign@sha256:39b00b5988c0840d3e3f2cd21a953cd986b7d8f1b1282652868f578932a5a164`,
  commit `e4e8c10df8613dff3cecb6bfe32f58bf990314c1` (PR #171 head).
- Runs `li-sweep-1788123911-{supportive,tyrannical,steady}`; artifacts under
  `s3://kingsandi-campaigns-994254241749-us-east-1/campaigns/`.
- `--engine=fake --opponent=tyrannical --depth-cap=8`, master seed `314159`,
  10 campaigns per style, 20 matches per campaign (n = 200 matches per style).
- Determinism ID `sim-fake/depth-fixed/depth-cap-8`. Wall time ~32 minutes for
  all 30 shards, submission to completion, at 1 vCPU / 2 GB per child.
- Fake-engine caveat applies: relative comparisons only, not chess strength.

## Pooled readings (200 matches per style)

| style | win score | LI | LI sd | trust_end | unjust. trauma | quiet-quit moves | desertions |
|---|---|---|---|---|---|---|---|
| supportive | 89.00 | **63.37** | 10.72 | 96.54 | 0.00 | 19.43 | 0.03 |
| tyrannical | 55.25 | **−23.94** | 12.95 | −98.77 | 2.79 | 4.54 | 1.97 |
| steady | 31.75 | **−31.25** | 11.59 | −99.35 | 2.35 | 5.64 | 1.93 |

Per-campaign LI means do not overlap anywhere: supportive spans 61.3–67.1,
tyrannical −32.8–−18.5, steady −37.9–−24.8. The instrument separates the
styles at every seed, not only in the pool.

## What each term actually contributes

| style | 0.4·trust | 0.3·win | −0.2·UT | −0.1·QQ |
|---|---|---|---|---|
| supportive | +38.62 | +26.70 | −0.00 | −1.94 |
| tyrannical | −39.51 | +16.57 | −0.56 | −0.45 |
| steady | −39.74 | +9.53 | −0.47 | −0.56 |

The reading is dominated by the trust term (a ~78-point swing between the
kind and cruel rooms) with the win term second (~17 points). The two priced
costs barely register at their spec weights.

## D202: the quiet-quit term cannot move the reading — and it points the wrong way

At δ = 0.1 the quiet-quit charge is at most ~2 points against a ~90-point
style separation. Worse for any plan to simply raise δ: the term charges the
*kind* room most. The supportive roster quiet-quits at 0.197 (19.4 charged
moves per match) while the tyrannical roster quiet-quits at 0.039 (4.5),
because the cruel room's disengaged pieces desert or are churned out of their
careers before they can accumulate quiet-quit turns — the same substitution
the 08-30 pre-pricing pass saw (supportive 0.206 vs tyrannical 0.037).
Raising δ until the term matters would penalise kindness, not cruelty.
If quiet-quitting under a kind leader is itself the phenomenon to price,
δ is the right knob; if the intent was to price *disengagement caused by
cruelty*, the term needs a different carrier (desertions and ended careers
are where the cruel room's disengagement actually lands), which is a design
ruling, not a weight choice.

## The unjustified-trauma term is nearly inert at this opponent

Supportive charges exactly 0.00 (its overrides are vindicated or absent);
the cruel styles charge only ~2.4–2.8 raw (−0.5 after γ). The definition
works — it is zero where insistence is justified and positive where it is
not — but at these magnitudes it is a tiebreaker, not a price. Whether that
is correct or the 2-ply window is too tight is a question for a window sweep,
not something to conclude from one opponent.

## D188 gate (win score, unchanged by ADR 0074)

At 10 seeds the tyrannical mid-run gain the 3-seed local pass showed
(10.00 → 60.00) does not reproduce: pooled tyrannical win score goes
52.00 (matches 1–5) → 49.00 (matches 16–20), while supportive goes
84.00 → 93.00. Cruelty's advantage does not widen; on this evidence it does
not appear at all. The earlier trajectory reading was a small-sample artifact
of its three seeds. Steady remains worst on outcome (22.00 → 33.00) while
sitting between the other styles on nothing — it pays cruelty's trust price
without cruelty's win rate.

## What this does not show

- No Lozza or Stockfish evidence: fake engine only.
- One opponent (`tyrannical`); the UT term's inertness may be
  opponent-specific.
- No grace: `GRACE_RATE_PERMILLE` remained 0.
- α–δ were not tuned and should not be tuned from this table alone (D200's
  constraint: the components are all in the CSV so any re-weighting is
  post-hoc).
