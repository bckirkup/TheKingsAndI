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
| D14 | Language and package/state stack | **TypeScript strict everywhere** — UI, core, and harness — with pnpm, Vite + React 18, Vitest, ESLint flat + Prettier, and Zustand for view state only. Transcendental math is banned in `psychology/` because JS engines disagree in the last bits; the Rust/WASM escape hatch is scoped to `psychology/` alone. | [0032](adr/0032-language-and-toolchain.md) |
| D48 | Sequencing async engine results | **A per-ply query barrier.** All queries for a round issued and collected in `PieceId` order, bundle frozen before psychology runs, psychology synchronous, PRNG drawn only after the barrier. Dependent queries become numbered rounds; failures abort the ply. | [0034](adr/0034-deterministic-query-barrier.md) |
| D95 | How fast may a piece revise its read of a commander? | **Proportional to evidence.** The ability-observation counter starts from a prior strength `n₀ > 0`, so the first observation no longer moves `τ_abil` by the whole scale. Not a floor, not a decay, not a damper — step size only. *ADR proposed; the value of `n₀` is a calibration ruling still owned by the user.* | [0039](adr/0039-credence-prior-strength-and-the-first-match.md) |
| D96 | What has a roster observed before a participant's first match? | **Optionally a cohort-uniform training record, and it buys patience only.** No mechanics-only game and no required first win; the record raises `n₀` and never `τ` for the participant. *ADR proposed; record size still owned by the user.* | [0039](adr/0039-credence-prior-strength-and-the-first-match.md) |
| D97 | What does a refusal offer the commander? | **A generated crisis menu whose options are gated by the state of the organisation, not two buttons.** | [0040](adr/0040-the-refusal-crisis-menu.md) |
| D98 | Where does inter-piece obligation live? | **In a fold over the event log, handed into psychology as plain data — never as new fields on `PieceState`.** | [0040](adr/0040-the-refusal-crisis-menu.md) |
| D99 | What may stand in for momentum? | **Only piece-visible facts** — material, recent losses, and refusals this match; never the audit stream, per ADR 0013. | [0040](adr/0040-the-refusal-crisis-menu.md) |
| D104 | When does a crisis in one student's match become the cohort's business? | **Deferred to Milestone 5b**, with teachable-moment scoring and facilitator override recorded by ADR 0041. | [0041](adr/0041-stopping-the-seminar.md) |
| D80 | Static analysis and coverage gate | **SonarQube Cloud** (`bckirkup_TheKingsAndI`), CI-based analysis with Vitest lcov coverage, gate on new code. Sonar advises; ESLint owns the project invariants. | [0033](adr/0033-static-analysis-and-quality-gate.md) |
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
risk term is 0..1, and `Φ` contributes at most `w_empathy` per peer. The
historical `Θ_refusal` spanned ±50, which put it outside the perceived
board-value range and made trust alone decide nearly every verdict. ADR 0015
now uses credence-weighted perception, and the reconciled threshold is in the
same board-value units.

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

### D48 ✅ resolved as a per-ply query barrier (ADR 0034)
With ADR 0017, every piece queries the pool each ply; results arrive
asynchronously; byte-identical replay requires a fixed resolution order. Without
an explicit ordering rule, replays diverge on faster hardware and the bug looks
like a psychology bug.

**Ruling (ADR 0034):** a barrier per ply per side. Queries are issued *and*
collected in `PieceId` order, the round's request set is a pure function of the
position, the bundle is frozen before psychology runs, and psychology stays
synchronous so no reducer can await. Three additions the original
recommendation did not cover, each a separate leak of arrival order: a genuinely
dependent query opens a numbered round *n+1* rather than a callback; a failure is
an ordered `InsightFailure` that aborts the ply, never a silently dropped piece;
and the seeded PRNG is consumed only after the barrier, in `PieceId` order.
Enforced by the shuffled-resolution-order replay test, a per-round `digest` in
the `MatchRecord`, and an ESLint ban on `Promise.race`/`Promise.any`/wall-clock
timeouts in `engine/` and `orchestration/`.

### D49 ✅ Is credence indexed by leader identity? (ADR 0035)
D5 makes psychology symmetric and campaigns persist rosters, so `τ_benev` and
`τ_abil` are trust *in someone* rather than scalars on a piece. If credence is
not keyed by leader from the first schema, the project can never have a second
commander, an AI-led opposing army with its own relational history, or a piece
that trusted a predecessor.

**Recommended:** key it — `credence: Record<LeaderId, {benev, abil}>`. Nearly
free now; a migration and a psychology rewrite later. Interacts with D27
(cross-campaign roster memory).

**Resolution (ADR 0035):** **Resolved yes.** Credence is a per-commander
relationship account, `Record<LeaderId, {benev, abil}>`, initialized from a
stable identity-seeded disposition prior. `B_i` remains global damage rather
than part of a relationship account. The disposition is not player-facing as a
number; facilitator exposure remains a separate open question.

### D50 ✅ Does the true evaluation get persisted in the event log? (ADR 0036)
The audit needs it (ADR 0018) and the trust-farming detector needs it
(ADR 0019), but persisting truth beside belief inflates the payload and places
the forbidden number inside the save file, where a future loader may read it into
psychology by accident.

**Recommended:** persist it in a **separate audit stream** that the psychology
loader has no code path to read. This makes ADR 0013's epistemic boundary
enforceable at rest rather than only at runtime, and it lets the audit stream be
dropped from a shipping save without breaking play.

**Resolution (ADR 0036):** **Resolved yes, outside the event log.** True
evaluations are persisted in a separate, droppable audit stream with no code
path from the psychology loader. Every audit score carries provenance,
including `determinismId` and depth for true engine values or an explicit
authored/placeholder marker for non-measured values.

### D95–D96 ✅ How fast a read forms, and what precedes it (ADR 0039, proposed)
Surfaced from the Milestone 3 calibration failure and the owner's question of
whether pieces read a weak opening "how fast", and whether a seminar needs a
mechanics-only game or a required first win. The prior-weighted observation
step no longer lets the first observation move credence by the entire scale.
ADR 0043 supersedes its symmetric shape with asymmetric, state-dependent
accretion and a one-point floor.

**Ruling (ADR 0039):** the counter starts from a **prior strength** `n₀ > 0`
carried on the relationship account (ADR 0035), so a read forms in proportion to
the evidence that displaces it — inside a match, but not inside an order. `n₀`
changes step size only: no floor, no decay toward baseline (ADR 0007), no
damping of a cascade (ADR 0011). A mechanics-only first game is **not** required,
and a scripted first win is **rejected** — it forces an AI first opponent
(against ADR 0025), makes credence a function of a scripted outcome (against
ADR 0022's stance for succession), and personalizes every roster so no cohort is
comparable. Instead a world may ship a **cohort-uniform training record**
attributed to a training commander, entering the log as ordinary observations
with `TRAINING` provenance, which raises `n₀` and never `τ` for the participant:
a trained roster is slower to condemn, not more obedient. The value of `n₀` and
the size of the record are calibration rulings the owner still holds.

### D97 ✅ What does a refusal offer the commander? (ADR 0040, proposed)
A refusal opens a generated crisis menu whose options are gated by the state of
the organisation, rather than reducing the commander to two buttons.

### D98 ✅ Where does inter-piece obligation live? (ADR 0040, proposed)
Obligation is a fold over the event log, handed into psychology as plain data;
it never becomes a new field on `PieceState`.

### D99 ✅ What may stand in for momentum? (ADR 0040, proposed)
Only piece-visible facts — material, recent losses, and refusals this match —
may stand in for momentum. The audit stream remains outside psychology under
ADR 0013.

### D104 ✅ When does a crisis in one student's match become the cohort's business? (ADR 0041, proposed; deferred to Milestone 5b)
The crisis becomes cohort business through a teachable-moment score with
facilitator override, but the seminar broadcast remains deferred to Milestone 5b.

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

### D91 ✅ The commendation set (ADR 0031 §2)
A seminar must celebrate as well as diagnose, without asserting anything about the
person. Eight, each a fold over the event log: **evenness of attention** (Gini
over consultation and use — who was never asked, never defended, never fielded);
**the best of the best** (top-quartile pieces against their own ceiling, since
stars underperform under bad leadership and a win/loss record hides it); **nobody
drowned** (bottom quartile, no retirements, the lowest-credence piece never at the
floor); **overcoming a weakness**; **grit and endurance** (sound policy sustained
*through* a losing streak — where ADR 0024 says cold leaders come apart); **overall
improvement** (the learning delta); **the honest sacrifice** (a piece spent for a
real win whose trust survived it); **the repaired breach**. Facilitators should
steer hardest toward *nobody drowned* — least intuitive, most transferable.

### D92 ✅ Commendations must be non-dominating (ADR 0031 §1)
No player may hold all of them, because the good ones trade off: getting the most
from your strongest pieces competes for attention and tempo with keeping the
weakest afloat. If one player can sweep, the awards have collapsed into a single
score. This is a **tested property** — each oracle policy should win a different
subset.

### D93 ✅ Criteria are computed at debrief, never shown during play (ADR 0031 §3)
The moment a student can watch an evenness meter, evenness stops being leadership
and becomes the game. Facilitators may see commendation state live, since steering
is their job; students see it after. Hard rule, not a default.

### D94 ✅ The facilitator's parallel set (ADR 0031 §4)
Even distribution of hard seeds; growth of the *weakest* student rather than the
average; pairing quality — whether matchups produced learning or humiliation; and
even expenditure of the cohort's people.

### D86 ✅ The transcript is the artifact; the certificate is its cover page (ADR 0030)
"Played the Game" proves attendance. The system records every order, refusal,
override, concession, and casualty — and can re-run all of it — so the deliverable
is a **report card**: proof of performance and evidence of learning.

### D87 ✅ The behavioural metric set (ADR 0030 §2)
All folds over the event log, never separate counters: **board quality vs
execution fidelity** (the gap is the finding); **channel trajectories** — `τ_abil`
vs `τ_benev`, separating *"they thought I was wrong"* from *"they thought I didn't
care"*; the **override ledger**; **concession quality**, since withdrawing a good
move is a concession and withdrawing a bad one is theatre (the trust-farming
detector doubles as a listening metric); **distribution of harm**, a Gini
coefficient over trauma — concentrated or spread; and attrition.

### D88 ✅ Counterfactual benchmarking and peer norming (ADR 0030 §3)
Only determinism affords these. **Counterfactual:** re-run the player's own
positions under oracle policies and report what was achievable on the boards he
faced — not *"you lost six"* but *"the pure tactician also lost six; the rebuilder
lost three."* **Peer norming:** deal a cohort identical seeds, so comparisons are
on the same positions with the same rosters.

### D89 ✅ The learning delta is the headline enterprise metric (ADR 0030 §4)
Act one diagnoses; act two — diminished command, reputation attached — is where a
*change in policy* can be measured: override rate, concession quality, whether the
second roster's benevolence channel recovers. This is why the thirteen-week format
is the behaviour-change product and the three-full-day/two-half-day format a
diagnostic.

### D90 ✅ Behaviour in simulation, never traits (ADR 0030 §5)
Defensible: *"Overrode 34% of refusals; 71% of those came after a loss."* Not
earned: *"Low empathy."* Trait inference, psychometric scoring, and predictive
claims about job performance are out of scope until a validation study exists, and
no shipped copy may imply them.

### D84 ✅ A world lives exactly as long as its curriculum (ADR 0029 §1)
Owner: *"the pieces should not outlast the seminar/curriculum."* A cohort, LAN, or
single-player world is created for a course and ends with it. This is a
simplification: no global registry, no promotion gate (**D83 superseded**), no
permanent-commons moderation, no long-lived PII. And retirement gets *sharper* —
in an unbounded world, exhausting a piece is a rounding error; in a thirteen-week
world a piece burned in week three is gone for the remaining ten, so the cohort
lives with the scarcity it created. The tragedy of the commons plays at the scale
it actually occurs at: an organisation, not a universe.

The four layers — `piece → King → player → facilitator` — each hold credence in
the one above and are measured by the one below, which is why the facilitator
audit needed no new machinery.

### D85 ✅ Only claims about the player leave the world (ADR 0029 §3)
Nothing about a piece is portable. **Achievements** say what you did, are backed
by play, and are gameable by design — that is their job. A **Certificate of
Completion** says what the log shows about how you led, is generated from the
audit, and must be **evidence-backed, never participation-backed**: the moment it
can be earned by attendance it is worth nothing to an enterprise buyer. Because a
match is a seed plus an event log, a certificate ships with the material to
**verify** it by replay rather than to believe it.

### D83 ⛔ Superseded by D84 — gated passport promotion
There is nowhere to promote to once a world ends with its curriculum
(ADR 0029 §1).

### D80 ✅ Steam is trust, delivery, and identity — not a world host (ADR 0028 §1)
It cannot host the world; it can host the binary and the identity. **SteamID**
gives identity with no accounts and no PII we must hold, **Steam Cloud** stores
tier-1 passports for free, and the install confidence is real: people run an
unknown executable from Steam that they would never run from a website. The
consumer tier thus gets most of a registry's value at near-zero infrastructure
cost. Nothing mechanical may require it — the DRM-free and facilitator builds
stay feature-complete.

### D81 ✅ One local host serves seminar, LAN party, and friend group (ADR 0028 §2)
A facilitator-hosted cohort service and a friend hosting a weekend world are the
same binary with a different label: closed membership, local host, no moderation,
AI commanders filling the market. Building it once ends the divergence between
the enterprise and consumer tracks.

### D82 ✅ The facilitator is a leader, and the instrument measures him (ADR 0028 §3)
Third-party seminars are welcome, but a thoughtless one delivers little — and the
system can say so, because everything is deterministic and logged. A cohort run
records how the facilitator paired students, when he intervened and when he let a
spiral run, whom he benched, and whether burnout in the shared pool was
distributed or concentrated. **He receives the same audit a student does.** The
trust/defect/recruit layer above the game is modelled exactly as it is inside it.

### D83 ✅ Worlds are instanced and sovereign; promotion is gated (ADR 0028 §4)
Trauma accumulates across every commander a piece has served, so a careless host
could damage the commons. Each cohort or LAN world is its own world by default,
and promotion of piece passports into a wider world is gated on evidence from the
facilitator audit. A bad seminar then harms only its own cohort, and a roster
that earns its way out is a real credential. AGPL means third parties may fork
and self-host; what does not travel is the shared world's acceptance of their
passports — the commons is protected by the gate, not the licence.

### D75 ✅ The cohort is the first community — registry ships for enterprise first (ADR 0027 §1)
Twelve to twenty-four people, one room, one facilitator install: enrollment is
identity, a facilitator is moderation, consent is privacy, AI commanders are the
cold start, and a scheduled course is discovery. Every reason ADR 0026's tier-2
registry looked expensive for consumer disappears in a seminar, so **tier 2 ships
for the seminar and consumer stays on tier-1 passports** — the reverse of ADR
0026's provisional recommendation, and lower risk. Students play each other,
pieces circulate, and the trauma pool is shared: *the pieces you burned Monday
are the ones your colleague inherits Wednesday.*

### D76 ✅ Two seminar formats, teaching different halves (ADR 0027 §2)
**Intensive** (3 full days × 4 + 2 half days × 2 of play, 16 matches) is
roughly one act — learn it is not chess, be dismissed, be debriefed — and sells
as a **diagnostic**; it cannot teach recovery, which needs a second appointment
with a reputation attached. **Nibelungen** (13 weeks × 3–4, ~52) is the full
three-king career and is the behaviour-change product. Pacing: **four matches a
day plus a structured midday debrief beats six** — the spiral needs between-match
thinking. The first campaign's collapse target is 8–12 matches (D26), distinct
from the 16-match intensive format length.

### D77 ✅ Facilitator ratio is bounded by debrief, not supervision (ADR 0027 §3)
Play is deterministic and audited, so nobody needs watching: ~12 students with
individual debriefs, ~24 in plenary with a cohort dashboard whose material is the
cross-student piece flow.

### D78 ✅ What Steam is for — and the refund window (ADR 0027 §4)
Discovery, payments, and a self-funding stream of calibration data from players
who do not want a lesson and will break the model in ways executives never will.
It does nothing for the seminar track. The hazard to design for now: **Steam's
two-hour refund window versus a first act designed to be lost.** If the hook
lands at match eight, buyers refund at match three having concluded the chess AI
is stupid — so the consumer build needs a compelling first ninety minutes that
the seminar build does not. A pacing decision, not a different game.

### D79 ✅ Build order: harness → debrief artifact → playable (ADR 0027 §5)
"Offline-first" was really the question of what gets built and tested first. The
central risk is whether the psychology is interesting and non-degenerate, which
simulation answers without a UI; then the **debrief artifact**, because an audit
from AI-versus-AI matches is a sellable deliverable with no game attached — the
earliest point at which anyone outside the team can validate the project.

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

### D72 ✅ Resolved by D75: tier 2 for the seminar, tier 1 for consumer (ADR 0027 §1)
Offline-first with no accounts and no backend cannot host a shared registry. The
ladder: **(1) passports** — signed piece exports carried between players by hand,
offline intact; **(2) registry** — a thin service owning identity, the free-agent
market, and retirement, with matches still local; **(3) authoritative world** —
not recommended. Moderation and privacy, not engineering, are the real cost of
tier 2 — and a cohort pays neither, so **tier 2 ships first for the seminar while
consumer stays on tier-1 passports** (D75). ADR 0026's provisional
"tier 1 everywhere" recommendation is superseded.

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

### D100 ⚠ What are the crisis-menu gate thresholds and transaction magnitudes?
Every crisis option needs a threshold and a transaction magnitude. These belong
to the harness, not to prose or intuition.

### D101 ⚠ What is the restoration curve for a nomination?
Calibrate how much calm a sacrifice buys and how quickly that restoration decays
to nothing.

### D102 ⚠ Is the menu offered on an unjustified refusal?
Decide whether every refusal opens a crisis or only a refusal justified in the
piece's own view.

### D103 ⚠ Does a nomination mark decay across matches?
Decide whether a nomination mark is permanent or decays across matches. This
interacts directly with ADR 0026's community-of-pieces model.

### D105 ⚠ How should desertion detector thresholds be re-ranged for attrition?
The existing desertion thresholds (`0.2`, `0.5`, and early-saturation `0.8`) and
refusal thresholds (`0.001` and `0.05`) were calibrated against the old
match-incidence and refusals-per-ply quantities. Re-range them against campaign
desertion attrition and bounded refusal rate before using the detectors as
balance acceptance gates.

### D106 ⚠ Should terminal desertion advance the headless ply?
The interactive path increments `ply` for terminal desertion before handling
rout, while the headless path does not. Reconcile the accounting without changing
the meaning of `plies` or the replay contract.

### D107 ✅ Should ability accretion be allowed to freeze permanently?
**Decided by ADR 0043:** no. Ability observations always have a minimum
one-point step; the prior observation count remains persistent, but truncation
must not permanently prevent revision.

### D112 ⚠ What multiplier should falsified ability observations use?
ADR 0043 makes losses larger than gains through a configurable multiplier.
The initial calibration value is `ABIL_VINDICATION_LOSS_MULTIPLIER = 2`;
the owner must calibrate the magnitude.

### D113 ⚠ How strongly should ability revision curve with current credence?
ADR 0043 makes gains harder and losses larger as `tauAbil` rises through an
integer-rational curvature term. The initial calibration value is
`ABIL_VINDICATION_CURVATURE = 2`; the owner must calibrate the shape.

### D114 ⚠ How strongly should vindication expectations depend on trust and trauma?
The expectation baseline discounts expected capture harm more heavily when a
piece has low benevolence credence or high trauma. The initial calibration value
is `VINDICATION_PESSIMISM_SCALE = 100`; the owner must calibrate this restoring
force.

### D108 ⚠ What is the per-ply vindication authority gain?
Every executed order may pay direct ability credence credit to each vindicated
witness on ADR 0038's obviousness scale; this supersedes override-only credit.
The mechanism ships behind `ABIL_VINDICATION_GAIN_SCALE`, initially tied to
`REFUSAL_AUTHORITY_LOSS_SCALE` (20), while the owner calibrates its magnitude.

### D109 ⚠ What is the match-end vindication authority gain?
Contested, vindicated overrides may credit the roster after a winning match,
scaled by result and contest count. `ABIL_OUTCOME_VINDICATION_SCALE` defaults
to zero until the harness calibrates the magnitude.

### D110 ⚠ Are per-ply and match-end vindication channels redundant?
Measure whether immediate witness credit and match-end roster credit provide
distinct evidence or merely duplicate the same authority signal before deciding
whether both channels should remain.

### D111 ⚠ Which baseline should vindication use?
Vindication may compare the played audit outcome against the piece's own
pessimistic expectation or against the engine-best oracle. The shipped default
is `VINDICATION_BASELINE = 'expectation'`, while `'oracle'` remains available
as the long-term variant. The expectation is
`deltaV_board - ((1 - w_courage) * P_captured * pessimismPercent / 100)`,
where pessimism rises with low `tauBenev` and trauma; the result is reconciled
to mover-side absolute cp by adding it to the pre-move audit score.

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

**D43 schema resolution (ADR 0037):** The private per-piece evaluation profile
schema is settled as bounded distortion of the shared score with geometric
attention pruning. D43 itself remains **open**: whether egocentric weights drift
with `B_i` is a calibration choice owned by the user. If drift is implemented,
it ships behind a configuration flag with both branches tested.

### D25–D29 ⚠ Trust-loop follow-ons
Which costly signals ship (D25), how long the trap runs before collapse (D26),
cross-campaign roster memory (D27), disclosure vs. discovery (D28), and the
post-collapse epilogue (D29). See `docs/trust_dynamics.md` §7.

### D115 ⚠ Ability drip magnitude (ADR 0044)
The magnitude of the frequent safe-play ability drip remains open. The
implementation exposes `ABIL_DRIP_SCALE` and does not increment the Bayesian
observation count, so calibration can distinguish frequent reassurance from
rare adjudication evidence.

### D116 ⚠ Near-refusal margin (ADR 0044)
The utility margin that classifies a piece as nearly refusing remains open.
`ABIL_VINDICATION_NEAR_REFUSAL_MARGIN` is the deterministic calibration knob;
adjudication is restricted to overridden refusals and witnesses within that
margin.

### D117 ⚠ Drip satiation curvature (ADR 0044)
How strongly should safe-play ability drip diminish as `tauAbil` rises? The
implementation exposes `ABIL_DRIP_CURVATURE`, initially `2`, and applies the
same integer-rational current-level curvature discipline as ADR 0043 while
leaving `abilityObservationCount` unchanged. The magnitude remains open for
owner calibration.

### D1 ⚠ Which audience ships first?
Partially answered by D13: validate the psychology in the lightest distribution,
then Steam. That implies the tactical/debug skin during development and an indie
release publicly, with the exec-lab track derived later from the same event logs.
Confirm when the UI scope is set.

### D14 ✅ Package/state stack — resolved by ADR 0032
The recommended defaults were taken (pnpm, Zustand kept thin, Vitest) and the
language choice they presupposed is now stated and argued rather than assumed.
Still genuinely open, and deferred to Milestone 5 when there is something to
plot: **the chart library for debriefs**.

### D17 🕐 Content policy for narrative prose
Pieces expressing fear, resentment, and betrayal can produce output a corporate
facilitator would not want on screen. Needs tone guardrails and a safe mode
before any exec-lab use. Not yet considered by the owner.

---

### D118 ⚠ Desertion board-loss scale (ADR 0045)
The centipawn scale `DESERTION_BOARD_LOSS_SCALE_CP` controls how quickly a
piece's private score saturates the rational board-loss map. Its owner
calibration remains open.

### D119 ⚠ Desertion board/rumor blend (ADR 0045)
`DESERTION_BOARD_LOSS_WEIGHT_PERMILLE` controls the balance between private
board belief and social rumor. Its owner calibration remains open.

### D120 ⚠ Desertion pivotality scale (ADR 0045)
`DESERTION_PIVOTALITY_SCALE_PERMILLE` controls how strongly a piece's
non-King material share changes `P_lossIfLeave`. Its owner calibration remains
open.

### D121 ⚠ Desertion shadow strength (ADR 0045)
`DESERTION_SHADOW_SCALE_PERMILLE` controls the symmetric attenuation of
private pain and standing cost as defeat becomes impending. Its owner
calibration remains open. The default `1_000` is deliberate but provisional
and unswept: it gives `shadowFactor = 1 - P_lossIfStay`, so the campaigns'
observed mean loss near `0.6` attenuates roughly 60% of both terms.

### D122 ⚠ Desertion attachment floor (ADR 0045)
`DESERTION_RESIDUAL_STAKE` is now the strictly positive floor for the
endogenous residual attachment. Alienation is measured from neutral:
`T_i = 0` and `tauBenev = 50` contribute zero, while below-neutral distrust,
benevolence credence, trauma, and negative dyadic affinity erode attachment;
loyalty resists that erosion. The previous accumulation-from-zero and
distance-from-perfection formulations were rejected because absent bonds and
neutral traits are not alienation. Its floor and resulting calibration remain
open.

### D123 ⚠ The enemy roster does not persist across a campaign
`sim/match.ts` never passes `initialEnemyRoster`, and `sim/campaign.ts` carries
only the player roster, so the opposing commander meets every match with a fresh
army holding no memory of him. Enemy psychology still evolves *within* a match.
Two consequences for reading the enemy-side metrics:

- `enemyDesertionAttrition` is a union over piece IDs that are reused every
  match (`b:K:e8` and friends), so it is a repeated per-match measure, **not**
  the career attrition the player-side quantity of the same shape reports. The
  two are not directly comparable and a differential between them is not a
  like-for-like comparison; `meanEnemyDesertions` per match is the honest
  enemy-side quantity.
- Any leadership advantage measured against this opponent is inflated by the
  fact that our roster accumulates trust across a career and his cannot. ADR
  0025 asks for a real opposing commander with a real roster, and ADR 0026 makes
  pieces community entities; persisting the enemy roster is the open work that
  would make the differential mean what it appears to mean.

### D124 ⚠ Symmetric enemy identity tracking
The default `ENEMY_TRACKED_IDENTITIES = 8` remains available for engine-cost
controlled runs, but world and campaign comparisons request all 16 enemy
identities. The old top-8-by-`E_i` selection is not neutral because it
systematically excludes pawns. The tracking cap and its cost/coverage tradeoff
remain open for calibration under ADR 0047.

### D125 ⚠ World pairing duration and schedule calibration
ADR 0047 settles deterministic style-vs-style pairing and persistent
commander rosters, but the number of matches per pairing, whether both
directions are required, and how matrix cells are summarized remain open
calibration questions. The first implementation uses a seeded schedule and
reuses the existing match metrics and horizon machinery.

### D126 ⚠ Opposing commander style selection
The opposing commander is selected explicitly from the five
`OpponentArchetype` styles and the selected style drives both tactical policy
and enemy psychology. Harness-only leader styles without a counterpart
(`pure_tactician`, `redeemer`, `cold_winner`, and `rebuilder`) fail loudly
instead of silently becoming `random`. The balance of style matchups remains
an open calibration question.

### D127 ⚠ Initial-trust/style confound
`leaderTrustBias` initializes servant and supportive rosters at `40`,
tyrannical rosters at `-10`, volatile rosters at `10`, and random rosters at
`20`. These preexisting values are part of roster initialization, not a change
made by ADR 0047. They confound style comparisons and especially the
style-vs-style round-robin matrix: a roster may enter a pairing already
expecting a different kind of leader. Separating “the leader a roster
expects” from “the leader it gets” is open calibration work; this slice leaves
the values untouched.

### D128 ⚠ Season scarcity ratio
The season pool depth factor controls whether preserving identities can be
rationally traded against winning the current match. Its default is provisional
and requires a match-budget-relative calibration; this slice exposes the knob
without treating the default as settled.

### D129 ⚠ Desertion absence term
A deserter is unavailable for a configurable number of subsequent matches and
then returns without psychological decay. The term length is open calibration
work; the season default is only a deterministic starting point.

### D130 ⚠ Permanent retirement threshold
Trauma at or above a configurable threshold permanently retires a non-King
identity within a season. The threshold is intentionally open because lowering
it changes the recovery-versus-burn tradeoff.

### D131 ⚠ Fielding policy by leadership style
The season has explicit strongest-available, rest-traumatised, and veteran-first
policies. Which command style should own which policy is open calibration work;
the initial mapping is a testable implementation choice, not a settled
leadership claim.

## Suggested decision order

1. **D52** — before persistence and before any dialogue is authored. D49 is
   resolved by ADR 0035, D50 by ADR 0036, and D48 by ADR 0034: it was the one
   whose absence would have presented as a mysterious psychology bug, and it had
   to land before `engine/`.
1b. **King's patience and recall rate** (D54/D56 residue) — with the harness,
   alongside D26. (D51 and D54 are resolved by ADR 0021; D55 and D56 by
   ADR 0022.)
2. **D35, D40, D42–D43** — with the harness, alongside credence tuning. D35 is
   partly answered in substance: an override is the canonical benevolence cliff
   (ADR 0019), so its price falls out of that channel's calibration rather than
   being an independent constant. D43's profile schema is settled by ADR 0037;
   its trauma-drift branch remains open.
3. **D100–D116** — with the harness before the crisis-menu transactions ship:
   thresholds, magnitudes, nomination restoration and mark persistence, the
   scope of the menu on unjustified refusals, and desertion-detector re-ranging.
4. **D25–D27, D33 (price)** — during Milestones 3–5.
5. **D1, D17** — as UI and content work begins. (D14 is resolved by ADR 0032;
   only its chart-library residue is left, and it waits for Milestone 5.)
