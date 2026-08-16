# AGENTS.md — AI Agent Guidelines for The Kings and I

## Repository Purpose
*The Kings and I* (internal codename: Living Chess): chess where the pieces have
persistent identities, memory, trust, class prejudice, and the ability to refuse
orders or walk off the board. Doubles as a leadership-dynamics simulation.
**Status: Core match, psychology, persistence, narration, and headless
world/season slices are in tree; the target community/seminar system is not
fully shipped.** Use `docs/adr/IMPLEMENTATION_STATUS.md` as the authoritative
decided-versus-shipped matrix. In particular, commander-keyed credence,
persisted engine audit truth, capture trauma, the shared community/free-agent
model, and facilitator/cohort host surfaces are not all wired. Do not infer
implementation status from an ADR or the decision register alone.

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
| `docs/engine_licensing.md` | `EnginePort`, engine swap strategy, verified permissive candidates |
| `docs/data_model.md` | Entities, Dexie schema, identity rules |
| `docs/development_plan.md` | Milestones 0–8 and their exit criteria (incl. **Milestone 5b**) |
| `docs/calibration/2026-08-13-blocked-on-measurement.md` | **Current state: the model is degenerate for cold styles and the measurement pipelines are broken.** Read before planning calibration or new mechanics |
| `docs/calibration/2026-08-13-cross-style-table.md` | All nine leader styles measured on 248cd08 — collapse is style-invariant and attrition is saturated; compute footprint is bounded |
| `docs/calibration/2026-08-15-desertion-gradient.md` | **Why style does not change the exit decision:** λ cancels out of the desertion comparison, the discriminator is an attachment knife edge at `tauBenev = 50`, and `DESERTION_STAY_ATTACHMENT_PERMILLE` (D145) measures the fix |
| `docs/calibration/2026-08-16-exit-cost-asymmetry.md` | **Historical D146 diagnosis before ADR 0052:** desertion removed the piece just as capture did without an own-future cost, `P_captured` was a threat flag rather than a probability, and pawn standing was 0 by construction |
| `docs/calibration/2026-08-16-exit-permanence-sweep.md` | **D146 default selection:** the CI-seed measurement adopts exit permanence `625`; seed-7 `750` was unsafe at the smoke boundary |
| `docs/calibration/2026-08-10-state-of-play.md` | Previous harness numbers; tyrannical figures superseded by the 08-13 pass |
| `docs/calibration/milestone-3-engine-wired.md` | Historical post-wiring calibration report |
| `docs/adr/0052-exit-cost-and-capture-probability.md` | D146 exit permanence and static-exchange capture-risk specification |
| `docs/adr/IMPLEMENTATION_STATUS.md` | ADR 0035–0054 decided vs shipped |
| `docs/adr/0053-pawn-hope-and-posthumous-credit.md` | D147 pawn hope, capture truth, and posthumous class credit |
| `docs/calibration/2026-08-18-pawn-hope-sweep.md` | D147 promotion-hope and credence-floor calibration; raw sweep artifacts retained externally |
| `docs/adr/0054-the-seminar-pool-and-what-a-player-knows.md` | D148–D150 seminar-pool direction and open decisions |
| `docs/calibration/2026-08-19-piece-quality-and-the-bench.md` | D149 piece-quality and bench calibration; design-only evidence |
| `docs/testing_strategy.md` | Unit + wiring probes (sensitivity); goldens for settled surfaces |
| `docs/llm_integration.md` | Narration port, cost model, safety |
| `docs/risks_and_open_questions.md` | Known hazards |
| `docs/adr/` | Recorded decisions (immutable) |
| `docs/spec/living-chess-srs.md` | Owner's original SRS (requirements source of record) |

## Non-Negotiable Architecture Rules
1. **Deterministic core, narrative skin.** No LLM output ever re-enters game
   state (ADR 0001). Narration is presentation-only.
2. **Seeded randomness only.** All RNG flows through the seeded PRNG module;
   `Math.random` is banned outside it (by lint). Every match records its seed.
   `Math.exp`/`Math.pow`/`Math.log`/trig/`**` are likewise banned (by lint) in
   `psychology/` and `chess/` — JS engines disagree in the last bits, so a replay
   recorded in one browser must not diverge in another. The deterministic math
   module that replaces them lands with its first consumer (ADR 0032 §4).
3. **Depth-limited engine search only.** `go depth N`, never `movetime`; pinned
   stockfish.wasm version. Wall-clock-dependent search breaks every golden test.
4. **Layer boundaries.** A layer imports only from itself, `src/core/`, and
   layers below it (`app > ui > orchestration > psychology > chess > engine`).
   Importing *upward* is the lint error. `psychology/` is stricter still: it
   receives board features as plain data, so it may import `core/` and chess
   *types*, never `chess/` values, `engine/`, or `ui/`. Orchestration and the
   app composition root may import `engine/` (barrier + port construction).
5. **Event log is the source of truth.** Audits, debriefs, and culture drift are
   folds over the log, never separately maintained counters.
6. **Every config knob gets a wiring (sensitivity) probe** — changing the knob
   must change a quantitative output. Prefer unit tests + wiring probes while
   coefficients are still moving; pin exact golden numbers only for settled
   surfaces (see `docs/testing_strategy.md`). A parsed-but-unwired knob is a
   review failure. See the `ci-test-design` skill. A decision may not be
   recorded as answered while its governing state has no implementing write:
   the register entry must carry an implementing `file:line`, or an explicit
   **not wired** marker, and its status must agree with
   `docs/adr/IMPLEMENTATION_STATUS.md`.
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
   D19 and D9 are settled (ADR 0015, ADR 0017); D36–D39 and D41 by ADR 0019;
   D51 by ADR 0021; D48 by ADR 0034. Remaining calibration decisions
   (D35, D40, D42–D44) belong to the harness in Milestone 3. **Open architecture
   decisions must not be resolved silently in code.** D49 and D50 are resolved
   by ADRs 0035 and 0036. (D54 is resolved by ADR 0021; D52/D53 by ADR 0023.)
   Engine results reach psychology only through a per-ply barrier: issued and
   collected in `PieceId` order, frozen, with the seeded PRNG drawn only after
   it closes — `Promise.race`/`Promise.any`/wall-clock timeouts are banned in
   `engine/` and `orchestration/` (ADR 0034). Situation keys are role-abstract —
   they name relationships and events, never board objects — and content ships
   as data packs, so the exec-lab track is a rename rather than a fork. Warmth
   is not required to win: a cold, highly able leader must be able to win a
   career, and `τ_benev` buys resilience rather than compliance (ADR 0024). Both
   armies are led: the opponent is a commander with a real roster, difficulty is
   an opposing *leader policy* and never an engine depth, and no enemy
   psychological state may reach the player except as observable behaviour
   (ADR 0025). Pieces are **community entities**, not save-file contents: capture
   is never permanent, accumulated trauma across *all* commanders can retire a
   piece permanently, and a free agent may decline a commander (ADR 0026).
   Single-player must remain whole with AI commanders only. A world lives exactly
   as long as its curriculum and pieces do not outlive it; only claims about the
   *player* leave — gameable achievements, and an evidence-backed, replay-
   verifiable Certificate of Completion (ADR 0029). The King is a character,
   not the player's avatar: uniform `PieceState`, unpruned attention, and his
   credence is a mandate, not an obedience gate (ADR 0021). Dismissal continues
   the campaign under the King's command with the player spectating, and the
   successor's success or failure is computed from roster state, never scripted
   (ADR 0022).

## Setup
```bash
pnpm install
pre-commit install
```

## Validation Commands
```bash
pre-commit run --all-files
pnpm lint # eslint + prettier check
pnpm typecheck # tsc --noEmit, strict
pnpm test # vitest run
pnpm test:coverage # lcov for the SonarQube gate (ADR 0033)
pnpm sim --matches=20 --leader=tyrannical # Lozza default; use --engine=fake in CI
pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4
```
See the `typescript-toolchain` and `sonarqube-quality-gate` skills.

## Planned Layout
```
src/core/ seeded PRNG, canonical encoder, deterministic math — depends on nothing
src/app/ React shell, routing, theme provider, onboarding tracks
src/ui/ board, overlays, gauges, dashboards (no game logic)
src/orchestration/ match loop; only place allowed to mutate match state
src/psychology/ pure reducers: utility, verdicts, trust/affinity/class bias
src/chess/ chess.js wrapper, piece-identity map, threat features
src/engine/ stockfish.wasm pool + insight broker
src/narrative/ template dialogue + optional LLM adapter
src/persistence/ Dexie schema, migrations, roster export/import
sim/ headless CLI harness, scripted AI leaders, metrics
docs/ planning documents and ADRs
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
- New config keys ship with a wiring (sensitivity) probe; add a golden only
  when the surface is intentionally frozen.
- Decisions that are expensive to reverse ship with an ADR.
- Balance-affecting changes include before/after harness metrics in the PR body.
