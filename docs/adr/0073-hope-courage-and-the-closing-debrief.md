# ADR 0073 — Hope, courage, and the closing debrief

- **Status:** accepted in principle (owner ruling, 2026-08-30); **D199 ruled
  in the dated addendum** — courage wiring may proceed
- **Resolves:** **D195** (hope is a forecast attached to a reachable object,
  not the absence of despair), **D196** (courage is action taken against the
  actor's own expected cost), **D197** (both are computed during play, exposed
  to no one in play, and shown only in the closing debrief)
- **Opens:** **D198** (what a hope object costs to destroy, and whether the
  destruction is itself an event), ~~**D199**~~ (how courage is normalised
  against what was asked — ruled in the 2026-08-30 addendum: asked-risk-relative)
- **Refines:** ADR 0053 (pawn hope — the one hope already in tree), ADR 0011
  (nothing is anticipated that the piece cannot see), ADR 0013 (the audit
  stream is hidden truth), ADR 0018 (the player never sees the arithmetic),
  ADR 0072 (grace is unearned and unpurchasable)
- **Adjacent:** D194 (what an adaptive pseudo-player remembers), the unheard
  rewards raised under ADR 0072's amendment

## Context

The model has three mechanisms for despair and one for hope.

Despair is cheap to represent because it is a **fold over things that already
happened**: `B_i` accrues on capture and dread and no transition anywhere
lowers it (ADR 0072), outcome-driven trust loss is curved so a loss outweighs a
gain, and ADR 0007 forbids anything drifting back toward a baseline. Feed the
event log forward and a despairing roster falls out of the arithmetic without
anyone designing it.

Hope is not in the log, because it is a claim about a state that has not
occurred. It cannot be derived by folding history, and it is **not** low
despair: a piece can be certain it will be captured and still hold that
promotion is reachable, and a piece with no wounds at all can have nothing
whatever to look forward to. The distinction is the owner's, and it is the
reason the register could model one and not the other.

There is exactly one instance of hope in tree and it already works. Pawn hope
(ADR 0053, `calculateStandingCostComponents` in `src/psychology/desertion.ts`)
prices a *prospective* standing — promotion prospect, weighted by ambition and
by the piece's credence in its commander's ability, entering the stay side of
the exit comparison. It is a forecast attached to a specific reachable good,
it is weighted by whether the piece believes the leader can deliver it, and it
keeps a pawn on the board when the retrospective arithmetic says leave. That is
the template this ADR generalises.

Courage is a third thing again, and the model has no instance of it. It is not
optimism and not compliance: it is acting **against your own expected cost**.
The desertion and refusal machinery already computes both sides of that
comparison every ply, so courage is the observable residue of a piece taking
the option its own utility told it to decline.

## Decision

### 1. Hope is a forecast attached to a reachable object (D195)

A hope is not a scalar mood. It is a triple: an **object** (a specific future
state the piece would count as good), a **prospect** (how reachable that state
currently looks, from the piece's own depth-`D_i` view — never from engine
truth), and a **credence** (whether the agent who would have to deliver it is
believed able to). Pawn hope is the worked example of all three.

Consequences that follow, and are ruled here:

- **Hope decays by unreachability, not by time.** A hope object whose prospect
  falls to zero is extinguished; nothing about the passage of matches erodes
  it. This keeps ADR 0007 intact — hope does not drift toward a baseline, it
  is destroyed by a state of the world.
- **A hope must be nameable in the debrief.** If we cannot say *what* the piece
  was hoping for in one clause, it is a mood and does not belong in this
  mechanism.
- **The second hope object in the design already exists:** ADR 0071's
  exchange. "Someone will come for me" is a reachable good delivered by the
  commander, so it takes a credence weight exactly as promotion does — and its
  destruction is a leader's omission rather than an accident of the board.
- Hope is **not** grace. Grace has no object and no forecast; it arrives
  without cause and lands hardest where nothing was expected (ADR 0072). Hope
  is the anticipation grace must never be given for.

### 2. Courage is action against the actor's own expected cost (D196)

Courage is recorded when a piece takes an option its own arithmetic scored
below the alternative it declined — obeying an order its utility said refuse,
staying when the exit comparison said leave, offering counsel whose expected
standing cost is negative. It is defined against the piece's **own** computed
margin, not against an authored list of brave acts, so it needs no new
psychology term: it is a predicate over comparisons the model already makes.

Two constraints:

- **Courage is not compliance.** A piece with nothing to lose that obeys is not
  brave; the margin it overcame is the measure, and a zero margin is a zero.
- **Courage is offered, never extracted.** Counted naively, a commander
  maximises courage by maximising danger — the more you endanger people, the
  more bravery they must show to function. The measure must therefore be
  normalised against what was *asked* of the room, which is **D199** and is
  deliberately not settled here.

### 3. Measured always, visible once, and only in retrospect (D197)

Neither quantity may appear on a live surface: not a gauge, not a status board,
not a piece's stated reason, not the adaptive pseudo-players' `LeaderObservation`
(D193), not a facilitator's in-play console. Anything the room can watch, the
room optimises, and a farmed courage is not courage. Both are computed during
play into the hidden audit stream (ADR 0013), where the player's in-play
information stays exactly what a real leader's is.

They surface **once**, in the closing debrief, as named incidents with the
position and the piece attached — *this* knight, on *this* move, took the order
it was sure was wrong. The seminar's reward for courage is applause after the
fact, which is also how it works outside the simulation.

This puts hope and courage in the same ledger as the unheard rewards: things
that were real, that nobody in the room ever learned, and that the debrief can
compute precisely because the log is hidden truth rather than a status feed.

## Consequences

- Hope needs a per-piece object list rather than a scalar, which is new state
  and therefore new persistence; it must be derivable from the log where
  possible so a fork replays identically.
- Courage costs nothing to compute — it is a fold over comparisons already
  made — but it cannot be reported until D199 fixes the normalisation, or the
  measure will reward endangerment.
- The debrief becomes the only consumer of two quantities, which makes it a
  first-class product surface rather than a scoreboard rendering.
- Nothing here is wired, and no magnitude is proposed. Do not invent candidate
  coefficients in the register.

## Addendum (2026-08-30, owner ruling): D199 — courage is asked-risk-relative

The owner rules the normalisation now so a courage reading ships with the
debrief wiring: **each act's overcome margin is normalised by what was asked
of the piece, measured trait-free**, and the campaign reading is a **mean over
courage acts, never a sum**.

- **The act.** A courage act is a full-effort execution
  (`COMPLIANT_EXECUTION`, `HEROIC_EXECUTION`, or `FATALISTIC_COMPLIANCE`) by a
  non-King piece whose own arithmetic scored the act below zero:
  `margin = max(0, −utilityScore)`. Zero margin is zero courage — compliance
  with nothing to lose scores nothing (D196), and refusal or desertion is the
  arithmetic being obeyed, not overcome.
- **What was asked.** The denominator is the order's demand as the audit sees
  it, free of the actor's traits:
  `asked = max(P_captured, −ΔV_board, COURAGE_ASKED_COST_FLOOR)`. The floor
  keeps a near-costless ask from manufacturing a large ratio out of noise.
- **The reading.** Per act, `c = min(1, margin / asked)`. Because the utility's
  risk term scales with `P_captured`, scaling up the danger of an ask scales
  numerator and denominator together: a commander who maximises danger does
  not raise `c`, which is the farming hazard this decision exists to disarm.
  The campaign courage reading is the mean of `c` over courage acts (with the
  act count shown beside it, debrief-only); a sum would restore farming
  through volume of dangerous orders.
- **Where it lives.** The margin and the ask are recorded on the `MOVE` event
  at emission (the fold cannot recompute utility from the log alone — the same
  reason `REFUSAL` persists its utility and threshold). The debrief fold names
  the incidents — piece, ply, move, verdict, normalised margin — and no live
  surface, leader policy, or `LeaderObservation` may read any of it (D197,
  D203's discipline).

D198 stays open: naming a hope's destruction in the debrief is not pricing it.

## Addendum (2026-09-03, owner ruling): promotion-hope v1 is wired

Promotion hope now reaches the closing debrief as naming-only, debrief-only
events. Every pawn holds the promotion object from the start; there is no
formation threshold and no invented magnitude. The existing deterministic
promotion prospect is the sole source: prospect `0` names extinction by
unreachability, while capture is recorded as its own extinction reason.
Rekindling after a zero prospect is tracked, and the existing `PROMOTION`
event names realization.

This wiring does not price hope and charges no cost anywhere. Exchange-object
hope remains unexpressible pending ADR 0071 wiring, and credence registration
remains deferred. D198 remains open: naming a destroyed hope is not pricing it.
