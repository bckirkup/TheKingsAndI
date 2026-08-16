# ADR 0053 — Pawn hope, capture truth, and posthumous class credit

Status: Accepted for the mechanism slice; calibration defaults remain open.

## Context

At the selected D146 exit permanence, measured departures were overwhelmingly
pawns and their held standing cost was often zero because initial Pawn prestige
is negative. The event log also declared capture events without emitting them,
leaving capture-aware audit prose unreachable.

## Decision

Capture resolution emits `CAPTURE` with the victim and mover in every
orchestration path. A captured piece whose recent move was witnessed as a
sacrifice grants surviving witnesses bounded, clamped class prestige for the
dead role. The posthumous class shift and look-back window are configurable.

Pawn promotion prospect is deterministic integer permille data, mirrored for
both sides and damped, but not erased, by a blocker on the pawn's file.
Prospect is carried through plain-data move evaluations and contributes a
prospective standing term when `DESERTION_PROMOTION_HOPE_PERMILLE` is enabled.
That term is additionally scaled by the piece's `τ_abil` credence: hope about
promotion is leadership-conditional belief in competence, not warmth.

The posthumous class-shift default is in the same family as living heroic
credit but smaller, so a death can establish class worth without overpowering
a living hero. The chosen promotion-hope default is **TBD** pending the D147
sweep. The “why this number” calibration rationale is **TBD**.

## Implementation

- `src/chess/features.ts:112-151,331-365`
- `src/psychology/types.ts:55-126,220-235`
- `src/psychology/desertion.ts:186-320`
- `src/orchestration/psychologyHooks.ts:68-96`
- `src/orchestration/headlessMatch.ts:310-318`
- `src/orchestration/matchSession.ts:626-748`
- `src/orchestration/enemyTurn.ts:99-115,249-267`
