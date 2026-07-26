# Design Decisions Required

_Decisions the owner (Benjamin) must make. Each has options, a trade-off
summary, a recommendation, and what it blocks. Recorded decisions graduate into
`docs/adr/`._

Legend: **⛔ blocks Milestone 1–2 code** · **⚠ blocks Milestone 4+** · **🕐 can wait**

---

## Model reconciliation (raised by `docs/spec/psychology-engine.reference.ts`)

The owner's machine-readable equation set is now the normative spec. Reconciling
it against the SRS prose surfaced six issues that must be decided before the
psychology engine is implemented; full analysis in `docs/psychology_engine.md` §10.

### D19 ⛔ The loyalty term dominates utility by ~10×
`w_loyalty · T_i` spans ±100 while `ΔV_board` is ±10, `ΔV_capture` is 0..9, the
risk term is 0..1, and `Φ` contributes at most `w_empathy` per peer. Since
`Θ_refusal` only spans ±50, trust alone decides nearly every verdict and the
move being evaluated barely matters — the "protect my friend" mechanic would
practically never fire.

- **A. Normalize trust** to `w_loyalty · (T_i / 100)` and put all terms on a
  comparable `[-10, +10]` scale (recommended).
- **B. Scale the board/peer terms up ~10×** instead.
- **C. Accept trust as decisive** — then the model is a mood filter, not a
  decision model; say so explicitly and drop the peer-protection marketing.

### D20 ⛔ `w_prestige` is declared but never read
No formula consumes it; class attitude enters only via `C_{i,role(j)}` inside
`Φ`, unweighted. Likely intent:
`Φ = w_empathy · ((A_{i,j} + w_prestige · C_{i,role(j)}) / 200) · ΔSafety_j`.
Confirm, or the trait is cosmetic.

### D21 ⛔ `B_i` (betrayal/disillusionment) is stored but never read
Nothing writes it and nothing consumes it. Is it (a) a grief penalty in `U`,
(b) a second mutiny gate alongside morale, or (c) display-only?

### D22 ⛔ Morale `M_i` has no update rule — mutiny is currently unreachable
Desertion requires `M_i == 0`, but no event changes morale. Need sources
(losses, exposure, peer deaths, victories), an inter-match recovery rule, and
`M_i <= ε` instead of exact float equality.

### D23 ⚠ `S(P_j, P_benched)` shared bond is undefined
The benching penalty needs a `[0,1]` closeness scalar nothing else produces.
Recommend reusing the `Φ` relationship coefficient:
`S = max(0, (A_{j,benched} + C_{j,role(benched)}) / 200)`.

### D24 ✅ Trust feedback loop — **decided** (ADR 0007, `docs/trust_dynamics.md`)
Nothing writes match outcome back into `T_i`, so the game's premise cannot
occur. Resolved by owner intent: outcomes and conduct do write back, and there
is **no** automatic decay toward baseline. The ratchet is deliberate — a player
who keeps playing pure chess spirals to mutiny and loses the campaign; recovery
comes only from costly signals, over multiple campaigns. The sole invariant is
that no absorbing state exists for a player who *changes policy*.

Follow-on decisions: **D25** (which costly signals ship), **D26** (how long
phase 2 lasts before collapse), **D27** (cross-campaign roster memory),
**D28** (disclosure vs. discovery), **D29** (post-collapse epilogue) — all in
`docs/trust_dynamics.md` §7.

Minor, no decision needed unless you disagree: `loyaltyStabilityScore` can reach
200 despite being documented `0..100`, and `engagementFactor` is both persisted
and recomputed per verdict (recommend derived-only).

---

## Product & audience

### D1 ⚠ Which audience track ships first?
The SRS targets four personas (indie/dark-strategy, exec-leadership lab, chess
purists, behavioral-game-theory academics). They pull the UI in opposite
directions: the indie track wants portraits, grim dialogue, and hidden numbers;
the exec-lab track wants exposed telemetry, dashboards, and a facilitator export.

- **A. Indie-first** — bigger organic audience, virality, cheaper art via woodcut
  aesthetic; monetization is a one-time $10–20 purchase.
- **B. Exec-lab-first** — far higher revenue per seat, but needs facilitator
  tooling, data handling assurances, and a sales motion you may not want.
- **C. Academic/purist-first** — smallest surface (`tactical-blueprint` theme,
  numbers on screen), fastest to build, and the natural output of Milestones 0–3.

**Recommendation:** build C as the *development* skin (it is nearly free — it
is the debug UI), ship A as the first *public* release, and treat B as a
derivative product built from the same event logs once the model is calibrated.

**Blocks:** Milestone 4 UI scope, Milestone 7 ordering, README positioning.

---

## Mechanics

### D2 ⛔ Does refusal cost the player a turn?
_(The reference implementation defines when `MORAL_REFUSAL` fires, but not what
it costs the player — that is still open.)_
The SRS says "the player loses their turn or must select a compliant piece."
These are wildly different games.

- **A. Free re-plan** (refusal just rejects the move) — refusal is information,
  not damage. Risk: player brute-forces the roster to find who will obey; the
  psychology becomes a mild inconvenience.
- **B. Turn forfeited** — brutal, chess-breaking (a forfeited tempo can lose a
  game outright), and randomly punishing at low trust.
- **C. Bounded budget** — the player may issue up to *k* rejected intents per
  turn (e.g. 3); exceeding it forfeits the turn or forces a null move.
- **D. Clock cost** — refusal burns time on a chess clock instead of a turn.

**Recommendation:** C with `k = 3` and rising narrative cost (each refusal in a
turn drops the refusing piece's morale further and is visible to peers), then
tune `k` with the harness. It preserves chess integrity while making distrust
genuinely expensive.

### D3 ⛔ How is mutiny represented on the board?
See `docs/psychology_engine.md` §8. Removal (A) / frozen obstacle (B) /
defection to the enemy (C).

**Recommendation:** B (frozen obstacle, re-recruitable) for MVP; C as an
unlockable "high-stakes" variant. The King is never eligible for mutiny.

### D4 ⛔ Does variable insight change the *engine*, or only the *advice*?
_(The reference resolves this in favor of B: `ΔV_board` in `U` is the piece's own
depth-`D_i` evaluation. Confirming the consequence is still worthwhile.)_
- **A. Advice-only** — all pieces move as commanded; experience only affects the
  quality of hints. Simple, keeps chess pure.
- **B. Insight enters utility** (as specified) — a novice's flawed evaluation
  makes it refuse good moves and accept bad ones. Much richer, but means bad
  advice has *mechanical* teeth and can feel unfair.

**Recommendation:** B, with the piece's *reasoning* always inspectable ("Aldric
thinks this loses a Rook — he is wrong"). Unfairness comes from opacity, not
from error.

### D5 ⚠ Does the opponent army have psychology too?
- **A. No** — opponent is plain Stockfish. Clean baseline, half the work.
- **B. Yes, symmetric** — enables AI-vs-AI leadership studies (valuable for the
  academic track and for the harness), doubles the balance surface.

**Recommendation:** A for player-facing MVP, but keep the engine *capable* of B
from day one (the harness already needs two scripted leaders), so this is a
config flag rather than a rewrite.

### D6 ⛔ Is capture permanent death?
Drives the entire campaign emotional arc, roster churn, and the meaning of
sacrifice.

- **A. Permadeath + green replacements** — sacrifice is heavy; replacements
  arrive with `E_i ≈ 1`, so attrition costs strategic depth. Strongest theme fit.
- **B. Pieces return with trauma** (`B_i` accumulates) — no roster spiral, more
  forgiving, keeps beloved characters alive across 20 matches.
- **C. Hybrid** — return, but each capture permanently caps morale/experience,
  and *N* captures retires the piece.

**Recommendation:** C. It preserves long-run character attachment (the thing
that makes the debriefs land) while making repeated exploitation visibly costly.

### D7 ⛔ Roster size: exactly 16, or a bench?
A bench (e.g. 24 identities for 16 slots) makes *benching* a distinct, meaningful
act from *firing*, and gives the "commodity paradox" mechanic room to breathe.
It also adds a roster-management screen and doubles trait-generation content.

**Recommendation:** 16 + a 4-slot reserve, introduced at Milestone 5.

### D8 🕐 Player-facing randomness
Are trait rolls, replacement recruits, and event thresholds fully deterministic
per campaign seed (competitive, replayable, "fair") or re-rolled live (surprising,
unreproducible)? Determinism is required inside the harness regardless.

**Recommendation:** seed the campaign, show the seed, allow seed sharing. Costs
nothing and buys reproducible playtest reports and bug reproduction.

---

## Technical

### D9 ⛔ Engine topology: worker-per-piece or shared search + truncation?
- **A. Worker per piece** — literal reading of the SRS; 16 WASM instances,
  hundreds of MB, unusable on mobile, mostly duplicated work.
- **B. Pool + single deep search truncated per piece** (recommended, see
  `docs/architecture.md` §5) — one search at `d_max`, each piece sees a
  truncated/noised view.
- **C. Pool + genuinely separate shallow searches for low-`d_i` pieces** —
  more faithful "different pieces see different boards," moderate cost.

**Recommendation:** B, with C available for the ≤4 pieces the player is actively
consulting, since that is where fidelity is visible.

### D10 ⛔ Determinism contract for Stockfish
Fixed `go depth N`, single thread, fixed hash, pinned stockfish.wasm version —
or allow time-based search for responsiveness? Time-based search makes every
golden test flaky and every replay non-reproducible.

**Recommendation:** depth-only, pinned version, `deterministic: true` recorded
in every `MatchRecord`. Non-negotiable if the harness is to have any value.

### D11 ⛔ Is the LLM allowed to affect mechanics?
- **A. Narration only** (recommended) — deterministic core, offline playable,
  cheap, testable.
- **B. LLM proposes piece decisions** — genuinely emergent personality, but
  non-deterministic, unbalanceable, expensive per turn, and unshippable offline.

**Recommendation:** A, permanently, and state it as an architectural invariant so
future features cannot erode it.

### D12 ⚠ LLM key strategy
- **A. BYO key** stored locally — zero hosting cost, zero liability; friction for
  non-technical players, and a plainly visible key in the client.
- **B. Hosted proxy with our key** — best UX; requires a backend, rate limiting,
  abuse defense, and per-user cost from day one.
- **C. Ship template-only, sell an "LLM narration" upgrade later.**

**Recommendation:** C → A → B in that order. Templates must be good enough that
LLM prose is a delight, not a dependency. Also decide provider now only insofar
as the adapter interface stays provider-agnostic (Gemini Flash vs Claude Haiku
is then a one-file change).

### D13 ⚠ Distribution shell: web, PWA, or Electron/Tauri?
WASM + IndexedDB works in-browser today; a desktop shell buys Steam
distribution, larger memory limits, and offline trust, at the cost of build
complexity and signing.

**Recommendation:** PWA first (link-shareable = viral), Tauri wrapper later if
Steam becomes a target. Avoid Electron (bundle size, memory).

### D14 🕐 Package/state stack details
Vite + React 18 + TS strict is settled by the SRS. Still open: state management
(Zustand recommended — the event log is the real state, so the store is thin),
package manager (pnpm recommended), test runner (Vitest), chart library for
debrief dashboards.

### D15 🕐 Save-data compatibility promise
Do campaign saves survive psychology re-calibration? Changing `w_*` changes
behavior mid-campaign. Options: version the config and pin a campaign to the
config it started with (recommended, keeps campaigns honest), or migrate and
accept drift.

---

## Business & legal

### D16 ⚠ Licensing conflicts with the exec-lab track
The repo is currently **AGPL-3.0**. AGPL means any hosted/networked version must
offer source, and corporate/government training customers frequently refuse
AGPL dependencies in their stack. If B in D1 is ever a revenue path, decide now:

- **A. Keep AGPL** — strongest community/copyleft stance; likely forecloses
  white-labeled corporate licensing.
- **B. Dual-license** (AGPL + commercial) — requires you to hold all copyright,
  so it must be decided *before* outside contributions arrive.
- **C. Relicense to MIT/Apache-2.0** — maximum adoption, no leverage.

**Recommendation:** B if there is any chance of the exec-lab product; it is far
cheaper to declare now than to re-license after contributors appear. This is the
most time-sensitive decision in this document.

### D17 🕐 Content policy for LLM prose
Pieces expressing fear, resentment, and betrayal in a corporate-training context
can produce output a facilitator would not want on screen. Need: persona-scoped
tone guardrails, an output validator, and a "safe mode" for the exec-lab theme.

### D18 🕐 Naming
"Living Chess" (SRS title) vs "The King and I" (repo name). Pick one for the
public artifact; keep the other as the internal codename.

---

## Suggested decision order

1. **D16** (licensing — cheapest now, most expensive later)
2. **D19–D22** (the model does not yet function as written: trust dominates,
   two fields are dead-wired, and mutiny is unreachable) → unblocks Milestone 2
3. **D2, D3, D4, D6, D7** (mechanics that define the data model) → unblocks Milestone 2
4. **D9, D10, D11** (engine + LLM invariants) → unblocks Milestone 1
5. **D1, D13** (audience + shell) → unblocks Milestone 4
6. **D23, D25–D27** during Milestone 3 calibration (they set the shape of the
   spiral); **D28, D29** during Milestone 4–7; everything else as it comes up.
