# ADR 0034 — The per-ply query barrier: engine results are ordered facts, never arrivals

- **Status:** accepted (2026-08-03); resolves **D48**
- **Depends on:** ADR 0005 (fixed depth), ADR 0013 (own view), ADR 0017 (shared
  search, private scoring), ADR 0020 (`EnginePort`)
- **Related:** `docs/architecture.md` §3, Milestone 1.3c in
  `docs/development_plan.md`

## Context
ADR 0017 has every piece consult the engine pool each ply, and `EnginePort`
(ADR 0020) is asynchronous. Sixteen promises per side resolve in whatever order
the pool, the cache, and the host CPU produce, and that order is not a property
of the game — it is a property of the machine. Anything downstream that can
observe it makes replay hardware-dependent.

This is the decision whose absence would be most expensive to diagnose rather
than most expensive to fix. A divergence appears as a piece refusing an order it
obeyed on the previous run: the symptom is in `psychology/`, the cause is a race
in `engine/`, and the golden test that fails names neither. Careers persist
rosters, seminar worlds share seeds across participants' machines (ADR 0028), and
the transcript is evidence about a person (ADR 0030) — a replay that is merely
*usually* identical is not evidence.

The register's recommendation was "issue all queries, collect, sort by
`PieceId`, then run psychology." That is right and insufficient: ordering the
results is only one of four ways arrival order leaks.

## Decision
One rule, stated negatively because that is how it will be reviewed: **no value
derived from arrival order may reach `psychology/`, and no observable may depend
on when a query returned.** Concretely, a *barrier* per ply per side.

### 1. The barrier
```ts
// engine/ — the only async surface orchestration/ may call during a ply
async function resolveInsightRound(
  round: InsightRequest[],            // deduplicated, sorted by (pieceId, depth)
): Promise<InsightBundle>;            // frozen, keyed and iterated by PieceId

interface InsightBundle {
  readonly round: number;             // 0-based; see §3
  readonly determinismId: string;     // ADR 0020
  readonly digest: string;            // canonical hash of the ordered bundle
  readonly insights: readonly Insight[];        // sorted by PieceId, total
  readonly failures: readonly InsightFailure[]; // sorted by PieceId
}
```
`resolveInsightRound` awaits **every** query in the round, then sorts, then
freezes, then returns. Psychology runs on the frozen bundle and is synchronous
throughout — a reducer never holds a `Promise`, so it cannot await, and a
reducer that cannot await cannot see a race. Steps 4 and 6 of the move pipeline
stay exactly as `docs/architecture.md` §3 describes them: pure functions of
`(state, move, insight, seed)`.

Requests are issued in `PieceId` order as well as collected in it. Ordering only
the results leaves the *pool's* internal scheduling — which query gets the free
worker, which one warms a shared transposition entry — a function of issue
order, and issue order would otherwise be whatever `Map` iteration gave us.

### 2. The request set is a pure function of the position
`round(state, side, ply)` is computed before any query is issued and is
reproducible from the replay log alone. A query may not be issued *because of*
another query's answer within a round; that is the same leak wearing a
disguise, since "which queries existed" would then depend on which returned
first.

### 3. Genuine dependency becomes a numbered round, not a callback
If a later phase truly needs a query informed by an earlier answer, it opens
**round *n+1*** with its own barrier, after round *n* has closed and been
digested. Rounds are numbered in the event log. Two barriers are cheap; one
adaptive barrier is a bug we would find in a seminar.

### 4. Banned constructs in `engine/` and `orchestration/`
`Promise.race`, `Promise.any`, `Promise.allSettled` used to proceed without a
laggard, wall-clock timeouts, `setTimeout`-based deadlines, per-query
cancellation, and "first result wins" caches. ESLint owns this list, not review
attention (ADR 0033 §4). `Promise.all` is fine and is the point.

Cancellation is legal at exactly one granularity: abandoning an entire ply
(match aborted, window closed). An abandoned ply emits no events, so it cannot
diverge.

### 5. Failure is a recorded fact, not a gap
An engine failure produces an `InsightFailure` in the bundle, ordered like any
insight. The barrier never returns a bundle that silently omits a piece: a
missing insight would change that piece's verdict, and "which piece was
dropped" is exactly the machine-dependent value this ADR exists to exclude. A
round containing failures aborts the ply deterministically — the same failure on
replay produces the same abort — rather than letting fifteen pieces decide
without the sixteenth.

### 6. The cache may change latency and nothing else
The key stays `(position, D_i, evalProfile_i, determinismId)` per ADR 0017. A
warm cache resolves instantly and a cold one does not, which is precisely the
kind of timing difference §1 makes unobservable — but only if the *values* are
identical. A cold-versus-warm bundle comparison is part of the conformance
suite (ADR 0020 §2), because a cache that mutates or shares a returned object is
the most plausible way this decision gets violated by accident.

### 7. Randomness is drawn after the barrier, in `PieceId` order
The subtle one, and the reason ordering the bundle is not enough on its own. The
seeded PRNG (`src/core/random.ts`) is a stream: if any reducer draws from it as
results arrive, arrival order chooses each piece's numbers even though every
piece saw the correct insight. Psychology therefore consumes the stream only
after the barrier closes, iterating pieces in `PieceId` order.

### 8. What proves it
1. **Shuffled-resolution-order replay.** A test `EnginePort` resolves a round in
   reverse order, in seeded-random orders, and with staggered delays, and the
   canonical event log must be byte-identical across all of them. This test
   ships *with* 1.3c, not after it; without it the rule is a comment.
2. **`digest` per round in the `MatchRecord`.** A canonical hash of the ordered
   bundle, recorded per ply. When a replay does diverge, matching digests and
   diverging events say "psychology"; diverging digests say "engine", and name
   the ply. This is the diagnostic the failure mode above otherwise lacks.

## Consequences
- A ply costs the *slowest* query in each round, not the average. Acceptable:
  depth is capped (ADR 0005), scoring is private but search is shared
  (ADR 0017), and the pool still runs the round concurrently — the barrier
  serializes nothing, it only refuses to proceed early.
- No progressive reveal of insights in the UI. Testimony (ADR 0018) is rendered
  from committed state anyway, so this costs an animation we had no reason to
  build; a "thinking" indicator is fine, partial insight shown as final is not.
- A slow or hung engine stalls the ply instead of degrading the verdict. That is
  the intended trade: a wrong verdict is silent and permanent, a stall is
  visible and recoverable. §5 makes the hung case an abort rather than an
  indefinite wait.
- `digest` makes an engine or settings change invalidate goldens loudly, at a
  named ply, complementing `determinismId`'s coarser signal (ADR 0020).
- The barrier is the natural home for the audit path: the true `D_max`
  evaluation is collected in the same round and travels to `orchestration/` and
  the audit only, never into the bundle psychology reads (ADR 0013).

## Alternatives considered
- **Sort at consumption instead of at the barrier.** Every future reducer would
  have to be independently order-hygienic, forever, including the PRNG
  interaction in §7. One choke point beats *n* disciplined authors.
- **Issue queries strictly sequentially in `PieceId` order.** Equally
  deterministic and simpler to reason about, but ~16× the latency per ply and it
  forfeits ADR 0017's shared search. Kept as the fallback if a pooled engine
  ever proves unable to return stable values under concurrency — the barrier's
  interface is unchanged by the swap.
- **Log arrival order and replay it.** Records the nondeterminism instead of
  removing it: live play stays hardware-dependent, so two participants in one
  seminar world with one seed can still diverge, and the log grows a field that
  exists only to paper over a race.
- **A virtual clock / deterministic scheduler across the whole app.** Strictly
  more powerful and standard in simulation work, but it makes every async call
  site a determinism-critical one. This project has exactly one async
  dependency; scoping the mechanism to it is proportionate.
