# ADR 0014 — The player may override a refusal, at a price

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D30)
- **Date:** 2026-07-26

## Context
ADR 0002 removed the forfeited-turn path, and chess has no "pass." That leaves an
unanswered position: **every legal move is refused.** It is not hypothetical — it
becomes likely late in a collapsing campaign and during a desertion cascade, when
few pieces remain and trust is at its lowest.

## Decision
**The player can always force a move.** Any refusal may be overridden, at any
time, at a steep cost:

1. The commanded move executes.
2. The overridden piece takes a large trust penalty and gains trauma.
3. **Every witness** takes a smaller penalty — being made to watch a comrade be
   compelled is itself a leadership event.
4. The override is recorded as a distinct event type and appears in the audit and
   the leadership archetype classification.

The board is therefore never stuck, and no separate "total refusal" resolution
rule is needed.

## Consequences
- **The tyrant path becomes playable rather than modeled.** A player can command
  by force alone — and the game lets them, then bills them for it. That is a far
  better lesson than a rules-lawyered stalemate, and it is the mechanic most
  likely to produce the intended spiral quickly.
- Overriding is the fastest possible route into ADR 0011's cascade: forced
  compliance drives trust down, which drives `λ_i` down, which is precisely what
  makes pieces leave.
- Chess integrity is fully preserved: the position is always playable, no null
  moves, no non-standard board states, no special stalemate handling. R2 closes.
- **Calibration risk, and the sharpest knob in the game:** if the override is
  cheap, refusal is decorative and the whole psychology is bypassable with one
  extra click; if it is ruinous, it is a trap button nobody presses twice. Both
  are degenerate. Track *override rate* per leader archetype in the harness and
  tune the penalty until a `tyrannical` policy uses it freely and a `supportive`
  one almost never does.
- The UI must make it a deliberate act with visible consequences — who will be
  hurt, and by how much — never a reflex. It should read as a decision, not as a
  dismissible dialog.

## Alternatives considered
Auto-play the least-refused move (removes player agency at the exact moment the
game is making its point); treat total refusal as resignation (a rules-lawyer
answer to a drama problem, and it deletes the tyrant path).
