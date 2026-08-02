# ADR 0026 — A community of pieces: capture is never permanent, exhaustion is

- **Status:** accepted in principle; the infrastructure tier (§5) is **proposed**
- **Resolves:** **D69** (what "taken" means at world scale), **D70** (pieces as
  community entities with free agency), **D71** (retirement as the only
  permanent loss), **D73** (replay verification), **D74** (AI as bootstrap)
- **Opens:** **D72** (which infrastructure tier ships) — reverses part of D13
- **Refines:** ADR 0006 (no permadeath), ADR 0009 (roster), ADR 0023 (career),
  ADR 0025 (the opponent)

## Context

> **"We are asking the fundamental question of what happens when a piece is
> 'taken.' We should optimally be envisioning a community of players with a
> community of pieces; any AI opponent is really just a stand-in for calibration
> or bootstrapping."**

Everything to date treats the roster as belonging to one save file. If pieces are
instead persistent members of a shared world, capture must be answered at world
scale, and reputation stops being a number inside a save.

## Decision

### 1. Capture is never permanent; exhaustion is (D69, D71)
A captured piece loses the match, gains trauma, and remembers **who took it** and
**who spent it**. ADR 0006 stands: no commander can destroy a piece.

What a shared world adds is that **the trauma pool is common property**.
Accumulated across all commanders it eventually produces **retirement**: the
piece declines every commander, permanently, and leaves the world.

> No single leader kills a piece. Every careless one contributes, and the
> community loses it collectively.

Leadership failure becomes a **tragedy of the commons** — the strongest statement
available in this design, and one that cannot exist in a single-player roster.

### 2. Pieces are free agents, not property (D70)
Between engagements a piece may **decline** a commander. Recruitment is mutual.

Reputation therefore becomes a **market position** rather than a save-file
scalar: the good pieces go to leaders who bring them home. The end of a bad
career is not the King's dismissal but **nobody taking your calls** — which
subsumes ADR 0023's career-terminal state under a mechanism the community
enforces rather than the fiction.

### 3. You are taken by people you know
Affinity crosses rosters. The rook that captures a piece may be one it served
beside for three campaigns, and a piece may respect an opposing commander who
took it cleanly while despising the one who spent it.

Consequently `PieceState` carries credence in **commanders it has never served**,
formed through the rumor channel and through being on the receiving end of their
orders — which the two-channel model (ADR 0019) already expresses without change.

### 4. AI commanders are permanent market infrastructure (D74)
AI leaders are not only calibration stand-ins. They populate the market at cold
start so pieces have histories and opinions before there is a second human, and
they must **never be removed**: a thin market is what kills a game of this shape
in month two.

### 5. Infrastructure ladder — this reverses part of D13 (D72, open)
Offline-first with no accounts and no backend cannot host a shared registry. The
reversal is recorded rather than buried. Cheapest first:

| Tier | What it is | Cost |
|---|---|---|
| **1. Passports** | Pieces export as signed files and travel between players by hand. Offline intact, no server, no moderation, no cold-start problem | low |
| **2. Registry** | A thin service owning identity, the free-agent market, and retirement. Matches still run locally | medium |
| **3. Authoritative world** | Everything server-side | high; not recommended |

**Recommendation: ship tier 1, design the schema for tier 2.** Piece identity,
provenance, and retirement state must be serializable and portable from day one.

### 6. Determinism becomes anti-cheat (D73)
A match is a seed plus an event log, so a registry can **replay-verify** any
submitted result rather than trusting or re-simulating it. This is the point at
which the deterministic-core rule (ADR 0002, ADR 0005) starts paying a dividend
instead of costing convenience — and it is the reason tier 2 is viable at all.

Replay verification requires the `determinismId` from ADR 0020 (engine, version,
settings) in every `MatchRecord`; results whose engine identity is unrecognized
are unverifiable and must be rejected rather than trusted.

## Consequences

**Retirement is a world event.** It needs an epilogue, a public record of which
commanders contributed, and an effect on those commanders' standing — otherwise
the commons has no feedback and the externality is free.

**New degeneracy detector — free commons.** Trauma accumulates but retirement
never fires, or retirement fires without measurably affecting any contributing
commander's ability to recruit. Then the tragedy of the commons is decoration.

**New degeneracy detector — captive labour.** Pieces effectively cannot decline a
commander (decline rate ≈ 0 even for the worst policies), so free agency is
nominal and reputation has no market consequence.

**New degeneracy detector — thin market.** Recruitment pools that collapse below
a viable size, or in which AI-commanded identities are absent, reproducing the
month-two failure mode in the harness.

**Moderation and privacy** enter scope at tier 2 (identity, names, shared
history) and are the real cost of that tier — larger than the engineering.

**Single-player must remain whole.** A player with no network sees a world
populated entirely by AI commanders and loses no mechanic. This is a hard
requirement, not a fallback.

## Alternatives considered
- **Capture as permanent loss.** Rejected: it contradicts ADR 0006, makes
  attrition the dominant strategy, and replaces a psychological game with an
  economic one.
- **Pieces as owned property.** Rejected: without the right to decline,
  reputation has no teeth and the market cannot punish anything.
- **Authoritative server.** Rejected for now: cost and moderation burden, and
  replay verification makes it unnecessary.
- **AI opponents removed once a player base exists.** Rejected: the market is
  what makes the world feel populated, and it is thinnest exactly when the game
  is newest.
