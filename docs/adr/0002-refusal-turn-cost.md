# ADR 0002 — Cost model for refused orders

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D2)
- **Date:** 2026-07-26

## Context
The SRS states a refusal means "the player loses their turn or must select a
compliant piece." Free re-planning risks making distrust a mild inconvenience;
forfeiting a turn is chess-breaking, since a lost tempo can lose a game outright
and would punish the player randomly at low trust.

## Decision
**Free re-plan.** A refusal rejects that order and the player may immediately
issue another. No turn, tempo, or clock cost.

## Consequences
- Chess integrity is preserved absolutely: the player is never forced into a
  null move or a forfeited tempo by the psychology layer.
- The teeth come from *denial of options*, not from a penalty: a distrusting
  roster removes the player's best moves from the menu, so they play the
  second-best move, lose position, and lose trust further (ADR 0007's loop).
  Refusal is therefore only as meaningful as the model's willingness to refuse
  *good* moves, which ADR 0013 supplies: pieces judge from their own limited
  view. ADR 0014 adds the escape valve — the player may override, at a price.
- Expect brute-force probing: the player will poll pieces to find who will obey.
  That is acceptable and arguably the intended learning behavior ("who still
  follows me?"), but the UI should make polling cheap and legible rather than a
  hidden click-grind, and repeated probing within one turn should be visible to
  the roster.
- The balance harness must track *refused-good-move rate*, not just refusal
  rate, since under free re-plan the former is the only thing that costs games.

## Alternatives considered
Turn forfeited (chess-breaking); bounded rejected-intent budget with a forfeit
on exceeding it (preserves integrity but adds a resource the player must track);
chess-clock cost (only meaningful in timed play).
