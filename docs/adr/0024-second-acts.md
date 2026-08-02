# ADR 0024 — Second acts: the cold winner, fatalistic compliance, the boss's own verdict, and the diminished command

- **Status:** accepted (owner ruling, 2026-07-27)
- **Resolves:** **D60** (ability/benevolence substitution), **D61** (fatalistic
  compliance), **D62** (the King's independent results channel), **D63**
  (diminished second appointments)
- **Refines:** ADR 0019 (two channels), ADR 0021 (mandate), ADR 0022
  (succession), ADR 0023 (career structure)

## Context

> **"One of the best models for this game is ultimately Steve Jobs; famously
> Americans have no second acts, but he was all second acts. Other models
> probably include Patton, and a number of Civil War generals."**

The career structure of ADR 0023 was built around failure and recall but assumed
a single shape of recovery. The historical models say otherwise, and three of
them contradict what the model currently supports.

## Decision

### 1. Ability can carry a cold leader — but with no shock absorber (D60)
Second-act Jobs was not warmer. He was *right*, visibly and repeatedly. Patton
was feared and revered simultaneously and produced results. If the simulation
only rewards warmth it teaches "be nice and you win," which is false and dull.

So a **high-ability / low-benevolence equilibrium must be viable**, and the
asymmetry that keeps it honest is:

> `τ_benev` is **variance insurance.**

- A cold leader with extreme `τ_abil` retains compliance *while winning*.
- A losing streak gives him nothing to draw on, and collapse is immediate.
- A warm leader survives bad runs; a cold one survives only good ones.

This is the real finding, it is testable, and it means the game rewards two
distinct viable strategies with different failure profiles rather than one
virtue.

### 2. Fatalistic compliance is its own verdict (D61)
At Fredericksburg, Union soldiers pinned their names to their coats before a
charge they believed was suicide — **and went anyway.** That is neither
compliance nor quiet quitting, and collapsing it into `COMPLIANT_EXECUTION`
throws away the most haunting outcome this simulation can produce.

```
FATALISTIC_COMPLIANCE
  the piece's own evaluation says the order is likely fatal (high P_capture(i))
  credence is too low to make it make sense
  it executes at full effort anyway
```

The cost does not land on the move — it lands on the **witnesses** and on the
piece's own future willingness. A leader can spend an army this way and see
nothing wrong in the move log, which is precisely the point.

### 3. The King judges results himself, so a beloved commander can be fired (D62)
McClellan's army adored him; he would not fight; Lincoln removed him over the
roster's objection — twice, with a recall in between. Under ADR 0021 as written,
mandate falls mostly through rumor *from the roster*, so this cannot happen.

The King therefore maintains his **own `τ_abil`** in the player, formed from
results rather than from the room. Two independent dismissal paths follow:

| Path | Cause | Roster's reaction |
|---|---|---|
| Fired by the room | mandate eroded via rumor | relief; rout-adjacent |
| Fired by the boss | the King's results channel | protest; the army liked you |

Both are recognizable to any leader, and the second is currently impossible.

### 4. Second appointments are diminished, not merely harder (D63)
Jobs's second act began at NeXT: a small command, low stakes, a cheap place to
rebuild `τ_abil`. Patton's began with a decoy army he was not allowed to fight
with.

So act two is a **lesser** appointment — fewer strong identities available, a
lesser king, less at stake — rather than the same game with the difficulty
raised. Rebuilding the ability channel is cheap there because the stakes are
small, which makes the return to a real command something earned twice.

### 5. The second act is where the game means something
Act one teaches the player that this is not chess. Act two is the only place he
can demonstrate that he learned it. The design takes Jobs's side of the
Fitzgerald line, and content investment should follow: a thin act one and a rich
act two, not the reverse.

## Consequences

**Verdict ladder changes.** `FATALISTIC_COMPLIANCE` is inserted between
`QUIET_QUITTING` and `HEROIC_EXECUTION` in evaluation order — see
`docs/psychology_engine.md` §6. It is the first verdict whose entire cost is
borne outside the move.

**New degeneracy detector — the saint's monopoly.** If no cold, high-ability
leader policy can reach a winning career, D60 has failed and the game is
moralizing. The harness needs a `cold_winner` oracle policy alongside
`pure_tactician` and `redeemer`.

**New degeneracy detector — invulnerable cold streak.** If a cold winner
survives a sustained losing run as well as a warm leader does, `τ_benev` is not
functioning as variance insurance and the two channels have collapsed in
practice even if their correlation looks fine.

**New degeneracy detector — no McClellan.** If dismissal never occurs while
roster mandate is high, the King's results channel is inert (D62).

**Calibration knob.** The substitution rate between channels — how much `τ_abil`
buys in the absence of `τ_benev` — is the sharpest knob created here. Too high
and warmth is pointless; too low and the cold winner is unplayable.

## Alternatives considered
- **Warmth required for compliance.** Rejected: it makes the game a morality
  play and contradicts the strongest historical models.
- **Fatalistic compliance as a flag on `COMPLIANT_EXECUTION`.** Rejected: the
  witness and future-willingness costs differ enough that it needs a verdict of
  its own, and the audit must be able to count it.
- **Uniform second appointments.** Rejected: identical acts make recovery a
  difficulty setting rather than a story, and they waste the cheapest place to
  rebuild ability.
