# Engine

Engine ports and workers live here. Nothing outside this layer may learn which
engine exists (ADR 0020), and results leave it only through the per-ply query
barrier (ADR 0034).

Landed (Milestone 1.3 / 1.3b / 1.3c):

- `EnginePort`, the barrier, the evaluation cache, and the round digest
- Lozza MIT adapter (`adapters/lozza.ts`) + conformance corpus
- Stockfish.js 18 lite-single WASM pool (`adapters/stockfish.ts`)
- Shared-search / private-scoring broker (`broker.ts`, ADR 0017)

```ts
const requests = buildInsightRound({ fen, seats });        // pure, PieceId-ordered
const bundle = requireComplete(
  await resolveInsightRound(port, requests, { round: 0, cache }),
);
// only now may psychology run — synchronously, iterating bundle.insights
```

Pinned Stockfish build: npm `stockfish@18.0.8` (GPL-3.0), flavor
`stockfish-18-lite-single`, `Hash=16`, `Threads=1`, shared search at
`D_max=16`. Determinism id:
`stockfish-js-18-lite-single/hash-16/threads-1/dmax-16`.

Rules this layer enforces rather than documents:

- **The round is a pure function of the position.** No query may be issued
  because of another query's answer; a genuine dependency opens round _n+1_.
- **Await everything.** `Promise.race`, `Promise.any`, `setTimeout`, and `.now`
  are lint errors here — a ply that proceeds on the first result back is
  hardware-dependent.
- **Failures are ordered facts.** A failed query becomes an `InsightFailure` in
  `PieceId` order; `requireComplete` then aborts the ply. Fifteen pieces never
  decide without the sixteenth, and which piece was lost is never machine-
  dependent.
- **The cache changes latency, not values.** Keyed
  `(determinismId, fen, depth, evalProfile)`; stored evaluations are frozen and
  shared, so a caller cannot mutate one and rewrite a later replay.
- **Draw randomness after the barrier.** The PRNG stream position is shared
  state; consuming it as results arrive diverges even when every piece saw the
  right insight (ADR 0034 §7).

The true `D_max` evaluation may be collected here for the audit path
(`SharedSearchBroker.evaluateTrue`), and travels to `orchestration/` only —
never into the bundle psychology reads (ADR 0013). It is not persisted into the
event log while D50 remains open.
