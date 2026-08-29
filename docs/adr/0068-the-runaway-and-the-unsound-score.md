# ADR 0068 — The runaway and the unsound score: no engine gets to hang us, and no engine gets to be believed

- **Status:** accepted (2026-08-29). The owner authorised the upstream report and
  the carried patch ("Go ahead, proud to be the name on good work"). The
  score-soundness rule below is the author's ruling on the same evidence and is
  reversible.
- **Refines:** ADR 0005 (depth-limited search only, never wall-clock), ADR 0020
  (the narrow engine port), ADR 0034 (the per-ply query barrier), ADR 0067 (the
  cold engine contract)
- **Answers:** **D172**.

## Context

Measuring the D171 cold contract found two positions where a single `go depth 4`
against a raw `vendor/lozza/lozza.cjs` child — no adapter involved — never
returns, and the child dies of heap exhaustion:

```text
Q1b1k3/8/8/4pP2/2pP3B/8/P1P2PPP/RN1QKBNR w KQ - 0 16
6Q1/2k1n2Q/8/p2P1P2/P3P3/8/8/RNBQK1NR w KQ - 1 32
```

It reproduces at `MultiPV` 1 and 8, warm and cold alike, and it reproduces
against the current upstream head, which is the same `BUILD = "11"` we vendor.
It is therefore an engine bug, not a harness artifact, and it is reported
upstream as `namanthanki/lozza#4` (the canonical `op12no2/lozza` now redirects
there).

Three things were established by measurement, and each one rules out an
otherwise attractive answer.

**1. The aspiration loop cannot terminate once the window is maximal.** In
`go()`, the widening step is `beta = Math.min(INF, beta + delta)`. Once `beta`
has reached `INF` and the search keeps returning a score `>= beta`, widening is
a no-op, `depth = Math.max(1, depth - 1)` pins the depth at 1, and the loop
re-searches and re-reports forever. Refusing to re-search a window that cannot
be widened is a two-line change and leaves Lozza's own `bench` unchanged at
`613926` nodes.

**2. The deeper defect is that a root search returns `INF` at all, and our
parser believed it.** `INF` (32000) is not a score; it is above `MATE` (31000).
`report()` renders it as `score mate -500`, and `parseScoreCp`
(`src/engine/uci.ts:74-85`) dutifully turns that into `-29_500` — a plausible
*losing* score for a position that is in fact a forced win in three, so the sign
is inverted from the truth. The existing `mate 0 → 29_999` special case
(`src/engine/uci.ts:79-82`), documented as "an immediate forced mate", is the
same sentinel seen from the other side: a mate distance of zero is not a
distance, and at the first position above `go depth 3` reports `mate 0` for what
is really mate in three. So the corruption is not loud — it arrives as an
ordinary number, in the one channel (`scoreCp`) that the audit trail, the
opponent policy, and every derived psychology signal treat as truth.

With the loop guard applied, both positions return the correct move in under
100 ms at every depth tried, but the *score* is only sound from depth 5 (first
position) and depth 4 (second). Tracing the `INF` back reached a child
`search()` that already returns `INF` with legal moves available; the origin is
further down and is left to upstream.

**3. A node budget is an escape hatch, not a contract.** Lozza honours
`go depth N nodes M`, and `nodes 20000` does turn both positions from "never
returns" into a return with the same best move. But its hard net fires only at
`statsNodes >= statsMaxNodes * 100` while each runaway lap adds ~3 nodes and
prints a line, so escape costs ~666k `info` lines and ~450 MB RSS; and the soft
net stops *deepening*, so a budget low enough to be cheap would silently
truncate honest deep searches. Node counts are machine-independent and therefore
replayable, but a budget that can bind is a budget that changes answers.

## Decision

1. **Carry a minimal patch to the vendored artifact.** Two conditions on the
   aspiration loop, so a maximal window is never re-searched. The patch is
   recorded as a diff under `vendor/lozza/patches/` so an upstream bump can
   re-apply or drop it, the MIT copyright and permission notice stay in the
   file, and the artifact hash — already part of `determinismId`
   (`src/engine/adapters/lozza.ts:212-222`) — separates patched from unpatched
   evidence automatically. Lozza is MIT (`vendor/lozza/LICENSE`), so this is the
   permissive half of the licensing strategy and carries no AGPL/commercial
   consequence; the cost is maintenance, which the recorded diff bounds.
2. **A score must prove itself sound before it leaves `engine/`.** A reported
   mate distance of zero, and any mate distance too large to be a real distance
   in a fixed-depth search, are engine unsoundness, not evaluations. The
   response is deterministic and pure in `(position, depth)`: re-search the same
   position one ply deeper, at most twice, and take that evaluation as the value
   for the requested depth; if it is still unsound, fail loudly. The escalation
   policy is part of `determinismId`, because it changes what the port returns.
   The `mate 0 → 29_999` special case is withdrawn: it was a hand-wave over this
   bug.
3. **Keep a deterministic runaway guard in the adapter, as a hard failure.** A
   ceiling on the output a single search may produce (`info` lines), never a
   wall-clock timeout and never a node budget that can bind. Exceeding it throws;
   it does not truncate. Truncation buys silence at the price of making every
   future engine's pathology invisible, and a campaign that dies loudly is worth
   more than one that quietly returns a shallower answer.

**Rejected.** A node budget as the search contract (see finding 3). Truncating a
runaway to whatever it had reported (a different answer, presented as the
answer). Clamping an unsound mate score into range (the sign can be wrong, so
clamping fabricates a confident lie). Routing around the two positions
(leaves campaigns that cannot be run, and the next such position is unknown).

## Consequences

- Long Lozza campaigns become runnable, which unblocks the seed-7 `tyrannical`
  re-baseline that ADR 0067 left blocked.
- Lozza evidence taken before this ADR carries a different artifact hash and
  must not be quoted beside evidence taken after it.
- Any position whose score needs escalation costs one or two extra searches;
  this is a latency cost only, and it is recorded rather than hidden.
- The guard's ceiling is a knob and therefore needs a sensitivity probe: a
  search that exceeds it must fail, and an ordinary search must never approach
  it.
- Fake-engine evidence is unaffected: the fake engine reports neither mate
  scores nor runaway output.
- Implementing the escalation exposed a **larger, pre-existing** hazard, raised
  as **D173** rather than settled here: the adapter and the broker serve a
  shallow query from a deeper search's ladder rung, and a rung is measurably not
  the same value a standalone search at that depth would give. Escalation is kept
  out of it — an escalated search neither reads nor writes the ladder cache and
  memoizes its own result, with an order-invariance probe — but the reuse rule
  itself is a purity claim that does not hold, and it is an architecture decision,
  not a patch.

## Addendum (2026-08-29): `mate 0` was two different things, and one of them was legal

The ruling above shipped and immediately failed at the first thing it was
supposed to unblock. Both re-baseline campaigns died within the first few dozen
insight rounds, not at the poison positions but at ordinary ones:

```text
UciUnsoundScoreError: Unsound engine score mate 0 for FEN
rnbqkbnr/ppppp2p/8/5pp1/P3P3/8/1PPP1PPP/RNBQKBNR w KQkq - 0 3 at depth 4 after 2 escalations
UciUnsoundScoreError: Unsound engine score mate 0 for FEN
3rkr2/1p3R2/2p3p1/p3P3/P1P1n1b1/8/R7/1N2KBN1 b - - 2 17 at depth 4 after 2 escalations
```

The returned moves — `d1h5` and `d8d1` — are **checkmate**, verified on the board
rather than inferred. So `mate 0` was never only the `INF` sentinel: it is also
how this engine renders a mate in one, which is among the most common decisive
results in ordinary play. Deepening cannot cure it, because there is nothing
wrong with it, so the escalation ladder exhausted and the campaign died on a
correct answer. Withdrawing the `mate 0 → 29_999` case was right about the
sentinel and wrong about the token: two causes were sharing one symbol, and the
first ruling read the symbol.

**The cause is a second defect in the same function.** `report()` renders

```js
let mateScore = ((MATE - Math.abs(score)) / 2) | 0;   // floor(ply / 2)
```

With `score = MATE - ply`, that is `floor(ply/2)`: mate in one (`ply = 1`) prints
`mate 0`, mate in three prints `mate 2`. Every mate distance this engine reports
is one short, and the error lands exactly on the value the out-of-range scores
also produce. The correct UCI distance is `ceil(ply/2)`, which is the same
expression plus one:

```js
let mateScore = ((MATE - Math.abs(score) + 1) / 2) | 0;
```

**Decision.** Extend the vendored patch to correct the rendering at both report
sites, and keep the soundness contract exactly as ruled above. This is preferred
to relaxing the classifier because it removes the ambiguity at its source rather
than choosing a side of it: after the fix a genuine mate always renders
`|mate| >= 1`, while the out-of-range values still render outside the plausible
band (`31001 → mate 0`, `INF = 32000 → mate -499`). `mate 0` therefore keeps
meaning "unsound", and now means *only* that. Accepting `mate 0` instead would
have restored the original hazard in full: a forced win reported as `-29_500`,
arriving silently in the one field the audit trail treats as truth.

**Consequences beyond the first ruling.**

- Reported mate distances shift by one for every mating line, so mate-derived
  scores in the calibration corpus change by one ply's worth. This is a
  correction, not a re-tuning, but it is an artifact-identity change like the
  first patch and separates evidence the same way.
- `bench` remains `613926` nodes: rendering is output-only.
- The regression that merged code failed — a mate in one must be *sound* — is now
  a probe, and it is the cheap test that was missing. The first ruling was
  measured only against the two positions that provoked the runaway, so it
  learned the pathological reading of a token and never met the ordinary one.
- The rendering fix has not been reported upstream: the integration account that
  filed `namanthanki/lozza#4` cannot comment on it.

## Addendum 2 (2026-08-29): the mate scores were never mates, and the band belongs to the engine

The rendering fix let the campaigns run further and they died again, three times,
each time on a *different* class of score: `cp 29991`, `cp -28497`, `cp 21349`,
`cp -24782`, `mate 354`, `mate -297`, `mate 500`. Two corrections came out of
chasing them, and the second makes the first unnecessary.

**A plausibility bound argued from material was wrong.** The first response was
to reject centipawn scores past `20_000`, on the reasoning that honest material
cannot reach 200 pawns. The engine refuted it. Measured over depths 1–12:

```text
8/4n2p/4p2k/p3Qpp1/P2PPPPP/8/8/RNBQK1NR b KQ - 1 23
  -12826  -14775  -17002  -20112  -20535  -21560  -24782  -29557  mate -5
r7/5k2/5P2/RPP3P1/2P1P2P/8/3B1P2/1N2KBNR w K - 1 24
  cp 20727 / 21191 / 21372 at every depth, always a5a8
```

That series is monotone, stable in its move, and converges on a real mate: these
are the engine's honest evaluations of grotesquely lopsided positions, where its
own terms pile up far past what a material argument allows. A bound chosen from
outside the engine rejects truth. The bound is therefore the engine's own:
`MINMATE = 30000`, above which it renders a score as a mate by definition.

**The mate tokens were the same phenomenon, not a mate at all.** Printing every
`info` line for the position the campaign died on shows what escalation could
never fix:

```text
Q1b2k2/8/8/2p1pP2/3P3B/8/P1P2PPP/RN1QKBNR w KQ - 1 16, MultiPV 8, go depth 5
  d1 cp 28386   d2 cp 29880   d3 mate 354   d4 mate 349 lb   d5 mate 500 lb
```

The static evaluation here is ~29 880–29 991 — just under `MINMATE`. `netEval` is
unbounded, so as soon as the aspiration window widens past 30 000 the search
returns *ordinary evaluations inside the mate band*, and `report()` renders them
as mates. `mate 354`, `mate 349`, `mate 500` are evaluations, not distances. This
also explains what looked inexplicable: the corruption was stable under
deepening (so no ladder of re-searches could cure it), and `MultiPV 1` and
`MultiPV 8` disagreed on the same position at the same depth, because the window
differs.

**Decision.** Extend the vendored patch a third time, clamping the static
evaluation so it cannot enter the mate band:

```js
const MAXEVAL = MINMATE - 1;
// in evaluate(), around netEval()
if (ev > MAXEVAL) return MAXEVAL;
if (ev < -MAXEVAL) return -MAXEVAL;
```

With it applied the position above reports `cp 29999` with a sane PV at every
depth from 1 to 8, `bench` is still exactly `613926` nodes (the clamp never binds
on ordinary positions), and the mate-in-one probes still report `mate 1`. This is
the root cause of all three symptom classes in this ADR's history, including the
original `INF` leak: a score that is not a mate had been free to occupy the mate
range.

**Consequences.**

- `MAX_PLAUSIBLE_CENTIPAWNS = 30_000` is now correct *by construction* rather
  than by taste: a clamped evaluation cannot reach it, so any `cp` at or above it
  is out of band by the artifact's own definition.
- The escalation ladder survives but is no longer load-bearing for these
  positions: both re-baseline campaigns now complete with
  `score_escalations=0`. The allowance is four searches — headroom that costs
  nothing when nothing is unsound. The classifier still rejects `mate 0`,
  `mate 354` and `cp >= 30_000` even though the patched artifact no longer emits
  them, because the contract is about what we will believe, not about what this
  build happens to produce.
- Three of the four earlier symptom classes were misdiagnosed as separate
  hazards. That is the cost of ruling from the positions that happened to fail:
  each ruling was measured, each was locally right, and only reading every
  `info` line of a failing search showed the single cause underneath.
- The clamp is not reported upstream yet; it belongs in `namanthanki/lozza#4`
  alongside the rendering fix.
