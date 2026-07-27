# ADR 0020 — The engine is a swappable port; the GPL problem is deferred, not solved

- **Status:** accepted (2026-07-26)
- **Owner:** *"I'm guessing that this is an achievable segmentation."*
- **Refines:** ADR 0005 (engine determinism), ADR 0006 (licensing), ADR 0012
  (distribution)

## Context
Stockfish is GPL-3.0. D16 wants a dual license and D13 wants Steam, which
appeared to require shipping a proprietary build linking a GPL engine — not
permitted. The question was whether swapping engines is a realistic escape.

Two facts change the shape of the problem:

1. **Absolute engine strength is nearly irrelevant to this design.** `D_max` is
   capped at 16, attention prunes (ADR 0019), and every psychology input is a
   *relative* comparison from a truncated view (ADR 0013/0017). A weaker engine
   moves calibration constants, not correctness. What is required is
   **consistency**, not elo.
2. **GPL forbids proprietary distribution, not selling.** A paid, GPL-compliant
   Steam release is legal; its costs are a source offer and incompatibility with
   DRM wrappers.

## Decision
1. All engine access goes through a narrow port, from Milestone 1:

```ts
interface EnginePort {
  evaluate(fen: string, depth: number): Promise<{ scoreCp: number; pv: Move[] }>;
  readonly determinismId: string;   // engine + version + settings → every MatchRecord
}
```

Nothing outside `engine/` may know which engine exists.

2. A **conformance suite** (fixed FEN × depth corpus, stable reproducible
   output) is written *before* the second adapter. This is what makes a swap a
   weekend instead of a quarter.
3. Ship **Stockfish** first as the reference and calibration baseline.
4. Land one **permissive** adapter early — Lozza (MIT, pure JavaScript, no build
   toolchain) is the cheapest possible proof — solely to prove the port is real.
   An untested port is not a port.
5. Defer the production permissive engine choice (D46) to the enterprise track,
   measured in this project's own harness at capped depth rather than from rating
   lists computed at time controls this game never uses.

## Consequences
- **The urgency inverts.** The swap is needed for the *enterprise* build — the
  last audience under D1 — not for Steam, the first. The open web build and a
  paid GPL-compliant Steam build can both ship with Stockfish.
- AGPL-3.0 project + GPL-3.0 engine is compatible: both GPLv3 §13 and AGPLv3 §13
  permit the combination.
- A GPL-compliant paid build cannot use a Steam DRM wrapper, and must honor a
  written source offer. That is the real, bounded cost.
- `determinismId` in every `MatchRecord` means a mid-project engine change
  invalidates goldens *loudly* instead of silently — the single most important
  guard this port provides.
- **Licenses were verified 2026-07-26 and must be re-verified at pin time.**
  Notably, GitHub's metadata fails to detect the MIT license of both Lozza and
  Blunder, so automated license scanning of dependencies will produce false
  "unknown license" flags for exactly the candidates we care about.
- The permissive field is thin and mostly hobby-scale; the strong open field is
  overwhelmingly GPL. If the enterprise track ever demands both no-copyleft and
  high strength, the honest options are a commercial engine license or paying for
  strength we do not need. See `docs/engine_licensing.md`.

## Alternatives considered
- **Swap to a permissive engine immediately.** Rejected: it degrades the
  calibration baseline at exactly the moment the psychology is being validated,
  to solve a problem that does not bind until the last audience.
- **Isolate Stockfish as a separate GPL process** and argue mere aggregation.
  Defensible for a native build over a UCI pipe, but the web build is
  in-process WASM, where the argument is much weaker. Not worth the legal risk.
- **Drop the commercial license.** Still available and would end the question
  outright; kept open under D47.
