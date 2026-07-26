---
name: psychology-engine
description: Modify or extend the Living Chess psychology model — trust, morale, grief, dyadic affinity, class bias, move utility, verdict ladder, witnessed events, and firing decay — without breaking determinism or balance. Use when changing anything under src/psychology/ or docs/psychology_engine.md.
---

# Working on the Psychology Engine

The psychology engine decides how a piece feels and whether it obeys. It is the
product. It is also the part that runs a million times inside the balance
harness, so it must stay pure, integer-clamped, and fast.

## Normative source

`docs/spec/psychology-engine.reference.ts` is the owner's machine-readable
equation set and is normative for names, formulas, thresholds, and defaults.
`docs/psychology_engine.md` restates it and lists reconciliation issues in §10
(trust-term dominance, `w_prestige` and `B_i` dead-wired, morale has no update
rule so mutiny is unreachable). Those are **open decisions D19–D24** — do not
quietly "fix" them in code.

## Contract

```
evaluateMoveResponse(actor, moveEval, allActivePieces)
  -> { verdict, utilityScore, refusalThreshold, effectiveSearchDepth, engagementFactor }

verdict ∈ HEROIC_EXECUTION | COMPLIANT_EXECUTION | QUIET_QUITTING
        | MORAL_REFUSAL | DESERTION_MUTINY
```

- **Pure.** No I/O, no `Date.now()`, no `Math.random()`. RNG, if ever needed,
  arrives as an injected seeded generator.
- **No upward imports.** `psychology/` never imports `engine/`, `chess/` internals,
  or `ui/`. Board information arrives as a plain `boardFeatures` value object.
- **Deltas, not mutations.** Return events; the orchestrator folds them.

## Procedure for changing the model

1. **Spec first.** Edit `docs/psychology_engine.md`. If the change alters a
   formula, show the old and new form. The doc is the review artifact; the code
   is the implementation of it.
2. **Name the weight.** Every new coefficient goes in the single `weights` config
   object with a documented default and range. No magic numbers inline.
3. **Clamp and budget.** All fields clamp to range after every fold, and per-ply
   total movement stays inside the swing budget (~25 trust points/ply from all
   sources). Large narrative swings must require repeated behavior, not one ply.
4. **Test both roles** (see `ci-test-design`):
   - golden: exact utility/verdict at the boundary values of each ladder rung;
   - sensitivity: change only the new weight → fingerprint or metric differs.
5. **Invariant suite** (`docs/psychology_engine.md` §11) must pass unchanged.
6. **Harness before/after.** Run `pnpm sim` for at least `tyrannical` and
   `supportive` leaders and paste the metric table into the PR. Check the
   degeneracy detectors in `docs/testing_strategy.md` §4 — a change that zeroes
   out mutiny or saturates refusal is a regression even if all unit tests pass.

## Modeling guidance

- **Asymmetry is a feature.** `A_{i,j} != A_{j,i}`. Do not "simplify" affinity
  into a symmetric matrix; contempt flowing one way is the point.
- **Class prestige is per piece and *blended*, not a fallback.** `Φ` uses
  `(A_{i,j} + C_{i,role(j)}) / 200`, so personal bond and class prejudice always
  combine. Each piece owns its own `classPrestige` map and updates it only from
  events it witnessed.
- **Traits are immutable; state is not.** Personality (`Θ_i`) is rolled once.
  Trust, morale, and grief move. Resist the urge to let events edit traits.
- **Insight belongs in utility.** A novice piece must compute a genuinely worse
  `ΔEval`, not merely give worse hints — but its reasoning must always be
  inspectable, or errors read as the game cheating.
- **Quiet quitting is `η_i → 0.2`,** not a special case in the move pipeline;
  desertion is `η_i = 0.1`, `D_i = 1`.
- **Watch term scales.** Utility mixes `T_i` (±100) with board terms (±10) and
  `Φ` (≤ `w_empathy` per peer). Any new term must be scaled deliberately against
  `Θ_refusal(T_i) = -50 + (100 - T_i)·0.5`, or it will be inert (see D19).
- **Sacrifice attribution is engine-based.** A capture is a "sacrifice" only if
  it removed a threat to a peer or enabled a forced winning line. Heuristics
  ("a pawn died near a rook") produce nonsense gratitude and destroy the
  narrative's credibility.

## Failure modes seen in comparable systems

| Failure | Symptom | Fix |
|---|---|---|
| Threshold cliff | pieces flip loyal↔mutinous on one ply | per-ply swing budget, hysteresis on verdict bands |
| Punishment spiral | one bad ply → unrecoverable roster | decay toward baseline between matches, capped `B_i` |
| Inert relationships | `C` variance ≈ 0 after 20 matches | raise class-shift velocity; verify witnessed events fire |
| Sycophant meta | player min-maxes high-loyalty traits | trait trade-offs: loyalty correlates with lower insight |
