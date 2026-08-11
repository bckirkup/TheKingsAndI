# ADR 0045 — Board belief, pivotality, and the impending-loss shadow

- **Status:** proposed
- **Date:** 2026-08-01

## Context

ADR 0013 requires desertion to use each piece's own depth-limited knowledge.
The previous implementation used rumor as the only changing army-loss belief
and treated every departure as the same flat loss increment.

## Decision

Desertion now derives four explicit terms:

1. The absolute post-move private score is mapped to a board-implied loss
   probability with a monotone rational map, using a configurable centipawn
   scale.
2. That board read is blended with `rumor.pLossTeam`; capture stress remains an
   additional private danger signal.
3. Departure loss is role-weighted pivotality: conventional material weights
   are summed over active non-King peers, and the departing piece's share is
   multiplied by a configurable scale.
4. A single shadow attenuation, driven by `P_lossIfStay`, scales both private
   capture pain and anticipated standing cost. The collective term is not
   attenuated.
5. The residual stake is endogenous attachment that starts near one and is
   eroded by alienation. The existing `DESERTION_RESIDUAL_STAKE` value remains
   the floor. Alienation is measured from neutral baselines: trust at
   `T_i = 0` and benevolence credence at `tauBenev = 50` contribute zero.
   Trust below neutral, low benevolence credence, trauma, and negative dyadic
   affinity erode attachment; loyalty resists that erosion. Absence of formed
   bonds is not itself alienation.

This refines ADR 0003's desertion semantics without changing its boundary:
desertion still removes a piece from a legal board, and the King remains
ineligible. It also makes ADR 0013's private-knowledge requirement concrete for
the team's loss belief. The new magnitudes remain open calibration decisions.
The former global residual stake was not a neutral coefficient: it gave every
deserter the same discount on the army's fate. The first implementation of
attachment accumulated it from loyalty and positive affinity, which incorrectly
treated an unacquainted fresh roster as detached; that alternative is rejected.
The subsequent distance-from-perfection reading also incorrectly treated
neutral trust as betrayal. The corrected attachment measures departure from
neutral, so an untouched piece has zero alienation and full exposure.
Alienation, rather than unfamiliarity or mere imperfection, is the route to
detachment. The floor remains reachable by configuration.

Enemy-side turns currently have no per-piece private insight available. Their
feature-based evaluation path therefore explicitly supplies a zero score,
meaning a dead-level board read (`pLossBoard = 0.5`) rather than an implicit
claim of a real private evaluation. Supplying enemy private insight remains a
known limitation.

## Consequences

Rumor remains a social channel rather than the sole board belief. A queen's
departure is more pivotal than a pawn's on the same roster, and survivor shares
rise as the roster empties. No cooldown, morale floor, or artificial cascade
cap is introduced.
