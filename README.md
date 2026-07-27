# The King and I: Sacrifice and Command

**A chess game of sacrifice and command.**

The pieces under your command are not wooden automata. They remember every match
you have played together. They trust you, or they do not. Rooks hold Pawns in
contempt until a Pawn dies to save one. Push a piece too far and it will obey
badly, refuse outright, or walk off the board — and once one walks, the rest can
follow in a matter of moves.

You can be the better chess player and still lose, because being right is not
the same as being followed.

The King and I layers a persistent multi-agent psychology model over standard
chess rules, and reuses the same telemetry as a leadership-dynamics simulation:
a post-match audit of how you led, and a campaign debrief of the culture you
built. *(Internal codename: Living Chess.)*

---

## Status

**Planning.** No application code yet. This repository holds the architecture,
the mathematical specification, the development plan, and the decision register.

| Document | What it answers |
|---|---|
| [docs/design_decisions.md](docs/design_decisions.md) | **What is decided, and what is still open** |
| [docs/architecture.md](docs/architecture.md) | How the system is layered; the move pipeline |
| [docs/psychology_engine.md](docs/psychology_engine.md) | Utility, verdicts, affinity, class prestige, benching decay |
| [docs/spec/psychology-engine.reference.ts](docs/spec/psychology-engine.reference.ts) | Normative equations and default coefficients |
| [docs/trust_dynamics.md](docs/trust_dynamics.md) | Why a strong player loses early, and how the spiral is escaped |
| [docs/desertion_model.md](docs/desertion_model.md) | Why a piece walks off, and why the rout is intended |
| [docs/credence_model.md](docs/credence_model.md) | Trust as the willingness to substitute the leader's judgment for your own |
| [docs/data_model.md](docs/data_model.md) | Entities, persistence, identity rules |
| [docs/development_plan.md](docs/development_plan.md) | Milestones 0–8, exit criteria, estimates |
| [docs/testing_strategy.md](docs/testing_strategy.md) | Golden + sensitivity tests, balance metrics |
| [docs/llm_integration.md](docs/llm_integration.md) | Narration layer and how personality is authored |
| [docs/risks_and_open_questions.md](docs/risks_and_open_questions.md) | What is most likely to go wrong |
| [docs/adr/](docs/adr/) | Accepted decisions |
| [docs/spec/living-chess-srs.md](docs/spec/living-chess-srs.md) | The owner's original SRS |

## Design in one paragraph

Player utility and piece utility are orthogonal. Each piece `P_i` carries trust
`T_i`, morale `M_i`, capture trauma `B_i`, a per-peer affinity map `A_{i,j}`, an
immutable six-trait vector, and its own class-prestige map `C_{i,role}` — its
prejudices toward each rank, which shift only from what it personally witnesses.
You always command the move; what the piece decides is whether to *accept* the
order, how well it counsels you, and ultimately whether to stay on the board at
all. Desertion is its own arithmetic: leaving escapes the risk of being taken but
raises the risk that the army loses, and how much a piece cares about the army
losing is exactly what your leadership has bought. Everything that touches game
state is deterministic, seeded, and replayable.

## What is decided

- **Refusal is free to re-plan** — no lost turn. The cost is that your best move
  is no longer available to you. ([ADR 0002](docs/adr/0002-refusal-turn-cost.md))
- **Desertion, never defection.** A piece may quit the board; it never joins the
  other side. ([ADR 0003](docs/adr/0003-desertion-not-defection.md))
- **Insight is advice.** A commanded move is always the move played.
  ([ADR 0008](docs/adr/0008-insight-is-advice-only.md))
- **Capture is trauma, not death.** Pieces return; the damage persists.
  ([ADR 0009](docs/adr/0009-capture-is-trauma-not-death.md))
- **The spiral is the lesson.** Losing compounds distrust and there is no
  automatic forgiveness. ([ADR 0007](docs/adr/0007-trust-feedback-loop.md))
- **A rout is a designed outcome, not a bug.**
  ([ADR 0011](docs/adr/0011-desertion-cascade.md))
- **A piece knows only what it can see.** It reasons from its own shallow view,
  so it can refuse a winning move in good faith.
  ([ADR 0013](docs/adr/0013-pieces-reason-from-own-knowledge.md))
- **You can always force a move** — and pay for it, in front of everyone.
  ([ADR 0014](docs/adr/0014-refusal-override.md))
- **No runtime LLM.** Personality is authored offline and shipped as a
  deterministic tree. ([ADR 0004](docs/adr/0004-llm-key-strategy.md))

## Planned stack

React 18 + TypeScript + Vite · chessground · chess.js · stockfish.wasm ·
Dexie (IndexedDB) · Vitest. Web build first, Steam via a Tauri shell later
([ADR 0012](docs/adr/0012-distribution.md)). Offline-first: no server, no
account, no API key, ever.

## For AI agents

Start with [AGENTS.md](AGENTS.md) and the skills in
[.agents/skills/](.agents/skills/): `living-chess`, `psychology-engine`,
`balance-simulation`, `narrative-llm`, `ci-test-design`.

## License

Dual-licensed: **AGPL-3.0** (see [LICENSE](LICENSE)) or commercial terms — see
[LICENSING.md](LICENSING.md) and [ADR 0006](docs/adr/0006-licensing.md).
Contributions require the grant in [CONTRIBUTING.md](CONTRIBUTING.md).
