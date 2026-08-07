---
name: living-chess
description: Orient in and work on The Kings and I (TheKingsAndI) repository — a chess game whose pieces have persistent memory, trust, class prejudice, and the ability to refuse orders or walk off the board. Use for any task in this repo, including planning, architecture, implementation, and balance work.
---

# The Kings and I (TheKingsAndI)

_"Living Chess" is the internal codename only (ADR 0010)._

## What this project is

Chess where the pieces are agents with persistent identities across matches.
They hold trust in the player (`T_i`), morale (`M_i`), capture trauma (`B_i`),
per-peer affinity (`A_{i,j}`), and role-class prejudice (`C_{r,r'}`). Player
utility and piece utility are orthogonal, so orders can be met with enthusiasm,
compliance, quiet quitting, refusal, or desertion. A second product surface
reuses the same telemetry as a leadership-development simulation.

## Current status (check before assuming otherwise)

Milestones 1–6 are substantially in tree: chess substrate; Stockfish 1.3 pool +
shared-search broker (`src/engine/`); psychology + orchestration with live
cascade/witness/sacrifice/costly-signal wiring; sim harness with sweeps;
playable UI; single-player persistence/campaign; authored narration. **Not**
done: Milestone 5b seminar/cohort tasks; supportive desertion calibration; open
**D49** / **D50**. If a task asks to "fix" or "extend" a component, first
verify current behaviour — stubs are rarer than the old Milestone-1 banner
implied.

## Orientation order

1. `docs/design_decisions.md` — the decision register; **do not silently resolve an open one in code**. **Nothing blocks Milestone 1–2 code** as of ADR 0019; remaining decisions (D35, D40, D42–D44) are harness calibration
2. `docs/architecture.md` — layering + the move pipeline (the 7 steps matter)
3. `docs/psychology_engine.md` — the math
4. `docs/development_plan.md` — what milestone we are in and its exit criteria
5. `docs/adr/` — what has already been settled and why

## The invariants that matter most

| Invariant | Why |
|---|---|
| LLM output never re-enters game state | offline play, determinism, testability (ADR 0001) |
| All RNG seeded and explicit | replay, golden tests, bug reproduction |
| Engine search is depth-limited only | wall-clock search makes every golden flaky |
| Event log is the only source of truth | audits/debriefs are folds; no drifting counters |
| `psychology/` is pure | it is the part that must be simulated a million times |
| The King cannot desert | otherwise matches end by psychology, not by chess |
| A commanded move is always the move played | insight is advice only (ADR 0008) |
| Refusal never costs a turn | free re-plan (ADR 0002); the cost is losing the option |
| Pieces desert, never defect | defection is not expressible in legal chess (ADR 0003) |
| The desertion cascade is never damped | a rout is a designed outcome (ADR 0011) |
| No runtime LLM, no API key | personality is an authored tree (ADR 0004) |
| A piece reasons only from its own depth-`D_i` view | the true score must never reach `psychology/` (ADR 0013) |
| The player can always override a refusal | the board is never stuck; the tyrant path is playable (ADR 0014) |

## Common tasks

**Adding a psychological mechanic:** update `docs/psychology_engine.md` first
(the math is the spec), add the reducer + event type, add a golden test at the
new mechanic's boundary values, add a sensitivity probe for its weight, then run
the harness and report metric deltas in the PR.

**Touching the chess layer:** remember chess.js has no piece identity. Any change
to move application must preserve the square→`PieceId` map through captures,
castling, promotion, and en passant. Run the identity fuzz test.

**Touching narration:** narration is presentation-only. If your change makes
prose affect a verdict, a delta, or a save file, it is wrong.

**Balance work:** see the `balance-simulation` skill.

## Anti-patterns specific to this repo

- Implementing "one Stockfish worker per piece" literally (memory blowup — ADR 0005).
- Adding a tuning weight without a sensitivity probe (dead wiring is invisible).
- Storing computed audit aggregates as the only copy (they must be folds).
- Adding cooldowns, caps, or morale floors to "fix" a desertion cascade (ADR 0011).
- Making a piece play a move other than the one commanded (ADR 0008).
- Introducing a runtime model call or an API key (ADR 0004).
- Adding a GPL/AGPL-only dependency without flagging it (`LICENSING.md`).
- Building UI polish before the harness says the model is non-degenerate.
