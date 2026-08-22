# ADR 0057 — App-side private squad fielding

- **Status:** Accepted and wired
- **Date:** 2026-08-20
- **Scope:** Offline career persistence and match orchestration
- **Related:** ADR 0026, ADR 0051, ADR 0054, ADR 0056

## Context

The career path historically bootstrapped only the sixteen starting pieces and
fielded every `ACTIVE` state. That made benching, firing, capture, and
desertion reduce the next match below sixteen chairs, despite capture being
non-permanent under ADR 0026. The harness chair contest is now shipped in
orchestration; the private career path must use the same rules without adding a
lineup-picker UI.

## Decision

New careers bootstrap a deterministic depth-two private squad (31 members)
using the shipped squad IDs and distinct authored names. Legacy careers retain
their existing sixteen members and therefore remain depth one; migration
invents no members.

The app selects exactly sixteen chairs through `fieldSquad`, with
origin-inclusive eligibility, highest-first chair contests, deduplication, and
chair-role write-back. The default player policy is
`strongest_available`. Optional pinned IDs model explicit commander choices,
but no UI sets them in this slice.

Each squad member receives one `SQUAD_FIELDING` event per match: either the
selected chair or `passed_over`. Availability, service, non-selection streaks,
redemption after return, recovery after desertion, capture return, and
obsolescence are reconstructed by folding match events. `pieceStates` remains
the persisted psychological snapshot, not a second availability table.

Capture removes a member for the match but does not permanently retire her.
Retirement is permanent for trauma at the shipped threshold or for the
configured obsolescence streak; its event distinguishes the obsolescence
cause. Conscription fills any genuinely empty non-King chair deterministically
from the career match sequence and records identity and provenance.

The private bench is offline and player-local. Shared market/free-agent
behavior, campaign-scale promotion/cohort prestige (D148), and commander
knowledge boundaries (D150) remain out of scope.

## Consequences

The army remains sixteen on the board after benching, firing, desertion, or
capture. A crowned pawn can contest the Queen chair and return to her Pawn
origin chair when she loses that contest. The same fielding rules are reusable
by the app and harness, while the event log remains the source of truth for
service and availability.

## Implementation

- `src/app/careerBootstrap.ts:49-79` — depth-configured deterministic squad
  bootstrap and identity names
- `src/app/squadCareer.ts:180-480` — event-log fold, selection, conscription,
  and post-match lifecycle merge
- `src/orchestration/squadFielding.ts:130-221` — shared fielding rules and
  lifecycle fold
- `src/orchestration/lineup.ts:1-58` and
  `src/orchestration/matchSession.ts:45-66` — squad IDs installed on the
  standard board
- `src/psychology/types.ts:270-292` — squad fielding and obsolescence events
- `src/persistence/service.ts:33-185` — passed-over service fold
- `src/persistence/types.ts:10-51` and `src/persistence/migrations.ts:8-31` —
  schema version 2 and forward-only legacy migration
- `src/app/App.tsx:99-166` — career-path selection, event preamble, and merge
- `tests/appSquad.test.ts` — bootstrap, chair, pin, policy, and depth probes
