# ADR 0040 — A refusal opens a crisis, and the menu is the organisation

- **Status:** proposed
- **Resolves:** **D97** (what does a refusal offer the commander?), **D98**
  (where does inter-piece obligation live?), **D99** (what may stand in for
  momentum without touching the true evaluation?)
- **Refines:** ADR 0002 (refusal is free to re-plan), ADR 0038 (public
  authority cost for justified refusal)
- **Related:** ADR 0008 (insight is advice only), ADR 0011 (the cascade is
  never damped), ADR 0013 (each piece decides from its own view), ADR 0014
  (the player can always override), ADR 0016 (rumor carries appraisals, never
  board facts), ADR 0018 (a stated reason always names a cause), ADR 0019
  (two-channel trust), ADR 0021 (the King's mandate), ADR 0024 (warmth is not
  required to win), ADR 0026 (a community of pieces)

## Context

A refusal today is silent. The piece declines, orchestration adds the SAN to a
`refusedSans` set and asks the leader policy for another candidate
(`src/orchestration/headlessMatch.ts:329-471`); the interactive path stores a
`PendingVerdict` and offers exactly two buttons, re-plan or override
(`src/orchestration/matchSession.ts:303-465`). The only public roster-wide
consequence is the `τ_abil` deduction of ADR 0038; the accepted re-plan also
applies the existing neglect signal to the refusing piece's credence
(`src/orchestration/matchSession.ts:404-418`). Nothing is asked of the refusing
piece, no other piece is consulted, and if every candidate is refused
the first refusal is implicitly overridden
(`src/orchestration/headlessMatch.ts:496-558`).

The state-of-play sweep (`docs/calibration/2026-08-10-state-of-play.md`) shows
what that produces. Supportive scores 95 and servant 97.5 against tyrannical's
27.5: kindness is strictly optimal, the `no-dilemma` detector fires on both
engines, and refusal behaves as a property of the position rather than of the
commander. It does so for a structural reason. Under free re-plan the only cost
of a refusal is the gap between the best move and the next acceptable one, and
in most positions that gap is small. A leader who never asks for anything
frightening therefore pays nothing at all, and ADR 0024's requirement — that a
cold, able commander must be able to win a career — cannot be met by tuning
coefficients, because there is no transaction in the mechanic for warmth to
lose.

The owner's framing supplies what is missing. A refusal should not be a veto
followed by a menu that silently shrinks; it should open a *situation*, with
several ways out, and the ways out should depend on the state of the
organisation rather than on the position alone: demanding a better idea,
looking to the rest of the pieces, someone volunteering, and — the case that
makes the mechanic recognisable — the roster answering "sacrifice that piece
instead."

An audit of the current tree (`social-state-audit`, summarised here) establishes
three facts this decision has to work around. There is directed
`dyadicAffinity` and role-indexed `classPrestige` on every `PieceState`
(`src/psychology/types.ts:45-58`), but **no ledger of obligation** — no record
of who protected whom, who was abandoned, who was spent. There is **no
momentum** of any kind available to psychology; the nearest thing is a
three-match realised-quality window in campaign policy
(`src/orchestration/campaignPolicy.ts:131-138`). And the event log records
**only actions taken**: the thirteen `MatchEvent` variants have no notion of an
option that was available and declined.

## Decision

### 1. A refusal opens a crisis, resolved by exactly one option

`MORAL_REFUSAL` no longer resolves into re-plan-or-override. It opens a
**crisis**, which is resolved by choosing exactly one option from a menu
generated at that moment. Resolution is mandatory and immediate; a crisis never
spans a ply.

### 2. The menu is generated, purely, from piece-local state

```ts
generateCrisisMenu(
  actor: PieceState,
  roster: readonly PieceState[],
  moveEval: MoveEvaluation,   // the refusing piece's own depth-D_i view
  social: SocialLedger,       // derived, plain data (§7)
  crisis: CrisisContext,      // refusals this ply, this match, standing losses
): readonly CrisisOption[]
```

This lives in `psychology/` and obeys its rules: pure, deterministic, no true
evaluation, no board values, no clock. Availability predicates read only state
the pieces themselves could have (ADR 0013). The menu is therefore a readout of
the organisation — a cohesive, well-led roster offers options a distrusted one
does not have, and *that* is the leadership content.

### 3. The option catalogue (v1)

| Option | Available when | Transaction |
|---|---|---|
| `OVERRIDE` | always | ADR 0014's price, unchanged |
| `WITHDRAW` | always | the order is dropped; ADR 0038's authority loss applies |
| `DEMAND_PROPOSAL` | refuser's `τ_benev` above a floor — he will not bother proposing to a commander who never listens | he names the move he would play, from his own depth-`D_i` view; taking it costs the difference between his view and the truth |
| `CONCEDE` | the refusal is justified in the refuser's own view | ADR 0038's `τ_abil` loss, *plus* a `τ_benev` gain across witnesses |
| `ACCEPT_VOLUNTEER` | some other piece has high affinity to the refuser or to the commander, low trauma, and momentum is not negative | the volunteer executes a substitute order and bears the risk; the volunteer spends trauma headroom |
| `SCAPEGOAT` | crisis intensity above a threshold, cohesion below one, and an undefended piece exists | §5 |
| `COALITION` | an ally exists with both high credence in the commander and high standing in the affinity graph | the ally's benevolence is spent to buy a third piece's compliance |
| `MAKE_EXAMPLE` | always, once the roster has more than one active non-King piece | compels now, raises fear, and manufactures the undefended piece who becomes a later nomination |
| `APPEAL_TO_KING` | mandate above a floor | compels; spends mandate (ADR 0021) |

`OVERRIDE` and `WITHDRAW` are unconditional. ADR 0014 therefore holds without
amendment — no position is ever unplayable — and so does ADR 0002: **no option
on this menu costs a turn, tempo, or clock**. The teeth are still denial of
options; there are simply more kinds of option to be denied. ADR 0008 is
untouched: every option except `OVERRIDE` and `MAKE_EXAMPLE` results in a
*different order being issued*, never in advice binding the commander.

### 4. Every option consumes the condition that made it available

A menu whose options renew each ply collapses into "always take the cheapest,"
which is the degeneracy we already have wearing better clothes. Each option
spends its own enabler: `COALITION` spends the ally's benevolence toward the
commander, `ACCEPT_VOLUNTEER` spends the volunteer's trauma headroom,
`DEMAND_PROPOSAL` spends the refuser's willingness to be asked again,
`SCAPEGOAT` spends the mechanism's potency (§5). Nothing here is renewable
within a match.

### 5. The nomination is the least-defended piece, not the cheapest one

When the roster answers a crisis by naming a victim, the nomination is
`argmin` over **incoming affinity weighted by class prestige** — the piece
fewest others will speak for — and explicitly **not** the tactically most
expendable piece. If the two coincide the mechanic is merely chess; the drama
is the case where they diverge. The King is never nominated (ADR 0003 already
forbids his desertion).

Three properties are required, and they are what make this a mechanic rather
than a flourish:

- **It works.** Expending the nominated piece restores morale and trust across
  every witness, and the crisis clears. This is a genuine brake on the
  desertion cascade that is *social* rather than a cooldown, cap, or morale
  floor, so ADR 0011 survives intact — the cascade is broken by a victim, not
  by damping.
- **It wears out.** Each successful nomination restores strictly less than the
  last. Otherwise feeding the machine is dominant and we have traded one
  degeneracy for another. When restoration falls below the crisis it is meant
  to resolve, the result is the collapse we already model as a rout.
- **It marks.** A piece nominated once is more easily nominated again, and the
  mark persists across matches. This is where ADR 0026's community-of-pieces
  and cross-commander trauma finally pay for themselves.

### 6. Concession is a trade, not only a cost

ADR 0038 currently only takes: an accepted justified refusal deducts `τ_abil`
from every other active piece. That remains the price of `WITHDRAW`. `CONCEDE`
— the commander publicly agreeing the piece was right — pays the same `τ_abil`
and *buys* `τ_benev` from the witnesses. This is the smallest change in this
ADR and probably the largest in effect, because it is the first place in the
model where a commander can convert competence-credit into goodwill on purpose.

### 7. Obligation is a fold, never a counter

The gates above want to know who protected whom and who was spent. That history
must **not** become new fields on `PieceState`: the event log is the source of
truth and derived history is a fold over it (AGENTS rule 5). Orchestration
computes a `SocialLedger` from the event log and passes it into psychology as
plain data, exactly as board features are passed today. Where the existing
events cannot support a needed relation — `SACRIFICE_WITNESSED` currently
stores the observer's own id as `beneficiary`, and no event names a protector —
the fix is a richer event, not a stored counter.

### 8. Momentum is derived, and only from what pieces can see

`ACCEPT_VOLUNTEER`'s momentum gate must not be computed from the audit stream:
the true evaluation may never reach `psychology/` (ADR 0013). Momentum is
derived by orchestration from piece-visible facts only — material on the board,
pieces lost in recent plies, refusals and desertions this match — and enters as
a plain scalar on `CrisisContext`.

### 9. The menu is logged before it is resolved

Two new event variants. `CRISIS_MENU` records the option set and the gate
values that produced it, emitted **before** the commander acts;
`CRISIS_RESOLUTION` records the option taken. Logging the menu is what makes
the moment replayable, auditable, and — see ADR 0041 — broadcastable. Replay
regenerates the menu from recorded state and replays the resolution; a menu
that does not regenerate identically is a replay divergence, which gives the
generator a golden test for free.

### 10. Detectors

Two, both folds over the log:

- **Option-share entropy.** If any single option exceeds a configured share of
  resolutions across a campaign, the menu has collapsed to one mechanic and the
  run is degenerate.
- **Dilemma-present rate.** The fraction of crises offering at least two live
  options with opposing costs. This measures playable space *directly*, rather
  than inferring it from win rates the way the current `no-dilemma` detector
  does.

Every knob introduced here ships with a golden test and a sensitivity probe
(AGENTS rule 6).

## Consequences

- Warmth acquires a price and coldness acquires an instrument, which is the
  precondition for ADR 0024's requirement that a cold, able commander can win a
  career. Whether it is *sufficient* is a calibration question, not a design
  one.
- Refusal stops being a property of the position. Two commanders facing the
  same board with different rosters are offered different ways out, so the
  refusal metrics finally measure leadership.
- The desertion cascade gains a restoring force that ADR 0011 permits, which is
  the most plausible route out of per-match desertion incidence sitting at
  1.000 for saint and tyrant alike.
- This is a substantial widening of the psychology surface: a menu generator,
  eight new option transactions, a social fold, two event variants, and their
  detectors. It should land option-by-option behind config, not as one change.
- The narrative layer inherits work. Every option needs authored dialogue that
  names a cause without exposing arithmetic (ADR 0018), and a nomination scene
  is the hardest tone problem in the game so far.
- `MatchEvent` grows by two variants, which touches the audit fold, the
  transcript, replay, and the goldens by construction
  (`src/persistence/folds.ts:66-96`, `src/psychology/replay.ts:35-105`).

## Alternatives considered

- **Keep the silent re-plan.** Cheapest, and it is what produced the current
  no-dilemma result. Rejected on the evidence.
- **Ship one mechanic — scapegoating alone.** Dramatic and much smaller, but a
  single mechanic cannot be gated on organisational state in any interesting
  way; with one option the menu is not a readout of anything, and the option
  becomes mandatory whenever it is available.
- **Let the commander poll the roster freely.** This is the natural reading of
  "look to the rest of the pieces," and it is a trap: free polling makes
  advice a public good, deletes the cost of distrust, and turns the turn into a
  click-grind — the hazard ADR 0002 already flagged. Consultation must be an
  option with a price, not an inspection.
- **Store obligations on `PieceState`.** Simpler to implement and directly
  contrary to AGENTS rule 5; it would also silently make obligations
  unreplayable.
- **Negotiate through a language model.** Banned by ADR 0004 and ADR 0001, and
  it would put game state downstream of generated text.

## Open questions

Registered in `docs/design_decisions.md` rather than settled here: the gate
thresholds and the transaction magnitudes (**D100**); the restoration curve for
a nomination and its decay rate (**D101**); whether the menu is offered on an
*unjustified* refusal or only a justified one (**D102**); and whether a mark
decays at all across matches or is permanent (**D103**).
