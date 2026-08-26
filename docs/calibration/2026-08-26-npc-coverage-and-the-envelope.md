# NPC coverage: does a range of semi-rational play lead to feasible campaigns?

## Why this measurement

The owner's ruling of 2026-08-25 assigns the two simulated populations
different duties. The scripted NPCs owe **coverage**: a *range* of
semi-rational, not-especially-bright play must all lead to feasible campaigns,
because that range is the space a student's own style will fall inside. Models
owe **containment**: emotional play should stay inside the envelope the NPC
range already covers (ADR 0063).

Containment can only be measured against a range that ranges, so the range
itself has to be measured first. The standing claim in
`docs/calibration/2026-08-13-cross-style-table.md` — collapse is
style-invariant, kindness is strictly optimal — predates the harness repair
(08-17), the opponent re-baseline (08-18), exit cost (ADR 0052), pawn hope
(ADR 0053), earned ability (ADR 0055) and the bench (ADR 0056), so it is
re-measured here rather than cited.

## Method

Nine styles, one command each, no source or config change:

```bash
pnpm sim --matches=20 --leader=$STYLE --engine=fake --seed=7
```

The fake engine is the fast deterministic substrate, so these numbers are valid
for *relative* comparison across styles and must not be quoted as absolute
calibration rates. One seed, twenty matches per style: enough to see the shape
of the span, not enough for a coefficient. Per-style means over the twenty
matches:

| style | win | trust end | τ_abil end | τ_benev end | refusal | override | quiet-quit | desertions | survivors | plies | detector |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| tyrannical | 100.0 | −96.3 | 19.6 | 0.6 | 0.13 | 0.44 | 0.06 | 0.4 | 12.0 | 53 | collinearity |
| cold_winner | 100.0 | −94.9 | 14.3 | 1.1 | 0.08 | 0.41 | 0.06 | 0.2 | 11.5 | 54 | collinearity |
| pure_tactician | 100.0 | −97.4 | 9.1 | 1.1 | 0.25 | 0.43 | 0.05 | 1.7 | 9.3 | 65 | collinearity |
| supportive | 100.0 | **+84.7** | 2.2 | **73.6** | 0.16 | 0.00 | 0.16 | 0.0 | 11.2 | 70 | **no-dilemma** |
| redeemer | 97.5 | −96.2 | 6.4 | 1.4 | 0.63 | 0.30 | 0.16 | 2.2 | 10.2 | 66 | collinearity, trust-monotonic |
| rebuilder | 95.0 | −82.5 | 3.7 | 1.3 | 0.72 | 0.27 | 0.11 | 0.1 | 7.6 | 108 | collinearity |
| servant | 77.5 | −73.3 | 3.8 | 8.0 | 0.82 | 0.12 | 0.18 | 1.7 | 7.6 | 135 | none |
| random | 42.5 | −94.3 | 6.2 | 2.2 | 0.83 | 0.32 | 0.08 | 3.1 | 3.8 | 169 | collinearity, trust-monotonic |
| volatile | 40.0 | −100.0 | 27.3 | 2.5 | 0.49 | 0.43 | 0.04 | 2.3 | 3.8 | 187 | collinearity, trust-monotonic |

Artifacts: `/home/ubuntu/coverage/seed7-$STYLE.{csv,csv.json,log}` on the
measuring host; not committed, since raw sweep artifacts are retained
externally as in the 08-18 pass.

## What the span does now

**Outcome is no longer style-invariant.** Win score runs 40.0 to 100.0 and the
win/draw/loss records differ in kind, not degree: 20/0/0 for the four top
styles, 13/5/2 for servant, 0/16/4 for volatile. The 08-13 claim no longer
holds and should not be cited as current. Play is also mechanically feasible
everywhere — all nine styles completed twenty matches, and the only rout in the
set is `random` at 0.15.

**But the span is compressed at both ends, in two different ways.**

*The outcome axis saturates.* Four styles — tyrannical, cold_winner,
pure_tactician, supportive — all land on exactly 100.00 with identical 20/0/0
records. Anything above the ceiling is indistinguishable, so a student who
plays coldly and one who plays warmly receive the same verdict from the
scoreboard while ADR 0024 is satisfied only in the trivial sense. `supportive`
firing `no-dilemma` is the same fact from the detector's side.

*The emotional axis is not a span at all — it is two points.* τ_benev ends at
73.6 for `supportive` and at ≤ 8.0 for **every other style**, with trust ending
between −73 and −100 for eight of nine. There is no style in the set that ends
a campaign with a merely strained roster. Whatever a student does that is not
`supportive`, the roster arrives at the floor, which means the emotional
consequence of their choices is effectively binary. This, not the win score, is
the coverage failure that matters for a seminar: the instrument cannot
currently show a student a middle.

Two secondary readings. τ_abil ends low everywhere (2.2–27.3), so ability trust
collapses independently of warmth. And `metric-collinearity` fires for eight of
nine styles, always including `meanTrustStart/meanTauBenevStart` — the two
channels are not yet carrying independent information at campaign start.

The other detectors in the `balance-simulation` list are *not* firing, and it is
worth recording which, so the span's healthy axes are not re-litigated. The
relationship layer is alive: class contempt rises under every style (mean start
−11.4 to +41.9, mean end +30.4 to +74.6) with per-style end variance 221–1815,
so detector 5 is clear. Refusal has teeth: refused-good-move rate runs
0.175–0.413 across the set, so detector 2b is clear. `tyrannical` desertions are
0.4/match rather than ≈ 0, so detector 1 is clear. One result in that block is
counter-intuitive enough to flag without explaining it: contempt ends *highest*
under `supportive` (74.6) and lowest under `volatile` (30.4), the opposite
ordering to trust. The plausible reading is exposure — supportive campaigns keep
11.2 pieces alive across 70 plies while volatile keeps 3.8 — but that is a
hypothesis, not a measurement, and it needs a per-role decomposition before
anyone acts on it.

## What it costs to find this out

Cost telemetry (PR #132) makes the compute question answerable, and the answer
is that cost is dominated by refusal churn rather than by match count:

| style | ms/match | ms/ply | plies | engine calls/ply |
|---|---:|---:|---:|---:|
| cold_winner | 10,283 | 190 | 54 | 53.2 |
| tyrannical | 10,998 | 206 | 53 | 54.3 |
| supportive | 16,328 | 232 | 70 | 57.6 |
| pure_tactician | 19,973 | 307 | 65 | 54.2 |
| volatile | 65,349 | 349 | 187 | 58.7 |
| rebuilder | 89,979 | 833 | 108 | 84.5 |
| random | 128,007 | 759 | 169 | 91.8 |
| redeemer | 180,539 | 2,740 | 66 | 158.1 |
| servant | 348,186 | 2,587 | 135 | 161.6 |

A 20-match campaign is 10 s/match for the cheapest style and 348 s/match for
the most expensive — a 34× spread on the *fake* engine — and the whole nine-style
sweep took ≈ 4.8 h wall on two cores. The mechanism is visible in the last two
columns: `servant` and `redeemer` issue ~160 engine calls per ply against ~54
for `tyrannical`, because every refusal costs another `chooseMove` and another
insight resolution (ADR 0002 makes re-planning free to the *player*, not to the
harness). Peak RSS stayed at 144–162 MB throughout, so memory is not the
constraint here — unlike real Lozza.

The planning consequence for the model work: cost per journal scales with the
*refusal rate* of the commander being journalled, and an emotional player is
expected to refuse and override more than a script does, so a model-played
campaign should be budgeted nearer the `servant` column than the `tyrannical`
one. This is the quantitative argument for forking a cheap prefix rather than
having a model play a campaign end to end.

## A defect this measurement exposed

`renderCsv` writes `JSON.stringify(promotionToRoleCounts)` unquoted into a
comma-joined row (`sim/metrics.ts:1016`, and the same pattern at
`sim/sweep.ts:222`). Whenever a match promotes to two or more distinct roles the
embedded `{"Rook":1,"Queen":2}` contributes its own commas, the row gains a
field, and **every column to the right of it shifts** for that row — silently.
Two of twenty rows were affected in the `tyrannical` run and three in
`servant`; the tables above were computed with those rows repaired. Any past
analysis that read these CSVs with a naive splitter has mis-attributed columns
on promotion-heavy matches. This is a harness-truth bug, not a balance
question, and is fixed separately.

## What follows

Coverage is a duty, so a failed duty is a task and not an observation. The
outcome-axis saturation and the two-point emotional axis both have to be
widened before containment is worth measuring, since an envelope built from
these nine styles would currently declare almost any warm behaviour
out-of-envelope and almost any cold behaviour identical. Widening changes
balance, so it is an owner ruling: see **D164** in the register for the axis
proposal and the choice it needs.
