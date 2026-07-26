# ADR 0002 — Cost model for refused orders

- **Status:** OPEN — decision required (design_decisions.md D2)
- **Date:** 2026-07-26

## Context
The SRS states a refusal means "the player loses their turn or must select a
compliant piece." Free re-planning makes distrust a mild inconvenience the player
routes around; forfeiting a turn is chess-breaking and randomly punishing.

## Options
- A. Free re-plan (refusal is information only)
- B. Turn forfeited
- C. Bounded rejected-intent budget per turn (`k`, recommended `k=3`), with
  escalating morale/peer-visibility cost per refusal
- D. Chess-clock cost instead of turn cost

## Recommendation
C, with `k` tuned by the headless harness; escalating narrative cost keeps
distrust expensive without breaking chess.

## Consequences (of C)
Requires defining behavior when the budget is exhausted and when *no* compliant
legal move exists (see risks R2), plus UI to make the budget legible before the
player spends it.
