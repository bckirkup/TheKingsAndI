# The King and I — System Architecture

_Status: planning. No implementation exists yet. This document is the target
architecture that `docs/development_plan.md` builds toward._

Sources of record: `docs/spec/living-chess-srs.md` (requirements) and
`docs/spec/psychology-engine.reference.ts` (equations, thresholds, coefficients).

---

## 1. Architectural thesis

The King and I is **a deterministic simulation with a cosmetic narrative skin**.

Everything that affects game state — legality, trust, affinity, refusal,
desertion, engine depth allocation — is computed by pure, seeded, testable
functions. The narration layer only *renders* that state as prose, from an
authored decision tree with no model call at runtime (ADR 0004). This split is the
single most important architectural constraint in the project:

```
                 ┌──────────────────────────────────────┐
                 │   MECHANICS (deterministic, tested)  │
                 │   chess rules · psychology · engine  │
                 └──────────────────┬───────────────────┘
                                    │ read-only projection
                                    ▼
                 ┌──────────────────────────────────────┐
                 │   NARRATION (best-effort, optional)  │
                 │   templates → optional LLM rewrite   │
                 └──────────────────────────────────────┘
```

Consequences:

- The game is fully playable offline with zero API keys (templates only).
- A dropped/slow/hallucinating LLM response can never corrupt a save file,
  change a refusal verdict, or desync a replay.
- The headless balance harness (1,000+ self-play matches) runs with the LLM
  layer switched off, at full speed, in CI.

## 2. Layers

```
┌───────────────────────────────────────────────────────────────────────┐
│ app/            React 18 + TS + Vite. Routing, onboarding tracks,     │
│                 theme provider, debrief dashboards.                   │
├───────────────────────────────────────────────────────────────────────┤
│ ui/             Board (chessground), aura rings, morale gauges,       │
│                 speech bubbles, telemetry overlays. No game logic.    │
├───────────────────────────────────────────────────────────────────────┤
│ orchestration/  Match loop: intent → verdict → commit → events.       │
│                 The only place allowed to mutate match state.         │
├───────────────────────────────────────────────────────────────────────┤
│ psychology/     Pure reducers: utility U(P_i, m), verdict ladder,     │
│                 trust/affinity/class-bias updates, witnessed events.  │
├───────────────────────────────────────────────────────────────────────┤
│ chess/          chess.js wrapper: legality, FEN, SAN, threat maps,    │
│                 capture-probability features consumed by psychology.  │
├───────────────────────────────────────────────────────────────────────┤
│ engine/         stockfish.wasm worker pool + insight broker           │
│                 (per-piece depth budgets, cancellation, caching).     │
├───────────────────────────────────────────────────────────────────────┤
│ narrative/      Template dialogue engine (deterministic) + optional   │
│                 LLM adapter (narrator, match audit, campaign debrief).│
├───────────────────────────────────────────────────────────────────────┤
│ persistence/    Dexie (IndexedDB) rosters, match logs, campaigns;     │
│                 versioned migrations; signed roster export/import.    │
├───────────────────────────────────────────────────────────────────────┤
│ sim/            Headless CLI harness: scripted AI leaders, N-match    │
│                 campaigns, metric CSV/JSON emission, calibration.     │
└───────────────────────────────────────────────────────────────────────┘
```

Dependency rule (enforced by lint boundaries): a layer may import only from
layers below it. `psychology/` must not import `engine/` or `ui/`; it receives
pre-computed board features as plain data.

## 3. The move pipeline

The core loop. Every player action passes through exactly this sequence.

```
player selects move m for piece P_i
        │
        ▼
1. chess/ legality check ................ illegal → reject, no state change
        │
        ▼
2. chess/ feature extraction ............ P_captured for P_i, ΔSafety_j for peers,
        │                                 material delta, king safety delta
        ▼
3. engine/ insight request (async) ...... depth D_i = f(E_i, η_i); may be
        │                                 served from cache; cancellable.
        │                                 ADVICE ONLY (ADR 0008): this never
        │                                 substitutes a different move.
        ▼
4. psychology/ evaluate ................. U(P_i, m) vs Θ_refusal(T_i) → verdict ∈
        │                                 {HEROIC_EXECUTION, COMPLIANT_EXECUTION,
        │                                  QUIET_QUITTING, MORAL_REFUSAL,
        │                                  DESERTION_MUTINY}
        ▼
5. orchestration/ commit ................ apply move (or refusal outcome),
        │                                 emit MoveEvent + derived events
        ▼
6. psychology/ witnessed-event pass ..... captures/sacrifices seen by peers →
        │                                 A_{i,j}, C_{r,r'}, T_i, B_i updates
        ▼
7. narrative/ render ..................... authored dialogue-tree lookup;
                                          synchronous, deterministic, no network
```

Steps 1–6 are synchronous and pure given `(state, move, insight, seed)`; that
tuple is what the replay log stores, which is what makes matches reproducible.
Step 7 reads that state and cannot write to it.

Two accepted decisions change what step 5 can do. A `MORAL_REFUSAL` commits no
move and costs no turn — the player simply issues another intent (ADR 0002). A
`DESERTION_MUTINY` removes the piece from the board for the remainder of the
match and never changes its color (ADR 0003); because each departure raises
`P_loss` for everyone left, step 6 must re-evaluate desertion for all remaining
pieces, which is how a cascade propagates within a single ply (ADR 0011).

Both armies may run this pipeline: opponent psychology is symmetric and either
side may be human- or AI-led (D5). Build the pipeline side-agnostic from the
start; retrofitting a hardcoded "player is White" assumption is expensive.

## 4. Event sourcing and replay

Match state is derived from an append-only event log:

```ts
type MatchEvent =
  | { t: 'MOVE'; ply: number; san: string; pieceId: PieceId; verdict: MoveResponseVerdict }
  | { t: 'REFUSAL'; ply: number; pieceId: PieceId; utility: number; threshold: number }
  | { t: 'CAPTURE'; ply: number; victim: PieceId; by: PieceId }
  | { t: 'SACRIFICE_WITNESSED'; ply: number; hero: PieceId; beneficiary: PieceId }
  | { t: 'ROSTER_BENCH'; pieceId: PieceId }
  | { t: 'PSYCH_DELTA'; ply: number; pieceId: PieceId; field: PsychField; delta: number }
  ...
```

- Match audits and campaign debriefs are **pure folds over the event log**, not
  separate bookkeeping. There is no second source of truth to drift.
- A match is replayable from `(rosterSnapshot, seed, playerIntents[])`. The sim
  harness, regression tests, and the "watch the turning point again" UI all use
  the same replayer.
- Psychological deltas are logged, not just their results, so the debrief can
  explain *why* trust moved.

## 5. Engine insight broker

Naive "one Stockfish worker per piece" is 16 WASM instances per side: memory
blowup on mobile and pointless duplicated search. Instead:

- A **pool of `min(navigator.hardwareConcurrency - 1, 4)` workers**.
- One canonical search per position at `D_max = 16`, retaining the multi-PV tree.
- Per-piece insight is a **truncation** of that tree to
  `D_i = max(1, floor(D_min + η_i · (E_i/100) · (D_max - D_min)))` plus a
  noise/bias model for low-experience or disengaged pieces (`η_i` throttling),
  so a novice piece is *wrong in a plausible way* rather than merely quieter.
- Deterministic mode for tests/sim: fixed depth, single thread, no time-based
  cutoffs (`go depth N` only — never `movetime`), fixed hash size.

Only the last property is non-negotiable for CI: **no wall-clock-dependent
search**, or golden values become flaky.

## 6. Theming

Themes are pure token sets (`VisualThemeTokens`) plus a narration persona id.
No theme may gate mechanics; all four themes must be reachable at runtime from
one build. Onboarding track (indie / exec-lab / purist / academic) selects a
default theme, a default narration persona, and which overlays start visible.

## 7. Deployment topology

- **Phase 1 (MVP):** static web build. IndexedDB only. Zero backend, zero
  per-user cost, no API key of any kind (ADR 0004). The lightest possible
  distribution, chosen so the psychology can be validated by strangers from a
  link (ADR 0012).
- **Phase 2:** desktop shell via Tauri for Steam. Same web build plus a native
  wrapper; nothing may depend on browser-only APIs beyond IndexedDB and Web
  Workers, or this stops being a packaging step.
- **Phase 3:** signed roster export/import (Ed25519 over a canonical JSON
  encoding) for asynchronous friend challenges; still no server.
- **Phase 4:** thin backend (ladder, matchmaking, exec-lab telemetry) only when
  metrics justify it.

Note the engine memory budget is set by the *web* target, and D5's symmetric
opponent psychology roughly doubles engine work — both bear on D9.
