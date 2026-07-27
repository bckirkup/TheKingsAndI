# ADR 0019 — Trust has two channels: benevolence is fast, ability is slow

- **Status:** accepted (owner ruling, 2026-07-26)
- **Resolves:** **D36** (form of the leader prior), **D37** (credence curve),
  **D38** (is `τ` domain-specific), **D39** (asymmetric rates)
- **Refines:** ADR 0015 (trust as credence), ADR 0016 (memory as a prior)

## Context
ADR 0015 made trust the weight on the leader's judgment; ADR 0016 said that
weight is built from history. Neither said at what *rate*. The owner supplied
four rates rather than one:

> **"Feeling heard builds faith fast. A single act of perceived betrayal can
> break it quickly. However, feeling ignored erodes faith and a reputation for
> competence builds slowly."**

Those four do not describe one asymmetric curve. They sort cleanly into two
channels with different physics — which is the ability/benevolence distinction
from the trust literature, and which D38 had raised speculatively.

## Decision
`τ_i` decomposes into two credences that are updated by different events at
different speeds:

| Channel | Question | Moved by | Rate |
|---|---|---|---|
| **`τ_benev`** | *does he care what happens to me?* | being heard; being defended; being spent | **fast up, cliff down**, plus slow erosion from neglect |
| **`τ_abil`** | *are his orders usually right?* | vindicated and falsified orders | **slow accretion**, roughly Bayesian in `1/n` |

Update shapes:

```
τ_benev   heard / defended / withdrawn-at-cost   →  large step up
          perceived betrayal (spent, overridden) →  cliff (logistic, not linear)
          ignored: never consulted, never
          defended, refusal steamrolled          →  slow per-event erosion

τ_abil    order vindicated at D_max              →  +1 observation, weight 1/n
          order falsified                        →  −1 observation, same weight
          (late in a campaign it is hard to move in either direction)
```

Both feed refusal, but they cause **different refusals**:

- **low `τ_abil` → "he's probably wrong."** The piece discounts
  `V_leader_implied` — it does not believe the order encodes anything it cannot
  see. Unfixable by kindness; only repeated, visible correctness moves it.
- **low `τ_benev` → "he thinks I'm expendable."** The piece may concede the move
  is strong and still refuse, because a sound sacrifice reads as contempt.
  Unfixable by winning.

`V_leader_implied` is therefore the **ability** channel (D36), and the
willingness to act on an unverifiable order is the **benevolence** channel. D37's
curve question dissolves: ability is Bayesian and gradual, benevolence is
logistic with a cliff — faith fails as a *snap*, not a fade.

## Consequences
- **The audit gains its most useful distinction.** A leader can now be told
  which channel he is failing, and the lesson is that producing more evidence
  for the channel that was never the problem is the classic failure of the
  competent, cold leader.
- **Neglect is an event, not decay.** "Feeling ignored" is caused by specific
  omissions — never consulted, never defended, refusal steamrolled — so ADR 0007
  still holds: trust never drifts toward a baseline on its own. Time passing is
  not neglect; being passed over is.
- **The two channels must be separately visible in telemetry**, or the
  distinction is unfalsifiable and the design collapses back to one number.
- **Exploit — trust farming.** If being heard builds faith fast, a player can
  issue a deliberately bad order, let it be refused, back down warmly, and
  repeat. Mitigation: the *heard* signal only fires when withdrawal cost real
  value, measured against the true evaluation on the audit path. Backing off a
  good move is a concession; backing off a bad one is theater and must register
  as nothing. New degeneracy detector.
- **Interaction with the override (ADR 0014):** an override is the canonical
  benevolence cliff, which is why it is expensive without needing a tuned
  constant. It should barely touch `τ_abil` — being coerced says nothing about
  whether the leader was right.
- **Asymmetry is the whole point and must not be tuned away.** Fast up on being
  heard plus a cliff on betrayal means a roster can be won and lost within one
  match, while a reputation for competence cannot. That is the intended
  experience of the trust spiral (ADR 0007).

## Also decided — D41: attention prunes
Attention **prunes** the lines a piece does not appear in rather than merely
deprioritizing them.

> Owner: *"pruning is the only computationally reasonable approach… and it
> mirrors real people who often don't think n steps ahead."*

Consequences: the pool re-search per piece stays cheap (ADR 0017); a piece can
be *structurally incapable* of seeing why a deep move is good, so refusals of
winning moves become common rather than rare — which is exactly the behavior
ADR 0015 needs and the sharpest fun risk in the design. The mitigation is
testimony (ADR 0018), not a softer model.
