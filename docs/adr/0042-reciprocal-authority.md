# ADR 0042 — Authority is reciprocal: standing firm and being right pays

- **Status:** proposed
- **Refines:** ADR 0038 (public authority cost for justified refusal), ADR 0019
  (separate benevolence and ability credence), ADR 0024 (warmth is not required
  to win), ADR 0039 (credence prior strength), ADR 0014 (override is always
  available)

## Context

`tau_abil` collapses to zero over a campaign under every leader style,
including servant. The state-of-play report read this as a coefficient problem.
It is not; the channel is structurally one-directional.

Instrumenting a fake-engine campaign gives the ledger:

- **Debit.** An accepted justified refusal charges every *witness* up to
  `REFUSAL_AUTHORITY_LOSS_SCALE = 20` (ADR 0038). With fifteen other active
  pieces, one refusal removes up to ~300 points of ability credence from the
  roster. The magnitude does not shrink with experience.
- **Credit.** A vindicated order pays `trunc(100 / n)` to the *single piece that
  moved*, and ADR 0039 makes `n` grow across a career, so each payment is
  smaller than the last.

No sequence of good orders can service that debt. Decline is therefore
guaranteed wherever refusals occur at all, independent of leader style, which is
exactly what the sweep shows. Raising the prior strength `n₀` shrinks only the
credit side, so ADR 0039's fix — correct in itself, since the old counter was
roster-wide and reset every match — makes recovery *slower* in isolation.

Two defects compound it, and both are wiring rather than design:

1. **The vindication test compares different quantities.** In the headless path
   `objectivelyGood` compares the mover's private *delta* (post-move minus
   pre-move) against the audit's *absolute* post-move score, with no
   best-available-move baseline anywhere in the comparison:

   ```text
   ply 5: actorDelta = -13, audit = 131 → objectivelyGood = false
   ply 9: actorDelta = -45, audit = -123 → objectivelyGood = true
   ```

   A commander is judged incompetent for being ahead and competent for being
   behind. ADR 0019 means something specific by "the order was vindicated at
   `D_max`", and this does not compute it.

2. **The interactive and enemy paths do not test anything at all.**
   `matchSession.applyPostCommitPsychology` calls
   `isObjectivelyGoodMove(x, x)` — the same value as both arguments — so every
   order vindicates; `orderQualityCp` is threaded the whole way in and then
   discarded. `enemyTurn` hardcodes `orderQualityCp` to `40`/`50`.

The owner's ruling on the shape of the fix:

> "There's definitely something at stake if you make difficult calls against
> opposition and win the game..."

## Decision

### 1. Vindication is measured against the piece's expectation

Vindication is relational rather than oracular. The default comparison uses
the piece's own expected value of complying, namely the verdict ladder's
`perceivedValue` term. This is the same credence-weighted, pessimistic
prediction used when deciding whether to refuse:

```text
expectedAbsoluteCp = preMoveAuditCp + round(perceivedValue * 100)
objectivelyGood = playedAuditCp >= expectedAbsoluteCp - tolerance
```

`perceivedValue` is a board-value delta in pawn units; the audit scores are
mover-side absolute centipawns. Adding the expected delta to the pre-move
absolute audit score puts both sides in the same units without passing the
audit score into psychology.

The `VINDICATION_BASELINE` configuration knob defaults to `'expectation'`.
The `'oracle'` branch retains the engine-best comparison:

`objectivelyGood` compares the audit's score for the move actually played
against the audit's score for the best move available at that ply, both
mover-side absolutes from the separate audit stream (ADR 0036):

```text
objectivelyGood = auditScore(played) >= auditScore(best available) - tolerance
```

Both terms come from the same stream in the same units. As with ADR 0038 the
audit is an orchestration-side gate only; the score never enters `psychology/`,
and pieces receive only the resulting per-piece boolean. The interactive and
enemy paths use the same computation as the headless path rather than a
substitute. D111 records the open baseline choice.

### 2. Authority lost in public can be won back in public

ADR 0038 charges the commander when a justified refusal is *accepted*. It has no
counterpart, which is what makes the channel one-directional. When a refusal is
**overridden** and the audit then vindicates the order, the same witnesses who
would have debited the commander credit him instead, on the same obviousness
scale:

```text
authorityGain = trunc(obviousness * ABIL_VINDICATION_GAIN_SCALE)
```

`obviousness` is the refuser's own private view, exactly as in ADR 0038, so the
payment is largest for the orders the roster was most confident were wrong. The
refuser is excluded from the credit, mirroring his exclusion from the debit.

This is what puts something at stake in overriding. Today an override is a
private cost (the overridden piece's trust and trauma, ADR 0014) with no public
upside; under this decision it is a wager against the roster's judgment, settled
by the audit in front of everyone. It also makes ADR 0024 reachable: a cold,
able commander can now build ability credence by being right under objection,
which is the only route that does not run through warmth.

An unjustified refusal that is overridden pays nothing. Symmetry with ADR 0038
is deliberate: the commander is neither charged nor paid when the piece's
objection is not borne out by the audit.

### 3. Winning a contested campaign pays the roster

The per-ply credit settles individual calls. It does not capture the owner's
second condition — *winning* after making hard calls against opposition. At
match end, the roster receives an ability credit scaled by the match result and
by how contested the match was:

```text
contest = refusals overridden and vindicated during the match
matchGain = trunc(result * contest_weight * ABIL_OUTCOME_VINDICATION_SCALE)
```

A win after an uncontested match pays little; a win carried over sustained
objection pays the most; a loss pays nothing rather than charging, since defeat
already charges through every other channel. This is the slower of the two
moments and the one that makes a hard campaign redemptive rather than merely
survivable.

### 4. Both channels ship behind knobs, defaulting off

`ABIL_VINDICATION_GAIN_SCALE` and `ABIL_OUTCOME_VINDICATION_SCALE` default to
`0`, reproducing current behaviour exactly, and each ships with a golden test
and a sensitivity probe. The magnitudes are calibration and belong to the
harness, not to this ADR: D108 and D109 record them. Whether the two channels
are redundant — whether one of them carries all the drama — is D110, and the
sweep is expected to answer it.

## Consequences

`tau_abil` becomes two-directional, so the campaign trajectory stops being a
monotone decline and the detector bands that judge it must be re-ranged with
D105. Golden fingerprints move once either knob is non-zero; with both at `0`
they must not.

Fixing the vindication test changes which orders count as good on every path,
so it moves behaviour on its own, before any credit is paid. This is a
correction rather than a tuning choice: the previous comparison had no
defensible reading.

The hazard the harness must watch is that overriding becomes strictly optimal —
if the expected credit from overriding exceeds the private cost, the crisis menu
of ADR 0040 collapses to a single option before it is even built. The
degeneracy detector for "one option dominates" applies here and should be run
against the override decision specifically.
