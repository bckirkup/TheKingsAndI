# The Carriers and the Floor — Pricing the Uncarried Emotions, Phase B

Date: 2026-09-05 (UTC). Status: measurement evidence for the ADR 0078
carrier magnitudes (D208 bitterness, D211 grief, D212 shame). Nothing in this
document changes a default. Read `docs/adr/0078-the-uncarried-emotions.md`,
`docs/calibration/2026-09-05-the-recognition-census.md` (Phase A), and
`docs/calibration/2026-08-30-the-index-and-the-scale.md` (the sweep shape
this reuses) first.

## Question

Phase A priced the *recognitions*. Three ADR 0078 emotions also carry a
*play change* behind a zero default: bitterness discounts repair and the
morning lift, grief suppresses search depth, shame scales the overridden
piece's own losses. Which of them fires at all on the campaign harness, at
what magnitude does each move the Judgement Seat, does the price fall where
the ADR says it should (on the cruel room, not the kind one), and which zeros
are structural?

## Method

- Pre-flight (this box): `pnpm exec tsx sim/sweep.ts`, fake engine,
  `--opponent=tyrannical --seed=7 --matches=8`, one campaign per value, to
  tell "fires" from "does not fire" before spending Batch time. Logs under
  `~/phaseb/preflight-*.log` and `~/phaseb/diag-thr-*.log` (not committed).
- Telemetry: this PR adds own-side per-match counters `shame_exposures`,
  `grief_mournings`, `bitterness_formations` and end-of-match means
  `mean_grief_load_end`, `mean_bitterness_end` to the campaign and sweep CSVs
  (appended columns; the existing columns are byte-identical to before).
- Sweep: AWS Batch, Fargate Spot, queue `kingsandi-campaign-spot-queue`, one
  image and job definition per candidate (`kingsandi-phaseb-<candidate>`),
  one campaign per array child. `--engine=fake --opponent=tyrannical
  --depth-cap=8`, master seed `314159`, 10 campaigns × 20 matches per
  (candidate, style) — n = 200 matches per cell, the same seeds in every
  cell, so per-campaign comparisons are paired. Runs
  `phaseb-1788606147-<candidate>-<style>`, artifacts under
  `s3://kingsandi-campaigns-994254241749-us-east-1/` (manifests carry
  `gitCommitSha`, `imageDigest`, `determinismId
  sim-fake/depth-fixed/depth-cap-8`). 27 arrays,
  270 children, 0 failed, 7 Spot retries; 1 h 29 min submission to last
  completion (10–34 min per cruel-room array, 34–89 min per kind one —
  grief lengthens the kind room's matches).
- Control is the telemetry commit `8d9cc16` with main defaults. Each
  candidate is one throwaway commit on top of it patching only
  `src/psychology/config.ts` (candidate branches not pushed; commits and
  immutable image digests are in the table below).

| candidate | commit | config change |
|---|---|---|
| control | `8d9cc16` | — |
| shame25 | `9eb57bf` | `SHAME_PER_WITNESS_PERMILLE=25` |
| shame50 | `c84f250` | `SHAME_PER_WITNESS_PERMILLE=50` |
| shame100 | `f41b9f5` | `SHAME_PER_WITNESS_PERMILLE=100` |
| grief100 | `aa43164` | `GRIEF_LOAD_PER_LOSS_PERMILLE=100`, suppression `1000`, decay `250` |
| grief250 | `34708d5` | load `250`, suppression `1000`, decay `250` |
| grief500 | `eb66233` | load `500`, suppression `1000`, decay `250` |
| grief250-decay0 | `30d70d7` | load `250`, suppression `1000`, decay `0` |
| grief250-decay500 | `b20593a` | load `250`, suppression `1000`, decay `500` |

Image digests (`994254241749.dkr.ecr.us-east-1.amazonaws.com/kingsandi-campaign@sha256:…`):
control `83d3a632…`, shame25 `5e9fe76e…`, shame50 `11028f37…`, shame100
`12b525a2…`, grief100 `4b1917d7…`, grief250 `0d5e9982…`, grief500
`d4826890…`, grief250-decay0 `f9b35565…`, grief250-decay500 `b5810edf…`.

Grief's engagement suppression is pinned at `1000` throughout because the
only live consumer is `depth × (1 − load × suppression / 10⁶)`: load and
suppression enter as a product, so one axis (load) prices both, and the
suppression column reads as "what fraction of the load reaches the search".

Fake-engine caveat: relative comparisons only, never chess strength.

## Control re-baseline

The world has moved since the 08-30 sweeps (retirement, grace, the morning
lift, the recognition defaults): do not quote these beside those.

| style | win | LI | LI range (campaigns) | trust_final | refusal | override/ply | desertions | quiet-quit | emptied-chairs score |
|---|---|---|---|---|---|---|---|---|---|
| supportive | 86.75 | 61.05 | 58.1–63.8 | 95.2 | 0.073 | 0.0001 | 0.04 | 0.196 | 5.81 |
| tyrannical | 63.75 | 5.13 | 2.5–9.6 | −29.5 | 0.005 | 0.0146 | 0.02 | 0.019 | 10.16 |
| steady | 63.25 | 4.72 | 0.9–8.8 | −29.9 | 0.053 | 0.0187 | 0.05 | 0.021 | 10.38 |

## D212 shame — fires in the cruel room, prices nothing the Seat can see

Shame fires only where overrides happen: 0.80–0.82 exposures per match under
tyrannical, 1.01–1.10 under steady, exactly 0 under supportive — whose
rows are byte-identical to control at every candidate (no override, no
shame, no play change, as the ADR intends).

| candidate | style | win | LI | LI range | trust_final | trust_end | exposures/match |
|---|---|---|---|---|---|---|---|
| control | tyrannical | 63.75 | 5.13 | 2.5–9.6 | −29.50 | −34.50 | 0 |
| shame25 | tyrannical | 65.50 | 5.66 | 3.3–8.7 | −29.53 | −34.16 | 0.81 |
| shame50 | tyrannical | 65.00 | 5.22 | 2.2–8.2 | −30.33 | −35.39 | 0.80 |
| shame100 | tyrannical | 65.25 | 5.08 | 1.7–8.6 | −30.85 | −35.68 | 0.82 |
| control | steady | 63.25 | 4.72 | 0.9–8.8 | −29.93 | −37.87 | 0 |
| shame25 | steady | 65.00 | 4.99 | 2.7–8.3 | −30.59 | −37.54 | 1.10 |
| shame50 | steady | 63.75 | 4.39 | 2.0–8.3 | −31.03 | −37.78 | 1.06 |
| shame100 | steady | 66.25 | 5.28 | 3.1–7.6 | −30.92 | −37.37 | 1.01 |

The trust term does move, the right way and nearly monotonically:
`trust_final` falls 0.0 → 0.8 → 1.3 points under tyrannical and 0.7 → 1.1 →
1.0 under steady as the coefficient rises. That is the whole price. Refusal,
override rate, quiet-quit, trauma, emptied chairs and retirements are
unchanged beyond noise in every cell; desertions move by ±1–3 per 200
matches with no trend. Win score and LI move by ±1–3 and ±0.5,
non-monotonically in the candidate — play divergence noise that swamps the
≤ 0.5 LI the trust price is worth (α = 0.4 × 1.3).

Why so little: shame multiplies a loss that is mostly already at the floor.
The overridden piece's trust in a cruel room reaches −100 by mid-campaign
(the 08-30 trust-population finding) and its benevolence stalls at 3 under
the proportional cliff (below); a ×1.4–×2.5 multiplier on a delta that
clamps to zero is a multiplier on nothing, and only the early-match losses
before the floor carry it. The pre-flight's 8-match campaign showed a larger
price (tyrannical trust_final −31.1 → −34.1 at 100‰) precisely because it
ended before the floor.

Reading for the D212 ruling: any value 25–100 is *safe* — order-preserving,
byte-identical kind room, no cascade — and *named* (≈1 exposure per
cruel-room match, the debrief material the ADR asked for). The price is
real but ≈1 trust point at the Judgement Seat, below the play-divergence
noise of this design, so the sweep cannot rank the three. Proposed:
`SHAME_PER_WITNESS_PERMILLE = 50` as a recognition-grade default (the
exposure is named, the multiplier is live for the losses that are not yet
floored), with the explicit note that it is not the D212 magnitude; that
magnitude waits on a trust term that is not saturated (D202's
exit-attribution refinement, or a gentler opponent tier).
`SHAME_STANDING_PERMILLE` stays 0 unswept: with the per-witness term this
faint at the Seat, a standing term on the same floored delta cannot read
either.

## D211 grief — fires in the kind room, and taxes it

Grief fires where bonds exist. Under the fake engine at this opponent the
supportive room mourns 17.9–18.9 times per match (every capture is a
qualified peer to most of the roster; affinity ≥ 50 is dense in a kind
room), steady 1.2, tyrannical 0.2. Loads accumulate accordingly:

| candidate | style | mournings/match | grief load end (‰) | win | LI | LI range | trust_final |
|---|---|---|---|---|---|---|---|
| control | supportive | 0 | 0 | 86.75 | 61.05 | 58.1–63.8 | 95.21 |
| grief100 | supportive | 18.9 | 236 | 86.75 | 61.09 | 58.1–64.2 | 95.22 |
| grief250 | supportive | 17.9 | 499 | 86.75 | 60.99 | 56.0–64.0 | 95.20 |
| grief500 | supportive | 18.4 | 623 | 85.75 | 60.62 | 53.0–64.2 | 95.08 |
| grief250-decay0 | supportive | 17.9 | 786 | 85.00 | 60.31 | 52.9–64.0 | 94.98 |
| grief250-decay500 | supportive | 18.3 | 270 | 86.00 | 60.86 | 56.9–63.8 | 95.15 |
| any grief | tyrannical | 0.2 | 0–44 | 63.75 | 5.13 | 2.5–9.6 | −29.50 |
| any grief | steady | 1.2 | 0–217 | 63.25–64.00 | 4.72–5.01 | 0.9–8.8 | −29.9 |

Desertion, quiet-quit, trauma and retirements do not move in any cell. The
supportive refusal rate rises with load (0.073 → 0.076 → 0.079 → 0.082,
0.089 at decay 0) — most plausibly the shallower search disagreeing with
the order a little more often, not a psychological cascade: nothing follows
it. Grief as wired is a depth tax and
only a depth tax. The tyrannical rows are *byte-identical* to control at
every load even where load accumulates (30–44‰ at grief500/decay0): at
`--depth-cap=8` a load below 125‰ cannot move `trunc(depth × (1 − load))`
by a ply. Steady is byte-identical at loads ≤ 49‰ and moves to LI 5.01 /
win 64.0 at 172–217‰ (noise-sized).

The tax lands on the kind room, and unevenly. Paired by seed, campaign 4
falls from LI 59.06 / win 82.5 (control) to 52.99 / 65.0 under grief500 and
52.95 / 65.0 under decay0; campaign 6 from 59.45 / 85.0 to 55.97 / 75.0
(grief500). Other campaigns move by less than a point or rise slightly (play
divergence). The pooled cost is small — ≤ 0.7 LI, ≤ 1.75 win — but it is a
cost only kindness pays, which is the wrong sign for the D188 trajectory
gate (the kind lead must not narrow *because* the room bonded).

Decay reads as expected: at load 250, decay 0 saturates toward 1000‰ (786 by
match 20 and still climbing), decay 250 holds ~500, decay 500 holds ~270.
Load 100 with decay 250 holds ~236‰ and costs nothing measurable
(LI +0.05, worst campaign −0.07).

Reading for the D211 ruling: the mechanism is real, correctly targeted at
the bonded, and — as a *play* change at this opponent — perverse: it can
only ever charge the room that has bonds, and only the kind room has them.
The engagement suppression should therefore stay 0 until either (a) the
cruel room acquires a bond source (there is none: tyrannical rooms have no
affinity ≥ 50, the same structural finding as loneliness in Phase A), or
(b) grief acquires a second consumer that is not a chess penalty (the
D211 text names distraction, not disloyalty — a debrief-only reading or the
narration layer's grieving room). What *can* be turned on now is the
recognition: `GRIEF_LOAD_PER_LOSS_PERMILLE = 100` with
`GRIEF_DECAY_PERMILLE_PER_MATCH = 250` and suppression left at `0` names
~19 mournings per kind-room match, carries a ~236‰ load for the debrief,
and is play-identical to control by construction (the depth multiplier is
exactly 1 at suppression 0 — `applyGriefDepthSuppression` returns
`depth` unchanged). That combination was not itself a Batch cell; its play
identity follows from the arithmetic, and the load trajectory is the
grief100 column above.

## D208 bitterness — a structural zero: the floor is unreachable

Bitterness did not form in any pre-flight cell — tyrannical and steady rows
byte-identical to control at `BITTERNESS_PER_TRIGGER_PERMILLE` 250/500/1000
with both discounts pinned at 1000, and still identical with
`BITTERNESS_RUPTURE_THRESHOLD_PERMILLE` swept down to 0 (logs
`~/phaseb/diag-thr-*.log`). `mean_bitterness_end` is 0.00 in all 27 Batch
cells. The reason is arithmetic, not scarcity:

- The `rupture_floor` trigger (`shouldFormRuptureBitterness`) requires
  `tauBenev <= 0` **and** `ruptureDebt >= ceiling × threshold / 1000`
  (default 100 × 500‰ = 50) on an unvindicated override.
- Since ADR 0066 the override cliff is proportional — at
  `BENEV_BETRAYAL_CLIFF_PERMILLE = 250` an unvindicated override at full
  severity takes `trunc(tauBenev / 4)`. From the seeded `tauBenev = 50` the
  drops run 12, 9, 7, 5, 4, 3, 2, 2, 1, 1, 1 (eleven overrides, 47 debt) and
  then `trunc(3 / 4) = 0`: **benevolence stalls at 3 and never reaches
  0**, and the accumulated rupture debt is 47, **below the 50 floor**. D175
  already recorded that the asymptote truncates down; this is the
  consequence for D208. Witnesses are charged at half scale and stall
  higher.
- The only other path to `tauBenev = 0` is neglect erosion (−3 flat), which
  fires only on a *heeded* refusal of an objectively good move — a kind-room
  event, where nothing is ever overridden.
- The `not_ransomed` trigger is seminar-only and the census found no
  ransoms (Phase A).

So the trigger cannot fire on any harness path, and no knob on it can make
it fire: `BITTERNESS_RUPTURE_THRESHOLD_PERMILLE = 0` still needs
`tauBenev = 0`. This is a D-ruling on the trigger, not a magnitude:

1. **Debt-only trigger** — drop the `tauBenev <= 0` clause; form on
   `ruptureDebt >= ceiling × threshold / 1000` alone, with the threshold
   lowered to ≤ 470‰ (the saturated debt of a piece seeded at 50) or the
   debt ceiling read as the seeded benevolence rather than 100. Bitterness
   then means "the room has spent its benevolence", which is the ADR's
   wording ("while `tauBenev` sits at the floor") read as the *effective*
   floor.
2. **Named floor** — replace `<= 0` with `<= BITTERNESS_BENEV_FLOOR`
   (a new knob, 3 being the stall point at cliff 250‰; any change to the
   cliff moves it, so it should be derived, not hard-coded).
3. **Fix the stall** — make the proportional cliff round up (`ceil`) so
   benevolence does reach 0. That reopens D175 and changes every cruel-room
   number in the ledger; not recommended for this reason alone.

Whichever is chosen, the downstream discounts still need something to
discount: in the cruel room repair signals are ~0 (regard needs the leader
to heed) and the morning lift is the only positive gain a bitter piece would
see. The pre-flight cannot say whether that gain is large enough for a
discount to register; that is the sweep to run *after* the trigger ruling.

## What this does not measure

- No Lozza or Stockfish run; every number is fake-engine relative evidence.
- One opponent (`tyrannical`); a kinder opponent tier would unsaturate the
  cruel room's trust floor and might let shame read as a price.
- No exploit-tier rerun (ADR 0075): none of the three carriers is proposed
  live as a play change here, so none is owed one yet. Shame at 50 is a play
  change in principle (the multiplier is live where trust is not floored);
  if it is enabled, the gaming sweep should be rerun before the next ADR
  0075 ruling relies on it.
- Grief with suppression 0 was not a Batch cell; its play identity is
  arithmetic, its load trajectory is grief100's.

## Proposed rulings (owner's call, not made here)

| knob | proposed | grounds |
|---|---|---|
| `SHAME_PER_WITNESS_PERMILLE` | 50 | fires ≈1/match in cruel rooms, 0 in kind; no measurable Seat price at this opponent; recognition value |
| `SHAME_STANDING_PERMILLE` | 0 | unswept; cannot read while the per-witness term is floored |
| `GRIEF_LOAD_PER_LOSS_PERMILLE` | 100 | names ≈19 mournings/match in the kind room, load ~236‰; harmless at suppression 0 by construction |
| `GRIEF_DECAY_PERMILLE_PER_MATCH` | 250 | holds the load at a plateau rather than saturating |
| `GRIEF_ENGAGEMENT_SUPPRESSION_PERMILLE` | 0 (ruled zero) | a depth tax only the bonded room can pay; wrong sign for D188 |
| `BITTERNESS_*` | 0 (structural) | trigger unreachable under the proportional cliff; D208 trigger ruling owed first |
