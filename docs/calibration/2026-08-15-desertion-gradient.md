# Why leadership style does not change the exit decision (2026-08-15)

Measured on `e600a5a` (branch `devin/1786741328-desertion-gradient`, off main
`29ff953`). Fake engine, seed 7. Companion to
`docs/calibration/2026-08-13-cross-style-table.md`, which reported that eight of
the nine leader styles produce byte-identical `desertion_attrition = 0.938`,
`rout = 1.000`, `win = 0.0`, while refusal rates still spread from `0.047` to
`0.541`. This report explains that result and measures a candidate fix.

## 1. The exit decision cancels λ

For a piece with no capture risk and no standing cost, the comparison in
`shouldDesert` reduces to a single inequality. Substituting the two utilities:

```
U_stay   = -P_captured·pain·shadow - P_lossIfStay ·λ·S
U_desert = -standing·shadow        - P_lossIfLeave·λ·S·attachment

desert ⟺ λ·S·(P_lossIfStay − P_lossIfLeave·attachment)
         > standing·shadow − P_captured·pain·shadow + hysteresis
```

On any given ply exactly one piece is moving, so for the other fifteen
`P_captured` is the *post-move* risk of a piece nobody is attacking — routinely
`0.000` — and `standing` is the audience's `affinity + classPrestige` for the
piece, which for a pawn early in a match is also `0.000`. Both sides of the
right-hand side vanish, `hysteresis` is `0.05` against a left-hand side of
order 10, and the decision becomes:

```
desert ⟺ attachment < P_lossIfStay / P_lossIfLeave
```

**λ multiplies both branches and cancels out of the sign.** λ is the entire
leadership channel — trust, morale, loyalty, dyadic affinity — so no amount of
trust or morale changes *whether* a piece with no immediate capture risk leaves;
it changes only the size of a margin whose sign is already fixed. Worse, the
cancellation is not neutral: because the deserter's collective term is
discounted by `attachment < 1` and the stayer's is not, a piece that cares
*more* about the team (higher λ) gets a *larger* payoff for leaving.

`P_lossIfLeave` exceeds `P_lossIfStay` only by the pivotality increment, which
for a pawn is about `0.013` — a ratio of `≈ 0.96`. So the threshold is:

```
attachment > ~0.96  →  never deserts
attachment < ~0.96  →  always deserts
```

`calculateAttachmentPermille` returns exactly `1.000` when alienation is zero
and drops to about `0.85` as soon as it is not. There is no middle. Alienation
is zero only when `T_i ≥ 0`, `B_i = 0`, no negative dyadic affinity, **and
`tauBenev ≥ 50`** — the benevolence gap term is `(50 − tauBenev)·20` permille.

That is the whole cross-style result. Servant holds `tauBenev` at 65–71, stays
at `attachment = 1.000`, and never crosses the threshold. The other eight styles
decay to `tauBenev` 0–12, sit at `attachment ≈ 0.85`, and cross it immediately —
identically, because once the sign is fixed by a knife-edge that ignores λ, the
styles have nothing left to differ on. The `random` control collapsing exactly
like `cold_winner` is the signature of a style-independent term, not of a
leadership model.

### Probe evidence

Single match, `tyrannical`, seed 7, first departure wave:

```
ply=30 w:N:b1 first    uStay=-11.269 uDesert= -7.677 margin=3.592 attach=0.830 Pcap=0.800 standing=2.338
ply=30 w:P:a2 cascade  uStay= -5.978 uDesert= -5.283 margin=0.695 attach=0.851 Pcap=0.000 standing=0.000
ply=30 w:P:b2 cascade  uStay= -5.978 uDesert= -5.283 margin=0.695 attach=0.851 Pcap=0.000 standing=0.000
```

The cascade rows are the reduction above, exactly: `λ·S = 0.353·50 = 17.65`, and
`17.65·(0.339 − 0.352·0.851) = 0.699`, against a reported margin of `0.695`
after quantization. Set `attachment = 1.000` in the same row and the margin is
`17.65·(0.339 − 0.352) = −0.229`: the piece stays. Nothing else about the piece
has to change.

## 2. A real wiring defect, but not the cause

`privateScoreCp` is documented and consumed as the absolute post-move private
score — `cascade.ts` maps it through `500 − trunc(500·s/(|s| + K))` to get
`pLossBoard`. `MoverInsights.actor.scoreCp` is deliberately a *delta* (after
minus before), which is correct for `deltaV_board`, and `insightToEvaluation`
was assigning that delta to `privateScoreCp` as well. So the acting piece — and
only the acting piece — computed its board-loss belief from a number that is
near zero for any quiet move, i.e. from `pLossBoard ≈ 0.5` regardless of whether
it was winning or lost.

This is fixed here (`resolveMoverInsights` now exposes the absolute post-move
score and `insightToEvaluation` takes it explicitly). It is a correctness fix,
not the collapse: `pLossBoard` enters `P_lossIfStay` and `P_lossIfLeave`
together, so it scales the margin without touching its sign.

## 3. Measuring the cancellation

`DESERTION_STAY_ATTACHMENT_PERMILLE` (`k`) applies attachment to the stay
branch as well, with `w_stay = (1000 − k + trunc(k·attachment))/1000`. At
`k = 0` the arithmetic is bit-identical to today. At `k = 1000` attachment
multiplies both branches, so it cancels instead of λ, and the decision becomes
what the model documents it to be: capture pain and standing versus the
pivotality increment you inflict by leaving. The default is `k = 0`; nothing
about shipped behaviour changes until this decision is made (D145).

Sweep: `sim/sweep.ts`, 6 matches, seed 7, fake engine, per style.

| style | k=0 attrition | k=500 | k=1000 | k=0 win | k=500 | k=1000 |
|---|---:|---:|---:|---:|---:|---:|
| random | 0.938 | 0.938 | 0.938 | 0.0 | 0.0 | 33.3 |
| tyrannical | 0.938 | 0.938 | **0.250** | 0.0 | 8.3 | 100.0 |
| supportive | 0.375 | 0.375 | 0.375 | 50.0 | 50.0 | 50.0 |
| volatile | 0.938 | 0.938 | 0.813 | 0.0 | 0.0 | 0.0 |
| servant | 0.750 | 0.750 | **0.000** | 25.0 | 25.0 | 41.7 |
| pure_tactician | 0.938 | 0.938 | 0.938 | 0.0 | 0.0 | 16.7 |
| redeemer | 0.938 | 0.938 | 0.938 | 0.0 | 0.0 | 50.0 |
| cold_winner | 0.938 | 0.938 | 0.813 | 0.0 | 50.0 | 83.3 |
| rebuilder | 0.938 | 0.938 | 0.875 | 0.0 | 0.0 | 8.3 |

Refusal, trust delta, and the plain-chess win delta for all 27 rows are in
`/home/ubuntu/kai-measure/gradient/<style>.csv` (not committed; regenerate with
the command above).

**Shape caveat.** Six matches on the fake engine is a gradient probe, not a
calibration: absolute rates mean nothing here and single-style differences of
one match are noise. What is readable is which styles *move* and in which
direction.

### Reading

1. The mechanism is confirmed. `supportive` is exactly insensitive to `k` —
   identical to four decimal places in all three rows — which is what the
   reduction predicts for a style already at `attachment = 1.000`. Every style
   that moves is a style sitting below the knife edge.
2. `k = 1000` restores a gradient, but does not by itself produce a defensible
   one. Attrition spreads (`0.000` to `0.938`) instead of being pinned at
   `0.938`, and win score spreads with it — but `tyrannical` lands at attrition
   `0.250` / win `100.0` against `supportive` at `0.375` / `50.0`. ADR 0024
   permits a cold able leader to win; it does not predict that tyranny keeps a
   *fuller roster* than support.
3. `servant` at `k = 1000` goes to zero desertion. Desertion with no
   consequences is the mirror failure of the current collapse.
4. `random`, `pure_tactician`, and `redeemer` stay at `0.938` even at
   `k = 1000`, so **there is at least one more driver**. The suspects, in order:
   the `raiseLossEstimatesAfterDesertion` bump (`+50` permille of `pLossTeam`,
   `−5` morale, `−3` trust per departure) which is style-independent by
   construction; the zero standing cost for pawns, which makes an unloved piece
   free to walk; and `P_captured` being the *commanded move's* post-move risk
   rather than the piece's standing exposure, so fifteen of sixteen pieces
   decide with no personal stake in the position at all.

## 4. What this does not do

No damping was added: no cooldown, no per-match cap, no morale floor (ADR 0011).
The cascade in `raiseLossEstimatesAfterDesertion` is untouched. The knob does
not weaken the feedback loop; it removes an unintended cancellation inside the
per-piece decision.

## 5. Decision

D145 is **resolved: both branches** — `DESERTION_STAY_ATTACHMENT_PERMILLE` is
`1000`, adopted as a structural correction rather than calibrated as a
continuous knob. `k = 0` cannot be right: it makes the leadership channel
algebraically inert for most of the roster. `k` survives as a knob only so the
pre-ruling regime stays reproducible.

`k = 1000` alone is not sufficient, and the ruling does not claim otherwise.
Driver (4) above is the next target, and two of the numbers in the table are
themselves symptoms rather than successes: `servant` at zero desertion, and
`tyrannical` finishing with a fuller roster than `supportive`. Neither is
evidence that the balance is right; both are why the remaining, style-independent
drivers come before any coefficient tuning.

### 5.1 Fixtures that depended on the collapse

Adopting the ruling failed three tests, and all three were fixtures that had
been quietly relying on the degenerate regime rather than on the mechanism they
name: the discovered-check turn-cession integration test forced its withdrawal
by flattening morale and `tauBenev`, which only worked while the collective term
alone could evict a piece; the season selection-knob probe only rotated its
bench because desertions kept emptying the lineup, so the redemption knob went
inert; and the early-saturation detector test asserted the detector's finding
against a live campaign that is no longer saturated. Each fixture was rebuilt to
exercise its mechanism independently of the desertion coefficients, and the
assertions were kept. This is worth recording: a balance regime this degenerate
becomes load-bearing for tests that were never meant to be about balance.
