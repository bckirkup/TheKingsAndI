# ADR 0011 — Desertion is an expected-cost decision, and the cascade is intended

- **Status:** accepted — owner decision, 2026-07-26
- **Date:** 2026-07-26
- **Supersedes:** the `T_i <= -75 && M_i === 0` desertion gate in
  `docs/spec/psychology-engine.reference.ts`

## Context
ADR 0003 keeps desertion and removes defection. The reference spec fires
desertion from a hard state trip-wire, which is unreachable (nothing writes
`M_i`) and, more importantly, models no reasoning. The owner states the piece's
actual calculus: deserting escapes the risk of being taken but raises the risk
that the army loses — and a leader can push a whole team into a rout.

## Decision
1. Desertion is decided by comparing expected costs, not by thresholds:
   `U_desert > U_stay`, where staying carries private capture risk and leaving
   raises the shared probability of defeat (`docs/desertion_model.md` §1).
2. `λ_i` — the weight a piece places on the team losing — is a function of trust,
   morale, loyalty, and surviving friendships. Trust is therefore literally the
   coefficient on collective interest.
3. **The cascade is intended behavior.** Each desertion raises `P_loss`, lowering
   the value of staying for everyone else. A player can lose an army in a handful
   of plies, and no artificial damping (cooldowns, caps, morale floors) may be
   added to prevent it.
4. The one permitted brake is a natural consequence, not a patch: deserting in
   front of comrades costs the deserter standing with every witness.
5. Every desertion must be attributable to a visible cause in the audit.

## Consequences
- Free-riding, exploitation of the loyal, and the second-order cost of spending
  pawns all become emergent rather than scripted.
- The detector polarity inverts: a `tyrannical` leader whose roster *never* routs
  is a bug (`docs/desertion_model.md` §6).
- `M_i` stops being load-bearing for reachability (it feeds `λ_i` instead), which
  downgrades D22 from blocking to ordinary wiring.
- Insight reaches the board through desertion even under ADR 0008: a novice
  estimates `P_capture` and `P_loss` from its own shallow view and can panic, or
  fail to leave a lost position.
- Balance risk accepted: a rout is fast and irreversible, so legibility work
  (narration, audit reconstruction) is not optional polish — it is what separates
  the lesson from a bug report.

## Alternatives considered
Threshold desertion (the reference spec's design): trivially testable, but models
no reasoning and cannot produce free-riding or contagion. Damped cascade
(cooldowns/caps): protects the player from a bad afternoon, at the cost of hiding
the exact failure the game exists to teach.
