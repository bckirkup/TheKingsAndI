# ADR 0055 — Earned ability from vindicated judgment

Status: Accepted direction; mechanism shipped at zero magnitude

## Decision

A piece's ability `E_i` is earnable from her own read of the position being
proved right. The existing vindication truth is reused rather than recomputed.
There are two judgment channels: a forced objector is right when
`wasRight = !vindicated`, while an objector whose refusal is accepted is right
when `wasRight = justifiedRefusal`. Near-refusal witnesses continue through the
credence adjudication path but do not stake an earned-ability judgment.

The reducer follows ADR 0043's integer-rational, curved asymmetry. Being wrong
costs ability quickly, while being right rebuilds it slowly and gains diminish
near the ceiling. The mechanism is deterministic, integer-valued, and clamped
to the existing `[1, 100]` range. It is wired at zero shipped magnitude:
the default step scale is `0`, so default behavior remains bit-identical to the
pre-mechanism harness. The calibrated nonzero magnitude remains open.

An `ABILITY_GRADE` event records the piece, ply, channel, polarity, and applied
nonzero delta. A heeded-and-right grade multiplies only its gain step by
`ABIL_EARNED_HEEDED_GAIN_MULTIPLIER` (default `2`); heeded-and-wrong uses the
ordinary loss. Campaign ability spread metrics fold the resulting state, while
the pool ranks fielding ability relative to the origin role's starting ability
so promotion does not preserve a permanent birth-role handicap.

## Implementation

- `src/psychology/reducers.ts:65-108`
- `src/orchestration/psychologyHooks.ts:270-338`
- `src/orchestration/headlessMatch.ts:684-700`
- `src/orchestration/matchSession.ts:478-490`
- `src/orchestration/enemyTurn.ts:190-214`
- `src/psychology/types.ts:236-244`
- `sim/pool.ts:252-277`
- `sim/metrics.ts:526-650`

## Consequences

Ability can form a quality gradient over service, and a promoted pawn can
compete on demonstrated ability rather than absolute birth-role ability.
`actorChallenged` is set only when a refusal is overridden, so the forced channel
learns only when an objection is settled by force. An accepted refusal uses the
existing audit-backed `justifiedRefusal` truth in headless, enemy, and
interactive paths, so being listened to is the heeded channel. Near-refusals
still inform credence adjudication but no longer earn ability. The measured
near-refusal population produced 761 grades per supportive campaign and 2,791
per tyrannical campaign, with overall right rates of 0.31–0.44 versus 0.78–0.93
for pieces that actually spoke. Under the ADR 0043 asymmetry this drove the
whole tyrannical roster to ability `1` at scale `3` and `24` at scale `1`.
The split channels remove that witness-driven collapse without claiming a
calibrated magnitude. Once the magnitude is nonzero,
`trackEnemyIdentities` (`src/orchestration/enemyTurn.ts:50`) also changes which
highest-ability enemy pieces remain inside the memory cap.
Because the shipped scale is zero, no calibration claim or balance threshold is
made here. D148 (promotion's campaign-scale meaning and clamp ceiling) and D150
(what a commander may know about a piece) remain open.
