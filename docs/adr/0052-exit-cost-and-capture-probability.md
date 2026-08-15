# ADR 0052: The exit charges the deserter, and capture risk is a probability

## Status

Accepted. Resolves D146 (both candidate resolutions adopted). Magnitudes are
calibration hypotheses measured in
`docs/calibration/2026-08-16-exit-cost-asymmetry.md` and its follow-up sweep;
the shapes below are the decision.

## Context

After D145 the desertion comparison reduces to

```
leave  if   P_captured · pain · shadow   >   pivotality · λ · 50 · attachment
                                            + standing · shadow  + hysteresis
```

Measured on `d362408`, the left side beats the right by 5–10× for pawns and the
roster still empties for cold styles. Two structural faults produce that, and
neither is a coefficient:

1. **Desertion removes the piece from the board exactly as capture does, yet
   `U_desert` charges nothing for it.** The piece escapes `P_captured · pain` by
   taking the very outcome it fears, with certainty. Nothing in the model prices
   the future it throws away.
2. **`P_captured` is a threat flag, not a probability.** It reports 0.9 / 0.8 /
   0.6 / 0.25 from attacker and defender *counts*, with no notion of whether the
   capture would profit the opponent. Ordinary central tension therefore tells a
   defended pawn it is 25% dead and a once-attacked knight it is 80% dead, every
   ply.

## Decision

### 1. The exit carries an own-future cost

`U_desert` gains a self-cost term with the same shape as the capture pain it
replaces, so the two branches are priced in one currency:

```
exitSelfCost = pain_i · attachment_i · w_exit · shadow
U_desert     = −P_lossIfLeave · λ · S · attachment  −  standing · shadow  −  exitSelfCost
```

where `w_exit = DESERTION_EXIT_PERMANENCE_PERMILLE / 1000`.

Rationale for each factor:

- **`pain_i`** — leaving is removal from the board, the same event capture
  threatens; it is priced in the same units, so trauma raises the cost of both
  branches rather than only the stay branch.
- **`attachment_i`** — how much future the piece is actually forfeiting. A piece
  that no longer believes in this command has less to lose by walking, which is
  where leadership enters: attachment already aggregates distrust, the
  benevolence gap, trauma, and negative affinity, damped by loyalty.
- **`w_exit`** — permanence. Capture is impermanent under ADR 0026 (the piece
  returns to the community pool); a desertion record and its trauma are not.
  The knob expresses how much worse, or less bad, walking out is than being
  taken.
- **`shadow`** — as with capture pain and standing cost, a future is worth less
  when the team is going down anyway.

The decision boundary becomes, with the small terms set aside,

```
leave  if   P_captured  >  attachment_i · w_exit
```

— a piece walks when its chance of being taken exceeds the fraction of its
future that staying still represents. That is the dilemma the model is supposed
to contain, and leadership sets the threshold directly.

This is **not** damping under ADR 0011: it adds no cooldown, cap, or floor, the
cascade remains undamped, and every departure remains a single expected-cost
comparison that any piece can win.

### 2. Capture risk is the probability the opponent profits by taking you

`captureRiskThousandths` computes a static exchange evaluation over the sorted
attacker and defender values on the square (no x-rays), and maps the resulting
material gain to risk:

```
gain = swapOff(victimValue, attackersSortedByValue, defendersSortedByValue)

gain > 0 and no defenders   → riskUndefended        (capture is free)
gain > 0 and defenders      → riskFavourableTrade   (wins material through the defence)
gain = 0 and attackers > defenders → riskOutnumbered (pressure without profit)
gain = 0                    → riskDefended          (an even trade, taken sometimes)
gain < 0                    → riskLosingTrade       (new; the opponent loses by taking)
```

Kings still score 0 as victims and use `kingExposureThousandths`. A King
*attacker* is not an ordinary participant in the swap-off: `kingAttackerValue`
is a sentinel for "cannot be recaptured", not a material value, so a King is
counted as an attacker only when the square has no defenders — where its capture
is free and the target reads `riskUndefended` — and is dropped from the swap-off
otherwise. Feeding the sentinel into the exchange would report every King-
adjacent piece, defended or hanging, as a losing trade. All five outcomes stay
`FeatureConfig` knobs, so each keeps a sensitivity probe, and `riskLosingTrade`
is the new one: today a knight defended by a pawn and attacked by a rook reads
0.25, when in fact the opponent cannot profitably take it at all.

No side-to-move or escapability discount is adopted. Desertion contexts are
built from post-move features with the opponent to move, so an escape discount
would not reach the decision it is meant to correct, and per-piece legal-move
generation every ply is not worth its cost.

## Consequences

- `P_captured` changes meaning everywhere it is read — move utility, leader
  policies, King command, and the private evaluation profile — so golden
  fingerprints move. They are regenerated deliberately, with the balance
  before/after in the PR body.
- `DESERTION_EXIT_PERMANENCE_PERMILLE` is a sweepable `ENGINE_CONFIG` knob; its
  default is chosen from a nine-style sweep, not assumed. `0` reproduces the
  pre-ADR free exit for reproducibility.
- The intended sign of the change is that a piece in genuine, material danger
  still walks, while a piece in ordinary contested chess does not — and that the
  difference between styles is the attachment threshold, not the flag.
- Class prejudice still zeroes pawn `standing`; that remains open and is now the
  smaller of the two brakes rather than the only one.

## The `no-rout` guard is re-expressed, not weakened

`DEGENERACY_CONFIG.noRoutAttritionThreshold` was `0.2`: a tyrant whose campaign
lost less than a fifth of the roster failed the smoke gate as an inert
consequence layer. That floor was written while the exit was free, when a fifth
of the roster was a low bar — under the priced exit, `tyrannical` deliberately
finishes at `0.063` (one piece over six matches), so the old floor now fails the
intended behaviour.

The threshold moves to `0.05`, which on a sixteen-piece roster is the smallest
threshold that still admits a single departure. The check therefore stops
asserting a magnitude — how *much* of the roster a tyrant must lose, which is a
balance target and not a degeneracy — and asserts the thing its message actually
claims: that a tyrant loses somebody. Attrition of exactly zero, meaning no
piece ever walked out on a tyrant in any match, still hard-fails the gate.

The guard keeps its hard-failure status on both the smoke and calibration paths.
Nothing else in `DEGENERACY_CONFIG` moves; in particular the supportive rout
ceiling and the early-saturation thresholds — the guards that catch the
collapse direction — are untouched. The tyrant's consequences are also visible
in channels this detector never read (`refusal = 0.164`, `override = 0.462`,
`trust_delta = -31.98` at the adopted default), so a low attrition figure is not
evidence of inertness on its own.
