# The Kings and I — Development Plan

_Greenfield plan, drafted 2026-07-26. Repo currently contains planning docs
only. Sequencing is chosen so that the riskiest unknowns are answered first and
so there is a playable artifact by the end of Milestone 3._

---

## 0. Strategy in one paragraph

Build the **deterministic core first** (chess + psychology + replay + headless
sim), because the project's central risk is not rendering or LLM prose — it is
whether the psychology model produces *interesting, tunable, non-degenerate*
behavior. A vertical slice that is ugly but balanced is worth more than a
beautiful board with a desertion rate of 0% or 90%. Narration content and the
four visual themes are deliberately late. There is no runtime LLM at all
(ADR 0004), so "narration" means authoring a dialogue tree, which is a content
cost that can be parallelized with engineering rather than a dependency.

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
| 1.3 | Engine broker behind `EnginePort` (ADR 0020): stockfish.wasm pool, `go depth N` only, deterministic mode, shared search + private per-piece scoring (ADR 0017). Nothing outside `engine/` learns which engine exists; `determinismId` goes into every `MatchRecord` |
| 1.3c | Deterministic query barrier (D48): all engine queries per ply issued, collected, sorted by `PieceId`, then psychology runs. Ship with the shuffled-resolution-order replay test — without it, replay divergence will present as a psychology bug |
| 1.3b | Engine conformance suite (fixed FEN × depth corpus → stable output) **plus one permissive adapter** — Lozza, MIT, pure JS, no toolchain — purely to prove the port is real. An untested port is not a port (ADR 0020) |
| 1.4 | Golden tests: known positions → known threat maps; identity map survives 1,000 random legal games |

Risk retired here: **piece identity through chess.js mutations** is the most
likely source of subtle, save-corrupting bugs in the entire project.

## Milestone 2 — Psychology engine + replay (≈1.5 weeks)

| Task | Deliverable |
|---|---|
| 2.1 | `PieceState` reducers; event types; append-only match log |
| 2.2 | `U(P_i, m)` and `Θ_refusal(T_i)` per `docs/spec/psychology-engine.reference.ts`, with all coefficients in one `ENGINE_CONFIG` object. All inputs are the piece's own depth-`D_i` view; the true evaluation must not be reachable from `psychology/` (ADR 0013) |
| 2.3 | Verdict ladder + refusal/quiet-quit state machines. Refusal is free to re-plan (ADR 0002), so the commit step must handle a rejected intent with no state change beyond the psychology event |
| 2.3c | Override path (ADR 0014): forced-move event, trust penalty to the piece, witness penalties, audit classification. This is what makes "every legal move refused" a non-case |
| 2.3b | Desertion: the `U_desert` vs `U_stay` comparison, removal from the board, and **cascade re-evaluation of all remaining pieces after each departure** (`docs/desertion_model.md`, ADR 0011). King exempt |
| 2.3d | Belief channels (ADR 0016): egocentric eval profiles, attention weighting, leader-prior memory feeding `V_leader_implied`, and the two-scalar rumor diffusion over the affinity graph. Rumor must never carry a board feature |
| 2.3e | Witness appraisal of a desertion (ADR 0018): each witness scores the refused order at its own `D_j`; brave-vs-ran splits the affinity and trust updates. Store the refused order on the event, not new state |
| 2.4 | Witnessed-event detection (sacrifice attribution is non-trivial: a capture counts as a sacrifice only if it removed a threat to a peer or enabled a forced win line — attribute via engine eval, not heuristics) |
| 2.5 | Firing/benching roster decay |
| 2.5b | Outcome→trust reducers and costly-signal detection per `docs/trust_dynamics.md` (ADR 0007) |
| 2.5c | Two-channel credence (ADR 0019): `τ_benev` fast up / cliff down / slow erosion under neglect, `τ_abil` Bayesian in `1/n`, both separately logged. Neglect fires on *omissions* (never consulted, never defended, refusal steamrolled), never on elapsed time — ADR 0007 still forbids drift toward a baseline. The *heard* signal must gate on withdrawal having surrendered real value, or it can be farmed |
| 2.6 | Replayer: `(rosterSnapshot, seed, intents) → identical event log` |

Exit criteria: invariant suite from `psychology_engine.md` §11 passes; replay
determinism test passes 100 random matches.

## Milestone 3 — Headless balance harness + first calibration (≈1 week)

| Task | Deliverable |
|---|---|
| 3.1 | Scripted AI leaders: `tyrannical`, `supportive`, `volatile`, `servant`, `random`, plus the two ADR-0007 oracles `pure_tactician` and `redeemer` |
| 3.2 | `pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --out=metrics.csv` |
| 3.3 | Metrics: quiet-quit rate, refusal rate, **refused-good-move rate**, desertion incidence, cascade length, trust trajectory, culture drift, win rate, archetype classification |
| 3.4 | Calibration pass on the trait weights, `Θ_refusal` slope/intercept, benching penalties, and sacrifice class/affinity shifts — plus resolution of D19 (trust-term scale) |
| 3.5 | Commit calibrated config + calibration report with the plots that justified it |

**Calibration targets (initial hypotheses, to be revised with data):**

| Metric | Tyrannical leader | Supportive leader |
|---|---|---|
| Refusal rate (per match) | 8–20% of plies | <2% |
| Desertion rate (per 20-match campaign) | 40–70% see ≥1 | <5% |
| Campaigns ending in a full rout | common — a tyrant whose roster never routs is a bug (ADR 0011) | rare |
| Win rate delta vs. plain chess | −5 to −20% | −0 to −8% |
| Culture drift after 20 matches | class contempt worsens | contempt largely dissolved |

If tyranny is *not* punished, the model is wrong — stop and re-tune before
building UI on it. Note the *upper* bound is deliberately absent for the tyrant:
per ADR 0007 and ADR 0011, collapse and rout are intended outcomes, and the only
failure condition on the harsh end is a spiral that survives a genuine change of
policy by the player (the `redeemer` oracle).

## Milestone 4 — Playable vertical slice UI (≈2 weeks)

| Task | Deliverable |
|---|---|
| 4.1 | chessground board + drag input → intent pipeline |
| 4.2 | Piece state overlays: aura rings (trust), morale gauge, betrayal marker |
| 4.3 | Refusal / quiet-quit / desertion UX — how a refused move is communicated without feeling like a bug, and how a rout is made legible while it happens |
| 4.3b | Override UX: a deliberate act showing who will be hurt and by how much, never a dismissible dialog. Plus the divergence display — the piece's own evaluation beside the true one; it presents *he would not take it on faith*, it does not adjudicate wrong-vs-disloyal (ADR 0013, revised by ADR 0015) |
| 4.4 | Relationship inspector: who protects whom, class-bias heatmap |
| 4.5 | Authored dialogue tree v1 (deterministic, relationship-aware; ~200 lines seeded by verdict + event + persona) |
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
| 5.6 | Succession coda (ADR 0022): King takes field command as an ordinary `LeaderId` with empty history, player spectates, remainder of match played out plus optional fast-forward of remaining matches; `D_king < D_player_effective` asserted in config tests; reinstatement evaluated only at the start of the next match |
| 5.7 | Debrief scores **board quality** and **execution fidelity** as separate columns — the gap is the player's diagnosis |
| 5.8e | World-scale piece identity (ADR 0026): provenance, cross-commander trauma, retirement state, credence keyed by `LeaderId` including commanders never served — serializable and portable whether or not a registry ships |
| 5.8f | Piece **passports** (tier 1): signed export/import so identities travel between players offline; `determinismId` + seed in every `MatchRecord` so a future registry can replay-verify rather than trust |
| 5.8a | Opposing commander (ADR 0025): AI leader archetype driving the enemy roster's full psychology; difficulty selects the archetype, never engine depth; enemy state exposed to the player only as behaviour |
| 5.8d | Free-agent market between careers — deserted identities may join other commanders' rosters, credence intact (ADR 0025 §5) |
| 5.8b | Diminished second appointment (ADR 0024 §4): lesser king, thinner available roster, lower stakes — the cheap place to rebuild `τ_abil` |
| 5.8c | King's own results channel (ADR 0024 §3) so a beloved commander can still be dismissed; two dismissal paths logged distinctly |
| 5.8 | Career/act schema (ADR 0023): `CareerId`, `ActId`/`KingId`, up to three appointments, career-terminal state. Ship one act; the schema carries three |
| 5.9 | Reputation transfer on recruitment — `τ_abil` from the leader's record, `τ_benev` from roster appraisal via rumor. Ship with the *roster laundering* detector; a ~32 bench is unsafe without it |
| 5.10 | Career victory condition: realized position quality sustained above `V_own(player)` — the army exceeding the leader's ceiling |
| 5.5 | Three terminal states with distinct epilogues (ADR 0021 §6.3): checkmate (outplayed, roster spent), **dismissal** (roster intact, they still want the win — the middle outcome, not the worst), rout (roster shattered). Mandate propagates through rumor; King's patience is a calibration knob shared with D26 |

## Milestone 6 — Narration layer (≈1.5 weeks)

| Task | Deliverable |
|---|---|
| 6.1 | `AuthoredProvider` over the full dialogue tree — synchronous, deterministic, no network (ADR 0004) |
| 6.2 | Offline distillation pipeline: situation matrix → authoring model → **reviewed** lines → committed tree JSON, with the generation script in-repo |
| 6.3 | Coverage validator in CI: every reachable situation has a line, no empty leaves, no line repeated within a match |
| 6.4 | Narrator pre-game, match audit prose, campaign debrief prose — including causal-chain reconstruction for desertions |
| 6.5 | Sanitize player-supplied piece names (control chars, length) before substitution; render as text, never HTML |

## Milestone 7 — Themes, onboarding tracks, polish (≈2 weeks)

| Task | Deliverable |
|---|---|
| 7.1 | Content packs as **data** (ADR 0023 §4): `{themeTokens, nounMap, dialogue, epilogues}` bound to role-abstract situation keys; pack-coverage CI check over reachable keys |
| 7.2 | Four onboarding manuals (indie / exec-lab / purist / academic) |
| 7.3 | Accessibility: colorblind-safe aura encoding (shape + number, not hue alone), keyboard play, reduced-motion |
| 7.4 | Exec-lab facilitator export bundle (CSV/PDF) |

## Milestone 8 — Federation & scale-up (deferred)

Tauri desktop shell and Steam packaging (ADR 0012); signed roster export/import;
async friend challenges; then — only if metrics justify — ladder and cloud sync.

**Blocking issue for the commercial build:** Stockfish is GPL-3.0 and cannot be
linked into a proprietary artifact. Resolve before Steam work starts — see
`LICENSING.md`.

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
