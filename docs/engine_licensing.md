# The engine port and the GPL problem

_Owner:_

> **"I don't know how good the other engines are or what it means in terms of
> engineering to swap them out, but I'm guessing that this is an achievable
> segmentation."**

Governed by ADR 0020. Nothing here is implemented.

---

## 1. Why the swap is cheap — and why strength barely matters

Two accepted decisions already isolate the engine almost completely:

- **D10 / ADR 0005:** fixed-depth search only (`go depth N`). This forbids the
  wall-clock and time-management behavior that differs most between engines, and
  it is the reason two engines can be held to the same contract at all.
- **ADR 0013 / 0017:** psychology consumes *the piece's own view* derived by
  re-scoring and truncation, never the engine's absolute verdict.

So what the engine must supply is narrow:

```ts
interface EnginePort {
  evaluate(fen: string, depth: number): Promise<{ scoreCp: number; pv: Move[] }>;
  readonly determinismId: string;  // engine + version + settings, recorded in every MatchRecord
}
```

**Absolute strength is close to irrelevant here.** `D_max` is capped at 16,
attention prunes (ADR 0019), and every psychology input is a *relative*
comparison between candidate moves as seen from a truncated view. Swapping a
3600-class engine for a 2700-class one moves calibration constants; it does not
change whether the model works. What the port genuinely requires is
**consistency**: identical output for identical `(fen, depth)`, forever, or every
golden test and replay breaks.

That reframes the licensing question. This project does not need the strongest
engine in the world. It needs a *stable, depth-addressable* one.

## 2. The licensing landscape

Verified via the GitHub license API and the repositories' own `LICENSE` files on
2026-07-26. **Re-verify at the moment a version is pinned** — licenses change,
and several of these projects are single-maintainer.

| Engine | Language | License | Notes |
|---|---|---|---|
| Stockfish | C++ | **GPL-3.0** | strongest; the constraint that created this document |
| Leela (lc0) | C++ | **GPL-3.0** | same problem |
| Berserk, Weiss, Smallbrain, Stormphrax, Velvet | C/C++/Rust | **GPL-3.0** | the strong open field is overwhelmingly GPL |
| Viridithas | Rust | **AGPL-3.0** | fine for the open build, worse for commercial |
| **Lozza** | JavaScript | **MIT** (license file; GitHub metadata does not detect it) | no WASM toolchain needed at all — pure JS, ideal for the web build |
| **Avalanche** | Zig | **MIT** | NNUE; the most promising permissive candidate on strength |
| **Blunder** | Go | **MIT** (license file; metadata undetected) | Go→WASM is viable but heavy |
| **Baislicka** | C | **MIT** | compiles to WASM straightforwardly |
| Shallow Blue | C++ | **MIT** | simple, weak, useful as a conformance reference |

Strength figures are deliberately omitted: they should be **measured in this
project's own harness at capped depth**, which is the only number that matters,
rather than quoted from rating lists computed at time controls this game never
uses.

## 3. The option that may make the whole problem moot

GPL prohibits *proprietary* distribution. It does not prohibit **selling**.

A paid, GPL-compliant Steam release is legal and common. The costs are a written
source offer and a conflict with DRM wrappers — not the ability to charge money.
So the likely segmentation is not "swap the engine to go commercial," but:

| Build | Engine | License | Rationale |
|---|---|---|---|
| Open / web | Stockfish | AGPL-3.0 project + GPL-3.0 engine | compatible: both GPLv3 §13 and AGPLv3 §13 permit the combination |
| Paid Steam | Stockfish | GPL-compliant, source offer honored, no DRM wrapper | charging money needs no license change |
| Exec-lab / enterprise | permissive engine behind `EnginePort` | commercial | the only build where a client may demand no copyleft anywhere |

That inverts the urgency: the engine swap is needed for the **enterprise** track,
which is the *last* audience (D1), not for Steam, which is the first.

## 4. What to do now

1. Define `EnginePort` in Milestone 1 and let nothing outside `engine/` know
   which engine exists. `determinismId` goes into every `MatchRecord`.
2. Write the **conformance suite** before the second adapter: a fixed corpus of
   FENs × depths, asserting stable, reproducible output. This is what makes an
   engine swap a weekend rather than a quarter.
3. Ship Stockfish first — it is the reference implementation and the strongest
   available baseline for calibration.
4. Land **one** permissive adapter early (Lozza is the cheapest possible second
   adapter, being plain JS with no build toolchain) purely to prove the port is
   real. An untested port is not a port.
5. Defer the actual choice of production permissive engine until the enterprise
   track is real, and measure candidates in the harness at capped depth then.

## 5. Open

- **D46:** which permissive engine ships in the enterprise build, decided by
  harness measurement at capped depth — not by rating lists.
- **D47:** does the paid Steam build stay GPL-compliant (source offer, no DRM
  wrapper) or wait for a permissive engine? The former ships far sooner.
- Trademark clearance on *The Kings and I: Sacrifice and Command* remains a
  separate pre-store-page item (ADR 0010).
