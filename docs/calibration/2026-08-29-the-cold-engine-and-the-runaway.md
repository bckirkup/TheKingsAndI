# The cold engine, and the runaway search underneath it (D171, D172)

Measurement accompanying ADR 0067. Five matches per condition, one campaign,
`--engine=lozza --depth-cap=4`, opponent default, on the D171 branch. Warm runs
use `--cold-search=false`; cold is the new default. Nothing else differs between
a warm and a cold row.

## What cold costs

| Leader | Seed | Policy | ms/ply | ms/match | plies/match | engine calls | peak RSS |
|---|---:|---|---:|---:|---:|---:|---:|
| tyrannical | 13 | warm | 117.5 | 6510.5 | 55.4 | 15097 | 135.7 MB |
| tyrannical | 13 | cold | 132.8 | 5790.3 | 43.6 | 11428 | 132.0 MB |
| exacting | 11 | warm | 130.7 | 11163.9 | 85.4 | 23546 | 140.3 MB |
| exacting | 11 | cold | 209.9 | 14401.1 | 68.6 | 19140 | 135.2 MB |

**Read `ms_per_ply`, not `ms_per_match`.** Cold changes the engine's answers, so
a cold campaign plays a different game — shorter here, 43.6 plies against 55.4
and 68.6 against 85.4 — and its per-match total is therefore partly a different
workload, not a different speed. On the comparable measure the tax is **+13% to
+61% per ply**, which is the range to plan with until more conditions are run;
the spread between the two conditions is wider than the tax itself, so a single
number would be a false precision.

Peak RSS is flat to slightly *lower* cold (132.0/135.2 MB against 135.7/140.3),
which is the expected direction: the ladder LRU is now bounded at 4096 entries
where it was unbounded. The memory objection to long campaigns is answered.

Two things this does **not** establish. The warm baseline of record — 2.82
s/match in `2026-08-13-blocked-on-measurement.md` — is not comparable to either
column (different tree, different opponent, different harness), so it is
superseded rather than beaten. And no psychological conclusion may be drawn from
the differing headlines: cold and warm campaigns are different games, and the
five-match samples here are cost measurements, not balance evidence.

## What the measurement actually found: Lozza does not always return

Two of the six planned runs never finished. Both cold runs that died did so the
same way — the engine child exhausted its heap mid-search:

- seed 7, `tyrannical`: `Q1b1k3/8/8/4pP2/2pP3B/8/P1P2PPP/RN1QKBNR w KQ - 0 16`
- seed 11, `tyrannical`: `6Q1/2k1n2Q/8/p2P1P2/P3P3/8/8/RNBQK1NR w KQ - 1 32`

**This is not caused by cold search.** Driving a raw `vendor/lozza/lozza.cjs`
child directly — no adapter, no harness — a single `go depth 4` at the first
position never returns. The aspiration-window loop in `go()`
(`vendor/lozza/lozza.cjs:1080-1098`) spins at depth 1, re-emitting

```text
info depth 1 seldepth 6 score mate -500 lowerbound nodes 4560 time 57 … pv a8c8
info depth 1 seldepth 6 score mate -500 lowerbound nodes 4563 time 57 … pv a8c8
```

with the node count crawling and the score never leaving the window, until the
child dies at the 2 GB heap limit. It reproduces at `MultiPV 1` and at
`MultiPV 8`, warm and cold alike. Cold only changed the game line, so these
campaigns walked into a position the warm ones happened to miss.

So a depth-limited search — the thing ADR 0005 relies on precisely because it
cannot run away — can in fact run away on this engine. That is a hazard for
every long Lozza campaign, and it is what **D172** must rule on.

Two observations, offered as leads rather than diagnosis: both poison positions
contain a promoted extra white queen and an overwhelming forced win, and the
reported score is the odd `mate -500` — a mate bound in the *losing* direction
for the side that is winning. A sign or bound error in mate-score handling at
the aspiration window would explain both the value and the non-termination, but
that has not been confirmed.

## Incidental: MultiPV 8 exceeds the advertised maximum, and is accepted anyway

Lozza advertises `option name MultiPV type spin default 1 min 1 max 5`
(`vendor/lozza/lozza.cjs:5278`) while the adapter sets 8
(`DEFAULT_PRIVATE_MULTIPV_WIDTH`). The parser clamps only the lower bound —
`multiPV = Math.max(uciGetInt(tokens, 'value', 1), 1)`
(`vendor/lozza/lozza.cjs:5252-5254`) — and reporting is bounded by the number of
available lines (`vendor/lozza/lozza.cjs:1748-1751`), so 8 is honoured, not
clamped and not ignored. Nothing is broken, but we are relying on undeclared
behaviour, and it belongs in the D172 conversation because both concern how far
the vendored artifact may be trusted or changed.

## Addendum (2026-08-29): what the runaway actually is, and what the fix buys

The lead offered above is half right and the wrong half matters. Two defects, not
one.

**The non-termination.** The widening step is `beta = Math.min(INF, beta + delta)`.
Once `beta` has reached `INF` (32000) and the root keeps returning a score
`>= beta`, widening is a no-op, `depth = Math.max(1, depth - 1)` pins the depth
at 1, and the loop re-searches forever. Instrumenting the loop at the first
position:

```text
DBG ply=3 depth=3 alpha=-32000 beta=32000 score=31001
DBG ply=4 depth=4 alpha=30991  beta=31011 score=32000
DBG ply=4 depth=3 alpha=30991  beta=31026 score=32000
DBG ply=4 depth=1 alpha=30991  beta=31081 score=32000
DBG ply=4 depth=1 alpha=30991  beta=32000 score=32000   <- clamped, then forever
```

**The unsound score, which is the dangerous one.** `rootSearch` returns 31001 and
then 32000 — above `MATE` (31000) and equal to `INF`, which is not a score at
all. `report()` renders it as `score mate -500` (`(MATE - 32000) / 2`), and
`parseScoreCp` (`src/engine/uci.ts:74-85`) turned that into `-29_500`: a
plausible *losing* number for a position that is a forced win in three, arriving
silently in the one field the audit trail and the opponent policy treat as truth.
The existing `mate 0 → 29_999` case is the same sentinel from the other side —
at `go depth 3` the first position reports `mate 0` for what is really mate in
three, so that special case was papering over this bug rather than describing an
immediate mate. Instrumenting `search` shows it returning `-INF` with legal moves
available, so the origin is below the root; it was not traced further and is
reported upstream (`namanthanki/lozza#4`; the canonical `op12no2/lozza` now
redirects to that repository, whose head is the same `BUILD = "11"` we vendor and
which reproduces the hang identically).

**Why `nodes` is not the answer.** Lozza does honour `go depth N nodes M`, and
`nodes 20000` turns both positions into a return with the *same* best move the
runaway was converging on. But the hard net fires only at
`statsNodes >= statsMaxNodes * 100` while each runaway lap adds ~3 nodes and
prints a line, so escaping costs ~666k `info` lines and ~450 MB RSS (5.1 s and
5.8 s respectively); and the soft net stops *deepening*, so a budget cheap enough
to help would silently truncate honest deep searches. Measured cost of escape,
for the record:

| position | `go depth 4` | `nodes 200` | `nodes 2000` | `nodes 20000` |
|---|---|---|---|---|
| A (`Q1b1k3/…`) | never returns | 112 ms | 534 ms | 5.1 s, ~451 MB |
| B (`6Q1/2k1n2Q/…`) | never returns | 108 ms | 627 ms | 5.8 s, ~430 MB |

**What the two-condition loop guard buys.** Refusing to re-search a window that
cannot be widened (`score <= alpha && alpha > -INF`, `score >= beta && beta < INF`)
leaves Lozza's own `bench` unchanged at `613926` nodes and returns both positions
in under 100 ms at every depth tried — but the *score* is only sound from depth 5
at A and depth 4 at B:

| position | depth | ms | best move | reported score |
|---|---|---|---|---|
| A | 3 | 49 | `a8c8` | `mate 0` (unsound) |
| A | 4 | 50 | `a8c8` | `mate -500` (unsound) |
| A | 5 | 60 | `a8c8` | `mate 3` |
| A | 6 | 77 | `a8c8` | `mate 3` |
| A | 8 | 84 | `a8c8` | `mate 3` |
| B | 3 | 51 | `h7e7` | `mate -500` (unsound) |
| B | 4 | 57 | `h7e7` | `mate 2` |
| B | 6 | 55 | `h7e7` | `mate 1` |
| B | 8 | 59 | `h7e7` | `mate 1` |

So the best move survives the bug at every depth and only the score is corrupt,
which is why ADR 0068 rules the score — not the move — as the thing that must
prove itself, and why the response is a deterministic re-search one ply deeper
rather than a clamp: the sign of the corrupt value is wrong, so clamping it into
range would fabricate a confident lie. A tests-level note for whoever
re-baselines: A at depth 3 needs two escalations, A at depth 4 and B at depth 3
need one.

An earlier hypothesis — that mate scores were being stored and re-read from the
transposition table without the `± ply` correction, since `ttPut` can store a
value above `MATE` while `ttGet`'s guard rejects exactly those entries from the
compensating adjustment — was tested and rejected as *the* cause: widening both
guards leaves `bench` at `613926` and does not stop the hang, because the first
out-of-range value is already `INF` arriving from a child search.

## A rung is not a search: the reuse assumption, measured (D173)

Implementing D172's deeper re-search made a second question unavoidable, so it
was measured rather than assumed. Both the adapter and the broker keep one ladder
per position and serve any shallower query from it whenever
`maxDepth >= requestedDepth` — the trick that lets a single shared search at
`D_max` answer every piece. Comparing a standalone `go depth d` against the
depth-`d` rung of a `go depth 6` over five ordinary positions at depths 2–5, 17
of 18 available comparisons matched and one did not:

| position | depth | standalone `go depth d` | rung of `go depth 6` |
|---|---|---|---|
| `2r3k1/p4p2/3Rp2p/1p2P1pK/8/1P4P1/P3Q2P/1q6 b - - 0 1` | 3 | `cp 461` \| `b1g6 h5g4 c8c2 e2b5` | `cp 464` \| `b1g6 h5g4 c8c2 e2d3` |

The move agrees; the score and the tail of the line do not. That is expected of
iterative deepening — a rung is computed with the table and the aspiration
windows the same search already warmed — which means the value returned for
`(position, depth)` depends on the depth of the search that ran first for that
position. Within a run the barrier's `PieceId` order fixes it; across runs whose
rosters ask for different depths it is not fixed, which is the purity ADR 0067
claimed. D172's escalation is deliberately kept out of that path (an escalated
search neither reads nor writes the ladder cache, memoizes its own result, and
carries an order-invariance probe), so the reuse rule is recorded as **D173** and
left for a ruling rather than patched here.

## Post-patch re-baseline: the cold, clamped artifact (2026-08-29)

The two campaigns ADR 0067 left blocked now complete. Both are cold, real Lozza,
`--depth-cap=4`, five matches, on the artifact carrying all three patch hunks
(aspiration guard, mate-distance rendering, evaluation clamp):

| run | wall | ms/match | ms/ply | engine calls | escalations | peak RSS |
|---|---|---|---|---|---|---|
| seed 7 `tyrannical` | 31.4 s | 6 283 | 151.0 | 11 361 | 0 | 140.6 MB |
| seed 11 `tyrannical` | 43.0 s | 8 604 | 150.4 | 14 917 | 0 | 141.4 MB |

Three things worth keeping.

**`ms_per_ply` is stable across the two runs (151.0 vs 150.4) while
`ms_per_match` differs by 37%.** Per-match cost is a function of how long the
games ran, not of engine speed; per-ply is the honest unit for planning a
campaign budget.

**Peak RSS is ~141 MB and flat**, against ~450 MB when a runaway search was
escaping through its node net. A long campaign is now a plan rather than a memory
bet, which was the other half of what ADR 0067 wanted.

**`score_escalations=0` in both runs.** The escalation ladder is the contract's
backstop, not its mechanism: with the evaluation clamped below the mate band,
nothing in ~26 000 engine calls produced a score we refuse to believe. That is
the measurement that would catch a regression in the clamp, and it belongs in any
future Lozza run's cost line.

These numbers supersede every warm Lozza figure in this directory and are not
comparable to the pre-patch cold measurements above: the artifact hash differs,
and the clamp changes the engine's answers in lopsided positions, so it changes
the game.
