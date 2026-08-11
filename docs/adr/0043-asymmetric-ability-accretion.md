# ADR 0043: Asymmetric, Curved Ability Accretion

- **Status:** proposed
- **Date:** 2026-08-10

## Context

The ability account is persistent across a career. A symmetric
`trunc(100 / n)` observation step has two defects: truncation eventually makes
the account unable to revise, and an accepted bad order can debit authority
more quickly than a good order can restore it. A linear step also ignores the
current level of confidence.

The owner ruled that ability trust should scale to the campaign: trust can be
broken quickly and rebuilt gradually. A deep-career piece must still be able to
revise its read, while a piece near maximum confidence should be difficult to
impress and easy to disappoint.

## Decision

`applyAbilityObservation` remains a pure, deterministic, integer-clamped
reducer. It keeps the persistent observation count and prior strength, but
derives a minimum-one base step:

```text
baseStep = max(1, trunc(ABIL_BAYES_NUMERATOR / (observationCount + n₀)))
```

For curvature strength `c` and current ability credence `τ`:

```text
gainStep =
  max(1, trunc(baseStep * (100 + c * (100 - τ)) / (100 * (c + 1))))

lossStep =
  max(1, trunc(baseStep * (100 + c * τ) / 100))
             * ABIL_VINDICATION_LOSS_MULTIPLIER
```

Vindicated observations add `gainStep`; falsified observations subtract
`lossStep`. Both results are clamped to `[0, 100]`. The integer-rational form
avoids banned transcendental operations and is replay-stable across JavaScript
engines.

The shipped starting values are deliberately calibration inputs rather than
owner rulings:

```text
ABIL_VINDICATION_LOSS_MULTIPLIER = 2
ABIL_VINDICATION_CURVATURE = 2
```

D112 and D113 remain open for calibration. D107 is superseded and resolved in
the no-freeze direction by this ADR.

## Consequences

- Ability accretion cannot permanently freeze from truncation.
- A falsified observation moves ability farther than a vindicated observation.
- Gains shrink as `τ_abil` approaches 100; losses grow with the current level.
- The reducer remains deterministic, pure, integer-valued, and bounded.
- Existing persistent accounts require no schema change because the new
  quantities are configuration knobs and the observation count already
  migrates to zero for legacy records.
- Campaign fingerprints move because the first observations use the new shape.
  Calibration evidence must report those changes rather than overwrite anchors
  silently.
