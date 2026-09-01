# The semester and the wall (2026-08-30)

The horizon question: everything priced so far was measured at week scale
(20-match campaigns). This pass runs the same three styles for 100-match
campaigns to ask whether any personality hits a wall a semester deep — the
D203 requirement that no one be driven off a cliff mid-run by hidden
arithmetic — and whether the D188 trajectory holds at 5× the measured horizon.
Read `docs/adr/0074-the-priced-leader.md` and
`docs/calibration/2026-08-30-the-emptied-chairs-measured.md` first.

## Provenance

- AWS Batch, Fargate Spot, queue `kingsandi-campaign-spot-queue`, job
  definition `kingsandi-campaign-spot:6`, one campaign per array child.
- Image `994254241749.dkr.ecr.us-east-1.amazonaws.com/kingsandi-campaign@sha256:b92b3e2f957536a525112033def44dd20871189e330dc72d2fbc10fbdef2a5d3`,
  commit `f980f5e0d8cc5ab7bbcb25223f48967165ba3b0a` (PR #176 merge).
- Runs `2026-08-30-semester-{supportive,tyrannical,steady}`; artifacts under
  `s3://kingsandi-campaigns-994254241749-us-east-1/campaigns/`.
- `--engine=fake --opponent=tyrannical --depth-cap=8`, master seed `314159`,
  10 campaigns per style, **100 matches per campaign** (n = 1000 per style).
  Determinism ID `sim-fake/depth-fixed/depth-cap-8`. Wall time 1h42m–2h47m
  per style, 30/30 shards succeeded with no retries.
- The image carries ε = 0 (this commit predates PR #177's ruling), so the
  committed `leadership_index` column is the four-term-plus-inert reading;
  LI at the ruled ε = 0.2 is computed post hoc as
  `leadership_index − 0.2·emptied_chairs_score`, which is exact because every
  component ships in the CSV (the D200 discipline doing its job).
- Fake-engine caveat applies: relative comparisons only, not chess strength.

## Nobody hits a wall

Pooled win score by quintile of 20 matches (matches 1–20 through 81–100):

| style | 1–20 | 21–40 | 41–60 | 61–80 | 81–100 | pooled | per-campaign range |
|---|---|---|---|---|---|---|---|
| supportive | 89.00 | 84.25 | 86.00 | 88.75 | 84.50 | **86.50** | 81.0–90.0 |
| tyrannical | 55.25 | 41.50 | 50.00 | 47.75 | 47.00 | **48.30** | 42.5–51.5 |
| steady | 31.75 | 41.75 | 43.50 | 45.75 | 37.75 | **40.10** | 32.5–54.0 |

Every style is stationary after its first quintile. The supportive room holds
84–89 for the whole semester. The tyrannical room settles ~7 points below its
opening and stays there — a step down, not a slide. Steady *improves* from its
opening and then holds. No trajectory bends toward zero; no campaign of any
style collapses; every campaign of all thirty runs its full 100 matches. The
visible game stays playable for every personality all semester.

The stability is churn-fed, not survivor-fed: the cruel rooms end their
matches with ~2.7 surviving pieces and empty ~3.1–3.3 chairs per match, all
semester (quintile means 3.00–3.67, no trend). Seat generations replace what
leaves, the replacements arrive with fresh trust, are curdled in turn, and the
room's steady state is a conveyor rather than a decline. Trust, quiet-quit
moves, and roster size are all flat across quintiles for all three styles.

## D188 at the long horizon

Cruelty's advantage does not widen — it shrinks slightly and then holds
(55.25 → ~47–50), while supportive holds ~86. The one new reading is that
**steady converges toward tyrannical from below** (40.10 pooled against 48.30,
per-campaign ranges overlapping at 42.5–51.5 vs 32.5–54.0): at week scale the
two cruel-priced styles were 23 points apart on outcome; a semester deep they
are 8. The gate's condition — the cruel style's advantage must not widen and
its permanent costs must accrue — holds: the emptied chairs accrue linearly
(~330 careers ended or deserted per cruel campaign against ~97 supportive) and
grace stayed inert.

## The Judgement Seat at ε = 0.2

| style | LI(ε=0) | LI(ε=0.2) | per-campaign LI(0.2) range | EC score | UT |
|---|---|---|---|---|---|
| supportive | 62.44 | **61.23** | 59.46–62.54 | 6.04 | 0.00 |
| tyrannical | −25.39 | **−29.54** | −31.52–−28.46 | 20.78 | 3.02 |
| steady | −27.83 | **−31.76** | −33.58–−27.19 | 19.62 | 2.45 |

Zero per-campaign overlap between the kind and cruel styles, as at week
scale; the ruled ε moves the cruel readings ~4 points and the kind one ~1.2.
The carrier still does not separate tyrannical from steady — at this horizon
their LI ranges overlap. The 4:1 charge ratio survives the horizon (kind
emptied-chair score 6.04 against ~20; the supportive room's charge remains
trauma-retirements, ~0.95 per match, with desertions still ~0.02).

## What this means for the adversarial phase

The straightforward personalities last both the week and the semester: no
hidden term ever surfaces mid-run, and no style's visible game decays into a
wall of failures. So a player who wants a cruel strategy to *look* good has no
long-horizon collapse to exploit or to blame — the exploiters to be built next
must game the short horizon and the visible scoreboard, and the Judgement Seat
reads what they did to the room regardless of when they did it.

## What this does not show

- No Lozza or Stockfish evidence: fake engine only.
- One opponent (`tyrannical`); trust remains saturated near ±100, so the
  trust-population fix and the carrier's marginal value are still understated.
- No grace: `GRACE_RATE_PERMILLE` remained 0.
- Steady's convergence toward tyrannical on outcome is a fake-engine reading
  at one opponent; do not quote it as a claim about real chess strength.
- One horizon (100); nothing here bounds behavior beyond it.
