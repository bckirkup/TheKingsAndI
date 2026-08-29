# The roster nobody stays in — attachment formation and turnover

**Date:** 2026-08-29
**Engine:** fake (no ladder state; unaffected by ADR 0067/0068 re-baselining)
**Seed:** 7 · **Opponent:** `tyrannical` · **Matches:** 20 per condition
**Conditions:** `--leader=tyrannical`, `--leader=redeemer`
**Config:** pre-D176 defaults (`OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE=1000`,
`OVERRIDE_STANDING_PRICE_PERMILLE=0`); the question measured here is roster
turnover, which those knobs do not price.

## Why this was measured

D176 ruled the graded-witness magnitudes linear in attachment. The reason it
could be ruled linear is that the attachment *input* is concentrated near zero
— sampling `witnessAttachmentPermille` at every override across these same
campaigns gave 992 observations for `tyrannical` and 476 for `redeemer`, of
which about half were exactly `0`, ~72% at or below `100` permille, only ~1.5%
at or above `500`, and none saturating (maxima `875` and `625`). A curve on
that distribution would bend a region with no mass in it.

That left the upstream question: attachment is
`(dyadicAffinity + classPrestige) × 5`, so a near-zero distribution means the
underlying *bonds* are near zero. Either affinity accrues too slowly, or the
pieces do not stay together long enough to accrue it. This pass measures which.

## Per-match accounting

`fielded` is `fieldedPieceIds.length`; `survivors` is `survivingRosterSize`
(the roster the match hands back); `desertions` is the event count. **`captures`
is inferred by subtraction** (`fielded − survivors − desertions`), because the
harness has no own-side capture counter — the enemy has `enemyAttrition`, the
player side does not. Treat that column as an exit-accounting residual rather
than a counted event.

### `tyrannical`

| match | plies | survivors | desertions | captures | fielded | mean `tauBenev` end |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 179 | 4 | 2 | 10 | 16 | 17.0 |
| 2 | 51 | 1 | 1 | 14 | 16 | 11.0 |
| 3 | 64 | 2 | 0 | 14 | 16 | 32.0 |
| 4 | 95 | 1 | 3 | 12 | 16 | 19.0 |
| 5 | 73 | 1 | 1 | 14 | 16 | 7.0 |
| 6 | 97 | 2 | 0 | 14 | 16 | 28.5 |
| 7 | 58 | 1 | 0 | 15 | 16 | 30.0 |
| 8 | 67 | 1 | 3 | 12 | 16 | 29.0 |
| 9 | 55 | 1 | 1 | 14 | 16 | 16.0 |
| 10 | 69 | 1 | 1 | 14 | 16 | 9.0 |
| 11 | 57 | 8 | 0 | 8 | 16 | 8.8 |
| 12 | 51 | 1 | 1 | 14 | 16 | 7.0 |
| 13 | 79 | 1 | 1 | 14 | 16 | 16.0 |
| 14 | 118 | 2 | 0 | 14 | 16 | 28.0 |
| 15 | 160 | 3 | 0 | 13 | 16 | 14.3 |
| 16 | 68 | 1 | 0 | 15 | 16 | 40.0 |
| 17 | 67 | 1 | 1 | 14 | 16 | 12.0 |
| 18 | 98 | 1 | 0 | 15 | 16 | 100.0 |
| 19 | 200 | 2 | 0 | 14 | 16 | 27.5 |
| 20 | 90 | 4 | 1 | 11 | 16 | 14.5 |

Mean survivors **1.95 of 16 fielded** (87.8% of the roster leaves the board
every match). Distinct identities that ever survived a match: **12**. Pieces
surviving ≥2 matches: **5**; ≥5 matches: **1** (the King, 20/20). Final roster:
**4**, holding 18 non-zero affinity edges, mean |affinity| 68.1, max 100.

### `redeemer`

| match | plies | survivors | desertions | captures | fielded | mean `tauBenev` end |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 65 | 1 | 5 | 10 | 16 | 55.0 |
| 2 | 56 | 1 | 0 | 15 | 16 | 62.0 |
| 3 | 69 | 1 | 1 | 14 | 16 | 40.0 |
| 4 | 51 | 1 | 1 | 14 | 16 | 38.0 |
| 5 | 200 | 2 | 1 | 13 | 16 | 46.5 |
| 6 | 60 | 1 | 0 | 15 | 16 | 42.0 |
| 7 | 48 | 1 | 0 | 15 | 16 | 14.0 |
| 8 | 63 | 1 | 1 | 14 | 16 | 12.0 |
| 9 | 52 | 5 | 1 | 10 | 16 | 14.2 |
| 10 | 119 | 1 | 1 | 14 | 16 | 76.0 |
| 11 | 75 | 4 | 0 | 12 | 16 | 73.8 |
| 12 | 98 | 1 | 0 | 15 | 16 | 67.0 |
| 13 | 70 | 1 | 0 | 15 | 16 | 99.0 |
| 14 | 125 | 5 | 0 | 11 | 16 | 68.0 |
| 15 | 60 | 1 | 0 | 15 | 16 | 100.0 |
| 16 | 39 | 14 | 0 | 2 | 16 | 19.8 |
| 17 | 200 | 2 | 2 | 12 | 16 | 51.5 |
| 18 | 81 | 5 | 0 | 11 | 16 | 61.8 |
| 19 | 153 | 4 | 0 | 12 | 16 | 47.0 |
| 20 | 93 | 5 | 0 | 11 | 16 | 15.4 |

Mean survivors **2.85 of 16 fielded** (82.2% turnover). Distinct identities that
ever survived a match: **16**. Pieces surviving ≥2 matches: **10**; ≥5 matches:
**2**. Final roster: **5**, holding 27 non-zero affinity edges, mean
|affinity| 66.7, max 100.

## What the numbers say

1. **Desertion is not the attrition.** It is 0–5 per match (usually 0 or 1).
   The roster empties by *capture*: 10–15 of 16 pieces per match, in both
   conditions. Reading turnover off the desertion metrics — the ones the
   register and the calibration corpus quote — understates it by an order of
   magnitude.

2. **A campaign is not a cohort of 16 with a history; it is a King plus
   strangers.** Only one piece (`tyrannical`) or two (`redeemer`) survive five
   or more matches out of twenty. `mergeCampaignRoster` refills the board each
   match, so the modal piece plays exactly one match and never meets the same
   witness twice.

3. **The bonds that do exist are strong, not weak.** Survivors carry affinity
   edges at mean |affinity| ~67 of a 100 scale, with maxima at the cap. So the
   *rate* of affinity accrual is not obviously too slow — the population of
   pieces that live long enough to accrue it is tiny. `nonzero=2..4` edges for a
   typical survivor against a 15-piece roster is the same story: a piece knows
   two or three others, not a room.

4. **This is what flattens attachment at override time.** Half the witnesses
   have zero attachment because half the witnesses are strangers to the piece
   that was overridden. Grading the price by the bond can only bite where a bond
   had time to form, so D170's measured campaign effect (a few percent of
   redistributed benevolence loss) is a coverage limit, not a pricing one.

5. **It also constrains D168 and D169 before they are built.** "A favour for my
   friend is evidence about you" needs friends; the confidence channel's cost
   asymmetry (intimates read care, the rest read favoritism) is priced off the
   same affinity graph that here holds two or three edges per piece. Choosing
   magnitudes for the private channel on today's turnover would tune a mechanism
   against a roster that has almost no intimates in it.

## What this does not say

- It does not show that capture attrition is *wrong*. Losing 12 of 16 pieces
  against a competent opponent may be the honest chess; ADR 0026 also makes
  capture non-permanent at the community level, so a captured piece is not dead
  and could return to a later roster — nothing in the harness currently exercises
  that return path.
- It does not measure affinity accrual *per shared ply*, only the stock held by
  survivors. Distinguishing "accrues too slowly" from "no one stays" would need
  affinity sampled per ply of shared service, which no probe collects.
- Both conditions run one seed. Match-to-match variance is large (survivors
  range 1–14), so the per-match rows are illustrative and only the means and
  survival counts should be quoted.
- The `captures` column is a residual, not an event count.

## The question this opens

Whether the sociology needs pieces to stay together longer — and if so whether
that is a roster-continuity change (bench/reserve, returning captives), an
affinity-accrual change (`AFFINITY_*` magnitudes), or an accepted property of
the game with the social mechanics priced accordingly — is recorded as **D177**
in `docs/design_decisions.md`. It is upstream of D170's pricing and of the
D168/D169 confidence channel, and it is not resolved here.
