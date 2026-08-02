# ADR 0029 — The world ends with the curriculum; only claims about the player leave it

- **Status:** accepted (owner ruling)
- **Resolves:** **D84** (world lifespan), **D85** (what escapes a world:
  achievements vs. evidence-backed certificates)
- **Supersedes:** **D83** (gated passport promotion — there is nowhere to
  promote to)
- **Simplifies:** D72 (no global registry tier), ADR 0026 §5, ADR 0028 §4

## Context

> **"How many layers — piece, King, player, facilitator. Yes, the pieces should
> not outlast the seminar/curriculum. Reputation beyond that goes by Steam
> 'achievements' and Certificates of Completion."**

ADR 0026 imagined a persistent community of pieces; ADR 0028 protected it with a
promotion gate. Bounding the world to the curriculum removes both problems.

## Decision

### 1. A world lives exactly as long as its curriculum (D84)
A cohort world, a LAN world, or a single-player world is created for a course or
a campaign and **ends with it.** Pieces do not outlive the world that made them.

Consequences that are simplifications rather than losses:

- **No global registry.** ADR 0026's tier-3 disappears and tier-2 stays local
  (ADR 0027 §1).
- **No promotion gate.** D83 is superseded; there is nowhere to promote to.
- **No permanent-commons moderation**, and no long-lived PII.
- **No cold-start problem beyond a single world**, which AI commanders already
  solve (D74).

**Retirement gets sharper, not weaker.** In a permanent world, exhausting a piece
is a rounding error against an unbounded pool. In a thirteen-week world, a piece
burned in week three is gone for the remaining ten, and the cohort lives with the
scarcity it created. The tragedy of the commons then plays at the scale it
actually occurs at — an organisation, not a universe.

### 2. The four layers, and why the model reaches all of them
```
piece  →  King  →  player  →  facilitator
```
Each rung holds credence in the one above and is measured by the one below. This
is why the facilitator audit (ADR 0028 §3) required no new machinery: it is the
same instrument one level up.

### 3. Only claims about the *player* leave the world (D85)
Nothing about a piece is portable. Two exit channels, deliberately different:

| Channel | Says | Backed by | Gameable |
|---|---|---|---|
| **Steam achievements** | what you did | play | yes, by design — that is their job |
| **Certificate of Completion** | what the log shows about how you led | the audit, with seed and event log attached | must not be |

**A certificate must be evidence-backed, never participation-backed.** The moment
it can be earned by attendance it is worth nothing to an enterprise buyer.
Because a match is a seed plus an event log (ADR 0026 §6), a certificate can ship
with the material needed to **verify** it by replay rather than to believe it.

## Consequences

**Data lifecycle becomes explicit.** A world has a defined end and a defined
disposition — export the player's certificate and achievements, then discard or
archive the world. Privacy review has a bounded surface.

**Scarcity is a design parameter.** Pool size relative to curriculum length now
directly controls how much a burned piece costs. It joins bench depth (D58) as a
calibration knob, and the harness must sweep it.

**New degeneracy detector — participation certificate.** A certificate issuable
without a discriminating signal from the audit, or one whose contents do not vary
with how the player actually led.

**New degeneracy detector — unverifiable claim.** A certificate that cannot be
replay-verified from the attached seed and log, or that omits the
`determinismId` (ADR 0020).

**New degeneracy detector — infinite pool.** Curriculum length and pool size set
such that retirement never binds, restoring the rounding-error problem this ADR
removes.

**ADR 0026 stands otherwise.** Capture is still never permanent, exhaustion is
still permanent, free agency and cross-roster affinity are unchanged — they are
simply scoped to a world with an end.

## Alternatives considered
- **Persistent global world.** Rejected by the owner: pieces should not outlast
  the curriculum. It also carried the moderation, privacy, and cold-start costs
  that made ADR 0026 §5 uncomfortable.
- **Certificates by attendance.** Rejected: worthless to the buyer, and it would
  contradict the thesis that leadership is measured rather than asserted.
- **Achievements as the enterprise artifact.** Rejected: they are gameable by
  design; that is acceptable for play and disqualifying for assessment.
