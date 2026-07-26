# TheKingAndI — *Living Chess*

**A chess game of sacrifice and command.**

The sixteen pieces under your command are not wooden automata. They remember
every match you have played together. They trust you, or they do not. Rooks hold
Pawns in contempt until a Pawn dies to save one. Push a piece too far and it will
obey badly, refuse outright, or walk off the board.

Living Chess layers a persistent multi-agent psychology model over standard chess
rules, and reuses the same telemetry as a leadership-dynamics simulation:
a post-match audit of how you led, and a campaign debrief of the culture you built.

---

## Status

**Planning.** No application code yet. This repository currently holds the
architecture, the mathematical specification, the development plan, and the list
of decisions that must be made before implementation starts.

| Document | What it answers |
|---|---|
| [docs/design_decisions.md](docs/design_decisions.md) | **What the owner must decide, and when** |
| [docs/architecture.md](docs/architecture.md) | How the system is layered; the move pipeline |
| [docs/psychology_engine.md](docs/psychology_engine.md) | Utility, verdicts, affinity, class prestige, benching decay |
| [docs/spec/psychology-engine.reference.ts](docs/spec/psychology-engine.reference.ts) | Normative equations and default coefficients |
| [docs/data_model.md](docs/data_model.md) | Entities, persistence, identity rules |
| [docs/development_plan.md](docs/development_plan.md) | Milestones 0–8, exit criteria, estimates |
| [docs/testing_strategy.md](docs/testing_strategy.md) | Golden + sensitivity tests, balance metrics |
| [docs/llm_integration.md](docs/llm_integration.md) | Narration layer, cost model, safety |
| [docs/risks_and_open_questions.md](docs/risks_and_open_questions.md) | What is most likely to go wrong |
| [docs/adr/](docs/adr/) | Decisions already recorded |
| [docs/spec/living-chess-srs.md](docs/spec/living-chess-srs.md) | The owner's original SRS |

Note: `docs/psychology_engine.md` §10 lists six reconciliation findings against
the reference implementation (trust dominates utility ~10×; `w_prestige` and
`B_i` are dead-wired; morale has no update rule, so mutiny is currently
unreachable). They are tracked as decisions D19–D24.

## Design in one paragraph

Player utility and piece utility are orthogonal. Each piece `P_i` carries trust
`T_i`, morale `M_i`, grief `B_i`, a per-peer affinity map `A_{i,j}`, an immutable
six-trait vector, and its own class-prestige map `C_{i,role}` — its prejudices
toward each rank, which only shift from what it personally witnesses. For every
proposed move the piece computes its own utility — using an
engine evaluation whose *depth is a function of its experience and engagement* —
and answers with enthusiasm, compliance, quiet quitting, refusal, or mutiny.
Everything that touches game state is deterministic and replayable; the LLM only
writes the prose. Verdicts are `HEROIC_EXECUTION`, `COMPLIANT_EXECUTION`,
`QUIET_QUITTING`, `MORAL_REFUSAL`, `DESERTION_MUTINY`, decided by comparing the
piece's utility against `Θ_refusal(T_i) = -50 + (100 - T_i)·0.5`.

## Planned stack

React 18 + TypeScript + Vite · chessground · chess.js · stockfish.wasm ·
Dexie (IndexedDB) · Vitest · optional LLM narration (provider-agnostic, BYO key).
Offline-first: no server, no account, no API key required to play.

## For AI agents

Start with [AGENTS.md](AGENTS.md) and the skills in
[.agents/skills/](.agents/skills/): `living-chess`, `psychology-engine`,
`balance-simulation`, `narrative-llm`, `ci-test-design`.

## License

AGPL-3.0 (see [LICENSE](LICENSE)) — **licensing posture is an open decision**,
see [ADR 0006](docs/adr/0006-licensing.md).
