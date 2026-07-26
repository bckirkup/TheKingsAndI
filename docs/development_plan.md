# Living Chess — Development Plan

_Greenfield plan, drafted 2026-07-26. Repo currently contains planning docs
only. Sequencing is chosen so that the riskiest unknowns are answered first and
so there is a playable artifact by the end of Milestone 3._

---

## 0. Strategy in one paragraph

Build the **deterministic core first** (chess + psychology + replay + headless
sim), because the project's central risk is not rendering or LLM prose — it is
whether the psychology model produces *interesting, tunable, non-degenerate*
behavior. A vertical slice that is ugly but balanced is worth more than a
beautiful board with a mutiny rate of 0% or 90%. LLM narration and the four
visual themes are deliberately late; a template-only build must be shippable.

Two hard rules for every milestone:

1. Anything that changes state is deterministic, seeded, and replayable.
2. Every config knob gets a golden-value test **and** a sensitivity test
   (see the `ci-test-design` skill).

---

## Milestone 0 — Repo & harness scaffolding (≈2 days)

| Task | Deliverable |
|---|---|
| 0.1 | Vite + React 18 + TS strict, ESLint + Prettier, Vitest, layer-boundary lint rule |
| 0.2 | CI: lint, typecheck, unit tests, headless sim smoke (20 matches) |
| 0.3 | `pnpm sim` CLI stub, seeded RNG utility, canonical JSON encoder |
| 0.4 | ADR process live; ADRs 0001–0006 decided (see `docs/adr/`) |

Exit criteria: `pnpm lint && pnpm typecheck && pnpm test && pnpm sim --matches=20`
green in CI on a fresh clone.

## Milestone 1 — Chess substrate + feature extraction (≈1 week)

| Task | Deliverable |
|---|---|
| 1.1 | `chess/` wrapper over chess.js: legality, FEN/SAN, per-piece identity mapping (chess.js has no piece identity — we maintain a square→PieceId map through every move, capture, castle, promotion, and en-passant) |
| 1.2 | Threat/feature extractor: `ΔP_capture(j, m)` for all pieces, material delta, king-safety delta |
| 1.3 | Engine broker: stockfish.wasm pool, `go depth N` only, deterministic mode, insight truncation + novice-bias noise model |
| 1.4 | Golden tests: known positions → known threat maps; identity map survives 1,000 random legal games |

Risk retired here: **piece identity through chess.js mutations** is the most
likely source of subtle, save-corrupting bugs in the entire project.

## Milestone 2 — Psychology engine + replay (≈1.5 weeks)

| Task | Deliverable |
|---|---|
| 2.1 | `PieceState` reducers; event types; append-only match log |
| 2.2 | `U(P_i, m)` per `docs/psychology_engine.md` §4, with all weights in one config object |
| 2.3 | Verdict ladder + refusal/quiet-quit/mutiny state machines |
| 2.4 | Witnessed-event detection (sacrifice attribution is non-trivial: a capture counts as a sacrifice only if it removed a threat to a peer or enabled a forced win line — attribute via engine eval, not heuristics) |
| 2.5 | Firing/benching roster decay |
| 2.6 | Replayer: `(rosterSnapshot, seed, intents) → identical event log` |

Exit criteria: invariant suite from `psychology_engine.md` §9 passes; replay
determinism test passes 100 random matches.

## Milestone 3 — Headless balance harness + first calibration (≈1 week)

| Task | Deliverable |
|---|---|
| 3.1 | Scripted AI leaders: `tyrannical`, `supportive`, `volatile`, `servant`, `random` |
| 3.2 | `pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --out=metrics.csv` |
| 3.3 | Metrics: quiet-quit rate, refusal rate, mutiny rate, trust trajectory, culture drift, win rate, archetype classification |
| 3.4 | Calibration pass on `w_*`, `κ_fire`, `τ_refuse`, class-shift velocity |
| 3.5 | Commit calibrated config + calibration report with the plots that justified it |

**Calibration targets (initial hypotheses, to be revised with data):**

| Metric | Tyrannical leader | Supportive leader |
|---|---|---|
| Refusal rate (per match) | 8–20% of plies | <2% |
| Mutiny rate (per 20-match campaign) | 40–70% see ≥1 | <5% |
| Win rate delta vs. plain chess | −5 to −20% | −0 to −8% |
| Culture drift after 20 matches | class contempt worsens | contempt largely dissolved |

If tyranny is *not* punished, or is punished so hard it's unplayable, the model
is wrong — stop and re-tune before building UI on it.

## Milestone 4 — Playable vertical slice UI (≈2 weeks)

| Task | Deliverable |
|---|---|
| 4.1 | chessground board + drag input → intent pipeline |
| 4.2 | Piece state overlays: aura rings (trust), morale gauge, betrayal marker |
| 4.3 | Refusal / quiet-quit / mutiny UX — including how a refused move is communicated without feeling like a bug |
| 4.4 | Relationship inspector: who protects whom, class-bias heatmap |
| 4.5 | Template dialogue engine (deterministic, relationship-aware, ~200 lines seeded by verdict + event + persona) |
| 4.6 | One theme only (`tactical-blueprint`: cheapest to draw, best for debugging) |

Exit criteria: a full match playable end-to-end offline with zero API keys, and
a playtest note documenting whether refusal feels *dramatic* or *annoying*.

## Milestone 5 — Persistence, roster & campaign (≈1.5 weeks)

| Task | Deliverable |
|---|---|
| 5.1 | Dexie schema v1 + migration harness + fixture-based migration tests |
| 5.2 | Roster screen: bench/fire flows with explicit consequence preview |
| 5.3 | Campaign loop (5–20 matches), culture drift computed as a fold |
| 5.4 | Deterministic single-match audit + campaign debrief (numbers and charts, no prose yet) |

## Milestone 6 — Narration layer (≈1.5 weeks)

| Task | Deliverable |
|---|---|
| 6.1 | Narration port: `NarrationProvider` interface with `TemplateProvider` (default) and `LlmProvider` |
| 6.2 | Structured prompt schemas + strict output validation; on any failure fall back to the template silently |
| 6.3 | BYO-key settings UI, per-session token budget, cache by prompt hash |
| 6.4 | Narrator pre-game, match audit prose, campaign debrief prose |
| 6.5 | Prompt-injection hardening: piece names are user-supplied text and must be sanitized before entering prompts |

## Milestone 7 — Themes, onboarding tracks, polish (≈2 weeks)

| Task | Deliverable |
|---|---|
| 7.1 | Remaining three themes as token sets + persona mappings |
| 7.2 | Four onboarding manuals (indie / exec-lab / purist / academic) |
| 7.3 | Accessibility: colorblind-safe aura encoding (shape + number, not hue alone), keyboard play, reduced-motion |
| 7.4 | Exec-lab facilitator export bundle (CSV/PDF) |

## Milestone 8 — Federation & scale-up (deferred)

Signed roster export/import, async friend challenges, then — only if metrics
justify — ladder, cloud sync, and a hosted LLM proxy.

---

## Estimated critical path

≈9–11 weeks of focused solo work to end of Milestone 6 (a complete, offline,
narratable game with a calibrated psychology model). Milestones 0–3 are ~40% of
that and carry ~80% of the technical risk.

## Sequencing rationale (why not UI-first)

A pretty board with a broken psychology model produces a chess game with random
annoyances. The differentiator is the model, and the model can only be validated
by thousands of headless matches. Building the harness in Milestone 3 rather
than Milestone 8 (as the source SRS sequenced it) is the single biggest change
this plan makes to the original roadmap.
