# ADR 0008 — Variable insight is advice, not mechanics

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D4)
- **Date:** 2026-07-26

## Context
The reference spec puts each piece's own depth-limited evaluation `ΔV_board`
directly inside its utility function, so a novice's flawed evaluation would
change what it is willing to do. That is richer, but it means bad advice has
mechanical teeth and can read as the game cheating.

## Decision
**Advice-only.** Experience and engagement determine the *quality of the counsel*
a piece offers — its suggested moves, its assessment of danger, the depth behind
its opinion. A piece never plays a move other than the one commanded.

## Consequences
- `D_i = f(E_i, η_i)` still drives real engine work, but its output is surfaced
  to the player as guidance rather than substituted into the game's outcome.
- Quiet quitting becomes primarily an *information* failure: a disengaged veteran
  gives you depth-4 advice while appearing to be a depth-16 asset. That is a good
  mechanic and a very good leadership metaphor.
- Combined with ADR 0002 (free re-plan) and ADR 0003 (no defection), refusal is
  now the psychology's only lever on the board. **ADR 0013 gives that lever its
  teeth:** a piece decides using its own depth-`D_i` view, so it can refuse a
  winning move in good faith.
- Golden tests get simpler: the played move is always the commanded move.

## Alternatives considered
Insight-in-utility (the reference spec's design): mechanically richer, but the
player loses games to errors they can see are errors, which requires the piece's
reasoning to be fully inspectable to avoid feeling arbitrary.
