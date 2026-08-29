# ADR 0070 — Graded witness loss and per-witness standing price

- **Status:** accepted (2026-08-29) — owner ruled D170 and D174 together.
- **Refines:** ADR 0014 (the player can always override), ADR 0066 (the
  witness/target curdle)
- **Answers:** **D170** and **D174**.
- **Leaves open:** **D176**, the live magnitudes for the two new knobs.

## Context

An override has two benevolence consequences: the overridden piece prices what
was done to it, while each witness registers what the commander did to another
piece. The existing target and witness paths both call the same betrayal
signal, and the witness sigmoid input is saturated. A different input cannot
grade the witness reliably; the witness drop needs its own multiplier.

D170 resolves onto the witness limb. The cost depends on the target's standing
in each witness's own eyes: each witness prices the override by its bond to the
overridden piece, so the same act can land unevenly across the room. There is
no roster-wide standing aggregate. The target's own charge remains unchanged.

## Decision

The mechanism is wired but ships inert until D176 chooses the magnitudes.

1. **Witness multiplier (D174).** `applyBetrayalSignal` accepts an optional
   trailing `scalePermille`, defaulting to `1000`, and applies it inside the
   final integer drop calculation. `OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE`
   defaults to `1000`, so the witness path is byte-identical to the shipped
   path.
2. **Per-witness standing price (D170).** `witnessAttachmentPermille` combines
   the witness's dyadic affinity for the target and the prestige it grants the
   target's role:

   ```text
   clampPermille(trunc((affinity + prestige) * 5))
   ```

   `applyOverride` computes a separate witness scale for each witness. The
   standing factor is always at least `1000`; attachment may only raise a
   witness's charge above the base and can never discount it. Indifference and
   dislike both floor at zero attachment. A discount would reintroduce a
   free-insistence route through unpopular pieces and teach a leader to be cruel
   efficiently, contrary to the D166/D167 curdle correction.
3. **Preserved semantics.** The overridden piece's betrayal charge is
   unchanged. The witness trust penalty is unchanged. Existing `PSYCH_DELTA`
   events already carry the measured benevolence deltas, so graded witness
   values enter the audit stream without an event-shape change. The separate
   `calculateStandingCostComponents` in `src/psychology/desertion.ts` remains
   untouched because it computes a roster-normalised aggregate of the piece's
   own standing in float pain units, not this per-witness override price.

The defaults are deliberately inert:

```text
OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE = 1000
OVERRIDE_STANDING_PRICE_PERMILLE = 0
```

## Consequences

- Existing override target and witness benevolence, rupture debt, trust
  penalties, and audit events remain byte-identical at default configuration.
- The two knobs are now independently testable, but their live magnitudes must
  be chosen jointly because the standing factor multiplies the witness
  multiplier.
- D176's acceptance gate is a sweep-level condition: the chosen magnitudes
  must not increase `free_insistence_ply_fraction` above the post-#151
  baseline. The unit-level zero-charge threshold is a measured change detector,
  not a promise that no witness charge can ever truncate to zero; D175 remains
  accepted.

## Alternatives considered

- **Use a different witness sigmoid input.** Rejected: the existing logistic is
  saturated across the useful input range and cannot provide graded witness
  loss.
- **Discount unpopular targets.** Rejected: standing factors below `1000`
  would make overrides of disliked pieces cheaper, reopening the free-
  insistence route and rewarding cruelty.
- **Use a roster-wide standing aggregate.** Rejected: D170 is explicitly
  per-witness and must preserve asymmetric bonds and class prejudice.
