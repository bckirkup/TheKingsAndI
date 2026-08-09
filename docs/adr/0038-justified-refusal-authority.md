# ADR 0038 — Public authority cost for justified refusal

- **Status:** accepted
- **Refines:** ADR 0002 (free refusal and re-plan), ADR 0013 (private
  evaluation), ADR 0019 (separate benevolence and ability credence), ADR 0024
  (warmth and ability are separable), ADR 0036 (separate engine audit stream)

## Context

The owner described the intended leadership signal as:

> “a commander should perhaps lose a little face from everyone else by having
> to listen to the piece on a decision even the piece could see... and yes, the
> control should be a commander of matched skill, not a very good chess engine.”

Refusal remains free to re-plan and never costs a turn. Without a public cost,
however, a commander can repeatedly issue orders that pieces correctly reject
and receive a free second opinion. The cost is evidence about competence, not
intent: it belongs in the ability channel, not benevolence.

## Decision

When a refusal is accepted rather than overridden, orchestration compares the
commanded move with the separate audit stream. A refusal is **justified** only
when both the refusing piece's own view and the audit view rate the move below
zero. The audit score is used only as an orchestration-side gate; it never
enters `psychology/`.

For a justified refusal, the refusing piece's own private view determines
obviousness:

```text
obviousness = clamp(-deltaV_board_i / 2.5, 0, 1)
authorityLoss = trunc(obviousness * REFUSAL_AUTHORITY_LOSS_SCALE)
```

The `2.5` board-value range is structural rather than another configuration
knob. A fake-engine breadth run found justified private-view losses from
`0.01` to `2.46`, with medians from `0.96` to `1.93`; using the observed
two-and-a-half-pawn range preserves a gradient across ordinary disagreements
instead of charging the full amount for every refusal. A refusal beyond that
range still saturates at the configured maximum. Witnesses receive only the
public refusal and its derived authority-loss event, not the true audit score.
Every active roster member other than the refusing piece loses that amount from
`tau_abil`; `tau_benev` is unchanged.

An unjustified refusal has zero authority loss. The commander is not charged
when the piece's private objection is contradicted by the audit. ADR 0002 still
applies: no refusal costs a turn, and an override avoids this correction signal.

The existing plain-chess control already is a matched-skill,
psychology-disabled commander: it uses the same scripted leader policy,
effective strength, opponent policy, seeds, and match configuration, with the
psychology fold absent. The control redesign therefore changes detector-6's
interpretation and reporting, not the chess computation. Reports retain the
legacy label and add the matched-skill label for the identical value so the
attribution is explicit; no stronger-engine counterfactual is used.

## Consequences

Accepted justified refusals can reduce roster-wide ability credence and thereby
change later perceived values without changing benevolence. The event log
records whether the refusal was justified and the applied loss, preserving
replay auditability. The true audit remains outside the psychology layer.
