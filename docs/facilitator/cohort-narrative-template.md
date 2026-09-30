# Cohort narrative (template)

The room-level readout — one narrative over all players' journals and
transcripts, written by the facilitator after the session. Host-side prose
only: this document is folded from committed logs and never touches game
state. `{fields}` resolve from each player's debrief; `{{cohort.*}}` fields
are computed across the room.

---

# {cohortName} — {sessionDate}

{playerCount} commanders sat. {cohort.careersCompleted} careers concluded.
The room's verdict, in one line: **{cohort.oneLineVerdict}**.

## What the room did

- Mean Leadership Index: {cohort.meanLeadershipIndex}
- Spread: {cohort.leadershipSpread} points between best and worst
- Endings: {cohort.victories} victories, {cohort.checkmates} outplayed, {cohort.dismissals} dismissed, {cohort.routs} routed, {cohort.ongoing} still campaigning
- Commendation rate: {cohort.commendationRate}% of seats earned at least one award

## The three rooms inside the room

{cohort.styleClusters}

## Individual verdicts

{#players}
### {commanderName} — {epilogueHeadline}

{playerSummary}

Commendations: {commendationList}

{/players}

## What the cohort learned (facilitator read)

{cohort.lessonsLearned}

## Rooms to re-seat

{#cohort.reSeats}
- {commanderName}: {reSeatReason}
{/cohort.reSeats}
