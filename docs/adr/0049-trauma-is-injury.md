# ADR 0049: Trauma is injury, not grievance

Date: 2026-08-13

## Status

Accepted for the injury wiring slice. Magnitudes and thresholds remain open
calibration decisions.

## Decision

`B_i` represents injury. Being captured is violence and applies a flat
victim-side trauma increment before the victim leaves the active roster.
Sustained expectation of capture is also injury: when a piece's private,
depth-limited capture-risk estimate remains above the serious-risk threshold
through the configured run length, it receives a small trauma increment after
the commander has had an opportunity to relieve the threat.

Being overruled or ignored is grievance, not injury. Override therefore changes
trust and morale but does not write `B_i`. Capture injury is not scaled by
standing, affinity, prestige, sacrifice meaning, or role. No trauma decay is
introduced.

## Implementation

The pure reducers live in `src/psychology/trauma.ts:10-42`. Orchestration applies
them before roster synchronization on both player and enemy paths in
`src/orchestration/headlessMatch.ts:336-358` and
`src/orchestration/headlessMatch.ts:442-454`; the enemy move capture is returned
by `src/orchestration/enemyTurn.ts:265-286`. The private-risk source remains the
existing per-piece desertion estimate; true engine evaluation does not enter
the psychology reducer.

## Open calibration

`CAPTURE_TRAUMA_GAIN`, `DREAD_CAPTURE_RISK_THRESHOLD`, `DREAD_TRAUMA_GAIN`, and
`DREAD_REQUIRED_PLIES` are provisional knobs. Their defaults require balance
harness calibration and are not claims about final psychological magnitudes.
