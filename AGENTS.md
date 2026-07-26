# AGENTS.md — AI Agent Guidelines for TheKingAndI (Living Chess)

## Repository Purpose
Living Chess: chess where the pieces have persistent identities, memory, trust,
class prejudice, and the ability to refuse orders or mutiny. Doubles as a
leadership-dynamics simulation. **Status: planning only — no application code
exists yet.**

## Read This First
| Doc | Purpose |
|---|---|
| `docs/design_decisions.md` | Open decisions the owner must make. **Check before implementing anything.** |
| `docs/architecture.md` | Target layering and move pipeline |
| `docs/psychology_engine.md` | Math spec: utility, verdicts, affinity, firing decay |
| `docs/data_model.md` | Entities, Dexie schema, identity rules |
| `docs/development_plan.md` | Milestones 0–8 and their exit criteria |
| `docs/testing_strategy.md` | Golden + sensitivity testing, balance metrics |
| `docs/llm_integration.md` | Narration port, cost model, safety |
| `docs/risks_and_open_questions.md` | Known hazards |
| `docs/adr/` | Recorded decisions (immutable) |
| `docs/spec/living-chess-srs.md` | Owner's original SRS (source of record) |

## Non-Negotiable Architecture Rules
1. **Deterministic core, narrative skin.** No LLM output ever re-enters game
   state (ADR 0001). Narration is presentation-only.
2. **Seeded randomness only.** All RNG flows through the seeded PRNG module;
   `Math.random` is banned outside it. Every match records its seed.
3. **Depth-limited engine search only.** `go depth N`, never `movetime`; pinned
   stockfish.wasm version. Wall-clock-dependent search breaks every golden test.
4. **Layer boundaries.** A layer imports only from layers below it
   (`app > ui > orchestration > psychology > chess > engine`). `psychology/`
   receives board features as plain data; it must not import `engine/` or `ui/`.
5. **Event log is the source of truth.** Audits, debriefs, and culture drift are
   folds over the log, never separately maintained counters.
6. **Every config knob gets a golden test AND a sensitivity test.** See the
   `ci-test-design` skill. A parsed-but-unwired knob is a review failure.
7. **Never modify tests to make them pass** — fix the implementation.
8. **Do not resolve an open decision in `docs/design_decisions.md` by writing
   code.** Ask, or implement behind a config flag with both branches tested.

## Setup (once code lands; not yet applicable)
```bash
pnpm install
pre-commit install
```

## Validation Commands
Docs-only phase (now):
```bash
pre-commit run --all-files
```
After Milestone 0:
```bash
pnpm lint          # eslint + prettier check
pnpm typecheck     # tsc --noEmit, strict
pnpm test          # vitest run
pnpm sim --matches=20 --leader=tyrannical   # headless balance smoke
```

## Planned Layout
```
src/app/            React shell, routing, theme provider, onboarding tracks
src/ui/             board, overlays, gauges, dashboards (no game logic)
src/orchestration/  match loop; only place allowed to mutate match state
src/psychology/     pure reducers: utility, verdicts, trust/affinity/class bias
src/chess/          chess.js wrapper, piece-identity map, threat features
src/engine/         stockfish.wasm pool + insight broker
src/narrative/      template dialogue + optional LLM adapter
src/persistence/    Dexie schema, migrations, roster export/import
sim/                headless CLI harness, scripted AI leaders, metrics
docs/               planning documents and ADRs
```

## Code Conventions
- TypeScript strict; no `any`, no non-null `!` without justification.
- Pure functions in `psychology/` — no I/O, no clock, no RNG except an injected
  seeded generator.
- Discriminated unions for events and verdicts; exhaustive `switch` with a
  `never` default.
- Money/score-like numbers stay integers where possible (trust, morale, affinity
  are integer-valued, clamped).

## PR Requirements
- Lint, typecheck, tests, and headless sim smoke all pass.
- New config keys ship with a golden test and a sensitivity probe.
- Decisions that are expensive to reverse ship with an ADR.
- Balance-affecting changes include before/after harness metrics in the PR body.
