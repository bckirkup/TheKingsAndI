# ADR 0069 — The canonical ladder rung: the rung is the value

- **Status:** accepted (2026-08-29) — owner ruled D173: the depth-`d` rung
  of a deeper search is the canonical value for `(position, d)`.
- **Refines:** ADR 0017 (the evaluation cache), ADR 0034 (the per-ply query
  barrier), ADR 0067 (the cold engine contract)
- **Depends on:** ADR 0034 (fixed `PieceId` barrier order)
- **Answers:** **D173**.

## Context

The Lozza adapter and shared-search broker cache one ladder per FEN and reuse
it whenever its `maxDepth` covers a requested depth
(`src/engine/adapters/lozza.ts:327-333`, `src/engine/broker.ts:139-149`).
That shared ladder is what lets one search serve every piece's depth. It is
also not equivalent to a set of standalone searches: over five ordinary
positions, 17 of 18 rungs matched and one did not. At depth 3 for

`2r3k1/p4p2/3Rp2p/1p2P1pK/8/1P4P1/P3Q2P/1q6 b - - 0 1`

the standalone search returned `cp 461 … e2b5`, while the rung of a depth-6
search returned `cp 464 … e2d3`. Iterative deepening warms its own table and
windows within one search, so the first ladder depth for a FEN is
answer-significant.

The two pure alternatives are expensive in different ways. Keying by
`(fen, searchDepth)` multiplies engine calls by the number of distinct depths a
roster asks for, with `D_i` spanning `MIN_SEARCH_DEPTH=2` through
`MAX_SEARCH_DEPTH=16`. Always searching at `D_max` makes every pawn's shallow
query pay `D_max`. The current reuse path is cheaper, but its honest contract
must be stated rather than pretending that a rung is a standalone search.

## Decision

**The rung is the value.** A request for `(position, depth)` receives the rung
from the first deeper ladder search that covers that depth. The reuse path is
unchanged; the policy is now explicit and versioned.

1. **Identity.** `ladder-rung-canonical` is part of the Lozza and Stockfish
   `determinismId` values (`src/engine/adapters/lozza.ts:247-248`,
   `src/engine/adapters/stockfish.ts:27-30`). The fake engine evaluates
   directly by `(fen, depth)` and has no ladder reuse, so it does not carry the
   token.
2. **Bounded broker caches.** `sharedByFen` and `bestByFenDepth` use the
   existing `LruCache` with `ladderCacheCapacity`
   (`src/engine/broker.ts:125-129`). Under the cold contract, eviction costs a
   re-search and cannot change a result. The transient `inflight` map is not a
   result cache and remains a map for request coalescing.
3. **Fork obligation.** When ADR 0062's journal and fork machinery is built, a
   fork must replay the parent's per-piece `D_i` and ladder search depths, not
   merely its positions and seeds. The `PieceId` barrier order fixes which
   depth runs first within a run, but different rosters can request different
   first depths.

The `(fen, searchDepth)` and always-`D_max` alternatives are rejected for the
costs above. If the fork programme later proves canonical rungs intolerable,
the escape is always `D_max` plus a re-baseline.

## Consequences

- The value returned for `(position, depth)` depends on the first ladder search
  depth for that FEN, and that policy is now visible in engine identity.
- Bounded `sharedByFen` and `bestByFenDepth` prevent long-run per-position
  growth; a cold re-search after eviction preserves the result.
- A future journal/fork can remain reproducible only if it records and replays
  the parent's per-piece depths and ladder search depths.
- Fake-engine calibration remains unchanged because it has no ladder state or
  ladder reuse.
- D172's score escalation stays outside this policy: an escalated search neither
  reads nor writes the ladder cache and memoizes its own result
  (`src/engine/adapters/lozza.ts:363-386`), with an order-invariance probe in
  `tests/engine.d172.test.ts`.

## Alternatives considered

- **Key by `(fen, searchDepth)`.** Rejected: it multiplies engine calls by each
  distinct depth requested by a roster across `MIN_SEARCH_DEPTH=2` through
  `MAX_SEARCH_DEPTH=16`.
- **Always search at `D_max`.** Rejected for now: every pawn's shallow query
  pays `D_max`; it remains the escape if fork replay later proves canonical
  rungs intolerable, with a full re-baseline.
