# ADR 0003 — How mutiny is represented on the board

- **Status:** OPEN — decision required (design_decisions.md D3)
- **Date:** 2026-07-26

## Context
"Leaves the board or defects to the enemy" is not expressible in standard chess.
chess.js validates positions and moves; arbitrary color flips can produce illegal
states (self-check, double-check artifacts).

## Options
- A. Removal — piece deleted from the position; pure material loss; FEN-safe
- B. Frozen obstacle — piece remains, permanently immovable, still occupies and
  blocks; needs a rules layer above chess.js; FEN-safe; re-recruitable
- C. Defection — piece changes color; most dramatic; highest legality and balance
  risk

## Recommendation
B for MVP, C as a post-MVP variant. The King is never eligible for mutiny in any
option, or matches end by psychology rather than by chess.

## Consequences (of B)
A custom legality wrapper must filter frozen squares out of move generation and
handle "no legal compliant move" states; stalemate/draw detection must account
for frozen pieces.
