# Design Decisions

The decision register for **The King and I**. Owner rulings of 2026-07-26 are
recorded below and, where consequential, as ADRs in `docs/adr/`.

Legend: **✅ decided** · **⛔ blocks Milestone 1–2 code** · **⚠ blocks Milestone 4+** · **🕐 can wait**

---

## Decided

| # | Decision | Ruling | ADR |
|---|---|---|---|
| D2 | Cost of a refused order | **Free re-plan.** No turn, tempo, or clock cost. | [0002](adr/0002-refusal-turn-cost.md) |
| D3 | Mutiny representation | **Desertion only** — the piece quits the board and is removed for the match. Defection to the enemy is permanently out of scope. King exempt. | [0003](adr/0003-desertion-not-defection.md) |
| D4 | Insight: engine or advice? | **Advice only.** A commanded move is always the move played; `E_i`/`η_i` govern the quality of counsel. | [0008](adr/0008-insight-is-advice-only.md) |
| D5 | Opponent psychology | **Yes, symmetric** — either side may be human- or AI-led, and both armies have psychology. | — |
| D6 | Capture permanence | **Not permadeath.** Capture removes the piece for that match and leaves durable trauma, trust loss, and the risk of losing the game. | [0009](adr/0009-capture-is-trauma-not-death.md) |
| D7 | Roster size | **A bench built up over time**, not a fixed 16. Pieces like winning, hate losing, and really hate being taken. | [0009](adr/0009-capture-is-trauma-not-death.md) |
| D8 | Randomness | **Campaign-seeded**, shown and shareable. | — |
| D10 | Stockfish determinism | **Fixed depth.** `go depth N`, single thread, fixed hash, pinned WASM build. No time-based search, ever. | [0005](adr/0005-engine-insight-topology.md) |
| D11 | May the LLM affect mechanics? | **No — personality only**, and distilled where possible from a large model into a shipped decision tree. | [0001](adr/0001-deterministic-core-narrative-skin.md) |
| D12 | LLM key strategy | **Simplest possible first**: no runtime LLM, no keys, no backend. Authored/distilled content ships in the bundle; a BYO-key provider comes later if the prose demands it. | [0004](adr/0004-llm-key-strategy.md) |
| D13 | Distribution | **Lightest shell first** to validate the psychology (web build); **Steam via a desktop wrapper** as the commercial target. Not Electron. | [0012](adr/0012-distribution.md) |
| D15 | Save compatibility | **No compatibility promise during development.** Saves may be invalidated by recalibration. | — |
| D16 | Licensing | **Dual-license** — AGPL-3.0 for the open build, commercial terms available. Requires holding all copyright, so contributor terms must land before outside contributions. | [0006](adr/0006-licensing.md) |
| D18 | Naming | **The King and I.** "Living Chess" is the internal codename only. | [0010](adr/0010-naming-the-king-and-i.md) |
| D24 | Trust feedback loop | Outcome and conduct write back into `T_i`; **no** automatic decay toward baseline. The spiral is the lesson. | [0007](adr/0007-trust-feedback-loop.md) |
| — | Desertion mechanics | Expected-cost decision, not a threshold; **the cascade to a rout is intended** and must not be damped. | [0011](adr/0011-desertion-cascade.md) |

Downgraded to ordinary implementation wiring by owner ruling — to be settled in
code review during Milestones 1–3, each with a sensitivity probe:
**D20** (`w_prestige` unused), **D21** (`B_i` unused — now answered in substance
by ADR 0009: it is capture trauma), **D22** (morale update rule — no longer
load-bearing since ADR 0011 removed the morale trip-wire), **D23** (`S(P_j, P_benched)`
undefined).

---

## Open — blocking

### D19 ⛔ The loyalty term dominates utility by ~10×
`w_loyalty · T_i` spans ±100 while `ΔV_board` is ±10, `ΔV_capture` is 0..9, the
risk term is 0..1, and `Φ` contributes at most `w_empathy` per peer. Since
`Θ_refusal` spans only ±50, trust alone decides nearly every verdict.

Owner: *"we will need to figure it out, but trust is critical here — the lesson
is how important trust can be relative to technical skill in a leader."*

That intent is compatible with fixing the scale. "Trust matters more than
tactics" should be an *outcome the simulation demonstrates*, not an artifact of
`T_i` being on a 10× larger axis than everything else. If it is the latter, the
peer-protection and class-prejudice machinery is decorative and the audit cannot
honestly attribute anything.

- **A.** Normalize: `w_loyalty · (T_i / 100)`, all terms on a comparable
  `[-10, +10]` axis, then *tune* `w_loyalty` up until trust visibly dominates.
  Recommended — same result, but chosen and measurable.
- **B.** Scale the board and peer terms up ~10× instead.
- **C.** Keep as-is and accept that only trust matters.

**Resolve during Milestone 3 calibration; blocks the psychology reducers.**

### D31 ⛔ Does a piece refuse using *its own* evaluation, or the true one?
Follows from D4 being advice-only. Under ADR 0002 (free re-plan) and ADR 0008,
refusal is the psychology's only lever on the board mid-match, so this decides
whether it has teeth.

- **A. Piece's own depth-`D_i` evaluation.** A novice refuses good moves it
  cannot see the point of, and accepts bad ones. Insight reaches the board
  through *willingness* while never substituting a move — arguably the truest
  reading of "advice only."
- **B. True evaluation.** All pieces judge the move correctly and differ only by
  trust and traits. Simpler, fairer-feeling, but experience then affects nothing
  a player can lose to, and `D_i` becomes cosmetic.

**Recommendation: A.** Note that desertion already uses the piece's own estimates
(ADR 0011), so B would make the model internally inconsistent.

### D9 ⛔ Engine topology
Owner: not decided yet. Options unchanged: worker-per-piece (16 WASM instances,
unusable on mobile), pool + one deep search truncated per piece (recommended),
or pool + separate shallow searches for the few pieces the player is consulting.
D5 (symmetric opponent psychology) roughly doubles the engine budget, which
argues against the literal per-piece reading.

---

## Open — non-blocking

### D30 ⚠ What if every legal move is refused?
Chess has no "pass," and ADR 0002 removed the forfeit path. Options: allow the
player to **override** a refusal at a large trust cost to the piece and every
witness (makes the tyrant path playable and keeps the board legal at all times —
recommended); force the least-refused move automatically; or treat total refusal
as resignation.

### D32 ⚠ Whose evaluation supplies `P_loss` for the desertion calculation?
Shared engine evaluation (cheap, consistent) or each piece's truncated view
(faithful to ADR 0008; lets a novice panic in a drawn position). See
`docs/desertion_model.md` §7.

### D33 ⚠ Can a deserter be re-recruited later, and at what cost?

### D34 ⚠ Does the player see the desertion arithmetic, or only the outcome?
Legibility of *cause* is mandatory; exposing the numbers is optional and
probably belongs to the tactical-blueprint and exec-lab skins only.

### D25–D29 ⚠ Trust-loop follow-ons
Which costly signals ship (D25), how long the trap runs before collapse (D26),
cross-campaign roster memory (D27), disclosure vs. discovery (D28), and the
post-collapse epilogue (D29). See `docs/trust_dynamics.md` §7.

### D1 ⚠ Which audience ships first?
Partially answered by D13: validate the psychology in the lightest distribution,
then Steam. That implies the tactical/debug skin during development and an indie
release publicly, with the exec-lab track derived later from the same event logs.
Confirm when the UI scope is set.

### D14 🕐 Package/state stack
Vite + React 18 + TS strict is settled. Still open, with recommendations: pnpm,
Zustand (thin — the event log is the real state), Vitest, and a chart library for
debriefs. Owner has no preference; defaults will be taken unless overridden.

### D17 🕐 Content policy for narrative prose
Pieces expressing fear, resentment, and betrayal can produce output a corporate
facilitator would not want on screen. Needs tone guardrails and a safe mode
before any exec-lab use. Not yet considered by the owner.

---

## Suggested decision order

1. **D31** — decides whether refusal (the only mid-match lever left) has teeth.
2. **D19** — during Milestone 3 calibration, with the harness in hand.
3. **D9** — before the engine layer is built; D5 makes it more expensive.
4. **D30** — needed the first time a full-refusal position occurs in the harness.
5. **D25–D27, D32–D34** — during Milestone 3–5.
6. **D1, D14, D17** — as UI and content work begins.
