# The emptied chairs, measured (2026-08-30)

The D202 measurement sweep: first readings of the fifth-term carrier
(`emptied_chairs`, `emptied_chairs_score`) and the trust-population fix
(`mean_trust_final`), taken at ε = 0 so nothing here could have tuned itself.
Read `docs/adr/0074-the-priced-leader.md` (D202 addendum) and
`docs/calibration/2026-08-30-the-index-and-the-scale.md` first.

## Provenance

- AWS Batch, Fargate Spot, queue `kingsandi-campaign-spot-queue`, job
  definition `kingsandi-campaign-spot:5`, one campaign per array child.
- Image `994254241749.dkr.ecr.us-east-1.amazonaws.com/kingsandi-campaign@sha256:37ba2137caab01b10c859f75ee46321eb2ed9f81c9f652408b420ff33421ef27`,
  commit `3673bee1dd459546c37f1ba50531e2dcd23a1208` (PR #175 merge).
- Runs `2026-08-30-emptied-chairs-v2-{supportive,tyrannical,steady}`;
  artifacts under `s3://kingsandi-campaigns-994254241749-us-east-1/campaigns/`.
- `--engine=fake --opponent=tyrannical --depth-cap=8`, master seed `314159`,
  10 campaigns per style, 20 matches per campaign (n = 200 matches per style).
  Determinism ID `sim-fake/depth-fixed/depth-cap-8`.
- A first run (`2026-08-30-emptied-chairs-{style}`, job definition revision 4)
  was discarded: the job definition pins the container image, so stamping a
  new `IMAGE_DIGEST` into the manifest does not change what runs, and its
  shards carried the pre-D202 67-column schema. Revision 5 was registered
  against the digest above and every shard was verified to carry the
  70-column schema ending `mean_trust_final,emptied_chairs,emptied_chairs_score`.
- Fake-engine caveat applies: relative comparisons only, not chess strength.

## The carrier reads cleanly, and it points the right way

| style | desertions/match | trauma-ended careers/match | emptied chairs/match | EC score (pooled) | EC score per-campaign range |
|---|---|---|---|---|---|
| supportive | 0.03 | 0.74 | 0.76 | **4.75** | 3.44–6.25 |
| tyrannical | 1.97 | 1.16 | 3.13 | **19.53** | 15.31–22.81 |
| steady | 1.93 | 1.25 | 3.18 | **19.84** | 16.25–23.44 |

This is the reading the quiet-quit term could not give. Where δ charged the
kind room most (19.4 quiet-quit moves against 4.5), the emptied-chair score
charges the cruel rooms ~4.1× the kind one, with **no per-campaign overlap**:
the worst supportive campaign (6.25) is well under the best cruel campaign
(15.31). Cruelty-caused disengagement lands here — mostly desertions, plus
roughly half a career per match more churned out by trauma — and the kind
room's residual charge is real, not noise: ~0.74 careers per match still end
at the trauma threshold under a supportive leader (its desertions are ~0.03).
The carrier does not separate tyrannical from steady (19.53 vs 19.84,
overlapping ranges); both empty the same chairs.

## The trust-population fix is live and behaves as ruled

| style | `mean_trust_end` (survivors) | `mean_trust_final` (fielded incl. departed) |
|---|---|---|
| supportive | 96.54 | 95.12 |
| tyrannical | −98.77 | −97.02 |
| steady | −99.35 | −96.14 |

At this opponent the fix changes little, and in the cruel rooms it reads
slightly *less* extreme — survivors sit clamped at −100 while deserters left
with the (still terrible, but pre-floor) trust they had at exit. The
laundering the fix targets — a cruel room shedding its angriest witnesses out
of its own trust term — cannot show at a saturated floor; the fix matters in
regimes where trust has room to move. It costs nothing here and closes the
structural hole regardless.

## Candidate ε: any value preserves the ordering; scale is the only question

LI at ε = 0 (now on `mean_trust_final`): supportive 62.81 (per-campaign
60.80–65.79), tyrannical −23.24 (−31.93–−18.12), steady −29.96
(−37.20–−24.25). Term contributions at candidate ε values (pooled):

| ε | supportive −ε·EC | tyrannical −ε·EC | steady −ε·EC | sep. margin (worst kind vs best cruel) |
|---|---|---|---|---|
| 0 | 0.00 | 0.00 | 0.00 | 78.9 |
| 0.1 | −0.48 | −1.95 | −1.98 | 80.2 |
| 0.2 | −0.95 | −3.91 | −3.97 | 81.3 |
| 0.3 | −1.43 | −5.86 | −5.95 | 82.4 |
| 0.5 | −2.38 | −9.77 | −9.92 | 84.3 |
| 1.0 | −4.75 | −19.53 | −19.84 | 89.0 |

Every candidate keeps zero per-campaign overlap between the kind and cruel
styles and widens the gap monotonically (the carrier's 4:1 ratio means any ε
charges cruelty ~4 points for every point it charges kindness). So ε cannot
be chosen here to make a style win or lose — the ordering is fixed — and it
cannot be chosen for *necessity* either: at this opponent trust is saturated
and already carries the verdict. What ε sets is how loudly the emptied chairs
speak at the Judgement Seat relative to the other prices.

**Recommendation: ε = 0.2**, the same weight as unjustified trauma (γ). The
two terms are the same kind of reading — a price for harm the win score never
saw — and at 0.2 the term charges the cruel rooms ~4 LI points (comparable to
the win-score spread between tyrannical and steady, larger than γ and δ ever
managed) while charging the kind room under 1. Larger values start letting a
normalized-count term rival the trust term in unsaturated regimes (at ε = 1 a
fully emptied roster is −100, symmetric with trust itself), which D200's
discipline argues against until a non-saturated opponent is measured. This is
a proposal for the owner's ruling, not a change: ε remains 0 in
`ENGINE_CONFIG.LEADERSHIP_WEIGHTS` until ruled.

## What this does not show

- No Lozza or Stockfish evidence: fake engine only.
- One opponent (`tyrannical`); trust saturation at −100 means the
  trust-population fix and the carrier's marginal value are both understated.
- No grace: `GRACE_RATE_PERMILLE` remained 0.
- No attribution: the carrier counts all fielded exits, not exits traceable
  to unvindicated insistence (D202's open refinement). The kind room's ~0.74
  trauma-retirements per match is the cost of that bluntness; at these
  ratios it does not invert the reading.
- The sim boundary counts `desertions + retirements` without deduplicating a
  piece that both deserted and retired in the same match window; the observed
  totals decompose exactly as the sum, so no double-count occurred here.
