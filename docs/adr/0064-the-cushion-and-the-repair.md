# ADR 0064 — The cushion and the repair: what earns benevolence

- **Status:** accepted (2026-08-27) — owner ruling on **D165**; ships at the
  control default (`BENEV_REGARD_STEP = 0`, `BENEV_REPAIR_STEP = 0`), so the
  mechanism is wired and inert until a measured default lands as **D166**.
- **Refines:** ADR 0024 (warmth is not required to win), ADR 0015 (credence as
  the weight on the leader's judgment)
- **Depends on:** ADR 0002 (refusal never costs a turn), ADR 0007 (trust never
  decays toward a baseline), ADR 0013 (a piece reasons from its own view),
  ADR 0014 (the player may always override), ADR 0018 (a piece always names a
  cause), ADR 0026 (pieces are community entities)
- **Evidence:**
  `docs/calibration/2026-08-27-the-competent-opponent-and-the-two-axes.md`
- **Opens:** **D166** (the measured defaults)

## Context

D164 widened the NPC span on care and insistence, and the emotional axis did not
move: `τ_benev` ends at 82.1 for `supportive` against ≤ 12.4 for every other
style, including the highest-care style in the harness at 5.7. The cause is not a
magnitude. `tauBenev` has exactly three writers, and reading them settles it:

| write | magnitude | fires when | source |
|---|---:|---|---|
| heard signal | **+15** | the actor plays a move *it* privately values as losing while the leader's implied view was better | `src/orchestration/psychologyHooks.ts:177-188` |
| betrayal cliff | **−40** | the commander overrides a refusal; saturated, since the logistic input is `6 × 4 = 24` | `src/psychology/override.ts:20-37` |
| neglect erosion | **−3** | the piece refuses a move that was objectively good | `src/orchestration/headlessMatch.ts:662-668` |

Three properties follow, none of them intended:

1. **Only obedience earns the channel.** The single gain requires the piece to
   comply with an order it believes loses value. Honouring a refusal earns
   nothing at all — the no-override branch has no benevolence credit.
2. **Care is illegible.** No benevolence write reads capture risk or any other
   protective feature, so a commander cannot become trusted by protecting
   anyone.
3. **Rupture is terminal.** One override costs ≈ 2.7 acts of faith and there is
   no repair term, so a single conflict is unrecoverable within a career.

That makes `τ_benev` a **compliance meter**, which directly contradicts ADR 0024
("`τ_benev` buys resilience rather than compliance"), and it compounds in the
exit decision: `benevolenceGapPermille = (50 − tauBenev) × 20`, capped at
`1_000` (`src/psychology/desertion.ts:116-119`), is `0` for `supportive` and
`752`–`885` for every style that ever overrode. Desertion pressure is therefore
close to a binary switch on *did you ever override*.

The owner's ruling of 2026-08-27 states the target directly:

> Definitely number 2 is important and number 3 must be possible. People say
> that regular positive feedback is necessary to cushion a relationship against
> the inevitable conflict. But no hope of recovery is a disaster in any game
> theory construct. The best [iterated prisoner's dilemma strategy] is mirror
> and forgive.

## Decision

Benevolence stops being a compliance meter. It becomes an account with three
properties borrowed from tit-for-tat: **retaliatory** (the cliff is unchanged),
**cushioned** (ordinary protective command accrues credit), and **forgiving**
(a rupture is repayable, at a cost, and legibly).

### 1. The cliff stays exactly as it is (mirror)

`applyBetrayalSignal` is not softened. A piece that does not register betrayal is
a doormat, and a game that teaches doormat is worse than one that teaches fear.
Retaliation also stays contingent on the *commander's* defection rather than on
outcomes: overriding and being proved right is still an override, which is the
leadership lesson the seminar exists to teach.

### 2. Protective command accrues regard (the cushion)

A new writer credits `BENEV_REGARD_STEP` when the commander has repeatedly
ordered a piece into positions that neither risk nor harm it:

```text
regard accrues to the actor when, for BENEV_REGARD_STREAK_PLIES
consecutive commanded moves of that piece:
    moveEval.P_captured  <= BENEV_REGARD_RISK_CEILING   // the order was safe
    moveEval.deltaV_board >= 0                          // and it did not cost me
then: tauBenev += BENEV_REGARD_STEP, and the streak resets
```

Three deliberate choices. The step is **small and streak-gated**, mirroring the
existing `applyAbilityDrip` / `ABILITY_DRIP_STREAK_PLIES = 3` precedent, so
regard is *regular positive feedback* rather than a lump sum, and a commander who
mixes in sharp orders never accumulates it. It reads `P_captured` — the piece's
own capture-risk estimate, already computed for the refusal decision — so care
becomes legible **without** exposing true engine evaluation to psychology
(ADR 0013). And it is the actor's own view, so a commander cannot buy regard by
being right; only by being safe.

### 3. A rupture is repayable, once, and legibly (forgiveness)

`CredenceState` gains one persisted integer, `ruptureDebt`:

```text
on override:               ruptureDebt += drop            (clamped 0..100)
on an honoured refusal:    repaid = min(ruptureDebt, BENEV_REPAIR_STEP)
                           tauBenev   += repaid
                           ruptureDebt -= repaid
                           emit REPAIR { pieceId, ply, repaid }
```

Four properties this must have, all of them consequences of the ruling:

- **Repair pays more than obedience.** `BENEV_REPAIR_STEP > BENEV_HEARD_STEP`,
  because in an iterated game the move that restores cooperation after a
  defection is worth more than a fresh cooperative move.
- **Forgiveness never exceeds the harm.** Repayment is bounded by the debt, so
  overriding and then honouring one refusal cannot leave a piece *better* off
  than never having been overridden. There is hope of recovery; there is no
  cheap absolution.
- **It is legible.** `REPAIR` is an event, so the piece can name the cause
  (ADR 0018) and the player can learn the rule. An illegible forgiveness rule
  teaches nothing, which in a seminar is the whole cost.
- **It is not decay.** Nothing repays itself with time; only the commander's own
  act of honouring a refusal repays it, which keeps ADR 0007 intact.

### 4. It ships inert, and the defaults are their own decision

`BENEV_REGARD_STEP` and `BENEV_REPAIR_STEP` default to `0`, which makes the
control byte-identical: every existing golden, digest and determinism ID is
unchanged by this ADR, and `ruptureDebt` is accounted but spends nothing. The
mechanism is therefore wired and measurable, and choosing the live magnitudes is
**D166**, to be ruled on a before/after sweep at seed 7 against
`--opponent=tyrannical`, reporting `τ_benev` spread, desertions and refusal
churn per style. Enabling them re-baselines committed calibration evidence, so
that flip is a separate PR with its own golden re-baseline.

## Consequences

- "Firm and caring" becomes a reachable quadrant: `exacting` can hold high
  `τ_benev` while still insisting, which is the combination the D164 sweep proved
  impossible today.
- The desertion alienation term stops being a switch on *did you ever override*,
  because a repaired relationship crosses back above the
  `benevolenceGapPermille` knee.
- Insecure attachment stops being hardwired: the question of whether the
  powerful party is the one who cares least becomes a *strategy* the player can
  lose or win at, rather than an assumption the engine encodes.
- One new persisted field means a Dexie migration (`version 4`) defaulting
  `ruptureDebt` to `0` for every existing relationship account, and
  `relationshipAccounts` keyed per commander means the debt is **per
  relationship** — a piece can be owed by one commander and not another, which
  is what ADR 0026's community entities require.
- Two new config keys ship with wiring probes (AGENTS.md rule 6), and a third
  invariant test asserts `BENEV_REPAIR_STEP > BENEV_HEARD_STEP` whenever repair
  is live, so a future tuning pass cannot silently make obedience the better
  deal again.

## Rejected alternatives

- **Soften the cliff.** Cheaper than repair, and it removes the mirror: a
  commander who overrides constantly would drift only slowly downward, which
  teaches that conflict is minor rather than that it is repairable.
- **Decay `ruptureDebt` over plies or matches.** Directly violates ADR 0007 and,
  worse, teaches that waiting is a strategy for being forgiven.
- **Credit regard from the audit stream** (was the order *objectively* safe).
  Would leak true evaluation into psychology (ADR 0013) and would reward being
  right rather than being careful.
- **Let honouring a refusal earn benevolence unconditionally**, with no debt.
  Deference alone would then dominate, which is the mirror image of today's bug
  and the reading the sweep already found wanting — `cold_winner` overrides least
  among the cold styles and still ends at 12.4.
- **A fourth credence channel** for warmth. More expressive, but every consumer
  (desertion, counsel, draft, narration) would need a new weight, and the
  evidence says the existing channel is mis-*written*, not mis-*shaped*.
