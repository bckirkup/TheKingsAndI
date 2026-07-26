# ADR 0009 — Capture is removal and trauma, not permadeath

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D6, D7)
- **Date:** 2026-07-26

## Context
Whether capture is permanent defines the campaign's stakes, roster churn, the
meaning of sacrifice, and the entire data model around piece lifecycle.

## Decision
- Capture removes the piece **from that match**, not from the campaign. There is
  no permadeath.
- Capture carries persistent cost: individual pain (`B_i`), trust loss for the
  victim and its witnesses, and the strategic risk of losing the game.
- Pieces have outcome preferences: **they like winning, hate losing, and really
  hate being taken.** These are the primary writers of `T_i` and `M_i` between
  matches, and they are what closes ADR 0007's feedback loop.
- The roster grows a **bench over time** rather than being a fixed 16.

## Consequences
- `B_i` finally has a job: accumulated capture trauma, persisted across matches,
  and therefore D21 is answered by design rather than deleted.
- Long-run character attachment survives, which is what makes campaign debriefs
  land — you keep the same cast for 20 matches.
- Being spent repeatedly must remain visibly costly even without permadeath;
  otherwise sacrifice is free and the trap never closes. Calibration hypothesis:
  each capture leaves a durable `B_i` increment and depresses the recovery rate
  of `T_i`, so the third sacrifice of the same piece is far more expensive than
  the first.
- Bench growth makes *selection* a leadership act (who plays today) distinct from
  benching-as-punishment, and it needs a roster screen at Milestone 5.

## Alternatives considered
Permadeath with green replacements (strongest thematic weight, but destroys the
longitudinal cast the debriefs depend on); hard retirement after *N* captures
(may still be worth it as a late-campaign pressure valve).
