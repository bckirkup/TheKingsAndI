# The belief model — how a piece imputes the position

_Owner:_

> **"The hardest problem in all of this is actually how to impute the board
> position for each of the pieces based on the history they have observed, the
> positions they can currently see, any rumor they may have heard…"**

Governed by ADR 0016. Supplies the `V_own` and `V_leader_implied` that ADR 0013
and ADR 0015 require. Nothing here is implemented.

---

## 1. The reframe: divergence is interpretive, not perceptual

The tempting reading of "what each piece can see" is *fog of war* — a belief
distribution over where the enemy pieces are. Reject it, for two reasons.

**It is intractable.** A belief over chess positions is a distribution over a
state space of ~10⁴⁴. Any honest POMDP treatment is unaffordable in a browser,
undermines byte-reproducible replay, and makes every piece's view an
approximation whose error we cannot characterize.

**It is not the phenomenon.** Chess is a perfect-information game and that is
the interesting part. Everyone on the board can see exactly where everything is
and they *still disagree violently about what it means* — which is precisely
true of the leadership situation being modeled. Staff meetings rarely fail
because someone lacked the org chart.

> **The board is common knowledge. Its meaning is not.**

So a piece's "view" is not a guess about the position. It is an **evaluation
function plus an attention pattern plus a prior about the leader** — and those
are cheap, deterministic, and inspectable.

## 2. Three channels

### Channel 1 — Perception: what this position means to me

| Component | Effect |
|---|---|
| **Depth `D_i`** | ADR 0013's existing lever: how far ahead it can actually calculate |
| **Egocentric evaluation** | The piece overweights its own safety, its own mobility, and the fate of its own class. A pawn's evaluation is not a grandmaster's evaluation of a pawn |
| **Attention** | *It searches the lines it appears in.* Variations involving the piece itself and its high-affinity peers get extra depth; variations involving pieces it does not care about get less |

Attention is the sharpest of the three, because it reproduces the actual failure
mode: **nobody analyzes the position, everyone analyzes their part of it.** A
brilliant plan whose point lies four plies deep in a line the piece never
examines is, to that piece, an arbitrary order. That is not stupidity and it is
not disloyalty — and per ADR 0015 those were never separable anyway.

### Channel 2 — Memory: what he has done to people like me

History enters as a **prior on the leader**, never as board knowledge. This is
the missing piece of D36:

```
V_leader_implied(m) = f( leader track record as this piece experienced it,
                         outcomes of orders this piece took on faith,
                         what happened to pieces of its class and its friends )
```

*"The last three times he advanced me on this file, I was taken."* The piece is
not recalling a position; it is recalling **what obedience cost**. Faith that was
rewarded raises the prior; faith that was punished lowers it — and per D39 the
two rates need not be equal.

This makes reputation mechanical rather than authored: a leader who has been
right before is *believed more*, which is the entire currency of the game.

### Channel 3 — Rumor: what the room thinks

Rumor carries **scalars over the affinity graph, never board facts.** Only two
quantities propagate:

- an estimate of `P_loss(team)`
- an appraisal of the leader

Each ply, a piece nudges its estimates toward those of the pieces it talks to,
weighted by affinity and by class prestige (ADR 0013's prejudice machinery
already says who listens to whom — a Knight discounts a Pawn's read of the
position). Two floats diffusing on a 16-node graph: negligible cost, seeded,
replayable.

What it buys is disproportionate: **panic outruns the position.** A rout can
begin because the mood spread faster than the material loss, which is the most
recognizable thing about real collapses and is impossible to get from any
per-piece calculation done in isolation.

## 3. What this deliberately does not model

- No uncertainty about piece locations. No hidden squares, no fog rendering.
- No belief distribution over positions, ever.
- No piece is wrong about *facts*. Every piece may be wrong about *meaning*.
- Rumor never transmits a board feature — only appraisals. A piece cannot learn
  a tactic through gossip, only a mood.

## 4. Consequences for the engine (see ADR 0017)

Sixteen distinct minds must not mean sixteen engines. Perception decomposes into
a shared part and a private part:

```
shared:   one search from the pool → a tree of leaf positions
private:  re-score those leaves under piece i's own weights,
          truncate to D_i, and re-search only i's attention lines
cache:    keyed (position, D_i, evalProfile_i)
```

Search is what costs; scoring is nearly free. Because attention is a *depth
allocation* rather than a different tree, most of the work is shared even
between pieces that end up disagreeing completely.

## 5. Consequences for the player

The player never sees any of this (D34, ADR 0018). What they see is a piece
giving a reason — and the reason may be a rationalization, because a piece
reporting its own attention failure would have to be more self-aware than
people are. The information channel is exactly the one a real commander has:
**testimony**.

## 6. Open questions

- **D41:** Is attention a depth bonus on the piece's own lines, or a hard
  pruning of lines it does not appear in? Pruning is more dramatic and more
  likely to produce refusals of winning moves.
- **D42:** Rumor propagation rate. Fast enough to cause panic cascades, slow
  enough that the player can intervene between plies.
- **D43:** Are the egocentric evaluation weights a fixed trait, or do they drift
  with trauma (`B_i`)? A piece taken twice on the same diagonal plausibly
  overweights that diagonal forever — which would finally give `B_i` a
  perceptual job as well as an affective one.
- **D44:** Do the two rumor scalars have separate credibility, so that a piece
  can believe the room about the position but not about the leader?
