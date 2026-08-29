---
name: typescript-toolchain
description: Build, lint, typecheck, test, and run The Kings and I TypeScript codebase, and keep its determinism rules (seeded RNG, banned transcendentals, layer boundaries) intact. Use for any code change in this repo, or when a build/lint/test command fails.
---

# TypeScript Toolchain (ADR 0032)

TypeScript strict everywhere — UI, orchestration, psychology, chess, engine
adapters, persistence, and the headless harness. One language so the harness
validates the shipping code rather than a re-implementation of it.

## Commands

```bash
pnpm install          # pnpm is pinned via packageManager; do not use npm/yarn
pnpm dev              # Vite dev server (app shell only until Milestone 4)
pnpm lint             # eslint + prettier --check
pnpm format           # prettier --write
pnpm typecheck        # tsc --noEmit, strict, covers src/ sim/ and tests
pnpm test             # fast tier: vitest run (campaign-scale cases skipped)
pnpm test:heavy       # every case, campaign-scale included; nightly owns this
pnpm test:coverage    # fast tier + coverage/lcov.info (Sonar reads this)
pnpm build            # vite build
pnpm sim --matches=20 --leader=tyrannical    # Lozza depth-cap-4 smoke
pnpm sim --matches=6 --leader=tyrannical --engine=fake   # CI smoke (nightly: 20, both leaders)
pre-commit run --all-files                   # repo hygiene hooks
```

All of the above must be green before a PR. Node 20 LTS.

## Engine cost and verification scope

The default simulation uses real Lozza with a harness-only `--depth-cap=4`
wrapper. The documented 20-match smoke takes approximately 5 seconds on the
reference box. The cap is recorded in the engine determinism ID and does not
touch `calculateEngineSearchDepth`, psychology, or piece `D_i` allocation.
It is a tractability proxy, not a psychology configuration knob.

CI pins `--engine=fake` explicitly to remain fast and deterministic. The fake
engine is position-coherent: a stable FEN-derived deep-limit score plus a
bounded error that shrinks with depth. It is suitable for fast deterministic
relative comparisons, but its absolute rates are not real chess and must not
be reported as calibration results.

Stockfish production-depth evaluation was measured at more than 251 seconds
per match. Stockfish sweeps are therefore on-demand or nightly operations
requiring an explicit runtime budget, never casual verification.

While iterating, run only targeted Vitest files for the changed behavior. Run
the full gate once before opening a PR:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm sim --matches=20 --leader=tyrannical
pre-commit run --all-files
```

Run `pnpm test:coverage` only when the SonarQube quality gate requests it.
For status questions, read committed calibration results in
`docs/calibration/` instead of re-running the harness.

## Agent-free verification (do not burn agent time on the gate)

GitHub Actions owns routine verification — see `docs/testing_strategy.md` §7.

- **PR / `main`:** `.github/workflows/ci.yml` — lint, typecheck, build, fast-tier
  Vitest coverage, and `pnpm sim --matches=6 --leader=tyrannical --engine=fake`.
- **Nightly / dispatch:** `.github/workflows/nightly.yml` — `pnpm test:heavy`,
  the 20-match two-leader smoke, Lozza N≈100 calibration + one-knob sweep;
  Stockfish only via `workflow_dispatch` with an explicit match budget.
- **Cursor agents:** triage red CI/nightly jobs and interpret metric deltas.
  Do not re-run the full suite inside an agent session when Actions already
  ran it. Do not schedule Automations to `pnpm test` / `pnpm sim`.

## Determinism rules the lint config enforces

These are not style preferences; they are what makes replay and every golden
test possible. If a rule fires, fix the code — never widen the rule.

| Rule | Why |
|---|---|
| `Math.random` banned outside the seeded PRNG module | replay, golden tests, bug reproduction (AGENTS.md rule 2) |
| `Math.exp` / `Math.pow` / `Math.log` / trig / `**` banned in `psychology/` and `chess/` | implementation-defined across JS engines — a replay recorded in Chrome must not diverge in Safari (ADR 0032 §4). The deterministic math module that replaces them lands with its first consumer in Milestone 2; if you need a logistic before then, write that module (with goldens) rather than reaching for `Math.exp` |
| Layer imports flow downward only (`app > ui > orchestration > psychology > chess > engine`); `psychology/` may import `core/` and chess *types* only | `psychology/` must stay pure and engine-agnostic (AGENTS.md rule 4, ADR 0013) |

Corollaries not expressible as lint rules, so they are on you:

- Persisted psychological state is integer-valued and clamped.
- Quantize before a comparison that decides a branch, so a last-bit float
  difference cannot flip a verdict.
- The seeded generator is **injected**, never imported ambiently, into anything
  in `psychology/`; it must support snapshot/restore for replay.
- Zustand holds view state only. A store field that duplicates a fold over the
  event log is a review failure (AGENTS.md rule 5).

## Conventions

- No `any`. No non-null `!` without a comment justifying it.
- Discriminated unions for events and verdicts; exhaustive `switch` with a
  `never` default.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on: indexing a
  record by `PieceId` yields `T | undefined` and you must handle it.
- Pure functions in `psychology/`: no I/O, no clock, no ambient RNG.
- Every config knob ships with a **wiring (sensitivity) probe** — see the
  `ci-test-design` skill and `docs/testing_strategy.md`. Exact goldens are for
  settled surfaces; a parsed-but-unwired knob is a review failure.

## Dependencies are a licensing gate

The project is dual-licensed (AGPL-3.0 + commercial), so a GPL/AGPL-only
dependency is a blocker, not a footnote — prefer MIT/BSD/Apache-2.0/ISC and flag
anything else in the PR. Stockfish is the one known, deliberate exception
(`LICENSING.md`, ADR 0020). Pin versions; avoid floating ranges; prefer releases
that have been public for at least a week.

## Escape hatch, if the harness gets too slow

Do **not** rewrite the project. `psychology/` is pure by construction, so the
sanctioned move is porting that module alone to Rust/WASM behind the identical
signature, validated against the existing golden corpus (ADR 0032 §5). The
trigger is measured Milestone 3 wall-clock, not a hunch.
