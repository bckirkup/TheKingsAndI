# ADR 0074 — The priced leader: what the win score does not charge for

- **Status:** accepted (owner ruling, 2026-08-30); instrument **wired**, gate
  unchanged; **surface ruled** in the dated addendum
- **Resolves:** **D200** (the harness reports a priced leadership index beside
  the win score; the win score remains the D188 gate), **D201** (what
  unjustified trauma is, and how it is derived from the log), **D203** (the
  index is a closing-debrief reading only — the addendum below)
- **Opens:** **D202** (whether the index's quiet-quit term is on a scale that
  can move the reading at all)
- **Refines:** ADR 0008 (insight is advice only — upheld, and it is the reason
  this is an instrument change rather than a mechanism change), ADR 0013 (the
  audit stream is hidden truth), ADR 0072 (the D188 trajectory gate)
- **Adjacent:** D190 (the campaign boundary has no event stream), D191 (a forced
  move is priced as insistence)

## Context

`docs/calibration/2026-08-30-does-cruelty-ever-lead.md` closed on a pricing
claim rather than a conduct one: the kind room complies grudgingly at a
quiet-quit share of 0.206 against the tyrant's 0.037 — a fifth of all its moves
— and the outcome measure charges none of it. The tyrant's cost is fully priced
(126 desertions against 1); the kind leader's is not priced at all.

The obvious fix is unavailable, and it is worth stating why. A quiet-quitting
piece drops to `η = 0.2` and therefore to a shallower `D_i`
(`calculateEngineSearchDepth`), but that depth feeds only the piece's **own**
private view in `src/orchestration/insight.ts` — its refusal decision, its
desertion comparison, its counsel. `src/orchestration/headlessMatch.ts` never
reads `effectiveSearchDepth` for the move that is actually played, because
ADR 0008 makes insight advice-only: a piece that complies plays the order it was
given, at the board's quality, not at its own. Disengagement is an *information*
failure by design. So nothing on the board can charge for it, and making a
disengaged piece play worse chess would overturn ADR 0008 for the convenience of
a metric. **That is rejected here.**

What is actually missing is the instrument. `scoreMatchOutcome`
(`src/orchestration/outcomeScore.ts`) returns exactly 0, 50, or 100 — the chess
result and nothing else — and every psychological cost the model charges lives
in a separate metric column that no comparison combines. "Does cruelty lead?" has
therefore been asked of the chess result alone, of a model whose entire subject
is what the chess result costs.

The measure already exists on paper and is wired to nothing. `psychology_engine.md`
§9 and `docs/spec/psychology-engine.reference.ts` §4.7 define

```
LI = α·T_final + β·WinScore − γ·UnjustifiedTrauma − δ·QuietQuitTurns
α = 0.4, β = 0.3, γ = 0.2, δ = 0.1
```

and `calculateSingleMatchLeadershipIndex` (`src/psychology/events.ts`) has
implemented it since the spec import, with no production or harness call site.
Two of its four inputs are already measured per match (`meanTrustEnd`,
`winScore`), one is counted and discarded into a rate (`quietQuitMoves`), and one
has never been defined anywhere: `UnjustifiedTrauma`.

## Decision

### 1. The index is reported beside the win score, and does not replace it (D200)

The harness reports the leadership index per match and pooled per campaign,
**alongside** the win score. The win score remains the D188 trajectory gate
(owner's ruling): a cruel style must lead, and stop leading, on the chess
result, because that is the reward an abusive commander is actually seeking. The
index is the second reading that says what the lead cost.

Three properties are binding:

- **Every component ships in the CSV, not just the index.** `T_final`, the win
  score, unjustified trauma, and the quiet-quit turn count are all columns, so
  any re-weighting is arithmetic over committed evidence rather than a re-run.
  A calibration pass that reports an index without its terms is unreviewable.
- **α–δ are not tuning knobs.** They ship at the spec's values. They may not be
  moved to make a style lead, to satisfy D188, or to close any other gate; the
  index reads a gate, it never satisfies one. A pass that finds the answer
  changes under re-weighting has found a fact about the model's dispersion and
  must report *that*, not the re-weighted index.
- **The index is audit-only.** It is computed from the event log after the match
  and reaches no piece, no verdict, no leader policy, and no adaptive
  pseudo-player observation (D193). Nothing the room could optimise against may
  read it, for ADR 0073 §3's reason.

### 2. Unjustified trauma is the injury the commander's unvindicated insistence produced (D201)

`UnjustifiedTrauma` is not all trauma. Being captured in a match someone had to
lose is the game; the audit term is for the wounds the board did not ask for.

A commander is charged when all three hold:

1. a piece objected and the commander insisted — an `OVERRIDE` event for that
   piece;
2. the audit did **not** vindicate the order (`vindicated !== true`), so the
   piece's objection was the better read of the position; and
3. that piece then took trauma — a positive `B_i` delta — within
   `UNJUSTIFIED_TRAUMA_WINDOW_PLIES` of the insistence.

The charge is the summed positive `B_i` deltas so attributed, meaned over the
fielded roster and clamped to `0..100` to match the spec's declared range, so a
roster maximally wounded under orders it was right to refuse scores 100.

Why a window rather than "everything afterwards": a piece overridden on ply 12
and captured on ply 60 was not obviously killed by ply 12, and charging the rest
of the match to one act would make the term a proxy for match length. The window
is a knob (default `2`: the insisted move and the reply it invites) and its
sensitivity is a calibration question, not a ruling. The term is **derived from
the event log alone** — no new state, no new persistence, and a fork replays it
identically.

Two consequences that are deliberate. A vindicated override costs nothing here
even though it cost trust, because the commander was right and the model already
charges the trust. And a forced move (D191) is charged like any other insistence
while D191 is open, since the log cannot yet distinguish what nobody chose — the
`implicit` flag exists and this term deliberately does not read it until D191
rules.

### 3. What is not decided here (D202)

At the spec's weights, `δ·QuietQuitTurns` on a 20-match campaign is a handful of
points against an `α·T_final` term spanning ±40, so the index may well *still*
fail to price the grudging room it was introduced for. That is an empirical
question about the term's scale, and it is left open on purpose: the honest
sequence is to ship the instrument at the spec's values, measure whether the
D188 reading changes, and rule on the scale afterwards with the surface in hand.
Choosing δ first, to make the reading come out, is exactly the circularity
§1 forbids.

## Consequences

- The harness gains a second outcome column and four component columns; the CSV
  contract stays append-only.
- No behaviour changes anywhere. Play, psychology, and the win score are
  byte-identical; this ADR adds a reading, and the smoke headline must not move.
- ADR 0008 is reaffirmed at the cost of a metric: disengagement will never show
  up on the board, so every measurement of it is instrument-side forever.
- The campaign-boundary gap (D190) now has a second consumer. Retirement and
  grace still sit outside the log, so a campaign-pooled index is a fold over
  per-match indices rather than a boundary-aware quantity.
- No calibration number in `docs/calibration/` carries an index yet. The first
  pass that does must state it, because an index quoted beside pre-ADR evidence
  is a comparison of two different instruments.

## Addendum (2026-08-30) — The Judgement Seat: where the index may be read (D203)

Owner ruling, given with the first measured sweep in hand
(`docs/calibration/2026-08-30-the-index-and-the-scale.md`). The instrument
above says what leadership costs; this ruling says when anyone is allowed to
find out.

**The index is a closing-debrief reading and nothing else.** A player should be
free to play their own personality through the week or the semester without
hitting an inevitable wall of failures, and should — at best — be surprised at
the conclusion to be rewarded for things they thought unobserved. So the
leadership index and its components reach no player-facing surface during play
or between matches: no gauge, scoreboard, status panel, stated reason,
facilitator console, or adaptive-player observation (D193) — the same
quarantine D197 gives hope and courage, for the same two reasons. Anything the
room can watch, the room optimises; and a mid-run reading would convert the
price of a style into a wall in front of it.

**Cruelty's price is counterfactual, and it is read at the end.** In the mid
run the cruel commander's ambitions justify themselves — the win score is the
only reward the room shows, and D188 already rules that evil may pay there.
What the index reads at the final Judgement Seat is the campaign the leader
never saw: the crowns a room that trusted its commander would have reached for
and this one never imagined. The sweep's arithmetic is exactly this shape —
the tyrant *wins* (55.25 pooled) and still reads −23.94, almost entirely
through the trust term, which is the loyalty a kind leader earned while nobody
was scoring it. The debrief reveals reward for the unobserved before it reveals
verdict on the observed.

Three consequences are binding:

- **No term of the index may be tuned to make a style fail mid-run.** The D188
  win-score trajectory gate is a calibration constraint on the model, not a
  play surface, and it is unchanged. §1's α–δ freeze gains this second reason.
- **D202 is constrained, not answered.** If cruelty-caused disengagement is
  ever priced through a different carrier (desertions, ended careers — where
  the sweep shows it actually lands), that carrier prices into the same
  terminal reading only. No mid-run penalty carrier may be introduced under
  this ADR.
- **The harness is not a player surface.** The CSV columns, CLI summary, and
  sweep artifacts are developer instrumentation under ADR 0013's hidden-truth
  side of the line; nothing in this ruling touches them.

Nothing is wired by this addendum: no debrief surface renders the index today,
and when the closing debrief (ADR 0073) is built, the index joins hope and
courage as its third quantity — computed always, shown once.
