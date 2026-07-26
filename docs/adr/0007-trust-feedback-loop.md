# ADR 0007 — Trust is a closed feedback loop with no automatic forgiveness

- **Status:** accepted (owner-stated design intent, 2026-07-26)
- **Date:** 2026-07-26

## Context
The reference equation set has no edge from match outcome back into trust, so
the game's premise — a strong chess player losing because the pieces will not
follow him — cannot occur. The obvious stabilizer (a decay term pulling trust
back toward a baseline between matches) would prevent runaway collapse, but the
owner has stated that the runaway *is* the design: a player who does not adapt
should spiral, and recovery should require recognizing that the game is not
exactly chess, over multiple campaigns.

## Decision
1. Match outcome and player conduct write back into `T_i` (`docs/trust_dynamics.md` §2).
2. There is **no unconditional decay toward baseline.** Trust recovers only via
   costly signals — actions that trade board utility for organizational utility.
3. Rates are asymmetric: distrust arrives fast and large, credit accrues slowly.
4. Campaign collapse is a supported terminal state, not a balance bug.
5. The one invariant: no absorbing state exists for a player who *changes
   policy*. The spiral must be escapable by insight and inescapable without it.

## Consequences
- Losing the first campaign is an expected, designed outcome; onboarding, tone,
  and the debrief must carry that weight instead of the balance model softening it.
- The balance harness needs two oracle policies, `pure_tactician` and
  `redeemer`, and their divergence is the subsystem's acceptance criterion
  (`docs/trust_dynamics.md` §5).
- Grievances must be legible even though the solution is not disclosed;
  otherwise the spiral reads as the game cheating rather than as a lesson.
- Cross-campaign roster memory (D27) becomes load-bearing: a remembered roster
  can make campaign 2 unwinnable for reasons the player has already learned from.

## Alternatives considered
- **Decay toward baseline (`ρ · (T_baseline - T_i)`).** Guarantees playability,
  but teaches that mistreatment costs nothing if you wait. Rejected by the owner.
- **Outcome-independent trust** (status quo of the reference spec). Safe,
  testable, and has no game in it.
