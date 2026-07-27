# ADR 0003 — Desertion, not defection

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D3)
- **Date:** 2026-07-26

## Context
The SRS described a piece that "leaves the board or defects to the enemy."
Defection is not expressible in standard chess — chess.js validates positions,
and flipping a piece's color mid-game produces illegal states, breaks FEN
round-tripping, and invalidates engine evaluation.

## Decision
- **Defection to the opposing side is out of scope, permanently.**
- **Desertion is in scope:** a piece that reaches the desertion state *quits the
  board* and is removed from play for the remainder of the match.
- The King is never eligible to desert; otherwise matches end by psychology
  rather than by chess.

## Consequences
- Board state stays legal at every ply: desertion is a piece removal, which
  chess.js and Stockfish both handle natively (the resulting position is simply
  material-down).
- Desertion is the campaign's terminal consequence and the mechanism behind
  ADR 0007's phase-3 collapse, now that defection is gone.
- `M_i` (morale) is the desertion gate, so D22 is back in scope and blocking: the
  spec still has no rule that writes morale, which makes desertion unreachable.
- A deserted piece's status is `DESERTED`; whether it can be re-recruited later,
  and at what cost, is a campaign-layer decision (D27/D7).
- Edge case still open (D30): if every legal move is refused and no piece will
  act, chess offers no "pass."

## Alternatives considered
Frozen obstacle (piece stays on the board, immovable and blocking) — more
visually dramatic and re-recruitable in place, but it is a non-standard board
object that every engine call must be taught about. Defection — rejected by the
owner and by chess legality.
