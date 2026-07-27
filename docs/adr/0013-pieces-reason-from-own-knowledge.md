# ADR 0013 — Pieces reason only from what they themselves know

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D31, D32)
- **Date:** 2026-07-26

## Context
ADR 0008 made insight advice-only: a commanded move is always the move played.
That left one question load-bearing. Under ADR 0002 refusal costs no turn and
under ADR 0003 there is no defection, so **refusal is the psychology's only
lever on the board mid-match** — and it only has teeth if a piece can be *wrong*.

## Decision
**A piece evaluates every decision using its own depth-`D_i` view of the
position, never the true evaluation.** This applies uniformly to:

- `ΔV_board` and `ΔV_capture` in the utility function `U(P_i, m)`;
- `P_captured` — its own estimate of the danger it is being ordered into;
- `ΔSafety_j` in the peer-protection term `Φ`;
- `P_capture(i)` and `P_loss(team)` in the desertion comparison — which also
  **resolves D32** in the same direction.

There is no privileged oracle anywhere in the psychology layer.

## Consequences
- **Epistemic state becomes a first-class concept.** `engine/` must answer "what
  does piece *i* believe about this position" as a real query, not merely "what
  is the best move." The insight broker's cache key is `(position, D_i)`, and the
  psychology layer must never be handed the `D_max` evaluation at all — a
  reviewable, testable boundary: if `psychology/` can see the true score, the
  architecture is wrong.
- **A novice can refuse a winning move**, and a novice can walk away from a
  position that was actually fine. That is the mechanic. Experience is now
  something you can *lose games to*, which is what makes developing pieces
  matter.
- **The audit shows the divergence between the piece's evaluation and the true
  one.** Log both. *Revised by ADR 0015:* do not adjudicate "he was wrong" versus
  "he was disloyal" — under the credence model those are one parameter seen from
  two sides, and the honest report is *he would not take it on faith*.
- **Panic and misplaced confidence are emergent**, not scripted: a low-`D_i`
  piece has a noisier and shallower view, so it over-reacts to visible threats
  and misses deep compensation.
- **Trust and competence become separable failure modes**, which is exactly the
  leadership lesson: an order refused because it looked insane to the person
  receiving it is a *communication* failure, not a loyalty failure.
- New detector: **refused-good-move rate ≈ 0** means the model collapsed back to
  omniscience and distrust costs nothing.

## Alternatives considered
Evaluate against the true position (simpler and feels fairer, but `D_i` becomes
cosmetic, experience stops mattering, and the desertion model — which already
uses the piece's own estimates — would be internally inconsistent).
