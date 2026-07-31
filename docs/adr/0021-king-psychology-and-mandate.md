# ADR 0021 — The King holds a mandate, not an opinion; his attention is broad, not deep

- **Status:** accepted (owner rulings, 2026-07-26)
- **Resolves:** **D51** (does the King have psychology?)
- **Refines:** ADR 0003 (desertion, not defection), ADR 0013 (own-knowledge
  reasoning), ADR 0016 (attention), ADR 0019 (two-channel credence)

## Context
D51 was left open and the owner called it genuinely ambiguous:

> **"Is a player incarnated in each king? Or can the king have a distinct
> opinion? What would it mean? After all, the king is involved in every branch
> of the game... at the tips, especially."**

The last clause decides it. ADR 0019 settled that attention **prunes** to the
lines a piece appears in. Every line in chess terminates in the King's safety.
So the King is the only piece whose attention is not parochial — not by
authorial fiat, but as a consequence of the pruning rule already adopted.

Two readings were available:

- **Incarnation.** The King *is* the player's avatar and holds no view of his
  own. Simple, uniform, and it makes the override question disappear.
- **Distinct character.** The King is a participant with his own judgment.

Incarnation is rejected. The product name is **The Kings and I** — plural,
across campaigns. The player serves kings and is not one. A design in which the
player *is* the King has no room for the title's central relationship.

## Decision

### 1. The King's attention is global in breadth, bounded in depth
He appears at the tips of every line, so no line is pruned from his view. His
depth `D_king` remains bounded like any other piece's.

> The King sees the whole board shallowly. A knight sees its own corner deeply.

This is the executive and the specialist, and it is the reason the commander is
the only participant who can integrate the two. Breadth without depth is **not**
truth; it is a plausible summary, and it can be confidently wrong in exactly the
way senior judgment is.

### 2. The King cannot desert — as a theorem, not an exemption
ADR 0011 deserts when personal danger outweighs the stake in the team losing:

```
U_desert(i) = -P_loss(team | i leaves) · λ_i · μ_i
U_stay(i)   = -P_capture(i)·pain_i - P_loss(team | i stays) · λ_i
```

For the King, `P_capture(king)` **is** `P_loss(team)`. The two terms are the same
quantity, so `U_desert` cannot exceed `U_stay` for any trait vector. ADR 0003's
King exemption stops being a special case in the rules and becomes a consequence
of the model.

### 3. His egocentrism is the objective function
Every other piece's self-interest distorts its evaluation away from the team's
interest. The King's self-interest *is* the win condition, making him the only
structurally honest evaluator on the board — while still limited by `D_king`.

### 4. His credence is a mandate, not a willingness to obey
Credence inverts direction for the sovereign. Other pieces extend faith upward
to a commander; a king does not obey a commander, he **grants him authority**.
So the King's `τ` in the player is not an obedience gate. It is the player's
mandate, and it has three effects as it falls:

1. The roster learns the sovereign has lost confidence — this enters the rumor
   channel (ADR 0016) as an appraisal of the leader, so it spreads and lowers
   `V_leader_implied` army-wide.
2. Orders carry less implied weight for every piece, because the office backing
   them is visibly weakening.
3. At the floor, the King relieves the player of command.

### 5. Overriding the King is the maximal betrayal event
The override path (ADR 0014) still applies — no position may be unplayable — but
forcing the sovereign is the largest `τ_benev` cliff available, and unlike
overriding a pawn it is unambiguously reckless: the King's breadth means his
objection is usually well founded.

## Consequences

**A third terminal state.** Checkmate, rout, and now a *political* loss: the
player can be winning on the board and be dismissed, with the roster unharmed.
See §6.

**A new degeneracy detector — costless mutiny.** Mean dismissal rate is
insensitive to `w_ambition`/`w_prestige`, or dismissal strictly dominates
desertion for every trait vector. Withdrawing confidence must cost the piece the
victory it wanted, or §6.2's brake is decorative and no roster ever routs.

**A new degeneracy detector — royal oracle.** A King with global attention edges
toward being a hint system. If `V_own_king` correlates with the true `D_max`
evaluation above roughly 0.85, or if players learn to read his testimony as
tactical advice, the breadth/depth distinction has failed in implementation and
he has become an omniscience leak (ADR 0013).

**`PieceState` stays uniform.** The King carries the same fields; what differs is
his attention mask (unpruned), his evaluation profile (self-safety *is* the
objective), and the *interpretation* of his credence (mandate, not obedience).
No royal special-casing in the reducers, which keeps ADR 0019's channels intact.

**Cross-campaign meaning.** Under D49, credence is keyed by leader identity;
symmetrically, mandate is held by a *specific* king. Serving a new king in a new
campaign means a fresh mandate with a reputation attached — which is what the
title has been describing all along.

## 6. Dismissal is a terminal state — the survivable one (owner ruling)

> **"It's not loss for the pieces per se. They lose the opportunity at glorious
> victory, but they are not taken."**

Dismissal is the only ending in which nobody dies. Checkmate spends pieces; a
rout scatters them; being relieved of command leaves the roster whole. Three
things follow.

### 6.1 The roster gains a non-violent alternative to routing
Pieces cannot dismiss the player, but they feed the King through the rumor
channel (ADR 0016), so **withdrawing confidence and letting the sovereign act is
strictly cheaper for a piece than deserting** — no capture risk, no witness cost,
no affinity damage from the ones who stayed. This is a vote of no confidence, and
it is the most organizationally realistic mechanic in the design.

### 6.2 The counterweight is glory, not danger
Because dismissal is safe, it would otherwise dominate desertion for every
piece. What a piece forfeits is the victory it wanted, so `w_ambition` and
`w_prestige` (already in `PieceTraits`) are the brake:

- ambitious, prestige-seeking pieces tolerate a commander they dislike because
  they want the win;
- traumatized and cautious pieces prefer to be safely led by someone else.

Dismissal is therefore a **coalition**, split by trait rather than by a trust
threshold, which is a better model of how leaders actually lose a room.

### 6.3 The three endings form a severity ladder
| Ending | Diagnosis | Roster |
|---|---|---|
| Checkmate | you were outplayed — tactical failure | spent |
| **Dismissal** | they still want to win, just not with you — relational failure | **intact** |
| Rout | they would rather lose than serve you — total failure | shattered |

Each needs its own epilogue (D29). Dismissal is the *middle* outcome and must not
be presented as the worst.

### 6.4 The mandate is the early-warning system
The King's global breadth (§1) means he sees the collapse forming before any
individual piece does, so **dismissal fires earlier than a rout**: a competent
sovereign saves the army from the player. That is the executive's actual job, and
it is why the mandate is not a fourth failure mode bolted on but the mechanism
that makes the rout avoidable in principle.

**New calibration knob (D54):** the King's *patience*. It interacts directly with
D26 — dismiss the player too early and he never reaches the insight that the game
is not chess; too late and the rout preempts the mechanic entirely.

## Alternatives considered
- **Incarnation** (King has no view). Rejected: contradicts the title's premise
  and wastes the only piece with global attention.
- **King as an ordinary piece that can refuse.** Rejected as the primary
  mechanic: a refusing King either stalls the game or is overridden constantly,
  and it models the relationship backwards — the sovereign is not a subordinate.
- **King with no credence but a special "loyalty of the crown" scalar.**
  Rejected: a second trust system with its own physics, when ADR 0019's channels
  already carry the semantics with a different *interpretation*.
