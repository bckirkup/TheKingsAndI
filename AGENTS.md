# AGENTS.md — AI Agent Guidelines for The Kings and I

## Repository Purpose
*The Kings and I* (internal codename: Living Chess): chess where the pieces have
persistent identities, memory, trust, class prejudice, and the ability to refuse
orders or walk off the board. Doubles as a leadership-dynamics simulation.
**Status: planning only — no application code exists yet.**

## Read This First
| Doc | Purpose |
|---|---|
| `docs/design_decisions.md` | Decision register — what is settled, what is open. **Check before implementing anything.** |
| `docs/architecture.md` | Target layering and move pipeline |
| `docs/psychology_engine.md` | Math spec restated + reconciliation issues (§10) |
| `docs/spec/psychology-engine.reference.ts` | **Normative** equations, thresholds, coefficients |
| `docs/trust_dynamics.md` | The competence trap: outcome→trust loop, costly signals, intended spiral |
| `docs/desertion_model.md` | Why a piece quits the board; the intended cascade |
| `docs/credence_model.md` | D19: trust as the weight on the leader's judgment |
| `docs/belief_model.md` | How a piece imputes the position — perception, memory, rumor |
| `LICENSING.md` | Dual-license terms and the Stockfish GPL constraint |
| `docs/data_model.md` | Entities, Dexie schema, identity rules |
| `docs/development_plan.md` | Milestones 0–8 and their exit criteria |
| `docs/testing_strategy.md` | Golden + sensitivity testing, balance metrics |
| `docs/llm_integration.md` | Narration port, cost model, safety |
| `docs/risks_and_open_questions.md` | Known hazards |
| `docs/adr/` | Recorded decisions (immutable) |
| `docs/spec/living-chess-srs.md` | Owner's original SRS (requirements source of record) |

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
8. **Accepted design invariants** (ADRs 0002–0012). A commanded move is always
   the move played (insight is advice, ADR 0008). Refusal is free to re-plan; it
   never costs a turn (ADR 0002). Pieces desert; they never defect (ADR 0003).
   Desertion is an expected-cost decision and its cascade must never be damped
   with cooldowns, caps, or morale floors (ADR 0011). Every piece decides from
   its own depth-`D_i` view and the true evaluation must never reach
   `psychology/` (ADR 0013). The player can always override a refusal, so no
   position is ever unplayable (ADR 0014). No piece is ever wrong about *where*
   a piece stands — divergence is interpretive, never perceptual, and rumor
   carries appraisals only, never board facts (ADR 0016). The player never sees
   the arithmetic; a piece's stated reason may be a rationalization, but it must
   always name a cause (ADR 0018). There is no runtime LLM and no API
   key (ADR 0004). Trust never decays toward a baseline on its own (ADR 0007).
9. **Do not resolve an open decision in `docs/design_decisions.md` by writing
   code.** Ask, or implement behind a config flag with both branches tested.
   D19 and D9 are settled (ADR 0015, ADR 0017). The blocking ones are now
   D36–D39 and D41 are settled by ADR 0019 as well, so **no open decision
   blocks Milestone 1–2 code.** Remaining calibration decisions (D35, D40,
   D42–D44) belong to the harness in Milestone 3.

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

## Licensing Hygiene
The project is dual-licensed (AGPL-3.0 + commercial), so **dependency licenses
are a gate**: prefer MIT/BSD/Apache-2.0/ISC and never add a GPL/AGPL-only
dependency without flagging it. Stockfish is GPL-3.0 and is already a known
constraint — see `LICENSING.md`. Contributions require the grant in
`CONTRIBUTING.md`; commit with `git commit -s`.

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
