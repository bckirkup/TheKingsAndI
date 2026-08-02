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
| D13 | Distribution | **Lightest shell first** to validate the psychology (web build); **Steam via a desktop wrapper** as the commercial target. Not Electron. *Partially reversed by D72: a shared piece community needs identity and a registry; see ADR 0026 §5.* | [0012](adr/0012-distribution.md) |
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

### D55 ✅ After dismissal the game continues without the player (ADR 0022)
Owner: *"the show must go on."* The King takes personal field command and the
player watches — no order authority, same rendering, same audit. Free
structurally: D5 already makes leadership side-agnostic and AI-drivable, D49
already keys credence by `LeaderId`.

The successor is **a worse tactician who gets better results**, which is not
authored but ADR 0015 with the coefficients swapped: the player's `V_own` was
the strongest on the board and his `τ` had collapsed; the King's breadth without
depth makes him mediocre, but full mandate means his mediocre plan is actually
executed. He is **broad and shallow**: `D_king < D_player_effective` strictly, so he sees
every line and none of them far. That is enforced rather than flavor — if the
successor's moves were good, the coda would become a chess tutorial and the
lesson would invert. His second weakness is caution: his own safety is the
objective function, so he grinds draws the player would have pressed.

The debrief therefore scores **board quality** (quality of orders issued) and
**execution fidelity** (share of orders actually carried out) as separate
columns. The gap between them is the player's diagnosis in numbers.

Outcome is computed, never guaranteed: *lost the room* → the successor
outperforms you; *broke the roster* → he fails too, which is the **worse**
ending. A successor who always succeeds is the game lecturing — detector
*scripted humiliation*.

### D56 ✅ Recall happens between matches, never mid-game (ADR 0022 §7)
Owner: *"this is something that has to play itself out, and then decisions can be
made at the start of the next game."* A mid-game recall is a rescue, which
ADR 0007 forbids, and it spares the player the part that teaches — sitting
through the consequence with no authority. Dismissal ends command for the
remainder of the match; the coda plays to a real result; only at the start of the
next match may the King reinstate.

Reinstatement is computed, not granted: available when `P(loss)` under the
successor drifts worse than it was under the player and the mandate is off the
floor. The roster then holds a comparison it never had. Earned rather than
forgiven, still requiring the changed policy D24 demands. Rate is a calibration
knob; a recall *within* a match is a hard failure, not a tuning issue.

### D52 ✅ Situation keys are role-abstract (ADR 0023 §4)
Keys name relationships and events, never board objects or geometry:
`subordinate.refused.high_risk_order.after_betrayal_by_this_leader`, never
`pawn_refused_diagonal_advance`. They carry the two credence channels separately
(ADR 0019) so a piece can say *"I know it was right, I just don't think you
care"* in any skin. This is what lets a pack rename Pawn → Analyst without
touching a key.

### D53 ✅ Content is data packs, not code paths (ADR 0023 §4)
The enterprise track is the same simulation with different nouns, so a pack is
`{themeTokens, nounMap, dialogue, epilogues}` and a code-path fork would be a
second codebase maintained forever. Pack coverage becomes a CI check.

### D69 ✅ Capture is never permanent; exhaustion is (ADR 0026 §1)
A taken piece loses the match, gains trauma, and remembers **who took it** and
**who spent it**. ADR 0006 stands — no commander can destroy a piece. But in a
shared world the trauma pool is **common property**, and accumulation across all
commanders eventually produces **retirement**: the piece declines everyone,
permanently, and leaves the world. No single leader kills a piece; every careless
one contributes. Leadership failure as a **tragedy of the commons**, which cannot
exist in a single-player roster.

### D70 ✅ Pieces are free agents, not property (ADR 0026 §2)
Between engagements a piece may **decline** a commander; recruitment is mutual.
Reputation becomes a market position rather than a save-file scalar, and the end
of a bad career is not the King's dismissal but nobody taking your calls — the
community enforcing what ADR 0023 had the fiction enforce. Affinity crosses
rosters, so a piece may be taken by one it served beside for three campaigns, and
may respect the opposing commander who took it cleanly.

### D71 ✅ Retirement is the only permanent loss, and it is a world event (ADR 0026 §1)
It needs an epilogue, a public record of which commanders contributed, and an
effect on their standing — otherwise the externality is free and the commons has
no feedback.

### D72 ⚠ Which infrastructure tier ships — reverses part of D13 (ADR 0026 §5)
Offline-first with no accounts and no backend cannot host a shared registry. The
ladder: **(1) passports** — signed piece exports carried between players by hand,
offline intact; **(2) registry** — a thin service owning identity, the free-agent
market, and retirement, with matches still local; **(3) authoritative world** —
not recommended. Recommendation: ship tier 1, make the schema tier-2 ready.
Moderation and privacy, not engineering, are the real cost of tier 2.

### D73 ✅ Determinism becomes anti-cheat (ADR 0026 §6)
A match is a seed plus an event log, so a registry can **replay-verify** submitted
results rather than trusting or re-simulating them. Requires ADR 0020's
`determinismId` in every `MatchRecord`; unrecognized engine identities are
unverifiable and must be rejected.

### D74 ✅ AI commanders are permanent market infrastructure (ADR 0026 §4)
Not merely calibration stand-ins: they populate the market at cold start so pieces
have histories and opinions before there is a second human, and they are never
removed. A thin market is what kills a game of this shape in month two.
Single-player must remain whole — a player with no network sees a world of AI
commanders and loses no mechanic.

### D64 ✅ The opponent is a commander, not an engine (ADR 0025 §1)
The enemy army has trust, refusals, desertion, and routs of its own, driven by an
AI leader with an archetype — the same oracle policies the harness already uses.
Side-agnostic orchestration (D5) makes this configuration, not a new subsystem.

### D65 ✅ Morale warfare wins games; enemy state is behavioural only (ADR 0025 §2)
A player may beat a stronger tactician by making the enemy army stop believing in
its commander. No enemy gauges, no numbers, no cross-side audit — their state is
read from behaviour, which is already public: hesitation, wasted tempo, a piece
that stops covering, and desertion, which is a piece walking off *their* board in
front of you. No new UI, no information leak.

### D67 ✅ Difficulty comes from opposing leadership, not engine depth (ADR 0025 §3)
Raising engine depth teaches nothing; facing a leader whose army actually
executes is hard in the way the game is about. Permanently retires the
stronger-engine pressure and confirms ADR 0020 from the other side.

### D66 ✅ The rival replaces you (ADR 0025 §4)
Dismissal hands the army to the commander who beat you, and the player watches
his own roster execute for the rival — sharper than the King taking over, with
ADR 0022's computation unchanged. The King remains the fallback successor. Note a
rival will usually *not* satisfy `D_rival < D_player_effective`, so the
tutorial-coda guard applies to the King only; a rival's edge must be shown to
come from fidelity in the debrief columns.

### D68 ✅ Deserters resurface in other rosters between careers (ADR 0025 §5)
D3 stands — nobody defects mid-match — but an identity driven off the board
becomes a free agent between careers, and the labour market may place it with a
commander who kept faith with his people. It does not forget. One foreign key,
and the most economical storytelling in the design.

### D60 ✅ Ability substitutes for benevolence; warmth is variance insurance (ADR 0024 §1)
Second-act Jobs was not warmer, he was *right* — visibly and repeatedly; Patton
was feared and revered at once. A **high-ability / low-benevolence equilibrium
must be viable**, or the game teaches "be nice and you win," which is false and
dull. The honest asymmetry: a cold leader retains compliance *while winning* and
has nothing to draw on during a losing run, so his collapse is immediate; a warm
leader survives bad runs. Two viable strategies with different failure profiles.
Substitution rate is the sharpest knob this creates.

### D61 ✅ Fatalistic compliance is its own verdict (ADR 0024 §2)
Fredericksburg: soldiers pinned their names to their coats and charged anyway.
Neither compliance nor quiet quitting — full effort, no faith, full knowledge.
Inserted into the ladder as `FATALISTIC_COMPLIANCE`; its cost lands on the
**witnesses** and on the piece's future willingness, never on the move, so a
leader can spend an army this way and see nothing wrong in the move log.

### D62 ✅ The King judges results himself (ADR 0024 §3)
McClellan's army adored him; Lincoln fired him anyway, twice. Under ADR 0021
alone mandate falls via rumor *from the roster*, so a beloved commander could
never be dismissed. The King keeps his own `τ_abil` formed from results, giving
two independent paths: **fired by the room** (relief, rout-adjacent) and **fired
by the boss** (protest, the army liked you).

### D63 ✅ Second appointments are diminished, not merely harder (ADR 0024 §4)
Jobs's second act was NeXT; Patton's was a decoy army. Act two is a *lesser*
command — fewer strong identities, a lesser king, less at stake — which is where
`τ_abil` can be rebuilt cheaply, and it makes the return to a real command
something earned twice. Content investment follows: thin act one, rich act two,
because act two is the only place the player can demonstrate he learned that
this is not chess.

### D57 ✅ Three kings, three acts — the career is the unit of play (ADR 0023 §1)
Owner: *"once none of them are willing to start a game with you, it is time to
kill the account."* A career holds up to three appointments; each dismissal burns
a king. Capture and desertion are not permadeath for a piece — dismissal **is**
permadeath for the player, so the roster outlives its commanders, which is what
the plural in the title has meant all along. Ship one act, put three in the
schema (`CareerId`, `ActId`/`KingId`): the content is what gets cut when a date
arrives, but the migration is not.

### D58 ✅ Bench ~32, made safe by reputation transfer (ADR 0023 §2)
A deep bench is a trust-**laundering** machine unless newcomers already know you.
On joining, a recruit is seeded with `τ_abil` from the leader's record and
`τ_benev` from the roster's current appraisal — both already carried by the rumor
channel (ADR 0016), so it costs no new machinery. With transfer, depth is a
comfort rather than an escape. It also gives the acts a difficulty curve for
free: **king two has heard about you.**

### D59 ✅ A career is won when the army exceeds the player's ceiling (ADR 0023 §3)
Winning matches shows the player is not failing; it is not what a career is for.
Using the two columns from ADR 0022 §5, the victory condition is the sustained
inverse of dismissal: realized position quality above `V_own(player)`, held
across matches. Leadership is when the organization outperforms the leader —
one number, computed from the existing event log.

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
1b. **King's patience and recall rate** (D54/D56 residue) — with the harness,
   alongside D26. (D51 and D54 are resolved by ADR 0021; D55 and D56 by
   ADR 0022.)
1c. **D50, D52** — before persistence and before any dialogue is authored.
2. **D35, D40, D42–D43** — with the harness, alongside credence tuning. D35 is
   partly answered in substance: an override is the canonical benevolence cliff
   (ADR 0019), so its price falls out of that channel's calibration rather than
   being an independent constant.
4. **D25–D27, D33 (price)** — during Milestones 3–5.
5. **D1, D14, D17** — as UI and content work begins.
