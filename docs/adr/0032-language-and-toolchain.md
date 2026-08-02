# ADR 0032 — TypeScript everywhere, and the determinism price we pay for it

- **Status:** accepted (2026-08-02)
- **Resolves:** D14 (package/state stack) — and states explicitly the language
  choice that D14 had only implied
- **Refines:** ADR 0012 (distribution), ADR 0001 (deterministic core)

## Context
`docs/development_plan.md` and the SRS assumed "Vite + React 18 + TS strict"
without ever recording *why*, and D14 left the rest of the stack open. Milestone 0
is the last cheap moment to change language: after it, the chess wrapper, the
psychology reducers, the harness, and the persistence schema are all written in
whatever we pick.

Three constraints bind the choice, and only one of them is about the UI:

1. **The browser is the first distribution target** (ADR 0012) and the engine
   ships as WASM behind `EnginePort` (ADR 0020). Whatever language the core is
   written in, something must run in a browser tab with no server.
2. **The harness is the primary validation instrument**, not the UI
   (`docs/development_plan.md` §0a). It must run thousands of matches, each with
   per-piece decisions, fast enough to iterate on calibration in a working day.
3. **Replay must be bit-identical** (ADR 0001), across machines and across
   browser engines, or every golden test in `docs/testing_strategy.md` is a
   coin flip.

## Decision
1. **TypeScript (strict) is the implementation language for the whole project** —
   UI, orchestration, psychology, chess, engine adapters, persistence, and the
   headless harness. One language, one test runner, one set of types shared
   between the game and the simulator.
2. The rest of D14 is settled with the defaults the owner said he had no
   preference on: **pnpm** (pinned via `packageManager`), **Vite + React 18**,
   **Vitest** (+ `@vitest/coverage-v8`), **ESLint flat config + Prettier**,
   **Zustand** for UI state only. Node 20 LTS.
3. **The state layer stays thin.** The event log is the source of truth
   (AGENTS.md rule 5); Zustand holds view state and a pointer into the log, never
   a second copy of game state. A store field that duplicates a fold over the log
   is a review failure.
4. **Floating-point discipline, because JavaScript will not give it to us for
   free.** IEEE-754 `+ - * /` and `Math.sqrt` are exactly specified and identical
   everywhere; `Math.exp`, `Math.log`, `Math.pow`, and friends are
   *implementation-defined* and may differ in the last bits between V8, JSC, and
   SpiderMonkey — which is exactly how a replay recorded on Chrome fails on
   Safari, presenting as a psychology bug. Therefore:
   - Persisted psychological state stays integer-valued and clamped (already the
     convention in AGENTS.md).
   - Any transcendental needed by `psychology/` (the logistic in `Θ_refusal`, any
     softmax over rumor weights) must go through a **project-owned deterministic
     math module** built from the exactly-specified operations, with its own
     golden corpus. `Math.exp`, `Math.pow`, `Math.log`, the trigonometric
     functions, and the `**` operator are banned by lint in `psychology/` and
     `chess/` from Milestone 0, the same way `Math.random` is banned outside the
     seeded PRNG. The module itself lands with its first consumer in Milestone 2
     — the ban exists now precisely so that it cannot be skipped then.
   - Comparisons that decide a branch (refuse vs. comply) quantize before
     comparing, so a last-bit difference cannot flip a verdict.
5. **The escape hatch is named now, and it is not a rewrite.** `psychology/` is
   pure by construction, so if the harness — not the game — becomes the
   bottleneck at Milestone 3 scale, the fix is to port *that module only* to
   Rust/WASM behind the identical function signature, validated by the existing
   golden corpus. Nothing else moves.

## Consequences
- The harness and the game share the psychology code literally, so a calibration
  run validates the shipping build rather than a re-implementation of it. This is
  the single largest reason for the choice.
- `chessground` and `chess.js` are first-class rather than bridged, and both are
  permissively licensed, which keeps the dual-license gate (ADR 0006) clean.
- We accept a slower harness than a native core would give. The mitigation is
  §5, and the trigger is measured wall-clock at Milestone 3, not taste.
- The float rules add friction to writing the psychology math — that friction is
  the point, and it is enforced by lint rather than by memory.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on. They are
  irritating in UI code and load-bearing in reducers that index by `PieceId`.

## Alternatives considered
- **Rust core (WASM) + TypeScript shell.** Genuinely better on determinism
  (no implementation-defined transcendentals) and on harness throughput. Rejected
  for now: it buys performance we have not yet proven we need, at the cost of two
  toolchains, an FFI boundary in the middle of the most-edited module in the
  project, and a slower loop on the thing that is actually risky — whether the
  psychology is *interesting*. §5 keeps this option open at the only place it
  would pay.
- **Python core.** Best iteration speed for a modelling harness and the owner's
  home turf, but it cannot run the shipping game in a browser tab, which would
  force exactly the dual-implementation split that §5 exists to avoid.
- **C++/native core.** Same objection as Rust, with worse WASM ergonomics and no
  memory-safety upside.
- **npm/yarn instead of pnpm.** No strong argument either way; pnpm's strict
  `node_modules` layout catches undeclared transitive imports, which matters for
  the layer-boundary rule.
