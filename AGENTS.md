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
| `docs/calibration/2026-08-13-cross-style-table.md` | All nine leader styles measured on 248cd08 — collapse is style-invariant and attrition is saturated; compute footprint is bounded. **Superseded by the 08-26 coverage pass:** outcome is no longer style-invariant |
| `docs/calibration/2026-08-26-npc-coverage-and-the-envelope.md` | The nine-style span at the `random` opponent; its outcome-ceiling reading is superseded by the 08-27 pass. Still current for the per-style compute spread (10 s–348 s per match, fake engine) and the promotion-column CSV corruption |
| `docs/calibration/2026-08-27-the-competent-opponent-and-the-two-axes.md` | **Read before any coverage sweep:** sweeps run `--opponent=tyrannical` (the 100.00 four-way tie was a `random`-opponent artifact; win score there ranges 10–82.5), the care/insistence quadrants are now populated, and the emotional axis is *still* two points, so **no containment number may be quoted** |
| `docs/calibration/2026-08-28-the-curdle-and-the-floor.md` | **Read before ruling D166:** ~half of all overrides cost the roster nothing because benevolence is already clamped at `0`, most plies are played after that point, and 78–87% of the loss falls on witnesses rather than the overridden piece — the structural question is D167 |
| `docs/calibration/2026-08-15-desertion-gradient.md` | **Why style does not change the exit decision:** λ cancels out of the desertion comparison, the discriminator is an attachment knife edge at `tauBenev = 50`, and `DESERTION_STAY_ATTACHMENT_PERMILLE` (D145) measures the fix |
| `docs/calibration/2026-08-16-exit-cost-asymmetry.md` | **Historical D146 diagnosis before ADR 0052:** desertion removed the piece just as capture did without an own-future cost, `P_captured` was a threat flag rather than a probability, and pawn standing was 0 by construction |
| `docs/calibration/2026-08-16-exit-permanence-sweep.md` | **D146 default selection:** the CI-seed measurement adopts exit permanence `625`; seed-7 `750` was unsafe at the smoke boundary |
| `docs/calibration/2026-08-17-harness-plays-chess.md` | Harness diagnosis and before/after measurement: repetition truth, pawn advancement, and promotion telemetry |
| `docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md` | Current re-baseline evidence: every calibration opponent was `random`, saturating win score and invalidating `plain_chess_win_delta` |
| `docs/calibration/2026-08-10-state-of-play.md` | Previous harness numbers; tyrannical figures superseded by the 08-13 pass |
| `docs/calibration/milestone-3-engine-wired.md` | Historical post-wiring calibration report |
| `docs/adr/0052-exit-cost-and-capture-probability.md` | D146 exit permanence and static-exchange capture-risk specification |
| `docs/adr/IMPLEMENTATION_STATUS.md` | ADR 0035–0054 decided vs shipped |
| `docs/adr/0053-pawn-hope-and-posthumous-credit.md` | D147 pawn hope, capture truth, and posthumous class credit |
| `docs/calibration/2026-08-18-pawn-hope-sweep.md` | D147 promotion-hope and credence-floor calibration; raw sweep artifacts retained externally |
| `docs/adr/0054-the-seminar-pool-and-what-a-player-knows.md` | D148–D150 seminar-pool direction and open decisions |
| `docs/adr/0062-the-decision-journal-and-the-llm-player.md` | How a model may play at all: offline journal, enumerated options, no live LLM |
| `docs/adr/0063-two-duties-coverage-and-containment.md` | **The NPCs owe coverage, the models owe containment;** D159–D164 answered, D165 answered by ADR 0064 |
| `docs/adr/0064-the-cushion-and-the-repair.md` | **Care cushions benevolence and rupture can be repaired;** D165 and D166 answered, with regard and repair live |
| `docs/adr/0065-the-confidence-and-the-culture.md` | **D168 and D169 ruled; only the D169 consumer is wired, and it is inert:** a private word that may not be kept. The channel must exist; good news makes poor gossip but still reaches the recipient's intimates; a favour for one reads as care to close affinities and as favoritism to the rest; no act in it is free. `leaderAppraisal` is now read by the ability-credence weight (derived, never stored) behind a zero-default knob; rumor diffusion still runs only in the desertion cascade, so nothing writes a non-zero appraisal yet |
| `docs/adr/0066-the-floor-under-the-curdle.md` | **D167 ruled, partly live:** the witness broadcast stays (being rough on one piece curdles the room), the proportional cliff is live at its D166 magnitude, and D170/D174 are ruled by ADR 0070 with their mechanism live under D176 at multiplier `500` and standing price `2000`. The rupture-debt ceiling remains inert under the repair-versus-accrual constraint, and D175 is ruled: the asymptote truncates down and is accepted as shipped behavior |
| `docs/adr/0067-the-cold-engine-contract.md` | **D171 ruled — the engine is cold:** Lozza's transposition table survived between searches, so an evaluation depended on the search history while the cache key and the query barrier assumed it did not. The engine is now cleared (`ucinewgame`) before every search, the cold/warm policy is part of `determinismId`, and the ladder LRU may be bounded. **Every Lozza number in `docs/calibration/` was taken warm and is re-baselined; do not quote it beside a cold run.** Fake-engine evidence is unaffected |
| `docs/adr/0068-the-runaway-and-the-unsound-score.md` | **D172 ruled — the artifact is patched and the engine is not believed.** Lozza's aspiration loop never returns once the window is maximal (two conditions, carried as a recorded diff under `vendor/lozza/patches/`, upstream `namanthanki/lozza#4`), and the deeper defect is that a root search can return `INF` — reported as `score mate -500` and previously parsed into a plausible *losing* score for a won position. An implausible mate distance is engine unsoundness, answered by a deterministic re-search one ply deeper (at most twice, then a loud failure); `mate 0 → 29_999` is withdrawn. The adapter's runaway guard is an output-volume ceiling that **fails**, never truncates, and never a wall clock or a bindable `nodes` budget. **Lozza evidence from before this ADR carries a different artifact hash — do not quote it beside evidence taken after it** |
| `docs/adr/0069-the-canonical-ladder-rung.md` | **D173 ruled — the rung is the value:** ladder reuse remains the shipped policy, so its identity is recorded in the Lozza and Stockfish `determinismId`; both broker per-position caches are bounded under the cold contract, and a future ADR 0062 fork must replay the parent's per-piece `D_i` and ladder search depths |
| `docs/adr/0070-graded-witness-loss-and-standing-price.md` | **D170 and D174 ruled; D176 ruled in the dated addendum:** each witness prices the overridden piece through its own affinity and class prestige, standing can only raise the witness charge, and the mechanism is live at multiplier `500` and standing price `2000`. The ruling is ledger-focused, not a demonstrated conduct improvement |
| `docs/adr/0071-captivity-and-the-exchange.md` | **D177 ruled — being taken is being held; not wired:** capture puts the piece in the captor's hands with its state intact, and an exchange settles at the end of every match, bounded by what each side holds. Attrition survives but stops being automatic; an unexchanged captive judges its own commander for the omission and its square is filled by a replacement, making roster social density an outcome of leadership. Choosing whom to ask back is the observable-favoritism act. D181–D183 are ruled in principle and D184/D185 remain open, all not wired: the exchange settles in money out of the **cycle purse**, ransom terms are private so the roster sees only who came home (**§5's observable-exchange claim is withdrawn**), a piece appraises itself against a persistent expectation relative to role, and pieces hold cash and may spring themselves. Every magnitude is inert by default, and the draft economy is not connected to the default match path, so no committed calibration number describes this economy |
| `docs/adr/0072-retirement-and-grace.md` | **D186 and D187 ruled; retirement live, grace wired inert (2026-08-30 amendment):** trauma at `ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD` permanently ends a non-King **career** on every path, including the campaign boundary, and one threshold now serves both paths. **A square is a seat and a career is a seat plus a generation** (D189 answered): retirement closes `${seatId}#${generation}`, increments the seat, and the next match fields a fresh career with no memory of its predecessor. Trauma relief exists as **grace**: unearned, unpurchasable, no leader-controlled input in the term (not standing, purse, credence, style, result, or whether the commander ransomed the piece), no credit to the leader, drawn from the campaign's seeded PRNG at the match boundary, never anticipated (ADR 0011), falling on both armies; `applyGrace` writes only `B_i` and relief is flat — expectation-relative *registration* waits on D182. `GRACE_RATE_PERMILLE`/`GRACE_RELIEF` default to `0` and consume no PRNG draw. **D188's old gate is withdrawn** on the owner's ruling that evil pays in the mid run: the gate is now a trajectory (a cruel style may lead at 10–20 matches; its advantage must not widen, its permanent costs must accrue, and grace may not flatten them). **D190** (the boundary has no event stream, so retirement and grace are derived metrics) is open |
| `docs/calibration/2026-08-29-the-cold-engine-and-the-runaway.md` | **Read before any Lozza run:** cold search costs +13%–61% per ply and slightly *less* peak RSS (the ladder LRU is bounded now); `ms_per_match` is not the honest comparison because cold changes the engine's answers and therefore the game. It also records two positions where Lozza's aspiration loop never returns and the child dies of heap exhaustion — warm and cold alike, `MultiPV` 1 and 8 alike — which is D172 |
| `docs/calibration/2026-08-29-the-response-surface-under-the-curdle.md` | **Read before ruling D166 or choosing any D167 magnitude:** the first joint measurement of the five D166/D167 knobs (194 cells, fake engine, seed 7). The proportional cliff is the only knob that removes the free-insistence floor and it is non-monotone (an interior window at or below 250 permille); `OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` cannot grade anything from inside a saturated logistic; `BENEV_RUPTURE_DEBT_CEILING` is unreachable while repair ≤ 30; regard and repair both *enlarge* the fall rather than cushioning it; and **no behavioural metric moves anywhere on the surface** |
| `docs/calibration/2026-08-29-the-graded-witness-surface.md` | **Read before interpreting D176's ruled cell:** the joint D170/D174 surface on the two conditions that still carry free insistence. Grading the witness *down* removes free insistence over a campaign (0.3411 → 0.0000) even though it widens the per-state truncation band — depletion dominates truncation, so the safe direction for `OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE` is down, not up. The standing price sits on the same axis and re-opens the floor at `8000`; the live cell is `500` / `2000`. This is a ledger ruling, not a demonstrated conduct improvement |
| `docs/calibration/2026-08-29-the-roster-nobody-stays-in.md` | **Read before choosing any D168/D169 magnitude or judging D170's effect too weak:** the roster turns over almost completely every match (mean survivors 1.95 of 16 fielded for `tyrannical`, 2.85 for `redeemer`), through capture (10–15 per match) rather than desertion (0–5). Only 1–2 pieces survive five or more matches out of twenty, while survivors hold strong but very sparse bonds (2–4 non-zero affinity edges, mean |affinity| ~67), which is why half of all witness attachments at override time are exactly zero. Own-side captures are a subtraction residual because the harness has no player-side capture counter |
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
