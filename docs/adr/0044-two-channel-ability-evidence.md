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
2. **Adjudication:** the existing expectation/oracle comparison and asymmetric
   reducer apply only when the actor was overridden after refusal or a witness
   was near refusal. Near refusal is `utilityScore <= refusalThreshold +
   ABIL_VINDICATION_NEAR_REFUSAL_MARGIN`. Adjudication increments
   `abilityObservationCount`.

The drip magnitude and near-refusal margin remain open calibration decisions
(D114–D115). This ADR supersedes the every-order scope in ADR 0042; ADR 0042
remains proposed for its reciprocal-authority mechanics.

## Consequences

Quiet play supplies a bounded restoring signal without shrinking adjudication
steps. Difficult calls remain rare, asymmetric, and expectation-based.
