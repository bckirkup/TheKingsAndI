# ADR 0018 — The roster judges a desertion; the player gets testimony

- **Status:** accepted (2026-07-26) — resolves **D34**, supplies the mechanism for **D33**
- **Owner:** *"the player should not see the calculation, only whatever
  rationalization the piece offers"*; *"If they saw his move as boldly resisting
  a foolhardy leader … they might be more willing to rout. If they saw him as
  failing the team, what then?"*

## Context
ADR 0011 made desertion an expected-cost decision, but left its *social* meaning
undefined, and D33 (re-recruitment) had no principled cost. Separately, D34 asked
how much of the arithmetic the player sees.

## Decision — two parts

**1. Only testimony reaches the player (D34).** The UI never shows the
computation. A piece's stated reason is generated from its *verdict*, not from
its calculation, so it may be a rationalization — self-serving and still
faithful to the model. The player debugs their leadership the way a commander
actually does: from accounts.

**2. Witnesses judge a desertion by their own evaluation of the refused order**
(ADR 0013), so its meaning is not authored:

```
for each witness j, score the order m the deserter refused, at depth D_j:

  V_own_j(m) also bad  →  "he said what we were all thinking"
                          affinity(j → deserter) ↑ , trust(j → leader) ↓
                          P_loss estimate spreads (ADR 0016 rumor) → rout nearer

  V_own_j(m) fine      →  "he ran"
                          affinity(j → deserter) ↓ , sharpest among pieces who
                          stood in a comparable position and stayed
```

**Re-recruitment (D33)** is then a costly signal *whose sign the roster sets*:
reinstating a piece the roster judged brave is the leader conceding error —
expensive, credible, and a genuine trust gain. Reinstating one they judged a
coward reads as favoritism and insults everyone who held the line. Because the
bench (D7) makes recruitment a visible opportunity cost, the roster also reads
**who was passed over**.

## Consequences
- One desertion has two opposite social meanings, both emergent from machinery
  that already exists. No authored branch decides which.
- Legitimate desertion is contagious *because* it was legitimate — the cleanest
  possible statement of ADR 0011's intended rout.
- The bench becomes a communication channel rather than inventory.
- **Requires** storing, per desertion, the refused order and each witness's
  appraisal of it — a fold over the event log, not new state.
- **Risk:** rationalization plus hidden arithmetic can leave a player unable to
  attribute a trust loss to anything they did, which `docs/trust_dynamics.md`
  names as the top refund risk. Mitigation: testimony must always name a
  *cause* ("you left me on that file") even while concealing the numbers.
  Legibility of cause is mandatory; legibility of arithmetic is forbidden.
