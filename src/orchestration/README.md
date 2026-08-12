# Orchestration

Match loop and state mutation — the only layer allowed to mutate match state.
Headless entry: `runHeadlessMatch` in `headlessMatch.ts`. Interactive entry:
`MatchSession` in `matchSession.ts`.

## Pipeline

Both player and enemy plies run psychology. Enemy decisions surface to the
player only as observable behaviour (ADR 0025) — no enemy gauges or cross-side
audit.

1. Build per-piece insight requests (`insight.ts`) with private evaluation
   profiles (`privateEvaluation.ts`, ADR 0037).
2. Resolve through the deterministic query barrier (`src/engine`, ADR 0034).
3. Evaluate verdicts, overrides, desertion cascade, witnesses, costly signals,
   and credence updates (`psychologyHooks.ts`).
4. Commit the chess move and append to the event log.

Enemy plies use `enemyTurn.ts` (refusal collapses to compliant execution for the
AI commander; desertion and fatalistic costs still apply).

## Notable modules

| File | Role |
|---|---|
| `headlessMatch.ts` / `matchSession.ts` | Match entry points |
| `insight.ts` / `evaluation.ts` | Barrier-backed insight + vindication |
| `privateEvaluation.ts` | Per-piece distortion of the shared score |
| `psychologyHooks.ts` | Post-move trust/credence/ability wiring |
| `enemyTurn.ts` | Side-agnostic opponent ply |
| `campaignPolicy.ts` / `campaignConfig.ts` | Dismissal, succession, reputation |
| `rosterActions.ts` | Bench / fire / recruit / retain |
| `pacingConfig.ts` | Consumer ninety-minute cliff beats |

## Gaps

- Three-channel reputation transfer (ADR 0035) still averages scalar credence
- Engine audit stream persistence (ADR 0036) is stored on
  `MatchRecord.engineAudit` as a separate, droppable stream; nomination
  candidates remain event-log records and do not alter psychology or fielding
- Seminar/cohort host surfaces (Milestone 5b) remain harness/world-sim scoped
