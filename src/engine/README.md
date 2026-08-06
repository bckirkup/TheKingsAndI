# Engine

Engine ports and workers live here. Nothing outside this layer may learn which
engine exists (ADR 0020), and results leave it only through the per-ply query
barrier (ADR 0034).

Landed: the port, the barrier, the Lozza MIT adapter (`adapters/lozza.ts`),
the UCI client, and the conformance corpus (Milestone 1.3b). Not yet written:
the stockfish.wasm pool and the shared-search / private-scoring broker
(Milestone 1.3).

```ts
const requests = buildInsightRound({ fen, seats });        // pure, PieceId-ordered
const bundle = requireComplete(
  await resolveInsightRound(port, requests, { round: 0, cache }),
);
// only now may psychology run — synchronously, iterating bundle.insights
```

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

The true `D_max` evaluation may be collected here for the audit path, and travels
to `orchestration/` only — never into the bundle psychology reads (ADR 0013).
