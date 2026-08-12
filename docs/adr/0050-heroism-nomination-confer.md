# ADR 0050: Machine nominations, human heroism conferral

Date: 2026-08-14

## Status

Accepted for the nomination-record slice. Thresholds and any headless
conferral stand-in remain open calibration/design decisions.

## Decision

Heroism is a collective human judgement about a piece that performed an
improbable act of duty beyond its own line of sight. The machine may nominate
candidate acts from deterministic evidence, but it never confers an honour.
Only a human cohort may confer heroism, and conferral requires a quorum.
Blame is deliberately asymmetric: it requires only the relevant power, not a
human quorum.

The machine nomination record is event-log traceable by ply, piece, and move;
the numerical private and true evidence remains in its separate orchestration
paths (the true evidence in the ADR 0036 audit stream).
Neither record changes `PieceState`, psychology, fielding, trust, morale,
injury, glory, shame, or reputation. No automatic honour state exists.

## Implementation boundary

The nomination detector is `src/orchestration/heroism.ts`. It requires a
compliant move, private perceived harm, and a decisive true audit result.
`HEROISM_CONFIG` contains the provisional integer thresholds. Persistence
stores true evidence as `MatchRecord.engineAudit`; the event log stores only
the candidate record. The audit stream has no import or input path into
`src/psychology/`.

## Open decisions

- `HEROISM_CONFIG.DECISIVE_MARGIN_CP` requires calibration.
- `HEROISM_CONFIG.PRIVATE_DISAGREEMENT_THRESHOLD_CP` requires calibration.
- A headless-conferral stand-in, if any, remains open and is not implemented.
- Non-selection as the sanction rather than a longer absence term (D129
  bearing), obsolescence rather than trauma-threshold retirement (D130
  bearing), and piece perception of selection state are future slices.
