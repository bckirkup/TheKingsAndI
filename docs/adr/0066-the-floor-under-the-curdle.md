# ADR 0066 — The floor under the curdle: what a room can still register

- **Status:** accepted (2026-08-28) — owner ruled D167 by delegation ("Sure
  D167"). The broadcast is kept; the saturation beneath it is the defect. All
  three limbs are **shipped inert** behind knobs whose defaults reproduce
  today's behaviour byte-for-byte (`src/psychology/config.ts:46-49,74-75`,
  `src/psychology/credence.ts:100-120`, `src/psychology/clamp.ts:25-32`,
  `src/psychology/override.ts:30-37`, probes in
  `tests/curdle.floor.test.ts`); the live magnitudes are chosen from a measured
  before/after together with D166, not here.
- **Refines:** ADR 0024 (`τ_benev` buys resilience, not compliance), ADR 0064
  (the cushion and the repair)
- **Depends on:** ADR 0015 / ADR 0019 (credence as two channels), ADR 0014 (the
  player may always override, so no position is unplayable)
- **Evidence:** `docs/calibration/2026-08-28-the-curdle-and-the-floor.md`
- **Answers:** **D167** (direction). Opens **D170** (status-priced overrides).

## Context

### What was measured

At seed 7 against `--opponent=tyrannical`
(`docs/calibration/2026-08-28-the-curdle-and-the-floor.md`):

| finding | figure |
|---|---|
| benevolence lost that is paid by **witnesses**, not the overridden piece | 78–87% |
| overrides that cost the roster **exactly zero** | 42–57% |
| plies played **after** the first zero-cost override | 62–78% |

The first line is the mechanic working: being rough on one person curdles the
team, and witnesses discount a commander who never wronged them. The owner has
ruled repeatedly that this is the feature, and it stays.

The second and third lines are the defect. Because `τ_benev` clamps at `0` and
never drifts back (ADR 0007 forbids decay toward a baseline), the roster reaches
the floor early and then **stops keeping score**. Past that point insisting is
free, and most of the campaign is played there. Sociologically that is a group
which has lost the ability to sanction and therefore the ability to govern; as a
game it means the second override costs everything and the tenth costs nothing,
which is the opposite of the mirror the owner asked for in D165.

### Where the saturation actually lives

Three separate saturations stack, and only naming all three explains the
measurement:

1. **The cliff input is saturated.** `applyBetrayalSignal` computes
   `logistic(severity × BENEV_BETRAYAL_CLIFF_SCALE)` with `severity = 6` and
   `scale = 4` (`src/psychology/config.ts:44-45,69`), i.e. `logistic(24) ≈ 1`.
   The drop is therefore always the full `BENEV_BETRAYAL_CLIFF_DROP` of `40`,
   whatever the state of the relationship.
2. **The witness pays the same as the target.** `applyOverride` passes the
   identical `OVERRIDE_BENEV_CLIFF_INPUT` to the overridden piece and to every
   witness (`src/psychology/override.ts:20-36`) — even though the trust channel
   right beside it already grades them 4.4:1 (`-35` vs `-8`,
   `src/psychology/config.ts:67-68`). The graded intent exists; it was simply
   never carried into benevolence.
3. **The ledger saturates too.** `ruptureDebt` accrues the same `40` per
   override but is clamped to `[0, 100]` by `clampCredence`
   (`src/psychology/credence.ts:109`, `src/psychology/clamp.ts`), so after three
   overrides even the *record* of what is owed stops growing.

(3) is the one that makes the floor irreversible rather than merely cold: once
benevolence and debt are both pinned, no subsequent act of the commander —
good or bad — changes any number in the room.

## Decision

Keep the broadcast. Remove the saturation beneath it, in three limbs, each an
exposed knob defaulting to today's behaviour.

### 1. Grade the witness cliff

Witnesses take a smaller benevolence hit than the piece actually overridden, as
the trust channel already does. New knob
`OVERRIDE_WITNESS_BENEV_CLIFF_INPUT`, read by `applyOverride` for witnesses
only, defaulting to `OVERRIDE_BENEV_CLIFF_INPUT`'s value so the split is inert
until calibrated.

Note this alone would *not* have changed the measurement, because the logistic
saturates: any input above roughly `1.5` yields the same drop. Limb 1 is only
meaningful in combination with limb 2, which is why they are one ADR.

### 2. Make the cliff proportional, not absolute

A defection costs a fraction of the standing that remains rather than a fixed
40 points:

```ts
const cliff = logistic(severity * BENEV_BETRAYAL_CLIFF_SCALE);
const permille = Math.trunc(BENEV_BETRAYAL_CLIFF_PERMILLE);
const drop =
  permille === 0
    ? Math.trunc(cliff * BENEV_BETRAYAL_CLIFF_DROP)          // today
    : Math.trunc((cliff * clampCredence(tauBenev) * permille) / 1_000);
```

At `permille = 0` this is byte-identical to today. Above zero the decay is
geometric: the first override is the most expensive one, every later override
still costs something, and the roster approaches the floor without ever landing
on it and going numb. It also preserves the mirror — retaliation stays real and
stays contingent on the commander's own act, never on outcomes.

### 3. Let the ledger keep scoring below the floor

`ruptureDebt` gets its own ceiling, `BENEV_RUPTURE_DEBT_CEILING`, defaulting to
`100` (today's `clampCredence` bound). Raising it lets the room keep recording
what is owed after benevolence itself has bottomed out, so a commander who
insists ten times owes more than one who insisted twice, even when both rosters
feel equally cold.

This limb is what actually kills "insisting is free", and it does so without
softening the floor: the cost is *deferred*, not absent. It only bites once
repair is live, since `BENEV_REPAIR_STEP` is still `0` pending D166 — the two
decisions must therefore be calibrated together, and the debt ceiling must not
be raised while repair is inert, or the game will have recorded a debt no act
can ever pay.

### What is explicitly not decided here

**Status-priced overrides** — whether overriding the Queen should cost more
than overriding a pawn. It is the most interesting of the three candidates the
measurement raised, and it needs a standing model that does not yet exist plus
a second calibration re-baseline. Recorded as **D170**, not smuggled in.

## Consequences

- Every existing golden stays byte-identical on the shipped defaults; nothing in
  the committed calibration evidence moves until a magnitude is chosen.
- D166 and D167 become a single calibration pass rather than two: repair step,
  regard step, cliff permille, witness split, and debt ceiling are one response
  surface, which is precisely the grid sweep the harness cannot yet run
  (ADR 0065, *Harness consequences*).
- The `curdle` metrics already emitted for the 08-28 measurement remain the
  acceptance instrument: the pass condition is that the zero-cost override share
  falls sharply while the witness share of total loss stays high. A change that
  fixes the floor by weakening the broadcast has failed, not succeeded.
- ADR 0065's leak mechanic becomes meaningful: a leaked confidence now lands on
  a room that can still register it.

## Alternatives considered

- **Letting `τ_benev` decay back toward a baseline.** Rejected: ADR 0007
  forbids it, and it would make waiting a repair strategy — the exact thing
  ADR 0064 refused.
- **Lowering `BENEV_BETRAYAL_CLIFF_DROP`.** Rejected: it delays saturation
  rather than removing it, and it weakens the first override, which is the one
  the design wants to hurt.
- **Removing the witness broadcast.** Rejected by the owner and by the
  measurement: the curdle is the phenomenon this simulation exists to teach.
- **A hard cap on overrides per match.** Rejected under ADR 0014 — the player
  may always override, so no position is ever unplayable.
