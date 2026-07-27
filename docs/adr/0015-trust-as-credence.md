# ADR 0015 — Trust is credence: the weight on the leader's judgment

- **Status:** accepted (owner ruling, 2026-07-26); resolves **D19** as option D
- **Date:** 2026-07-26
- **Refines:** ADR 0013 (pieces reason from their own knowledge)

## Context
D19 recorded that `w_loyalty · T_i` spans ±100 while every board term spans ±10,
so trust numerically decides every verdict and the move being evaluated is noise.
Three options were on the table, all of them arithmetic patches: normalize trust,
scale the board terms up, or accept a mood filter.

The owner reframed the problem:

> "He was wrong" and "he was disloyal" are often ambiguous in a more fundamental
> sense; in the minds of people themselves. The unwillingness to substitute
> judgement — doubt, a lack of faith, an unwillingness to do the trust fall — as
> disloyalty.

This is not a scaling question. Trust is not a feeling a piece adds to a move's
value; it is **the willingness to act on a judgment you cannot personally
verify**.

## Decision
Trust enters as a **mixing weight between two evaluations**, not as an additive
term:

```
V_perceived(P_i, m) = (1 − τ_i) · V_own(m, D_i) + τ_i · V_leader_implied(m)
τ_i = credence(T_i, …) ∈ [0, 1]
```

A command is evidence about the position; `τ_i` is how much of that evidence the
piece imports. Refusal becomes *"I cannot make this make sense, and I will not
take it on faith"* — requiring both a bad-looking move and insufficient credence.

Detail and open sub-questions in `docs/credence_model.md`.

## Consequences
- **D19 dissolves.** `τ` is dimensionless and bounded, so there is no scale
  contest — while trust becomes *more* decisive, because it governs what the
  piece perceives the move to be rather than merely how it feels about it. Every
  board, peer, and prejudice term stays live inside `V_own`.
- **The wrong/disloyal ambiguity becomes structural.** One parameter, two honest
  descriptions: "I could not see what he saw" and "he would not act on my word."
  This **revises ADR 0013's audit guidance** — the audit must stop adjudicating
  between them and instead report *he would not take it on faith*, showing both
  evaluations without a verdict. Anything more decisive would claim a
  distinction the model does not contain and people do not honestly make about
  themselves.
- **The competence trap becomes arithmetic rather than a penalty.** An untrusted
  commander's army plays at the average of sixteen shallow views instead of his
  one deep one. Nothing punishes him; his judgment simply cannot reach the board.
- **The dangerous piece is the competent skeptic** — high `E_i`, low `τ`,
  individually reasonable and collectively catastrophic. The debrief should be
  able to name this profile.
- **Faith is worth most where verification is weakest**, so trusted novices play
  above their level and developing a piece partially substitutes for earning its
  trust — a genuine leadership trade-off rather than a mechanic.
- **Cost:** the model needs `V_leader_implied(m)` (D36 — answered in substance
  by ADR 0016: a prior on the leader built from what obedience has cost) and a
  shape for `credence()` (D37). Both are now the blocking pair.
- Fits ADR 0013 exactly: `V_own` is the piece's own depth-`D_i` view, and
  `V_leader_implied` is an *inference from the order*, not the true evaluation.
  The engine's true score still must never reach `psychology/`.

## Alternatives considered
Options A–C under D19 (normalize trust, scale board terms up, accept a mood
filter). All three keep trust and tactics on one additive axis, which is the
thing the owner's framing rejects: doubt is not a quantity added to a move's
value, it is a refusal to adopt someone else's estimate of it.
