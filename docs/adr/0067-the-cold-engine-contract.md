# ADR 0067 — The cold engine contract: an evaluation is a function of the position

- **Status:** accepted (2026-08-28) — owner ruled cold ("ok, I guess cold").
  The engine's carried search state is cleared before every search, so an
  evaluation depends on the position and nothing else. Committed Lozza
  calibration numbers were taken warm and are re-baselined.
- **Refines:** ADR 0017 (the evaluation cache), ADR 0034 (the per-ply query
  barrier), ADR 0005 (depth-limited search only, never wall-clock)
- **Answers:** **D171**.

## Context

Everything above the engine assumes an evaluation is a pure function of
`(position, depth, evalProfile, determinismId)`. The cache says so in as many
words — "a warm entry must produce a bundle byte-identical to a cold one"
(`src/engine/cache.ts:4-9`) — and the query barrier goes to some length to fix
issue *and* collection order so that pool scheduling cannot leak into a result
(`src/engine/round.ts:26-31`).

A real engine is not that function. Lozza runs as one long-lived child process
with a 16 MB transposition table (`src/engine/adapters/lozza.ts:14-21,99-106`),
and the handshake sends `ucinewgame` exactly once, at startup
(`src/engine/uci.ts:299-310`). Every subsequent search therefore begins with
whatever the previous searches left in the table. The answer to "what is this
position worth at depth 4" depends on what was asked before it — which is
precisely the dependency the cache key denies.

Today this is papered over by two defaults that both mean *never*: the ladder
cache is unbounded and the child is never recycled
(`DEFAULT_LOZZA_LADDER_CACHE_CAPACITY` and
`DEFAULT_LOZZA_RECYCLE_AFTER_SEARCHES`, both `Number.MAX_SAFE_INTEGER`). That
makes a run reproducible only if it is replayed as the identical sequence of
searches from process start, and it caps two things the programme needs:

- **Long campaigns.** Never evicting and never recycling means the adapter's
  memory grows for the life of the run, so a hundred-match Lozza campaign is a
  bet rather than a plan.
- **Replay and counterfactual forks** — the point of ADR 0062's journal. A fork
  starts mid-campaign and cannot reproduce the search history that warmed the
  table, so either its engine answers differ from the parent's (and a psychology
  effect cannot be told apart from a table artifact), or the engine must be cold
  at the fork's first query and the parent's numbers must have been taken cold
  too.

### What is actually carried, in the vendored artifact

This matters because it decides how expensive "cold" is. Reading
`vendor/lozza/lozza.cjs`:

- The **transposition table** is the only state that survives a search.
  `ucinewgame` dispatches to `newGame()`, which calls `ttInit()` and clears the
  entry types and moves (`vendor/lozza/lozza.cjs:1145-1149,2857-2862`).
- **Killer moves and the history heuristic are already cleared per search**, not
  per game: the `position` command runs `initNode` over every node and refills
  `objHistory` with its base value
  (`vendor/lozza/lozza.cjs:2882-2883,3066-3067`).

So a cold search does **not** require respawning the process. Sending
`ucinewgame` before each `position`/`go` pair is sufficient, and the expensive
option — dispose and re-spawn per query — buys nothing this engine needs.

## Decision

**Cold.** The adapter clears the engine's carried state before every search, so
`evaluate(fen, depth)` is a function of its arguments alone.

1. **`ucinewgame` before every search.** `UciEngine.searchLadder` issues
   `ucinewgame` (and waits for readiness) ahead of `position fen …` / `go depth
   N`. This is the mechanism; process recycling stays available as the blunt
   fallback but is not the contract.
2. **The policy is part of the determinism identity.** `determinismId` currently
   encodes build, artifact hash, hash size, threads and MultiPV widths
   (`src/engine/adapters/lozza.ts:201-210`) but not whether the engine was cold.
   It must, or a cache — or a committed CSV — can serve a warm value under a
   cold key. A run under a different policy is a different engine.
3. **Bounded resources become legal.** With cold searches the ladder LRU may be
   bounded without changing results, because an eviction can only cost a
   re-search, never change one. The unbounded default exists solely because
   eviction was unsafe under warm state; bounding it is what makes a long
   campaign a plan rather than a bet. The capacity itself is a memory/latency
   choice, not a correctness one.
4. **Committed Lozza evidence is re-baselined, not reinterpreted.** Every
   Lozza-engine number in `docs/calibration/` was taken warm. They are not
   comparable to cold runs and must not be quoted alongside them. Fake-engine
   evidence is unaffected — it has no carried state — which is most of the
   committed corpus, including the D164/D166/D167 measurements.

### What this costs

Search time. Discarding the table between searches removes reuse both within a
ply (pieces at different depths on the same position) and across plies. The
in-process evaluation cache (ADR 0017) absorbs the first of those — identical
`(fen, depth, evalProfile)` requests at a barrier are still served once — so the
loss is table reuse across *different* queries, which is the part that was never
safe to keep.

The magnitude is measured, not guessed:
`docs/calibration/2026-08-29-the-cold-engine-and-the-runaway.md` puts it at
**+13% to +61% per ply** across two conditions. Per *match* is not the honest
measure — cold changes the engine's answers, so a cold campaign plays a
different game and a per-match total mixes speed with workload. Peak RSS is flat
to slightly lower cold (132–135 MB against 136–140 MB), because the ladder LRU
is now bounded, which is what answers the long-campaign memory objection. If
cold proves too slow for the campaign lengths the journal needs, the answer is a
smaller depth cap or fewer matches — not a warm engine, because a fork that
cannot be trusted is not worth the compute it saves.

### Acceptance test

A determinism probe that fails if the contract is violated: the same position
evaluated after a deliberately divergent search history must produce a
byte-identical bundle to the same position evaluated first thing. Under the old
default that probe is expected to fail, which is the point — it is the evidence
that the problem was real, and it is why the probe is worth more than a golden.

### What the first cold run found instead: a runaway search in the vendored engine

Two of the planned cold runs did not finish. The Lozza child died of heap
exhaustion at `Q1b1k3/8/8/4pP2/2pP3B/8/P1P2PPP/RN1QKBNR w KQ - 0 16` (seed 7,
`tyrannical`) and at `6Q1/2k1n2Q/8/p2P1P2/P3P3/8/8/RNBQK1NR w KQ - 1 32`
(seed 11, `tyrannical`).

This is **not** caused by cold search. Driving a raw `vendor/lozza/lozza.cjs`
child with no adapter involved, a single `go depth 4` at that position never
terminates: the aspiration-window loop in `go()`
(`vendor/lozza/lozza.cjs:1080-1098`) spins at depth 1 re-reporting
`score mate -500 lowerbound … pv a8c8` and allocating until the heap dies.
It reproduces identically at `MultiPV 1` and `MultiPV 8`, and identically warm
and cold. Cold only changed the game line so that this campaign walked into the
position.

So the engine has positions at which it does not return, which is a hazard for
the whole calibration programme rather than for this contract — a campaign can
die at any ply, and a depth-limited search is supposed to be the thing that
cannot run away. Two properties make it tractable: it is deterministic (the same
FEN always explodes, so it is discoverable and testable), and the obvious fix is
a patch to the vendored artifact — which changes the artifact hash and therefore
`determinismId`, i.e. a re-baseline, which D171 is already paying for. Whether to
patch a vendored engine is an owner call and is opened as **D172**; it is
deliberately not smuggled into this ADR.

## Consequences

- ADR 0062's counterfactual forks become meaningful: a fork entered mid-campaign
  and its parent ask the engine the same question and get the same answer.
- Resume becomes honest for the same reason — a resumed campaign is a fork of
  itself.
- The nightly Lozza calibration job produces numbers that can be compared across
  runs and across machines, which warm numbers never could.
- Any future adapter inherits the contract: an engine that cannot be made cold
  cannot be used for calibration, only for play.
- The cold/warm cost comparison is reported on conditions that do not reach the
  runaway position, and the seed-7 `tyrannical` condition cannot be re-baselined
  until D172 is ruled.

## Alternatives considered

- **Warm but declared** — keep the carried state and define a campaign as
  reproducible only from ply 0. Rejected by the owner. It is cheaper and
  strictly weaker: forks and resume stay uncomparable, and every future
  divergence has two candidate explanations.
- **Recycle the child process on a fixed boundary.** Rejected as the primary
  mechanism: `ucinewgame` clears everything Lozza carries
  (`vendor/lozza/lozza.cjs:1145-1149`), so respawning pays process startup for
  no additional guarantee. Retained as an opt-in for adapters that carry state
  `ucinewgame` does not clear.
- **Keeping a bounded warm table and hashing it into `determinismId`.**
  Rejected: the table's contents depend on search order, so the identity would
  have to encode the entire history — which is the same as having no identity.
