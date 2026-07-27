# ADR 0016 — Belief is interpretive, not perceptual

- **Status:** proposed (2026-07-26); supplies `V_own` for ADR 0013 and
  `V_leader_implied` for ADR 0015 (D36)
- **Owner prompt:** *"the hardest problem … is how to impute the board position
  for each of the pieces based on the history they have observed, the positions
  they can currently see, any rumor they may have heard"*

## Context
ADR 0013 requires every piece to decide from its own view, and ADR 0015 makes
that view the thing trust is measured against. Neither says where the view comes
from. The obvious answer — partial observability, a belief distribution over
board states — is unaffordable (~10⁴⁴ states, in a browser, under a
byte-reproducible replay guarantee) and, more importantly, models the wrong
thing.

## Decision
**The board is common knowledge; its meaning is not.** No piece is ever wrong
about where a piece stands. Divergence is produced by three cheap channels
(`docs/belief_model.md`):

1. **Perception** — depth `D_i`, an egocentric evaluation (own safety, own
   mobility, own class), and **attention**: a piece searches the lines it
   appears in more deeply than the lines it does not.
2. **Memory** — history enters as a *prior on the leader*, not as board
   knowledge: what obedience has previously cost this piece, its friends, and
   its class. This is the substance of `V_leader_implied` (D36).
3. **Rumor** — two scalars (`P_loss(team)` and an appraisal of the leader)
   diffusing over the affinity graph each ply, weighted by affinity and class
   prestige. Never board facts.

## Consequences
- **Tractable and deterministic.** Two floats on a 16-node graph plus per-piece
  leaf re-scoring; seeded, replayable, and cheap enough for the 1,000-match
  harness.
- **Attention reproduces the real failure mode.** A plan whose point lies deep
  in a line the piece never examines is, to that piece, an arbitrary order —
  neither stupidity nor disloyalty, which is exactly ADR 0015's claim.
- **Reputation becomes mechanical.** A leader who has been right before is
  literally believed more. Nothing about this is authored.
- **Panic can outrun the position.** Rumor lets a rout begin from mood rather
  than material — recognizable, and unobtainable from isolated per-piece
  calculation.
- **A piece can never learn a tactic by gossip, only a mood.** This keeps rumor
  from becoming a back-channel that repairs bad perception.
- **Cost:** the engine must serve sixteen evaluation profiles. See ADR 0017.

## Alternatives considered
- **True partial observability / fog of war.** Rejected: intractable, breaks
  replay, and dissolves the perfect-information premise that makes the
  disagreement interesting.
- **Noise on a shared evaluation.** Cheaper, but random error is not
  perspective: it produces pieces that are *unreliable* rather than pieces that
  are *differently invested*, and it cannot generate the competent skeptic.
