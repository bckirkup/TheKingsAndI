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
