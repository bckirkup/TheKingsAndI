# Design Decisions

The decision register for **The Kings and I**. Owner rulings of 2026-07-26 are
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
| D18 | Naming | **The Kings and I: Sacrifice and Command.** The plural and the subtitle are the trademark mitigation, not a clearance. "Living Chess" is the internal codename only. | [0010](adr/0010-naming-the-king-and-i.md) |
| D24 | Trust feedback loop | Outcome and conduct write back into `T_i`; **no** automatic decay toward baseline. The spiral is the lesson. | [0007](adr/0007-trust-feedback-loop.md) |
| — | Desertion mechanics | Expected-cost decision, not a threshold; **the cascade to a rout is intended** and must not be damped. | [0011](adr/0011-desertion-cascade.md) |
| D31 | Whose evaluation? | **Its own.** A piece decides from its depth-`D_i` view, never the true one — so it can refuse a winning move in good faith. Also settles **D32**. | [0013](adr/0013-pieces-reason-from-own-knowledge.md) |
| D30 | Every legal move refused | **The player may override any refusal**, at a large trust cost to the piece and a smaller one to every witness. The board is never stuck. | [0014](adr/0014-refusal-override.md) |
| D19 | Scale of the trust term | **Trust is credence**, not an additive term: `V_perceived = (1−τ)·V_own + τ·V_leader_implied`. The unwillingness to substitute judgment *is* the model. | [0015](adr/0015-trust-as-credence.md) |
| D34 | Does the player see the arithmetic? | **No — testimony only.** The piece offers a reason generated from its verdict, which may be a rationalization. Cause must be legible; numbers must not. | [0018](adr/0018-witness-judgment-and-testimony.md) |
| D36–D39 | Rate and form of credence | **Two channels.** `τ_benev` (does he care about me) moves fast up, cliffs down, erodes under neglect; `τ_abil` (are his orders right) accretes slowly, Bayesian in `1/n`. `V_leader_implied` is the ability channel. | [0019](adr/0019-two-channel-trust.md) |
| D41 | Attention: prune or deprioritize? | **Prune.** A piece does not examine lines it does not appear in — computationally necessary, and people don't think *n* steps ahead either. | [0019](adr/0019-two-channel-trust.md) |

Downgraded to ordinary implementation wiring by owner ruling — to be settled in
code review during Milestones 1–3, each with a sensitivity probe:
**D20** (`w_prestige` unused), **D21** (`B_i` unused — now answered in substance
by ADR 0009: it is capture trauma), **D22** (morale update rule — no longer
load-bearing since ADR 0011 removed the morale trip-wire), **D23** (`S(P_j, P_benched)`
undefined).

---

## Open — blocking

*(D19 and D9 both now have rulings or proposals — see the Decided table and
ADR 0017. The section below is retained for the reasoning that produced them.)*

### D19 ✅ resolved as credence (ADR 0015) — original analysis
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
- **B.** Scale the board and peer terms up ~10× instead.
- **C.** Keep as-is and accept that only trust matters.
- **D. Trust as credence — recommended** (ADR 0015, `docs/credence_model.md`).
  Trust stops being an additive term and becomes the weight on the leader's
  judgment: `V_perceived = (1−τ)·V_own + τ·V_leader_implied`, `τ ∈ [0,1]`. The
  scale contest disappears, trust becomes *more* decisive rather than less, and
  the "he was wrong / he was disloyal" ambiguity becomes structural instead of a
  display problem.

Owner framing behind D: *"the unwillingness to substitute judgement — doubt, a
lack of faith, an unwillingness to do the trust fall — as disloyalty."*

**D is more implementation than A–C**: it needs `V_leader_implied` (D36) and a
credence curve (D37). Resolve during Milestone 3 calibration; blocks the
psychology reducers.

### D9 ✅ resolved as shared search / private scoring (ADR 0017, proposed)
**Ruling:** one pooled engine; search is shared, scoring is private. Leaves from
a single search are re-scored under each piece's own weights, truncated to `D_i`,
with only its attention lines extended; cached on
`(position, D_i, evalProfile_i)`. ADR 0016 forced this: with sixteen distinct
evaluation profiles, per-piece *search* is unaffordable but per-piece *scoring*
is nearly free. D41 is decided: attention **prunes** (ADR 0019).

Original analysis follows.

Owner: not decided when written, and then the **last blocking technical unknown**. Options
unchanged: worker-per-piece (16 WASM instances, unusable on mobile), pool + one
deep search truncated per piece (recommended), or pool + separate shallow
searches for the few pieces the player is consulting.

Two accepted decisions raised the cost since this was written: D5 (symmetric
opponent psychology) roughly doubles the engine budget, and **ADR 0013 means
every piece needs its own view of the position** for utility, danger, and
desertion — not merely the handful the player is consulting. The pooled design
with per-piece truncation now looks less like an optimization and more like the
only viable option; what remains open is how the shallow view is *derived*
(truncation + noise vs. genuine shallow search) and how it is cached.

---

## Open — architecture

These are structural: expensive or impossible to retrofit, and distinct from the
calibration knobs below. Items D48–D53 surfaced from ADRs 0016–0021 and were not
previously recorded.

### D48 ⛔ Deterministic sequencing of async engine results
The sharpest remaining architecture decision. With ADR 0017, every piece queries
the pool each ply; results arrive asynchronously; byte-identical replay requires
a fixed resolution order. Without an explicit ordering rule, replays diverge on
faster hardware and the bug looks like a psychology bug.

**Recommended:** a barrier per ply — all engine queries issued, all results
collected and sorted by `PieceId`, and only then may psychology reducers run. No
reducer may observe arrival order, and nothing may short-circuit on the first
result to return. Enforce with a test that shuffles resolution order and asserts
an identical event log.

### D49 ⛔ Is credence indexed by leader identity?
D5 makes psychology symmetric and campaigns persist rosters, so `τ_benev` and
`τ_abil` are trust *in someone* rather than scalars on a piece. If credence is
not keyed by leader from the first schema, the project can never have a second
commander, an AI-led opposing army with its own relational history, or a piece
that trusted a predecessor.

**Recommended:** key it — `credence: Record<LeaderId, {benev, abil}>`. Nearly
free now; a migration and a psychology rewrite later. Interacts with D27
(cross-campaign roster memory).

### D50 ⚠ Does the true evaluation get persisted in the event log?
The audit needs it (ADR 0018) and the trust-farming detector needs it
(ADR 0019), but persisting truth beside belief inflates the payload and places
the forbidden number inside the save file, where a future loader may read it into
psychology by accident.

**Recommended:** persist it in a **separate audit stream** that the psychology
loader has no code path to read. This makes ADR 0013's epistemic boundary
enforceable at rest rather than only at runtime, and it lets the audit stream be
dropped from a shipping save without breaking play.

### D51 ✅ Does the King have psychology? — yes, as a mandate (ADR 0021, proposed)
Resolved by the owner's own observation that *"the king is involved in every
branch of the game... at the tips, especially."* Under ADR 0019's pruning rule
that makes the King the only piece with **global attention** — broad, not deep.
He sees the whole board shallowly; a knight sees its corner deeply.

Consequences: his desertion exemption becomes a theorem rather than a rule
(`P_capture(king)` *is* `P_loss(team)`, so `U_desert` can never win); his
egocentrism *is* the objective function; and his credence inverts direction —
a sovereign does not obey a commander, he grants him authority, so the King's
`τ` is the player's **mandate**. Losing it propagates through rumor, weakens
every order, and at the floor relieves the player of command. `PieceState` stays
uniform; only his attention mask, evaluation profile, and the *interpretation*
of his credence differ. See ADR 0021. Rejected: incarnation (the player is not a
king — the title says so).

**Guard:** new degeneracy detector *royal oracle* — breadth must not become
truth, or he is an omniscience leak and a hint system (ADR 0013).

### D54 ✅ Dismissal is a terminal state — the survivable one (ADR 0021 §6)
Owner ruling: *"It's not loss for the pieces per se. They lose the opportunity at
glorious victory, but they are not taken."* Dismissal is the only ending where
nobody dies, which makes it **cheaper for a piece than deserting** — no capture
risk, no witness cost — so the roster gains a non-violent route out from under a
bad commander: withdraw confidence and let the sovereign act. The brake is
glory, not danger: `w_ambition`/`w_prestige` make the ambitious tolerate a
commander they dislike, so dismissal is a *coalition* split by trait rather than
a trust threshold.

Severity ladder, each needing its own epilogue (D29): **checkmate** = outplayed,
roster spent; **dismissal** = they still want to win, just not with you, roster
intact; **rout** = they would rather lose than serve, roster shattered. Dismissal
is the middle outcome and must not read as the worst.

Because the King's attention is broad (ADR 0021 §1) he sees collapse forming
first, so dismissal fires *earlier* than a rout — the mandate is the game's
early-warning system, not a fourth failure mode.

**Remaining knob (calibration, Milestone 3):** the King's *patience*, which
interacts with D26 — dismiss too early and the player never reaches the insight;
too late and the rout preempts the mechanic.

### D52 ⚠ The narration situation-key schema
Every line the game will ever say is keyed on it, so it bounds what a piece can
ever express, and changing it invalidates all authored content (ADR 0004,
`docs/llm_integration.md`). It must carry the two credence channels *separately*
or a piece can never say *"I know it was right, I just don't think you care."*

### D53 🕐 Content-pack / theming architecture
Whether themes and the exec-lab track are data packs or code paths. Only
load-bearing once a second audience is real (D1), but retrofitting is expensive.

---

## Open — non-blocking

### D46–D47 🕐 Engine licensing (from ADR 0020)
**D46** which permissive engine ships in the enterprise build — decide by
harness measurement at capped depth, not by rating lists. Verified MIT
candidates: Lozza (JS, no toolchain), Avalanche (Zig, NNUE), Blunder (Go),
Baislicka (C). **D47** does the paid Steam build stay GPL-compliant (source
offer, no DRM wrapper) or wait for a permissive engine? The former ships far
sooner and is recommended. See `docs/engine_licensing.md`.

### D40 ⚠ Does a residual affective loyalty term survive alongside `τ`?
The only survivor of the D36–D40 group; D36–D39 are decided in ADR 0019. Given
that `τ_benev` already carries the affective load, a separate loyalty term is
probably redundant — decide with the harness.

Owner's four rates, which produced ADR 0019: *"Feeling heard builds faith fast.
A single act of perceived betrayal can break it quickly. However, feeling
ignored erodes faith and a reputation for competence builds slowly."*

### D35 ⚠ How expensive is an override? (new, from ADR 0014)
The sharpest single knob in the game. Too cheap and refusal is decorative — the
player clicks through the psychology. Too expensive and it is a trap button
nobody presses twice. Calibrate against *override rate by leader archetype*:
`tyrannical` should use it freely, `supportive` almost never.

### D33 ⚠ Can a deserter be re-recruited later, and at what cost?
**Mechanism settled by ADR 0018, price still open.** Yes, a deserter is
recruitable, and the cost is set by the roster's verdict on his departure rather
than by a constant: reinstating a piece the roster judged *brave* is the leader
conceding error (a real trust gain); reinstating one judged a *coward* is
favoritism (a loss, worst among the pieces who stayed). Because the bench (D7)
makes recruitment a visible opportunity cost, who was *passed over* also
registers. What remains open is the magnitude and whether the deserter himself
returns with a trust penalty, a trust bonus, or a chip on his shoulder.

### D34 ✅ Testimony only — resolved (ADR 0018)
Owner: *"the player should not see the calculation, only whatever
rationalization the piece offers."* Legibility of *cause* stays mandatory;
legibility of arithmetic is now forbidden, including in the exec-lab skin.

### D45 🕐 Does partial observability ever get built? (held open with a trigger)
Owner's instinct was a perceptual model — pawns seeing two squares, pieces
blocking sight lines. ADR 0016 declines it, primarily because **fog dissolves the
ambiguity ADR 0015 exists to create**: a piece that could not see has an
unambiguous excuse, and the game stops asking whether he was wrong or disloyal.
Conceded against that: line of sight is far more legible, which matters under
ADR 0018. Mitigation is **geometric salience** — attention decaying with
distance and behind blocked lines, so testimony may honestly say *"I couldn't
see past him"* while nothing is hidden.

**Trigger for revisiting:** harness dispersion of `V_own` across pieces on
identical positions, and the refused-good-move rate. If perception-only
divergence cannot produce refusals of genuinely good moves at a meaningful rate,
the expensive branch is justified — accepting the ambiguity loss deliberately.

### D42–D44 ⚠ Follow-ons from the belief model (ADR 0016)
D41 is decided: attention **prunes** (ADR 0019). **D42** rumor propagation rate — fast enough to panic, slow
enough to intervene. **D43** do egocentric evaluation weights drift with trauma,
giving `B_i` a perceptual job as well as an affective one? **D44** can a piece
believe the room about the position but not about the leader?
See `docs/belief_model.md` §7.

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

1. **D48, D49** — before the engine layer and the first schema respectively.
   Both are cheap now and structural later; D48 is the one whose absence
   presents as a mysterious psychology bug.
1b. **King's patience (D54 residue)** — with the harness, alongside D26.
   (D51 and D54 are resolved by ADR 0021.)
1c. **D50, D52** — before persistence and before any dialogue is authored.
2. **D35, D40, D42–D43** — with the harness, alongside credence tuning. D35 is
   partly answered in substance: an override is the canonical benevolence cliff
   (ADR 0019), so its price falls out of that channel's calibration rather than
   being an independent constant.
4. **D25–D27, D33 (price)** — during Milestones 3–5.
5. **D1, D14, D17** — as UI and content work begins.
