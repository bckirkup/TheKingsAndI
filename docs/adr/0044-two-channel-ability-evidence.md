# ADR 0044 — Two channels for ability evidence

**Status:** proposed
**Date:** 2025-02-14

## Context

Applying the difficult expectation-baseline adjudication to every executed
order convicts ordinary developing moves too often. Conversely, a quiet
stretch without disaster is evidence of competent leadership, but should not
consume the finite Bayesian observation budget used by difficult calls.

## Decision

Ability evidence is split into two deterministic channels:

1. **Drip:** after each piece has completed an uninterrupted three-ply safe
   stretch, a small integer gain is awarded. A safe ply has non-negative
   private board delta and no friendly loss. The counter is per active piece,
   resets on a blunder, friendly loss, desertion, or match boundary, and is
   not persisted across matches. Drip is weighted toward vulnerability and
   low standing using existing capture risk, `E_i`, and class prestige.
   Drip does not increment `abilityObservationCount`.
   Drip gains are satiated by current `tauAbil` using the same integer-rational
   curvature discipline as ADR 0043. For raw drip amount `g`, curvature `c`,
   and current credence `tau`, the adjusted gain is:

   ```text
   g' = trunc(g * (100 + c * (100 - tau)) / (100 * (c + 1)))
   ```

   Positive raw gains retain a one-point minimum after truncation.
   `ABIL_DRIP_CURVATURE` is a separate calibration knob.
2. **Adjudication:** the existing expectation/oracle comparison and asymmetric
   reducer apply only when the actor was overridden after refusal or a witness
   was near refusal. Near refusal is `utilityScore <= refusalThreshold +
   ABIL_VINDICATION_NEAR_REFUSAL_MARGIN`. Adjudication increments
   `abilityObservationCount`.

The drip magnitude, near-refusal margin, and drip curvature remain open
calibration decisions (D115–D117). This ADR supersedes the every-order scope in
ADR 0042; ADR 0042 remains proposed for its reciprocal-authority mechanics.

## Consequences

Quiet play supplies a bounded, satiating restoring signal without shrinking
adjudication steps. Both channels therefore obey the same non-linear credence
discipline; otherwise unconditional drip would dominate at high ability
credence. Difficult calls remain rare, asymmetric, and expectation-based.
