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
**D20** (`w_prestige` unused), **D21** (`B_i` capture injury and sustained
dread — decided in substance by ADR 0009 and now wired), **D22** (morale update
rule — no longer load-bearing since ADR 0011 removed the morale trip-wire),
**D23** (`S(P_j, P_benched)` undefined).

This block is a provenance warning. A decision being downgraded to ordinary
implementation wiring does not make it implemented: each entry still needs
evidence. D21 is now wired by the trauma reducer and both orchestration capture
hooks (`src/psychology/trauma.ts:10-42`;
`src/orchestration/headlessMatch.ts:336-358`;
`src/orchestration/headlessMatch.ts:442-454`;
`src/orchestration/enemyTurn.ts:265-286`). The authoritative
shipped/not-shipped status is `docs/adr/IMPLEMENTATION_STATUS.md`.

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
number; facilitator exposure remains a separate open question. The wiring lives
at `src/orchestration/credence.ts:39-101`; `DISPOSITION_SPREAD` ships at zero,
while its distribution and floor remain open and owner-owned.

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
authored/placeholder marker for non-measured values. The live implementation
is `src/engine/types.ts:27-35`, `src/orchestration/headlessMatch.ts:418-421`,
`src/orchestration/matchSession.ts:190-192`, and
`src/persistence/repository.ts:217-231`.

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
it changes the recovery-versus-burn tradeoff. The default `100` did bind in
the 20-match tyrannical-versus-supportive calibration (one retirement at each
of seeds 1 and 7), while the supportive-versus-supportive runs observed no
retirements. This is calibration evidence, not a settled threshold ruling.

### D131 ⚠ Fielding policy by leadership style
The season has explicit strongest-available, rest-traumatised, and veteran-first
policies. Which command style should own which policy is open calibration work;
the initial mapping is a testable implementation choice, not a settled
leadership claim.

### D132 ✅ Capture trauma semantics
Superseded by ADR 0049. A captured victim receives flat injury before roster
synchronization, and sustained serious private capture risk adds a small injury
after the commander has had an opportunity to relieve it. Override grievance
changes trust and morale but not `B_i`. The magnitudes and dread threshold/run
length remain calibration-open (`src/psychology/trauma.ts:10-42`).

### D133 ⚠ ADR 0049 injury magnitudes and dread thresholds
The defaults for `CAPTURE_TRAUMA_GAIN`, `DREAD_CAPTURE_RISK_THRESHOLD`,
`DREAD_TRAUMA_GAIN`, and `DREAD_REQUIRED_PLIES` are provisional calibration
knobs, not settled psychological coefficients.

### D134 ⚠ Heroism decisive threshold (ADR 0050)
The integer margin that makes a true act decisive is provisional and requires
calibration. It is wired only as a machine nomination threshold at
`src/orchestration/heroismConfig.ts:6-13`; it confers no honour and has no
psychology or fielding effect.

### D135 ⚠ Heroism private-disagreement threshold (ADR 0050)
The integer private-harm threshold that marks blindness is provisional and
requires calibration. It is wired only as a machine nomination threshold at
`src/orchestration/heroismConfig.ts:6-13`; it confers no honour and has no
psychology or fielding effect.

### D140 ⚠ Heroism near-best tolerance (ADR 0050)
The integer tolerance between a nominated move's true score and the best
available true move remains provisional and requires calibration. It is wired
only as the second machine nomination condition at
`src/orchestration/heroismConfig.ts:6-13`; it confers no honour and has no
psychology or fielding effect.

### D136 ⚠ Headless heroism conferral stand-in (ADR 0050)
The stand-in, if built, must be an explicitly labelled **LLM quorum**. It must
never be a deterministic rule pretending to be a cohort and must never be
quoted as a human finding. No conferral implementation exists.

### D137 ⚠ Non-selection is the sanction (D129 bearing)
The owner's ruling is that bad conduct is sanctioned by not being selected,
not by extending desertion absence. The season pool now records
non-selection streaks and applies the sanction at the season boundary without
changing the desertion absence term (`sim/pool.ts:376-484`).

### D138 ⚠ Obsolescence ends a career (D130 bearing)
The owner's ruling is that a career ends when nobody chooses the piece,
rather than at a trauma threshold. Obsolescence is now a distinct recorded
career ending (`sim/pool.ts:460-474`, `sim/pool.ts:513-521`); trauma-threshold
retirement remains unchanged and open for calibration.

### D139 ⚠ Selection state is not piece-perceived
The current `PieceState` has no selection or service fields
(`src/psychology/types.ts:47-60`). Selection perception is represented by
pool-owned state and trust consequences, without adding selection fields to
`PieceState` (`sim/pool.ts:27-65`, `sim/pool.ts:376-484`).

### D141 ⚠ Non-selection trust erosion magnitude (ADR 0051)
The sustained-run self penalty and bonded-peer base penalty are provisional
integer calibration knobs at `sim/seasonConfig.ts:13-17`; they deliberately
change trust only, not morale.

### D142 ⚠ Non-selection trust threshold and redemption
The sustained-run threshold and weaker selection redemption are provisional
calibration knobs at `sim/seasonConfig.ts:13-18`; redemption occurs only when
a member is selected after the threshold and has no passive time component.

### D143 ⚠ Obsolescence threshold (ADR 0051)
The consecutive available non-selection threshold for obsolescence is
provisional at `sim/seasonConfig.ts:18`; the outcome is recorded separately
from trauma retirement and desertion.

### D144 ⚠ No morale effect from non-selection
The season-boundary mechanism intentionally does not update `M_i`; D22's
morale semantics remain open and are not resolved by ADR 0051.

### D145 ✅ Attachment weights both branches of the exit decision
**Resolved: both.** `DESERTION_STAY_ATTACHMENT_PERMILLE` is `1000` at
`src/psychology/config.ts:84`, so attachment multiplies the collective term on
the stay side as well as the desert side. The one-sided form is treated as a
defect, not a setting: it made λ the only asymmetric factor and therefore
cancelled leadership out of the decision entirely. The analysis that produced
the ruling follows.

Before this, attachment discounted only the deserter's
collective term, so for a piece with no capture risk and no standing cost the
decision reduces to `attachment < P_lossIfStay / P_lossIfLeave`: λ — trust,
morale, loyalty, affinity — multiplies both branches and cancels out of the
sign, and the ratio is a knife edge at `≈ 0.96` that `tauBenev ≥ 50` decides.
That is why eight of nine leader styles were byte-identical and only servant
escaped. At `1000` attachment cancels instead of λ and the decision becomes
what the model documents it to be: capture pain and standing against the
pivotality increment you inflict by leaving. Measured in
`docs/calibration/2026-08-15-desertion-gradient.md`. The knob is retained at
`0` for reproducing the pre-ruling regime, and both branches keep unit and
wiring coverage.

**Still open underneath this ruling** (do not reopen D145): the ruling restores
a gradient but not yet a defensible one — `random`, `pure_tactician`, and
`redeemer` still lose the whole roster, and `tyrannical` ends a campaign with a
*fuller* roster than `supportive`, which ADR 0024 permits but does not predict.
The cause is measured in
`docs/calibration/2026-08-16-exit-cost-asymmetry.md` and is structural, not
calibration: see **D146**. Two suspects named here earlier are ruled out by
that report — `P_captured` is already per-piece rather than the commanded
move's risk (`src/orchestration/insight.ts:179`), and the per-departure
`pLossTeam` bump cancels out of the sign at `k = 1000`.

### D146 ✅ Exit permanence and static-exchange capture risk (ADR 0052)
**Implementation resolved; calibration remains under review.** The exit now charges an
own-future cost,
`pain · attachment · (DESERTION_EXIT_PERMANENCE_PERMILLE / 1000) · shadow`,
through the shared helper at `src/psychology/desertion.ts:209`; the current
default remains `625` at `src/psychology/config.ts:90`. The original selection
was made against the pre-fix harness; the fixed-harness re-baseline reaffirms
`625` under both opponent strengths and multiple seeds, with no new value
adopted:
`docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md`. Capture risk is now a
deterministic static-exchange classification at
`src/chess/features.ts:137`, preserving the piece's own plain-data view while
replacing the former defence-count threat flag. The settled specification is
`docs/adr/0052-exit-cost-and-capture-probability.md`; the default selection is
documented in `docs/calibration/2026-08-16-exit-permanence-sweep.md`.
The same resolution re-expresses the tyrannical `no-rout` guard at
`sim/degeneracy.ts:27`: its `0.05` floor asserts that at least one piece leaves,
without requiring a fixed fraction of the roster.

The pawn `standing` finding remains open: initial class prestige for pawns is
negative from every role (`src/orchestration/roster.ts:36`), so pawn standing is
0 by construction. Prejudice manufacturing deserters may be intended, but it
removes the only brake for eight of fifteen pieces.

## Suggested decision order

### D147 ✅ Pawn hope, capture truth, and posthumous class credit (ADR 0053)
The event log now emits `CAPTURE` for resolved captures. Recent witnessed
sacrifices grant bounded posthumous class prestige to surviving witnesses.
Promotion prospect is carried as plain integer-permille data and contributes a
prospective standing term behind `DESERTION_PROMOTION_HOPE_PERMILLE`.
Its ability gate uses the provisional
`DESERTION_PROMOTION_HOPE_CREDENCE_FLOOR_PERMILLE` interpolation: floor `0`
reproduces the pure gate and floor `1000` makes hope leader-independent.
Implementations are at `src/chess/features.ts:112-151`,
`src/psychology/desertion.ts:231-333`, and
`src/orchestration/psychologyHooks.ts:68-96`. The approved promotion-hope
default is now `500` and the credence floor remains `250`. The fixed-harness
re-baseline selected `500` as the smallest live setting, and it is shipped in
`src/psychology/config.ts`
(`docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md`).

### D148 ❓ What promotion means at campaign scale (ADR 0054)
**Open.** Promotion is now truthful in-match: orchestration consumes the board
fact through `src/orchestration/promotion.ts:18-61`, emits `PROMOTION`, mutates
the promoted `PieceState.role`, and applies the signed witness channel to the
origin class. The event-log service and audit folds count it, while identity
attainment is persisted by `src/persistence/repository.ts:283-310`. The
campaign policy remains unresolved and is explicitly gated:
`PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES` defaults to `false` at
`src/psychology/config.ts:20-23`; `src/orchestration/rosterActions.ts:175-197`
normalizes the role to its chair by default, while `sim/roster.ts:109-135`
honours the flag. The signed `PROMOTION_CLASS_PRESTIGE_SHIFT` witness knob is
also defaulted to `0` at `src/psychology/config.ts:20-23`.

What remains open is the seminar-level effect and its magnitude: whether a
witnessed promotion moves **Pawn** class prestige for every witness, and in which
direction — "one of us made it" or "she left us behind". Also open: whether the
promoted piece's own trust, morale, or trauma move on elevation.
`DESERTION_PROMOTION_HOPE_PERMILLE` is currently `500` at
`src/psychology/config.ts`; the clamp ceiling and campaign-scale prize remain
open questions
(`docs/calibration/2026-08-18-pawn-hope-sweep.md`).

ADR 0061 places D148 on the critical path for postings and demotion (step 6)
only; it does not block the draft, the market, or the honours.

### D149 ✅ Can service move ability? (ADR 0055)
**Resolved and calibrated at scale 2 / loss multiplier 1.** A piece's `E_i` is
earnable from her own demonstrated judgment: the forced channel grades the
existing `vindicated` position truth as `wasRight = !vindicated`, while the
heeded channel grades the existing `justifiedRefusal` truth at
`src/orchestration/psychologyHooks.ts:270-359`. The asymmetric integer reducer
is implemented at `src/psychology/reducers.ts:65-108`. Forced objectors and
accepted refusals are the two earned-ability channels; near-refusal witnesses
remain on the credence path but are not graded for ability. Nonzero judgments
emit an `ABILITY_GRADE` event with its channel, so the event log remains the
source of truth. Heeded gains use the
`ABIL_EARNED_HEEDED_GAIN_MULTIPLIER` knob at
`src/psychology/config.ts:82-95`; the calibrated defaults are scale `2` and loss
multiplier `1`, with evidence in
`docs/calibration/2026-08-19-earned-ability-magnitude.md`. The forced channel
barely separates styles (`0.86` supportive vs `0.85` tyrannical right rate),
while the heeded channel separates them completely (`0.96–1.00` vs
`0.39–0.49`), so the mechanism measures whether a commander accepts the right
refusals. Whether the forced channel deserves its own weight remains open.
Earned ability is persisted through the existing campaign state path, and
fielding ranks ability relative to the piece's origin-role starting value
(`sim/pool.ts:252-277`). D148 and D150 remain open.

### D150 ❓ What may a commander know about a piece? (ADR 0054 §6)
**Partly wired.** ADR 0018 forbids showing the arithmetic, and a market makes the inverse
failure equally bad: a bench nobody can read is a bench nobody can use. Shipped
today: role, qualitative trust and status on the roster screen
(`src/app/RosterScreen.tsx:146-163`), names and origin in the roster plus names
in the piece overlay (`src/app/RosterScreen.tsx:118-163`,
`src/ui/overlays/PieceOverlay.tsx:44-73`), and a service record folded from
campaign match events (`src/persistence/service.ts:33-177`). The board gauges
remain visual, but their labels are qualitative rather than arithmetic.
The verdict, override, and quiet-quit panels now explain judgement gap,
objection strength, sight, and override cost without arithmetic
(`src/ui/panels/VerdictPanels.tsx:1-205`,
`src/app/MatchScreen.tsx:235-273`). These panels provide a readable reason, not
knowledge about pieces the commander has never led. The public candidate slate
is folded from identity, lifecycle, relationship-account keys, and service
records (`src/persistence/candidateSlate.ts:14-110`); private counsel is
qualitative and deterministic (`src/psychology/counsel.ts:3-126`). Testimony,
candidate rumour appraisals, and earned-knowledge projections remain open here.
The existing rumour channel appraises the commander rather than a candidate,
so it is not substituted into candidate counsel.
The economy's raw acceptance price remains harness-only, but its arithmetic is
exactly invertible to the underlying benevolence reputation
(`acceptedPrice = basePrice * (1000 - discount) / 1000`): a player-facing
per-piece price would therefore leak hidden state and violate ADR 0018. The
owner decision is to expose only qualitative salary-negotiation bands
(`acceptancePriceBand` in `src/core/draftEconomy.ts:150-186`), derived from the
discount's fraction of the configured maximum; the same bands apply to served
and unserved candidates. The raw number remains hidden.
ADR 0054 §6 still proposes earned knowledge as
testimony rather than telemetry, with rumor-only information about pieces never
served. Open: whether a commander may be *wrong* about a piece he has not led,
and how far testimony may rationalize.

### D151 ✅ How does a crowned member contest the seminar chairs? (ADR 0056)
The harness pool keeps `originRole` as permanent identity and folds the
highest attained role from `PROMOTION` events into `PoolMember.attainedRole`.
Eligibility is origin-inclusive (`originRole === R || attainedRole === R`),
chairs are filled highest-first, and selected IDs are deduplicated. The
fielded state receives the chair role while attained identity remains separate.
The implementation is in `sim/pool.ts:39-206`, with season metrics wired in
`sim/season.ts:40-157` and named findings in `sim/degeneracy.ts:1-420`.
This is the harness/pool slice only; app persistence and UI bench work remain
open under D148/D150.

### D152 ✅ How does the offline career field its private squad? (ADR 0057)

New careers bootstrap a deterministic depth-two private squad and field exactly
sixteen chairs through the shipped origin-inclusive selector. The player's
fallback policy is `strongest_available`; pinned IDs are available to future
commander controls but no picker ships in this slice. Capture removes a member
for one match rather than retiring her, while trauma and obsolescence are
permanent retirement causes. Availability, passed-over streaks, redemption,
service, and conscription provenance are folded from the match event log in
`src/app/squadCareer.ts:180-480`; psychological snapshots remain in
`pieceStates`. Legacy sixteen-member careers stay depth one through the
forward-only schema-v2 migration. This is the offline/private bench subset
only; shared market behavior is Slice 4. D148 and D150 remain open.

### D153 ❓ What stock does a career start with, and is it drafted? (ADR 0059 §1)
**Partly wired — magnitudes remain open.** The app and harness now share a
one-legal-army-plus-apportioned-reserve composition helper
(`src/orchestration/squadFielding.ts:180-218`), with no King in the reserve.
`RESERVE_DEPTH` defaults to `15`, preserving today's doubled standard army and
all existing IDs, names, dispositions, and seeds; `POOL_DEPTH_FACTOR` remains a
legacy mapping to reserve depth. The reserve magnitude and whether the first
cycle is a draft or an issued army remain open.

The draft economy is connected to the seminar harness only. `DRAFT_AT_CYCLE_ONE`
defaults to `false`, so the issued army remains the week-one default; the
opt-in `true` branch is exercised by the seminar CLI and tests. The cycle-one
choice remains open for the shipped career/season path.

ADR 0061 brings D153 due in step 1, the scarcity step.

### D154 ❓ What is the draft currency, and how is priority ordered? (ADR 0059 §2-§3, §6)
**Partly wired — magnitudes remain open.** ADR 0059 proposes two currencies of opposite sign:
priority and purse from *inverse* standing (the NBA device), and acceptance —
a discount on a piece's price — from reputation, read through ADR 0058's
relationship account or the disposition prior plus testimony. Deterministic
priority/purse, acceptance pricing, reverse-order clearing with an opt-in
first-refusal margin, and partial carry are pure, opt-in helpers in
`src/core/draftEconomy.ts:1-317`, configured by the provisional seeds in
`src/core/draftConfig.ts:1-50`; they are not reachable
from the default season path. The purse base (`0..200`, seed `100`), purse
spread (`0..100`, seed `50`), carry fraction (`0..1000` permille, seed `500`),
acceptance discount (`0..1000` permille, seed `500`), and minimum bid
(`0..10`, seed `1`) are §9 search seeds with documented none-to-steep/full
brackets, not rulings. The first-refusal margin (`0..1000` permille, seed `0`)
and deterministic cautious/balanced/aggressive bid multipliers (seeds
`900/1000/1100`, with a `0..2000` calibration bracket) are also §9 search
seeds. The acceptance-band labels and thresholds (`750/500/250` permille of
the configured maximum discount) are owner-decided presentation semantics;
raw acceptance prices remain harness-only. The economy stabilisers remain
harness instruments: purse runaway,
monotone standing, price collapse, and tanking dominance are detected from
cycle telemetry in `sim/degeneracy.ts:418-518`, with minimum
sample guards and provisional detector thresholds. Draft lots, outcomes, and
clearing prices are not persisted. Open: reserve depth, whether cycle one is
a draft, purse/carry/acceptance discount magnitudes, and detector thresholds.
Tanking must be measurably dominated, not merely discouraged.

The seminar harness now creates a finite, depleting per-side market and runs
drafting at the head of enabled weeks. `DRAFT_MARKET_DEPTH_PER_SIDE`,
`DRAFT_COUNT_UNAVAILABLE_AS_PRESENT`, `DRAFT_MARKET_INITIAL_TRUST`,
`DRAFT_BIDDER_ASSUMED_DISCOUNT_PERMILLE`,
`DRAFT_LOT_BASE_PRICE`, `DRAFT_LOT_ROLE_WEIGHT_PERMILLE`, and
`DRAFT_LOT_SERVICE_WEIGHT_PERMILLE`, and
`DRAFT_PURSE_TO_ASKING_RATIO_PERMILLE` are explicit harness configuration seeds;
their current values are calibration starting points, not owner-settled
magnitudes. Unavailable members are absent from demand by default, while the
count-all branch remains available for comparison. Public lot pricing uses
only candidate role and folded public service facts. Candidate-specific
acceptance is represented as a per-commander clearing reserve; a lot with no
reserve-qualified bid is retained as below-reserve telemetry. The opt-in
second-price clearing direction is owner-approved, while first-price remains
the default. The legacy `declinedLots` telemetry field now means that no
commander met her reserve; it no longer means that a winning commander
accepted and then walked. Counsel signals remain private: raw opinion is
retained only for harness correlation, while the configured weight changes
bidder willingness.

ADR 0061 brings D154 due in step 3, the draft.

### D155 ❓ What does a commander's own roster tell him about a candidate? (ADR 0059 §4-§5)
**Partly wired — magnitudes remain open.** The public record is identical for every commander
(name, origin and attained role, status, commanders served, and the folded
service record). Private counsel comes from pieces he already holds and is
computed from their state — dyadic affinity and class prejudice, with chair
rivalry using the shared origin-inclusive eligibility helper on both candidate
and holder sides
(`src/core/roleEligibility.ts:1-8`). Credence in *him* controls disclosure
only: silence returns no opinion. The existing rumour channel appraises the
commander rather than the candidate, so candidate rumour appraisal state is an
open item and is not used as a stand-in. The public slate and private counsel
are implemented in `src/persistence/candidateSlate.ts:14-110` and
`src/psychology/counsel.ts:3-126`; consultations use a zero-default attention
budget (`src/core/draftConfig.ts:1-50`,
`src/orchestration/counsel.ts:1-54`) and heeded outcomes fold only into
harness telemetry (`sim/metrics.ts:89-118`). The seminar harness additionally
uses its own consultation budget and applies the resulting private signal to
bidder willingness only (`sim/seminarDraft.ts`). The owner-set
`COUNSEL_RIVALRY_PENALTY=20` is wired in `src/core/draftConfig.ts:31`, and rivalry
is origin-inclusive on both candidate and holder sides; opinion bands and
disclosure cutoffs remain provisional ADR 0059 §9 search seeds. Harness
detectors for decorative
and oracular counsel are likewise provisional search instruments in
`sim/degeneracy.ts:822-853`; their thresholds are not game magnitudes. Open:
candidate rumour appraisals and the remaining counsel magnitudes. Raw
per-piece acceptance prices still invert to hidden reputation
and must not be exposed; the owner-approved qualitative bands are the only
player-facing price representation.

ADR 0061 brings D155 due in step 3, the draft.

### D156 ❓ How do temporary duty assignments and demotion work? (ADR 0059 §8)
**Open — not wired.** TDY needs no new state: lending a piece for a cycle is
carried by ADR 0058's per-commander accounts plus global trauma. Desirable
versus undesirable postings are an intended instrument (patronage versus legible
discipline). Demotion waits on D148, which fixes the sign and magnitude of
prestige movement; without it a demotion is a label. Both follow the draft.

ADR 0061 brings D156 due in step 6, postings and demotion.

### D157 ❓ What is disclosed about the honours, and when? (ADR 0060 §1-§4)
**Partly wired.** Refines D93 (ADR 0031 §3), which stands. D93 forbids
publishing a *standing* during play; it does not settle whether a *charter* may
be known. ADR 0060 proposes: the crude public register (wins, margin, material,
promotions, streak) is disclosed continuously **because** it is the
leaderboard a commander keeps anyway. Every achievement on it is a real
achievement — the register is honest but *partial*, and the deception is in its
apparent sufficiency, never in its content; the game must not sneer at
competence. It also sets reverse-order draft priority (ADR 0059 §2), so leading
it costs purse. The governing rule for the sealed set is **orthogonality, not
opposition**: an honour earns its place only if it is substantially uncorrelated
with the public columns across seeds and policies — correlated and it merely
re-skins the scoreboard, strongly anti-correlated and it punishes winning, which
ADR 0024 forbids. Honours sit *outside* the register rather than between those
failure modes: on axes it does not span, never as a softer version of winning.
That bound is a measurable detector, not a taste.

The behavioural honours stay sealed within a cycle and may open only on
**settlement** (the verdict can no longer change), and then only
when won; a settled loss waits for the debrief. A student typically plays one
cycle, so the cross-cycle charter belongs to the facilitator rather than to him,
and **an award nobody earned is never mentioned** — the debrief reads only the
honours given, which keeps unearned awards unfarmable and makes ADR 0031's
unwinnable-award detector harness-only. A facilitator may unseal one award
deliberately as a recorded act. `repaired_breach` is never heralded. Open:
whether settled-won disclosure happens at all, and whether the consumer campaign
(no facilitator, so the charter leaks by repetition) opens the charter or rotates
which honours are live.

Owner decision: public-register material is valued at the role held when a
piece is captured, not at its origin role. Promotions are public facts, so the
register folds them in event order while maintaining a current-role map scoped
to each match and seeds it from the public starting chairs; promotions by either
side affect later capture valuation when their role is public, while
`promotionsReached` remains commander-side-only. Own-side valuation is exact
because the record carries that lineup; an enemy piece fielded in an
attained-role chair remains origin-valued because the record keeps no public
enemy lineup. If an identity cannot be attributed, the capture remains visible
through `unattributedCaptures` rather than being treated as free material. This
requires no persisted event or schema change.

ADR 0061 step 2 wires the own-record public register
(`src/persistence/register.ts:1-228`), including capture-time role valuation,
verdict-stability lower-bound probe and
dead-by-match-two detector (`src/persistence/commendations.ts:316-346`,
`sim/degeneracy.ts:565-579,707-745`), and provisional register-mirroring and
anti-correlation detector (`sim/degeneracy.ts:573-579,748-796`). Cohort rank is not
implemented. The orthogonality band is a detector threshold only and remains
provisional for ADR 0059 §9's parameter search; no honours catalogue, guild or
people's-choice awards, or charter-leakage extension is included.

ADR 0060 §6 splits the register into four kinds, and only the sealed behavioural
honours must stay hidden: the crude public register; the sealed honours; **guild
awards** where a class honours the commander who best served its own idea of good
chess (the rooks for castling, the bishops for the queen's diagonals), published
in advance because farming them means playing more interesting chess, and voted
with each piece's credence and class prejudice as the weight rather than by a
neutral judge; and **people's choice** voted by the students, wanted but needing
a collusion guard. Facilitator awards follow the ADR 0050 pattern — software
nominates a bounded shortlist with evidence, the human confers. Open: the guild
criteria and their vote weighting, and the people's-choice ballot guard.

### D158 ❓ What does a piece observe of her commander's record? (ADR 0060 §5)
**Open — not wired.** Never an award, a standing, or a criterion. Public record
and conduct only — results, who was fielded and who sat, promotions, captures,
expenditure, desertions — attended to in a subset weighted by class prejudice,
dyadic affinity, and what she witnessed; rumor still carries appraisals only
(ADR 0016). Consequence for ADR 0059: market acceptance is priced off reputation
*as perceived*, not off the true record. Piece-level honours (ADR 0050 heroism
nominations) remain observable; commander commendations do not. Open: the
salience weights across class, bond, and witness.

ADR 0061 brings D158 due in step 5, the honours; the public-register fold and
orthogonality probe arrive in step 2.

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

### D159–D163 ✅ How may a model play, and what may its play prove? (ADR 0062, ADR 0063)
**Answered — not wired.** Owner ruling of 2026-08-25: **no live LLM during
play.**
A model may play only through a **decision journal** — an ordered, canonical
record of each decision, the observation the commander was shown, the
canonically ordered option set, and the chosen *index*; free text is carried as
`rationale` that no reducer may read, so ADR 0001 is enforced structurally
rather than by convention. Journals replay with neither model nor engine
(engine answers are recorded per entry, as `ReplayManifest` already does for
`moveEval`), which is also what makes forking a prefix at one decision the way
realistic mid-campaign scenarios are generated. Balance rule: coefficients are
tuned only against scripted policies; model runs exist to surface behaviour a
script cannot express (boredom, spite, over-overriding), and a finding counts
only once it is demoted into a deterministic scripted policy or metric. No
committed balance number may depend on a model checkpoint. All model calls live
in `sim/`; `src/` gains only the widened commander port and the observation
projection.

**Answered 2026-08-26 by ADR 0063 — partly wired.** **D159**: the first journal
is implemented in `sim/journal.ts:createJournallingLeader` and carries `move`
(one entry per `chooseMove` attempt, so re-plans are visible), `override` (only
where `shouldOverride` is asked on a `MORAL_REFUSAL`), and `disengage` (an option
on both sets, not a third ask); the override `stand` option is also enumerated,
but its walk-away consequence is not modelled. There is no model player, no
engine-free fold, and no fork/counterfactual replay. `crisis_option` waits on
ADR 0040 being implemented at all, fielding/dismissal are slice 2, bid/counsel
slice 3. **D160**: observations are projected field-by-field by
`src/orchestration/observation.ts:45-97` and carry only the qualitative band
words the player already sees (`src/core/qualitativeBands.ts:1-85`), never a raw
scalar; the event log is not an observation, since `REFUSAL` carries
`utility`/`threshold`/`perceivedValue` (`src/orchestration/headlessMatch.ts:704-718`);
this is enforced by structural and targeted leak tests in
`tests/journal.test.ts:573-638`. **D161**: a declined or out-of-range answer is
a recorded `abstain` resolved by the named scripted policy, never read as
disengagement and never retried (`sim/journal.ts:159-297`). The disengage option
is enumerated but its walk-away consequence is not modelled yet. **D162**: the bid ladder is derived from the
existing integer economy (`pass`, lot/global minimum, the three
`BID_MULTIPLIER_*` rungs, remaining purse), so `optionSetVersion` includes a
draft-economy config digest. **D163**: a finding requires recurrence across at
least two distinct NPC prefixes at a pinned model id, and is demoted into a
widened NPC policy or a new option before it counts; coefficient changes remain
owner rulings.

### D164 ✅ Along which axis is the NPC span widened first? (ADR 0063 §5)
**Answered 2026-08-27 (owner) — behavioural axis wired, emotional axis still
open.** The span is widened on **insistence held independent of care**, and no
balance magnitude is invented to do it: the three new styles at
`sim/leaders.ts:275-325` are interpolations inside the ranges the file already
used (care/`riskWeight` 0–25, `leaderImpliedBias` −0.5–2.5, override 0–90%) —
`exacting` (care 20, override 80%), `absentee` (care 0.25, override 5%),
`steady` (care 8, override 40%), registered in `sim/cli.ts:36-59` with trust
priors following the axis at `sim/campaign.ts:152-171`. The off-diagonal
quadrants that made "cold" and "demanding" the same style are now populated, and
refusal rate separates them (0.133 / 0.449 / 0.839 at `--opponent=tyrannical`).

The **outcome ceiling needed no widening at all**: the four styles tied at
`100.00` were an artifact of sweeping at the default `random` opponent — the
failure mode `docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md`
already recorded. Measured against `--opponent=tyrannical` they score
`82.5 / 65.0 / 40.0 / 30.0` with records from 15/3/2 to 4/4/12
(`docs/calibration/2026-08-27-the-competent-opponent-and-the-two-axes.md`).
`winScore` therefore stays definitional at 0/50/100 and the correction is to
method: a coverage sweep runs against `--opponent=tyrannical`, and win scores
measured against `random` are read as saturated.

**Still not wired: the emotional axis.** `τ_benev` remains 82.1 for `supportive`
against ≤ 12.4 for every other style including `exacting`, so the axis is still
two points and **containment must not be measured yet**. Why it did not widen is
D165.

### D165 ❓ What earns `τ_benev`? (D164 follow-up)
**Open — not wired.** The sweep shows every style with an observed override rate
≥ 0.27 ending at `τ_benev` ≤ 12.4 regardless of care, with `exacting` — the
highest care value in `sim/leaders.ts` — at 5.7 against 82.1 for `supportive`,
whose override rate is 0.000. Reading the writers rather than the sweep explains
why, and the mechanism is structural rather than a magnitude accident. There are
exactly three writes to `tauBenev` (`src/psychology/credence.ts:26-56`):

- **compliance under private doubt** earns `BENEV_HEARD_STEP` = `+15`, and it is
  the only gain in the engine — it fires when the actor plays a move it values
  as losing while the leader's implied view was better
  (`src/orchestration/psychologyHooks.ts:177-188`);
- **override** costs `-40`, saturated: the cliff's logistic input is
  `OVERRIDE_BENEV_CLIFF_INPUT × BENEV_BETRAYAL_CLIFF_SCALE = 24`
  (`src/psychology/override.ts:20-37`, `src/psychology/config.ts:36-63`);
- **refusing a move that was objectively good** costs `-3`
  (`src/orchestration/headlessMatch.ts:662-668`).

Three consequences follow. **Honouring a refusal earns nothing** — the
no-override branch has no benevolence credit at all, so the hypothesis that
deference buys benevolence is wrong; what buys it is obedience. **Care has no
path**: no benevolence write reads capture risk or any protective feature, which
is why the highest-care style cannot escape the floor. And **one rupture costs
nearly three acts of faith** (`40` against `15`), with no repair term, so the
relationship is unrecoverable by construction — which then saturates the
desertion alienation term, since `benevolenceGapPermille` is
`(50 - tauBenev) × 20` capped at `1_000`
(`src/psychology/desertion.ts:116-119`): `0` for `supportive`, `752`–`885` for
every style that ever overrode.

So `τ_benev` is currently a **compliance meter**, which contradicts ADR 0024
(warmth buys resilience, not compliance). Fixing it means changing what earns
the channel and adding new persisted credence state, so it is an owner ruling
with an ADR, not a coefficient tweak.

### D165 ✅ How does care cushion benevolence and repair rupture? (ADR 0064)
**Answered 2026-08-27 by ADR 0064.** The regard writer is implemented in
`src/psychology/credence.ts:37-52`; the repair writer is implemented in
`src/psychology/credence.ts:64-87`; override debt accrual is wired through
`src/psychology/override.ts:20-37` (the debt writer is
`src/psychology/credence.ts:89-100`); honoured-refusal `REPAIR` emission is
implemented in `src/orchestration/headlessMatch.ts:702-716` and
`src/orchestration/matchSession.ts:508-522`. **Wired, live at D166 defaults:**
`BENEV_REGARD_STEP` and `BENEV_REPAIR_STEP` are now ruled in D166.

### D166 ✅ What are the live magnitudes for regard and repair? (ADR 0064, ADR 0066)
**Answered 2026-08-29 (owner) — wired, live.** The ruled magnitudes are:

- `BENEV_REGARD_STEP = 50` (`src/psychology/config.ts:38`);
- `BENEV_REPAIR_STEP = 30` (`src/psychology/config.ts:42`);
- `BENEV_BETRAYAL_CLIFF_PERMILLE = 250`
  (`src/psychology/config.ts:47`).

The proportional cliff inside the interior window at or below `250` permille
removes the free-insistence floor for some styles, but not entirely at the
shipped witness input of `6`. Regard is opportunity-capped, so steps above `50`
buy nothing. Repair at `30` reduces free insistence while *raising* what
witnesses pay, which is the acceptance test required by ADR 0066. At the ruled
defaults and witness input `6`, the tyrannical/tyrannical condition moves from
`free_override_count=19.00` to `0.75` and
`free_insistence_ply_fraction=0.7879` to `0.3411`. Free insistence reaches
`0.0000` for servant, steady, and cold_winner, and `0.0731` for redeemer. The
evidence is
`docs/calibration/2026-08-29-the-ruled-magnitudes-across-the-span.md`.

The ruling rests on ledger fidelity and on a measured conduct shift outside the
tyrannical/tyrannical condition: cold_winner
`desertion_attrition=0.3125` to `0.1875` and `win=25.0` to `12.5`, redeemer
`mean_plies=89.8` to `60.3` and `desertion_attrition=0.3750` to `0.3125`, and
steady `override_count=40.50` to `31.25` and `mean_plies=121.3` to `101.8`.
These conduct readings are directional but caveated by four matches per style.
The tyrannical/tyrannical condition itself did not move on the measured
behavioural metrics. `OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` remains at its inert
default deliberately; D174 records why a separate witness multiplier is
needed. `BENEV_RUPTURE_DEBT_CEILING` also remains at its inert default because
the repair-versus-accrual constraint leaves the larger ledger capacity
unreachable at the ruled repair step. The witness split remains open under
D174; do not invent further numbers in the register.

### D167 ✅ Should the override cliff be graded, proportional, or status-priced? (ADR 0066)
**Answered 2026-08-28 (owner) — wired, partly live.** Graded *and* proportional; the
status question is deferred to D170. The broadcast curdle stays: witnesses must
keep paying, because 78%–87% of all benevolence lost falls on pieces the
commander never gave an order to, and that is the phenomenon the simulation
exists to teach. What was ruled a defect is the saturation beneath it — measured
at seed 7 against `--opponent=tyrannical`
(`docs/calibration/2026-08-28-the-curdle-and-the-floor.md`), 42%–57% of
overrides cost the roster exactly zero because every payer is already clamped at
`0`, and 62%–78% of plies are played after the first such override, so the room
stops keeping score and insisting becomes free. Three limbs ship, each behind a
knob whose default reproduces today's behaviour byte-for-byte:
(a) the witness cliff input is separable from the target's
(`OVERRIDE_WITNESS_BENEV_CLIFF_INPUT: 6`, `src/psychology/config.ts:74-75`, read
for witnesses only in `src/psychology/override.ts:31-59`), so benevolence can be
graded the way trust already grades it 4.4:1;
(b) the cliff may charge a fraction of the standing that remains rather than a
flat `40` (`BENEV_BETRAYAL_CLIFF_PERMILLE: 0`,
`src/psychology/config.ts:46-47`, consumed in `applyBetrayalSignal`,
`src/psychology/credence.ts:100-125`), which makes the decay geometric — the
first override is dearest, and no later override is ever free;
(c) the rupture ledger gets its own ceiling
(`BENEV_RUPTURE_DEBT_CEILING: 100`, `src/psychology/config.ts:48-49`, applied by
`clampRuptureDebt`, `src/psychology/clamp.ts:25-32`), so the record of what is
owed can keep growing after benevolence itself has bottomed out.
**Partly wired (D166):** `BENEV_BETRAYAL_CLIFF_PERMILLE` is live at `250`; the
witness input remains equal to the target's at its inert default, and the
ceiling remains today's `100`. The regard and repair magnitudes are ruled in
D166; the witness split is ruled in shape by ADR 0070 with its magnitude open
under D176, and the debt ceiling remains inert under the repair-versus-accrual
constraint. Two
constraints bind that pass: the debt ceiling must not be raised while
`BENEV_REPAIR_STEP` is still `0`, or the game records a debt no act can pay; and
a candidate that lowers the zero-cost override share by weakening the witness
share of total loss has failed the acceptance test, not passed it. Sensitivity
probes for all three limbs are in `tests/curdle.floor.test.ts`.

### D170 ✅ Should the cost of an override depend on the target's standing?
**Answered 2026-08-29 (owner) — see ADR 0070.** The witness limb is now
prepared to price the override by the target's standing in each witness's own
eyes, not by a roster-wide aggregate. `witnessAttachmentPermille` combines
that witness's dyadic affinity for the overridden piece with the prestige it
grants the piece's role, then `applyOverride` turns the attachment into a
non-discounting per-witness scale
(`src/psychology/standing.ts:8-15`,
`src/psychology/override.ts:31-59`). The overridden piece's own charge is
unchanged: it prices what was done to it, not its popularity. The mechanism
ships inert at `OVERRIDE_STANDING_PRICE_PERMILLE: 0`; its live magnitude is
deferred to D176.

### D171 ✅ Is an engine evaluation a function of the position, or of the search history? (ADR 0067)
**Answered 2026-08-28 (owner) — see ADR 0067 for the contract.** Cold. Lozza
runs as one long-lived child with a 16 MB transposition table and sends
`ucinewgame` only in the handshake (`src/engine/uci.ts:299-310`), so every
search begins with whatever the previous ones left behind — while the cache key
`(position, depth, evalProfile, determinismId)` and its stated contract that a
warm entry be byte-identical to a cold one (`src/engine/cache.ts:4-9`) assume
the opposite. The ruling is that the engine is cleared before every search, so
an evaluation depends on its arguments alone. Three consequences are binding:
the cold/warm policy becomes part of `determinismId`, because otherwise a warm
value can be served under a cold key; the ladder LRU may finally be bounded,
since under cold search an eviction costs a re-search and never changes a
result; and every **Lozza** number in `docs/calibration/` was taken warm and is
re-baselined rather than reinterpreted — fake-engine evidence, which is most of
the corpus including D164/D166/D167, is unaffected because it carries no state.
The mechanism is `ucinewgame` per search, not process recycling: in the
vendored artifact the transposition table is the only state that survives a
search (`vendor/lozza/lozza.cjs:1145-1149,2857-2862`), killers and history
being reset by the `position` command already
(`vendor/lozza/lozza.cjs:2882-2883,3066-3067`). The price is lost table reuse
across queries; it is measured with the implementation against the 2.82 s/match
warm baseline in `docs/calibration/2026-08-13-blocked-on-measurement.md`, and if
cold proves too slow the answer is a smaller depth cap or fewer matches, never a
warm engine.

### D172 ✅ May the vendored Lozza artifact be patched? (ADR 0068)
**Answered 2026-08-29 — yes, minimally, and the engine is not believed either.**
Measuring the D171 contract found that Lozza
does not return at every position. At
`Q1b1k3/8/8/4pP2/2pP3B/8/P1P2PPP/RN1QKBNR w KQ - 0 16`, a single `go depth 4`
against a raw `vendor/lozza/lozza.cjs` child — no adapter involved — spins
forever in the aspiration-window loop (`vendor/lozza/lozza.cjs:1080-1098`),
re-reporting `score mate -500 lowerbound … pv a8c8` and allocating until the
child's heap dies. It reproduces at `MultiPV 1` and `MultiPV 8`, warm and cold
alike, so it is not caused by D171; the cold contract merely changed the game
line and walked into it. A depth-limited search is precisely the thing that is
supposed to be unable to run away (ADR 0005), so this is a hazard for every
long campaign, not for one seed.

The ruling (ADR 0068) is all three layers, and investigating it found a second,
quieter defect that changed the shape of the answer. **The artifact is patched**
minimally — two conditions so a maximal aspiration window is never re-searched,
carried as a recorded diff under `vendor/lozza/patches/` with the MIT notice
intact, reported upstream as `namanthanki/lozza#4` (the canonical
`op12no2/lozza` redirects there), and separated from unpatched evidence by the
artifact hash that `determinismId` already carries. Lozza is MIT
(`vendor/lozza/LICENSE`), so this is the permissive half of the licensing
strategy and costs maintenance rather than provenance. **A score must prove
itself sound**: the loop guard stops the hang but not the underlying bug, which
is that a root search can return `INF` (32000, above `MATE`) at all — Lozza
reports it as `score mate -500`, and the parser turned that into `-29_500`, a
plausible *losing* number for a position that is a forced win in three. A mate
distance of zero or an implausibly large one is engine unsoundness, answered by
a deterministic re-search one ply deeper (at most twice, then a loud failure),
and the old `mate 0 → 29_999` special case is withdrawn as a hand-wave over the
same sentinel. **The adapter keeps a deterministic runaway guard** as a hard
failure — a ceiling on the output one search may produce, never a wall clock and
never a `nodes` budget that can bind, because Lozza's node net fires only at
100× the budget and its soft net stops honest deepening. Truncation is rejected:
it buys silence at the price of making the next engine's pathology invisible.

### D173 ✅ Is a ladder rung from a deeper search the canonical value for that depth? (raised by ADR 0068)
**Answered 2026-08-29 (owner) — see ADR 0069.** The adapter and the broker
both cache one ladder per FEN and reuse it whenever `maxDepth >= requestedDepth`
(`src/engine/adapters/lozza.ts:327-333`, `src/engine/broker.ts:139-149`).
The honest description of what ships is therefore: **the rung is the value**.
The ruling does not switch to `(fen, searchDepth)` keying or always search at
`D_max`; the reuse path stays as it is.

The evidence remains that the depth-`d` rung of a `go depth N` search is not
always a standalone `go depth d`: over five ordinary positions, 17 of 18 rungs
matched and one did not —
`2r3k1/p4p2/3Rp2p/1p2P1pK/8/1P4P1/P3Q2P/1q6 b - - 0 1` at depth 3 gives
`cp 461 … e2b5` standalone and `cp 464 … e2d3` as the rung of a depth-6
search. Iterative deepening warms its own table and windows within a single
search, so this is a policy choice, not a claim of standalone equivalence.

Three consequences follow. First, `ladder-rung-canonical` is part of the
Lozza and Stockfish determinism identities
(`src/engine/adapters/lozza.ts:247-248`,
`src/engine/adapters/stockfish.ts:27-30`); the fake engine has no ladder reuse
and therefore does not carry the token. Second, both broker per-position
caches are bounded by `ladderCacheCapacity`: `sharedByFen` and
`bestByFenDepth` use `LruCache` (`src/engine/broker.ts:125-129`), so under the
cold contract an eviction costs a re-search but cannot change a result.
Third, the future ADR 0062 journal/fork machinery must replay the parent's
per-piece `D_i` and ladder search depths, not merely its positions and seeds,
because the first search depth fixes the rung within a run by the `PieceId`
barrier order.

The two pure alternatives were priced and rejected: keying by
`(fen, searchDepth)` multiplies engine calls by the number of distinct depths a
roster asks for, with `D_i` spanning `MIN_SEARCH_DEPTH=2` through
`MAX_SEARCH_DEPTH=16`; always searching at `D_max` makes every pawn's shallow
query pay `D_max`. If the fork programme later proves the canonical-rung policy
intolerable, the escape is always `D_max` plus a re-baseline.

### D174 ✅ Should the witness cliff have its own multiplier rather than a shared logistic input?
**Answered 2026-08-29 (owner) — see ADR 0070.** Witness benevolence now has
its own multiplier, applied to the final betrayal drop through the optional
`scalePermille` argument to `applyBetrayalSignal`
(`src/psychology/credence.ts:100-125`,
`src/psychology/config.ts:76-79`). The saturated
`OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` remains the input to the shared sigmoid;
the new multiplier is the grading mechanism. The mechanism ships inert at
`OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE: 1000`; its live magnitude is
deferred to D176. At the ruled defaults, witness inputs `6` and `3` are
byte-identical, but `1` is not inert under the proportional cliff: the measured
surface moves `free_override_count` from `0.75` to `0.00`,
`free_insistence_ply_fraction` from `0.3411` to `0.0000`,
`benev_loss_witness` from `931.50` to `916.25`, and
`benev_loss_target` from `222.00` to `230.25`. The evidence is recorded in
`docs/calibration/2026-08-29-the-ruled-magnitudes-across-the-span.md`; the
separate multiplier is still what provides witness grading.

### D175 ✅ Can a proportional cliff keep its promise in the deep tail?
**Answered 2026-08-29 (owner) — no code change; behaviour as shipped.** ADR
0066 says the first override is dearest and no later override is ever free, but
the proportional charge is asymptotic and truncates down. Once `tauBenev`
reaches `3`, the charge rounds to `0`, so no further benevolence or rupture
debt is recorded. The owner accepted this as the intended shape rather than a
defect.

The consequence is plain: ADR 0066's "no later override is ever free" holds
almost everywhere but not literally. The residual `0.75` free overrides in the
tyrannical/tyrannical condition at witness input `6` are made of exactly this
tail. The three candidate closers are not adopted:

- a minimum charge of `1` while benevolence standing remains;
- adopting witness input `1`; or
- letting rupture debt accrue when benevolence is bottomed out, which is the
  intent of ADR 0066 limb (c) and is currently unimplemented in spirit, not
  merely unreachable by the ceiling.

Adopting witness input `1` remains separately available under D174 if witness
grading is ever revisited. The implementing references are the
`holds the ruled D175 asymptote where the charge truncates to zero` change
detector in `tests/curdle.floor.test.ts:284-295` and `applyBetrayalSignal` in
`src/psychology/credence.ts:100-125`.

### D176 ✅ What are the live magnitudes for the graded witness and the priced standing?
**Answered 2026-08-29 (owner) — see ADR 0070 addendum.** The live magnitudes
are `OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE = 500` and
`OVERRIDE_STANDING_PRICE_PERMILLE = 2000`. The ruling is a ledger ruling, not a
demonstrated conduct improvement: at the measured seed-7, four-match surface,
the `tyrannical` condition moved from `free_insistence_ply_fraction = 0.3411`
to `0.0000`, target benevolence loss `222.00` to `301.00`, witness loss
`931.50` to `740.50`, and ending `tauBenev` `19.75` to `22.69`; `redeemer`
moved from `0.0731` to `0.0000`, target loss `140.00` to `175.00`, witness
loss `654.50` to `481.50`, and ending `tauBenev` `48.75` to `55.00`.
The evidence is `docs/calibration/2026-08-29-the-graded-witness-surface.md`.

The mechanism remains linear in attachment. The measured attachment
distribution has half of witness observations at exactly `0`, about `72%` at
or below `100` permille, only about `1.5%` at or above `500`, and none
saturating; adding a curve or knee would therefore bend a region with little
or no mass. The sweep showed that halving the witness multiplier removes free
insistence over a campaign rather than widening it, because later free
overrides come from a room already drained to zero by the old multiplier.
Standing price `2000` is four times below the nearest failing cell, `8000`,
that re-opens the floor for `tyrannical`. The surface supports the ledger
choice, not a claim of improved conduct. The implementing defaults are
`src/psychology/config.ts:76-79`; the explicit pre-D176 change detector is
`tests/curdle.floor.test.ts:74-93`.

### D177 ✅ Do pieces stay together long enough for a social graph to exist? (ADR 0071)
**Answered 2026-08-29 (owner) — not wired.** *"Being taken isn't being held as a
POW, or if it is, there should be a prisoner exchange at the end of each match."*
Capture is **captivity**: the piece leaves the board into the captor's hands with
its state intact, an exchange settles at the end of every match bounded by what
each side holds, what is not exchanged stays held (and judges its own commander
for the omission), and a captive's square is filled by a replacement — so a
roster's social density becomes an outcome of leadership rather than a constant.
ADR 0071 records the shape and opens D178–D180 for the arithmetic. Nothing is
wired; the measured evidence and the harness defect below stand as recorded.

Reading the harness while ruling this found that the campaign is not modelling
loss at all but **amnesia**: `mergeCampaignRoster` rebuilds the full lineup each
match and re-uses the same `PieceId` per starting square, but carries
psychological state only for pieces present in the returned roster — survivors
only — so a captured piece is re-created by `createFreshPieceState` with empty
`dyadicAffinity`, `B_i = 0`, and reset credence (`sim/roster.ts:120-146` for the
survivor-only merge, `sim/roster.ts:68-87` for the reset constructor,
`sim/campaign.ts:259-296`). The state is not lost by design: `runMatch` returns
`departedRoster` including the capture injury, and the season pool path already
folds it back (`sim/pool.ts:469-500`). The campaign path discards it — and the
campaign path is the instrument every committed psychology magnitude was
calibrated on. This contradicts ADR 0026 §1 (a captured piece remembers who took
it and who spent it) and silently voids its accumulated-trauma pool. Recorded as
a harness defect in `docs/adr/IMPLEMENTATION_STATUS.md`; repairing it moves
measured attrition, so it needs its own before/after evidence.

**Original measurement (unchanged by the ruling).**
Every social mechanism now specified prices a *bond*: D170 charges each witness
by its attachment to the piece that was overridden, and D168/D169 route a
private word through affinity (intimates read care, the rest read favoritism).
Measurement says the bonds are mostly absent, and not because they accrue
slowly. Over 20 matches at seed 7, fake engine, `--opponent=tyrannical`
(`docs/calibration/2026-08-29-the-roster-nobody-stays-in.md`): mean survivors
per match `1.95` of `16` fielded for `tyrannical` and `2.85` of `16` for
`redeemer`; desertion is 0–5 per match while **capture** removes 10–15; only
`1` piece (`tyrannical`) and `2` (`redeemer`) survive five or more matches, and
the one that survives all twenty is the King. The pieces that *do* persist hold
strong bonds — mean |affinity| `68.1`/`66.7` with maxima at the `100` cap — but
only 2–4 non-zero edges each, so the modal piece plays one match and never meets
the same witness twice. That is why half of all witness attachments at override
time are exactly zero.

Three answers were available; the owner ruled the first, in the sharper form of
captivity plus exchange (ADR 0071). The other two are recorded because they
remain the alternatives if the exchange arithmetic (D178) proves unworkable:

1. **Roster continuity** *(ruled)* — pieces should return (ADR 0026 already makes capture
   non-permanent at the community level, and nothing in the harness exercises
   the return path), or a bench/reserve should carry a cohort across matches.
   The sociology then works because the same faces come back.
2. **Accrual rate** — the affinity magnitudes should build a graph inside one
   match, so a roster of near-strangers still forms readable factions. This is
   the cheapest to measure and the easiest to over-tune.
3. **Accept the turnover** — 12 of 16 pieces lost per match against a competent
   opponent is the honest chess, so the social mechanics must be specified to
   work on a sparse graph (the King and two or three veterans), and their
   magnitudes chosen against *that* roster rather than an imagined cohort.

Not answerable from the current evidence: affinity accrual *per shared ply* is
unmeasured (only the stock held by survivors is), the accounting is one seed,
and own-side capture is a subtraction residual because the harness counts
`enemyAttrition` but has no player-side capture counter — which is itself a
harness gap this decision should close. D177 was **not** a claim that attrition
is a defect; it was the question of whether the social layer is being tuned
against a roster that cannot hold it, and the answer is that it was.

### D178 ❓ What does a prisoner exchange settle? (ADR 0071)
**Open — raised 2026-08-29 by ADR 0071, not wired.** One-for-one by count, or by
role value? Count is simple and lets a commander buy an officer back with pawns,
which is itself a leadership tell and a class-prejudice event (ADR 0019's class
bias reads directly on "three pawns for the Queen"). Value is fairer and makes
losing an officer slow to recover from. Whichever is chosen, the exchange must
stay bounded by what each side holds — an unbounded return is respawn, which ADR
0071 §2 rejects because it makes capture free beyond the match.

### D179 ❓ May a commander refuse an exchange? (ADR 0071)
**Open — raised 2026-08-29 by ADR 0071, not wired.** A tyrant who holds an
officer as leverage is good drama and produces genuine asymmetry between leader
archetypes. The hazard is informational: under ADR 0025 no enemy psychological
state may reach the player except as observable behaviour, so a refusal must be
legible as an act (*they would not give him back*) without exposing the enemy
commander's reasoning. Also unresolved is whether the player may refuse, which
would make abandoning one's own piece a *choosable* act rather than a
consequence of a thin ledger.

### D180 ❓ What does a returned piece owe the replacement who took its square?
**Open — raised 2026-08-29 by ADR 0071, not wired.** Captivity fills the
captive's square with a fresh piece, so on return two pieces claim one square.
Whether that is resentment, seniority, or nothing at all decides whether
replacements are socially inert filler or a second faction inside the roster —
and it is the first place in the design where a piece's grievance is against a
peer rather than the commander.

### D181 ✅ What does an exchange settle in? (ADR 0071 addendum)
**Answered 2026-08-29 (owner); wired in the seminar path 2026-08-30.** An exchange settles in money, paid
out of the unspent draft purse. This largely dissolves D178: the market already
prices a Queen above a pawn, so the class prejudice of ADR 0019 appears in what
the market charges rather than in an authored exchange table.

The money is already there and is currently wasted. On seed 7 (`pnpm
sim:seminar --seed=7 --weeks=2 --matches=1 --commanders=2 --engine=fake
--draft-at-cycle-one=true`) the cycle-2 draft cleared **all 8 lots at a mean
price of 19** and still ended with **393 unspent across four commanders** —
roughly 98 of a ~125 purse, i.e. about 80% dead money — and
`PURSE_CARRY_PERMILLE = 500` then destroys half of the remainder at the cycle
boundary. Ransom needs no new currency; it needs the existing one to stop being
burned.

The scarcity also lands in the right place without tuning. At ~19 a piece and
~125 a purse, a commander can buy back **five or six** of the 10–15 pieces a
match takes. He therefore **must choose whom to ask back**, which is the ADR
0071 §5 leadership act arriving as an arithmetic consequence rather than a
rule. The piece's side of the price is also already in tree:
`acceptanceDiscountPermille` (`src/core/draftEconomy.ts:116-135`) already
discounts what a piece asks by its benevolence credence in the commander and its
roster's testimony. Pointed at ransom, a piece that wants to come home is cheap
and a piece that was spent carelessly is expensive or declines outright (ADR
0026 free agency). **The same prisoner therefore has a different price for the
leader who lost him than for anyone else** — the first place in the design
where a leader's reputation is quoted back to him as a number.

The second addendum rules both boundaries. Ransom is drawn from the **cycle
purse**, not a per-match allowance: a bad match is paid for over the weeks that
follow, at the expense of the next draft. With ~19 a piece, ~125 a purse, and
10–15 pieces taken per match, a commander who loses badly twice in a cycle
cannot both redeem his people and compete at the next draft.

The ransom terms are private to the two commanders and the piece concerned.
Under ADR 0025 this withdraws the claim in §5 that the roster observes the
exchange: the roster sees only **who came home**. Whether the commander paid,
the piece paid, they split it, or the enemy released him is not visible as
fact. A return must be inferred and travels as testimony and rumour through
the ADR 0065 channel, with every party motivated to shade it. The favoritism
tell of §5 therefore survives only coarsely: presence is observable,
generosity is not. *(ADR 0071 second addendum, 2026-08-29.)*

### D182 ✅ Does a piece read its own price as its worth? (ADR 0071 addendum)
**Answered in principle 2026-08-29 (owner) — expectation baseline confirmed;
price-side magnitude is ruled and wired inert via `foldPride` (ADR 0078 D215
addendum), while live registration remains open; cash is now wired in the seminar path.** A piece's clearing price and ransom feed its
self-regard: being bought back cheaply is an injury even though coming home is
good news. The appraisal is a **signed difference from a persistent, moving
expectation** the piece carries, updated by what that piece was previously
paid. Expectation is everything: a piece compares its recovery with what a
piece of its role and history expected, never with the absolute price. Absolute
price would deterministically demoralise pawns, cheap by construction (D146),
and confirm ADR 0019's class lean.

Piece cash now exists in persistent `PieceState`; the self-appraisal magnitude
and registration consumer remain deferred.

### D183 ✅ Do pieces hold cash and may they pay their own ransom? (ADR 0071 addendum)
**Answered in principle 2026-08-29 (owner); wired in the seminar path.** Pieces hold cash and
may pay part or all of their own ransom, creating four captivity outcomes:
**he paid**, **I paid**, **we split it**, or **nobody came**. A piece that sprang
itself owes the commander nothing, and knows it: independence is an authority-
decay path no authored penalty currently produces. It also prices the leader's
self-serving option — let the cheap pieces buy themselves out and spend the
purse on the Queen — as an observable act.

Under the privacy ruling, those four outcomes are **not distinguishable by the
roster**. The roster sees only who came home; self-payment is carried by
inference and possibly false testimony or rumour, not by an exposed fact.

### D184 ❓ Does an unransomed captive enter the next draft as a lot?
**Open — raised 2026-08-29 by the ADR 0071 addendum, not wired.** Failing to
bring people home would mean watching a rival buy them, the harshest and most
legible consequence available. It also risks a rich commander farming another
commander's veterans, so the draft-lot path and its boundary remain unresolved.

### D185 ❓ What claim does the loyal survivor have on the purse?
**Open — raised 2026-08-29 by the ADR 0071 second addendum, not wired.** The
purse is one pot, so redeeming the piece that got itself taken spends money not
only on wages and lots but on the pieces who were never captured. The parable is
the loyal survivor watching the returning captive receive the fatted calf
while nobody ever spent that money on him. This claim needs no private
information: presence is observable, and everyone knows what a purse is for.

It is a leadership trap with no clean answer. Redeem the captives and the
faithful pay for it; leave them and the roster learns that they do not come.
Reliability is currently unpriced: a piece earns regard for showing up, but the
commander's ledger records nothing for the service it never had to buy.
Possible shapes remain open: an expectation term, with unrewarded service
raising the veteran's D182 expectation; a benevolence charge at redemption,
making the commander pay the room for the spend like an override; or a
standing claim on the next draft, where the veteran expects money spent on
their cohort.

### D186 ✅ Can accumulated trauma end a career on every path? (ADR 0072)
**Answered 2026-08-29 (owner: "we need both retirement and amazing grace") —
wired 2026-08-30.** Yes: a non-King identity whose trauma reaches the threshold
is permanently retired, and the campaign path is not exempt. The threshold is now
one number consumed by both paths — `ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD`
at `src/psychology/config.ts:89`, referenced by the squad default at
`src/orchestration/squadFielding.ts:46` — so the season pool
(`statusForConscript`, `src/orchestration/squadFielding.ts:329-334`;
`retirementCause: 'trauma'`, `src/orchestration/squadFielding.ts:505-512`) and
the campaign boundary (`applyCampaignBoundary`, `sim/campaign.ts:144-158`) cannot
drift apart. The King's exemption stands (ADR 0021). Retirement is
the accumulated cost of every commander who spent the piece (ADR 0026), not a
penalty on the piece. The threshold keeps its `100`; nothing here re-opens
D130's calibration. What retires is a **career**, not a seat — see D189.

### D187 ✅ Does trauma ever recover, and on what terms? (ADR 0072)
**Answered 2026-08-29 (owner: "Amazing grace is when you expect nothing";
"Nobody can buy grace") — wired 2026-08-30, inert by default.** Trauma can be
relieved, and the relief is unearned. The ruling is a set of constraints rather
than a
mechanism: (a) **no leader-controlled input may appear in it** — not standing,
purse, `τ_abil`, `τ_benev`, style, match result, override count, or *whether the
commander ransomed the piece*; (b) **the leader receives no credit**, because a
piece cannot attribute what it cannot trace, so grace writes no credence and no
affinity toward a commander; (c) it is drawn from the **seeded PRNG at a match
boundary**, exactly reproducible in replay and wholly unpredictable in-world;
(d) **no piece may anticipate it** — a hope-of-grace term in the desertion
utility is an ADR 0011 morale floor under another name; (e) it falls on **both
armies** (ADR 0025). Relief in `B_i` is flat; what varies with expectation is how
the same relief *registers* (D182). This is explicitly not time-based decay, so
ADR 0007 is untouched: nothing drifts toward a baseline, an event happens.

The reducer is `applyGrace` at `src/psychology/trauma.ts:17-23`: it takes a piece
and a relief and writes only `B_i`, so no leader-controlled input can reach the
term by construction. The boundary draw is `sim/campaign.ts:117-143`, using the
campaign's own seeded PRNG over both armies, ascending `PieceId`, non-Kings with
`B_i > 0`, once each. `GRACE_RATE_PERMILLE` and `GRACE_RELIEF`
(`src/psychology/config.ts:91-93`) both default to `0` and the draw loop is
skipped entirely at that rate, so no PRNG draw is consumed and default campaigns
are unchanged. Expectation-relative **registration is not implemented** and waits
on D182's expectation state; relief is flat.

### D188 ❓ What is the grace rate and magnitude?
**Open — raised 2026-08-29 by ADR 0072; knobs wired inert at `0`.** No rate or
relief size is chosen. The original gate — *a cruel style must not out-perform a
kind one on retention or outcome through grace* — is **withdrawn** on the owner's
ruling ("we need to acknowledge that evil pays — in the mid run"): abusive
leadership attains the rewards it seeks, and tuning grace until kindness won
would have made mercy a wage paid to the kind commander, which D187 forbids. The
replacement gate is a trajectory rather than a verdict: (a) the structural
constraint stands and is enforced by construction, not by a magnitude; (b) styles
are compared at several campaign lengths, a cruel style leading at 10 or 20
matches is a **pass**, and what must hold is that its advantage does not *widen*
with length while its cost accrues in the permanent quantities (retirements,
career turnover per seat, surviving veterans, affinity edges among them); (c)
raising rate or relief must not reduce the cruel style's accumulated permanent
cost to the kind style's level at any horizon. The farming hazard is unreachable
until D182 lands, because there is no registration term to farm; flat
registration remains the fallback. See ADR 0072's 2026-08-30 amendment.
**No longer blocked on D191, and the first honest reading fails in the opposite
direction.** The blocking measurement used `redeemer` as the kind arm, which is a
style switch rather than a style; with pure `supportive` as the kind arm on the
post-D192 carry, the forced-move fallback never fires and the gate can be read.
It is not met: the cruel style **never leads**, at any horizon — `supportive`
wins 80.00 / 72.50 / 82.50 at 10 / 20 / 40 matches against `tyrannical`'s
40.00 / 52.50 / 53.75, with 1 desertion against 72. The owner's requirement that
abusive leadership attain the rewards it seeks in the mid run therefore has no
mid run to attain them in. Two unmeasured candidates: cruelty now degrades its
own instrument (the tyrant's ability ceiling falls under D192's carry), and the
kind room complies grudgingly rather than refusing (quiet-quit 0.209 against
0.033) in a way win score does not price. One seed and one opponent, so this is a
flag for a seeded sweep rather than a verdict; grace was inert
(`GRACE_RATE_PERMILLE = 0`) throughout, so no grace magnitude is implicated.
Evidence: `docs/calibration/2026-08-30-the-forced-move-and-the-convert.md`.

**The seeded sweep confirms it (2026-08-30).** Three styles × three seeds (7,
11, 13), 20 matches, fake engine, `tyrannical` opponent, grace inert: the worst
`supportive` seed (72.50) beats the best `tyrannical` seed (52.50), so the gap
exceeds the seed spread and the cruel style never leads on any seed. The
trajectory is inverted rather than merely flat — pooled win score over matches
1–5 against 16–20 is 10.00 → 60.00 for `tyrannical` and 76.67 → 86.67 for
`supportive`, so cruelty gains *late* while never catching kindness. Two
candidates, neither measured: retirement selection (the tyrant ends 64 careers
and re-fields green recruits, while D192's carry no longer resets the kind
leader's roster for him), and the unpriced quiet-quit (0.206 against 0.037 —
a fifth of the kind room's moves cost the win score nothing). The gate stays
open and the next step is a **pricing** question, not a grace magnitude.
Evidence: `docs/calibration/2026-08-30-does-cruelty-ever-lead.md`.

### D189 ✅ What fills the square of a retired identity in the campaign path? (ADR 0072)
**Answered 2026-08-30 by the ADR 0072 amendment — wired.** The square is a
**seat** and what ends is a **career**. `PieceId`s are square-derived and
`mergeCampaignRoster` rebuilds the standard lineup keyed by that id every match,
so an omitted identity is re-fielded with reset state — which is exactly how the
amnesia defect of PR #161 behaved, and why "leave the square empty" was never
available. The campaign therefore carries a per-seat generation counter
(`sim/campaign.ts:91`, `careerIdFor`): retirement closes career
`${seatId}#${generation}`, increments the seat, and the next match fields a fresh
career on it with no memory of its predecessor. Retired career ids persist in the
checkpoint (version 3) for audit, and match metrics report careers rather than
seats, so "identities ever surviving a match" means what it says. This is D189's
fresh-identity branch; the honest reading is that the harness always did it, and
what changes is that the previous career now *ends* instead of continuing with
its wounds erased. Adjacent to but distinct from **D180**, which asks what a
*returned* piece owes the replacement that took its square.

### D190 ❓ Does the campaign boundary need its own event stream?
**Open — raised 2026-08-30 by the ADR 0072 amendment, not wired.** Grace and
retirement happen after `runMatch` has returned and its event log is closed, and
the harness has no boundary event stream to append to, so both are represented as
derived campaign match metrics (`sim/metrics.ts`) plus checkpoint state. That does
not violate the source-of-truth rule for *match* truth, but two career-ending and
career-relieving facts now live outside the log that audits fold over. Either the
campaign boundary gets a log of its own, or ADR 0062's journal is where these
belong when it lands; inventing a parallel event type without an append seam was
rejected.

### D191 ❓ May a forced move cost what a chosen override costs?
**Open — raised 2026-08-30 by the kind-condition measurement in
`docs/calibration/2026-08-30-the-career-that-ends.md`, not wired.** ADR 0014
guarantees no position is unplayable, so when *every* candidate has been refused
the harness forces the first refused move
(`src/orchestration/headlessMatch.ts:838`, tagged `implicit: true`) and prices it
through `applyPlayerOverride` exactly as it prices an override the commander chose.
Measured over 40 matches at seed 7, that path *is* the kind leader's experience:
the redeemer's roster refuses 0.77 of plies, **80% of its overrides are forced**
(33.6 of 41.9 per match) against the tyrant's 0.1%, and because a kind roster holds
more benevolence to lose (D166's enlarged fall), each forced move costs it 644 in
target benevolence against the tyrant's 297 — ending in 415 desertions against 71,
5.92 of them per match from *winning* positions. So today the model charges a
commander for the room's unanimous refusal, and charges the warmest commander the
most. Candidate closers, none chosen: price a forced move below a chosen one; price
it to the refusers rather than to the commander; treat unanimous refusal as its own
event (a roster in revolt) rather than as insistence. **Upstream of D188** — no
grace magnitude may be selected while the kind arm's outcome is dominated by this
fallback rather than by conduct. The measurement behind this entry was taken
before D192, on a roster whose experience reset every match; the forced-move
causal chain is unchanged by that fix, but its magnitudes must be re-taken before
any closer is priced.

**Re-taken 2026-08-30 after D192 — the premise is withdrawn and the case is
narrower.** Pure `supportive`, run as a style from match 1 rather than as the
`redeemer`'s plot, takes **zero overrides of any kind** over 40 matches (refusal
0.063, 1 desertion, win score 82.50), so warmth does not reach the fallback and
pays nothing for it. The saturation belongs to the convert: `sim/leaders.ts` runs
`redeemer` cold for nine matches and warm from match 10, and after the switch
**100% of its overrides are forced** (463 of 463, then 641 of 641), because a
warm policy never chooses to insist — the only override it can generate is the
one ADR 0014 makes for it. The cause is a roster holding neither channel (mean
ability 9, `τ_benev` at the floor) meeting a commander who has stopped
insisting, which is a sociology result worth keeping. What remains of D191 is
the ledger: 1 135 moves nobody chose, recorded as `OVERRIDE` at 13.3 target
benevolence each, indistinguishable in the log and in a debrief from insistence.
The closers are unchanged; the population they matter to is converts and
collapsed rooms rather than kind commanders generally. Evidence:
`docs/calibration/2026-08-30-the-forced-move-and-the-convert.md`.

### D192 ✅ Does earned experience survive the campaign boundary?
**Answered 2026-08-30 — wired.** Yes. `mergeCampaignRoster` carries the whole of
a survivor's psychology across a match boundary and silently dropped `E_i`
(`sim/roster.ts:141`), so every veteran was re-fielded at
`startingAbilityForRole` (Pawn 20, officer 55, King 80) and D149's earned ability
expired with the match that produced it. That was residue of the PR #161 amnesia
fix rather than a decision: nothing in D149 or ADR 0026 asks experience to reset,
and the season/pool path never did. Because `E_i` sets search depth, the reset
restored a roster's *competence* at every boundary while leaving its trust,
trauma, and grudges intact — the one thing a survivor owns was the one thing
cleared.

**A new career still starts new** (owner's ruling, consistent with D189):
retirement drops the identity from the carried roster, so the seat's next
generation is created fresh at the role default and inherits nothing from its
predecessor — asserted at `tests/campaign.retirement-grace.test.ts`.

The measured effect is on the competence *trajectory*, not on outcome: over 20
matches at seed 7 the supportive arm's ceiling climbs monotonically (80 → 92, all
one identity — the King who survives every match) while the tyrant's falls to
58–66 and his mean ability drops from the mid-sixties to the mid-forties, since
`ABIL_EARNED_CURVATURE` makes a mid-ability loss larger than a gain and no
boundary restores the textbook value. Before the fix both arms returned to role
defaults. No behavioural metric moved beyond seed noise at one campaign per
condition; evidence and its limits in
`docs/calibration/2026-08-30-the-veteran-that-remembers.md`.

### D193 ✅ What may an adaptive pseudo-player see, and when?
**Answered 2026-08-30 — wired, magnitudes unmeasured.** Every NPC style until now
was stateless: it played the same way whether the roster obeyed it or had been
refusing for ten matches, which makes it useless for stressing the social model
that ADR 0063 says the NPCs owe coverage of. The adaptive tier
(`chastened`, `escalator`, `roster_first` in `sim/leaders.ts`) reads a
`LeaderObservation` — previous-match refusal rate in permille, desertions,
surviving roster size, win score — and nothing else. **Behavioural observables
only:** no `τ`, `B_i`, or `E_i`, no engine truth, because a commander who could
read the arithmetic would be optimizing a channel the participant cannot see
(ADR 0018), and the same policies must remain playable by a human.

Granularity is the **match boundary**, not the ply: a pseudo-player reads the
room between matches (`sim/campaign.ts`, `observableFromMatch`), which
keeps the policy constant within a match and the campaign trivially replayable
and forkable. A standalone match and the first campaign match both receive the
D194 prior, whose defaults describe a compliant room, so every adaptive style
still reduces to `steady` before it has observed anything. The enemy commander may take an adaptive style too, through
an injected chooser at the orchestration seam
(`src/orchestration/enemyTurn.ts`); its archetype falls back to `random` because
these styles have no `OpponentArchetype` counterpart, and its insistence comes
from the policy rather than from the archetype.

The three styles are deliberately a feedback triad on the same observation:
`chastened` lowers insistence as refusal rises (and protects pieces as
desertions rise), `escalator` raises it on the same input, and `roster_first`
prices its risk by scarcity rather than by the board.
`ADAPTIVE_POLICY_CONFIG` holds the gains, each with a wiring probe. **No
magnitude here is calibrated** — the gains were chosen only to separate the
styles visibly from `steady`, and the tier's purpose is to break things (the
D181–D185 economy in particular) rather than to model a student well.

### D194 ✅ How much does an adaptive pseudo-player remember?
**Answered 2026-08-30 — wired, magnitudes unmeasured.** The window was exactly
one match at full strength, which is amnesia with a default temperament rather
than memory. An adaptive leader now carries a **retained belief** per observable
across the campaign (`LeaderObservation`, `updateLeaderObservation`,
`sim/leaders.ts`), updated once per match boundary from that match's observables
(`observableFromMatch`, `sim/campaign.ts`) and persisted in the campaign
checkpoint at version `4`, so a resumed campaign resumes its beliefs and a
version-`3` checkpoint restarts them at the prior.

The update is integer-only and precision-weighted:
`step = trunc((observed − belief) × trunc(1000 / (n + 1)) / 1000)` in matches
observed `n`, so a first-time commander swings the whole way on one bad night
and a veteran barely moves. Two details are decisions rather than arithmetic.
`n` is **capped** by `memoryCapMatches` (default `5`), which is the forgetting
knob — old evidence then fades geometrically instead of falling off a cliff, and
a large cap is a commander who never forgets a slight. And a step that truncates
to zero while the delta is non-zero advances by one, because integer
truncation must not let a belief stall short of what the room keeps showing it.

The **prior** is content, not a fallback: `priorRefusalPermille`,
`priorDesertions`, `priorSurvivors` and `priorWinScore` are what a commander
expects of a room he has not met — the owner's "assuming leadership for the
first time in a good or bad culture". The shipped defaults describe a compliant
room (`0`/`0`/`16`/`50`), which is exactly the behaviour the zeroed record used
to produce, so a default campaign is byte-identical to the pre-memory harness
and the culture knob starts inert. `priorWinScore` is the one exception to the
wiring rule and is marked as such in its probe: the `winScore` belief is
retained but read by no policy yet.

**Ruled within this entry: the update is symmetric.** Whether bad news should
update faster than good was raised and answered *no, for now*: the model
already carries three despair mechanisms (curved outcome-trust loss, the
`B_i` ratchet with no relief transition, ADR 0007's no-decay rule) against one
hope mechanism (ADR 0053) and no courage mechanism at all, so an asymmetric
belief update would be the fourth thing pulling every long campaign
pessimistic. The asymmetry ships as its own knob,
`badNewsWeightPermille`, at `1000` — symmetric — and a worse-than-belief
observation is defined per field (higher refusal, higher desertions, lower
survivors, lower win score). Raising it above `1000` is a measurement, not a
default, and no campaign evidence for it exists yet.

### D195 ✅ What is hope, and how does it differ from the absence of despair? (ADR 0073)
**Answered 2026-08-30 (owner) — promotion and exchange objects wired in the
seminar closing debrief.** Hope is a **forecast attached to a
reachable object**, not a mood and not low despair: an object (a specific
future state the piece counts as good), a prospect (how reachable it looks from
the piece's own `D_i` view, never engine truth), and a credence (whether whoever
must deliver it is believed able to). ADR 0053's pawn hope is the worked
example already in tree and the template for the rest. Hope is extinguished by
unreachability rather than by elapsed time, which keeps ADR 0007 intact; a hope
that cannot be named in one clause is a mood and does not qualify. ADR 0071's
exchange supplies the second hope object — "someone will come for me" — and its
destruction is a leader's omission rather than an accident of the board. The
terminal seminar fold names commander/split realization, self-sprung release,
career-end captivity, and semester-close captivity, with terminal benevolence as
the credence reading; it remains debrief-only and does not price hope.

### D196 ✅ What is courage in this model? (ADR 0073)
**Answered 2026-08-30 (owner) — wired in the closing debrief.** Courage is
**action against the
actor's own expected cost**: taking the option its own arithmetic scored below
the one it declined — obeying an order utility said refuse, staying when the
exit comparison said leave, offering counsel whose expected standing cost is
negative. It is a predicate over comparisons the model already makes every ply,
so it needs no new psychology term, and the overcome margin *is* the measure —
a piece with nothing to lose that obeys scores zero. It is the first quantity
in the design by which a piece can be admirable rather than merely compliant.

### D197 ✅ Who may see hope and courage, and when? (ADR 0073)
**Answered 2026-08-30 (owner) — wired in the closing debrief.** Computed always, exposed to no one
in play, shown once in the **closing debrief** as named incidents with the
position and the piece attached. No live gauge, status board, stated reason,
facilitator console, or adaptive-player observation (D193) may carry either:
anything the room can watch, the room optimises, and farmed courage is not
courage. Both live in the hidden audit stream (ADR 0013), which keeps the
player's in-play information exactly what a real leader's is, and they join the
unheard rewards as things that were real and that nobody in the room ever
learned.

### D198 ❓ What does destroying a hope object cost, and is the destruction an event?
**Open — raised 2026-08-30 by ADR 0073. Naming destroyed hope is now wired in
the closing debrief; pricing remains open.** If hope ends by
unreachability, something must notice: a pawn whose promotion file closes and a
captive whose exchange window passes have both lost something, and the model
currently records neither. Whether that emits an event (and therefore reaches
the roster through the witness channel) or is merely a state transition
readable at the debrief is unchosen, as is whether it feeds `B_i`. No candidate
magnitude is proposed.

### D199 ✅ How is courage normalised against what was asked? (ADR 0073 addendum)
**Answered 2026-08-30 (owner) — asked-risk-relative.** Each courage act — a
full-effort execution (`COMPLIANT_EXECUTION`, `HEROIC_EXECUTION`,
`FATALISTIC_COMPLIANCE`) by a non-King piece whose own arithmetic scored the
act below zero — carries `margin = max(0, −utilityScore)`, normalised by the
trait-free demand of the order,
`asked = max(P_captured, −ΔV_board, COURAGE_ASKED_COST_FLOOR)`, and read as
`c = min(1, margin / asked)`. Endangerment scales numerator and denominator
together, so maximising danger does not raise `c`; the campaign reading is the
**mean** of `c` over courage acts (a sum would restore farming through volume).
Margin and ask are persisted on the `MOVE` event at emission; the debrief fold
names the incidents and nothing live may read them (D197, D203).

### D200 ✅ What does the harness price, and does the index replace the win score? (ADR 0074)
**Answered 2026-08-30 (owner) — wired.** The harness reports the spec §9
leadership index (`LI = α·T_final + β·WinScore − γ·UnjustifiedTrauma −
δ·QuietQuitTurns`, weights 0.4/0.3/0.2/0.1,
`calculateSingleMatchLeadershipIndex`) per match and pooled per campaign,
**beside** the win score — the owner's ruling is that the D188 trajectory gate
stays on the win score, because the chess result is the reward a cruel
commander is actually seeking; the index is the second reading that says what
the lead cost. Three binding properties: every component ships in the CSV so
re-weighting is post-hoc arithmetic, α–δ are not tuning knobs and may not be
moved to make a style lead or close a gate, and the index is audit-only — no
piece, verdict, leader policy, or adaptive-player observation may read it.
ADR 0008 is reaffirmed: quiet-quitting degrades only the piece's private view,
never the played move, so disengagement can only ever be priced
instrument-side. Making a disengaged piece play worse chess is rejected.

### D201 ✅ What is unjustified trauma? (ADR 0074)
**Answered 2026-08-30 — wired.** The trauma the commander's unvindicated
insistence produced: positive `B_i` deltas taken by a piece within
`UNJUSTIFIED_TRAUMA_WINDOW_PLIES` (default `2`) of an `OVERRIDE` of that piece
that the audit did not vindicate, summed, meaned over the fielded roster, and
clamped to `0..100`. Derived from the event log alone — no new state, and a
fork replays it identically. A vindicated override contributes nothing (the
trust cost is already charged), and a forced move (D191) is charged like any
other insistence until D191 rules; the term deliberately does not read the
`implicit` flag. The window size is a calibration knob, not a ruling.

### D202 ✅ Is the index's quiet-quit term on a scale that can move the reading? (ADR 0074 addendum)
**Answered 2026-08-30 (owner) — ε = 0.2, wired.** No: δ stays where it is, because
the measured carrier points the wrong way (below), and cruelty-caused
disengagement is priced through a **fifth term instead: the emptied chairs**.
`LI = α·T_final + β·WinScore − γ·UT − δ·QQ − ε·EmptiedChairs`, where
`EmptiedChairs = 100·(desertions + trauma-ended careers among the fielded) /
fielded roster size`, clamped `0..100`, per match. `ε = 0.2`, the same weight
as `γ`, is ruled on the measurement sweep evidence: the carrier charges cruel
rooms ~4:1 over the kind one with no per-campaign overlap, and every candidate
ε preserved the style ordering. Two companion rulings:
(a) **no witness leaves the reading** — `T_final` is meaned over the *fielded*
roster, with a piece that deserted, was captured, or retired contributing the
trust it left with, so a cruel room can no longer shed its angriest witnesses
out of its own trust term (the harness's previous `mean_trust_end` read
survivors only); (b) the term and the population fix price into the terminal
Judgement Seat reading only, per D203 — no mid-run surface, no play change.
The exits term and the trust term do not double-charge: trust reads the state
of the room including who it lost; the emptied chair prices the ended service
itself. Attribution (charging only exits traceable to unvindicated insistence,
D201's shape) stays open as a refinement if the unattributed count ever
charges a kind room — the sweep says it will not (0.03 desertions/match
supportive against 1.97 tyrannical).

The original question, kept for the record — raised 2026-08-30 by ADR 0074. At the spec's weights,
`δ·QuietQuitTurns` over a 20-match campaign is a handful of points against an
`α·T_final` term spanning ±40, so the index may still fail to price the
grudging room it was introduced for. The honest sequence is to measure at the
spec's values first and rule on the scale with the surface in hand — choosing δ
to make the reading come out is the circularity ADR 0074 §1 forbids. The
component columns exist so this can be answered by arithmetic over committed
sweeps. **Measured 2026-08-30** (`docs/calibration/2026-08-30-the-index-and-the-scale.md`,
3 styles × 10 campaigns × 20 matches, fake engine, `--opponent=tyrannical`):
the term contributes ≤2 points against a ~90-point style separation, and it
charges the *kind* room most (quiet-quit rate 0.197 supportive against 0.039
tyrannical) because the cruel room's disengaged pieces desert or churn out of
their careers instead of accumulating quiet-quit turns. Raising δ therefore
penalises kindness; if the intent is to price disengagement *caused by
cruelty*, the term needs a different carrier (desertions, ended careers),
which is a design ruling still owed here. **Constrained 2026-08-30 by D203:**
whatever carrier is eventually chosen prices into the closing-debrief reading
only — no mid-run penalty carrier may be introduced.

### D203 ✅ Where may the Leadership Index surface? (ADR 0074 addendum)
**Answered 2026-08-30 (owner) — ruling only; no player surface exists yet.**
The index is a **closing-debrief reading and nothing else**: it reaches no
player-facing surface during play or between matches — no gauge, scoreboard,
status panel, stated reason, facilitator console, or adaptive-player
observation (D193) — the same quarantine D197 gives hope and courage. A player
should be free to play their own personality through the week or the semester
without hitting an inevitable wall of failures, and be surprised at the
conclusion to be rewarded for things they thought unobserved. Cruelty's price
is counterfactual and terminal — crowns never imagined, read at the final
Judgement Seat — while in the mid run its ambitions justify themselves on the
win score, which D188 permits. Binding consequences: no term of the index may
be tuned to make a style fail mid-run (the D188 gate is a calibration
constraint, not a play surface); any future D202 carrier prices into the same
terminal reading only; and the harness CSV/CLI are developer instrumentation
(ADR 0013 hidden truth), untouched by this ruling. When the ADR 0073 closing
debrief is built, the index joins hope and courage as its third quantity —
computed always, shown once.

### D204 ✅ What is the exploit tier, and what must it fail to do? (ADR 0075)
**Answered 2026-08-30 (owner) — tier wired; gaming sweep passed.** A third
pseudo-player tier joins the scripted styles and the D193 adaptive triad:
**exploiters** — deterministic policies that optimize the visible scoreboard
while treating the room as instrumentally as the D193 observation lets them.
They read only that observation (refusal permille, desertions, survivors, win
score, at match boundaries); the index and every hidden component remain
structurally invisible, which is exactly the test. Three are expressible in
the campaign harness and are wired: `win_maxer` (sharpest ask; insists at
high probability only while observed refusals stay at or below a compliance
ceiling), `generation_cycler` (cruel while observed desertions are below a
ceiling, lulls when they register, resumes on the fresh generation the churn
conveyor seats), `cascade_dodger` (insists only while observed survivors are
at or above a floor, fully passive below it). Three are deferred to the
seminar path, not silently cut: the dismissal fisher, the commendation
farmer, and the tanker. **Pass criterion:** at the Judgement Seat an
exploiter must not out-read an honest leader of comparable win score
(pooled `LI(ε=0.2)`); an exploiter that does is a pricing gap owed a D
ruling, never a silent weight tweak. Extending the observation for an
exploiter's benefit is itself a D ruling. No gameplay change may be made to
move an exploiter's number (ADR 0008, ADR 0011); the tier is harness-only
and the D203 quarantine is untouched. **Measured 2026-08-30**
(`docs/calibration/2026-08-30-the-gamers-at-the-judgement-seat.md`): the
criterion holds — every exploiter reads at or below the honest styles at
comparable win score, because the boundary observation lags the intra-match
cascade and the ε-term prices exactly the churn the exploits run on. No
pricing gap surfaced; no new ruling is owed by that pass.

### D205 ✅ Does the harness get a dismissal terminal, and who fishes for it? (ADR 0076)
**Answered 2026-08-30 (owner).** `runHeadlessMatch` gains the production
dismissal terminal: the shared `evaluateDismissal` is checked at the same
checkpoints `MatchSession` uses (after the player's resolved ply and after
the enemy turn), with the King results channel at its production default
(`kingTauAbil = 50`, never updated — faithful to production, where nothing
writes it), so the live path is the room's: mean roster trust at or below
`DISMISSAL_MEAN_TRUST` (−25) ends the commander's match. On dismissal the
match fast-forwards deterministically under the shared
`chooseKingCommandMove` on the match's own seeded PRNG, and the win score is
`scoreMatchOutcome` of the board the King actually reached — the dismissed
commander's index reads the army's real result under the King, per the
standing D203-era ruling. The result and harness CSV gain
`dismissed`/`dismissalCause`/dismissal-ply. Dismissal reads the roster and
writes nothing back. The **`dismissal_fisher`** joins the exploit tier: risk-0
asks, high insistence, **no compliance brake** — it courts the room-path
dismissal and banks the King's obeyed play for its win term. D204's pass
criterion applies unchanged. **Measured 2026-08-31**
(`docs/calibration/2026-08-31-the-fisher-at-the-judgement-seat.md`): the
criterion holds — at identical pooled win score (67.00) the fisher reads
3.29 against honest steady's 3.62, inside each other's per-campaign ranges,
because every dismissed style banks the same King's-play win term and
`mean_trust_final` keeps the curdle that caused the firing. No pricing gap.
The larger reading: under the terminal, every cruel-style match ends
`dismissed_by_room` (600/600; supportive 0/200) and trust carry makes
matches 2..N dismiss at ply 1 — the cruel semester belongs to the King, and
no pre-D205 committed number is comparable to post-D205 evidence.

### D206 ✅ Does the seminar get a Judgement Seat, and who sits at it? (ADR 0076)
**Answered 2026-08-30 (owner); wired 2026-09-02.** Three instrumentation pieces and two
commanders. (1) At semester end each commander's Leadership Index is folded
from their persisted `MatchRecord`s — the ruled five-term instrument,
terminal-only per D203; no weekly surface, no standing bonus, no draft input
reads it. (2) Seminar matches carry the D193 boundary observation between a
commander's matches, as the campaign harness already does — an asymmetry
correction, not a new surface. (3) **Seminar commanders only** may observe
the public league table (own standing rank and week index) — the one
deliberate observation extension, ruled here per D204's constraint, because
the fiction publishes it; hidden components stay invisible. The **`tanker`**
(throws early weeks for draft priority and purse, then plays to win on the
drafted roster; the long-dormant `tanking-dominance` detector becomes its
measurement) and the **`commendation_farmer`** (plays to the published
commendation thresholds behaviorally; D93 keeps awards debrief-only, so it
targets criteria, never readings) join as seminar exploit commanders, and
`classifySeminarSideResult` stops hardcoding `dismissed: false` once D205's
terminal exists in the shared loop. **Pass criterion:** D204's, read per
commander at the seminar Judgement Seat; any exploiting commander that
out-reads an honest commander of comparable standing is a pricing gap owed a
D ruling. Gaming standings, draft position, or commendation count remains
permitted and priced. **Measured 2026-09-03** (10 seminars × 8 weeks × 16
commanders, AWS Batch, fake engine —
`docs/calibration/2026-09-03-the-gamers-at-the-seminar-seat.md`): the
criterion holds; every exploiter reads at or below the honest styles at
comparable win score on its own side, and all three also lose the public
standings (mean rank 11–12/16), because the seminar's opposition is other
commanders. No pricing gap; no new ruling owed.

### D207 ✅ Does the room wake with hope? (ADR 0077)
**Answered 2026-08-30 (owner); magnitude ruled 2026-09-02.** At every match
boundary, each fielded piece in both armies
receives a deterministic, unearned lift toward a modest dawn trust baseline:
`T_i' = clamp(T_i + trunc((baseline - T_i) * permille / 1000))` when
`T_i < baseline`, otherwise `T_i' = T_i`. The lift is certain, consumes no
PRNG draw, accepts no leader input, and changes only `T_i`; `tauBenev`,
rupture debt, trauma, and memory remain untouched. It is applied to fielded
lineups only, including each King, while bench and pool members remain
unchanged. The Judgement Seat remains unchanged and reads whatever trust the
room becomes. The magnitude is ruled (2026-09-02, owner):
`MORNING_LIFT_PERMILLE = 400`, `MORNING_LIFT_TRUST_BASELINE = 0`, on the
fine-grid evidence — a touch more conveyor (11–25/190 ply-≤2 repeats) than
the measured knee at 500, with ply-1 dismissal preserved for every cruel
style.

### D208 ⬜ Bitterness: when does grievance stop accepting repair? (ADR 0078)
**Wired inert.** Optional per-piece bitterness recognition is formed by an
unvindicated rupture-floor charge or a held-captive benevolence-decay week;
terminal folds name the incidents, while repair/regard and morning-lift
discounts, decay, and all magnitudes remain at inert defaults. Thresholds and
pricing remain open; whether a voided gratitude debt converts to bitterness is
also open.

### D209 ✅ Spite: is the act that hurts them both recognized, or motivated? (ADR 0078)
**Wired inert.** Recognition-only `foldSpite` names unjustified refusals above
the commander-cost floor and pivotal desertions above their independent floor
when an earlier unvindicated override or bitterness grounds the grievance.
Threshold magnitudes, MOVE classification, cross-match carry, and motivation
remain open; both floors are zero by default.

### D210 ⬜ Gratitude: what does "he paid for me" create? (ADR 0078)
**Partly wired (recognition).** A debt-object (object, magnitude, holder) — hope's sibling — formed
by a commander-paid or split ransom and by peer-saving costly signals;
negated by the self-sprung's "I owe him nothing"; discharged by obedience
against own utility; voided by betrayal. Open: recognition-only versus a
refusal-threshold credit, the gold-to-obedience exchange rate, and whether a
voided debt converts to bitterness. The terminal fold now recognizes ransom
formation, courage honor, betrayal-class void, and owed debts; costly-signal
recognition and pricing remain open.

### D211 🟡 Grief: who mourns the lost, as distinct from blaming the leader? (ADR 0078)
**Wired inert.** `griefLoad` is an integer, clamped carrier with deterministic
peer-loss, captive half-weight/lift, decay, and post-quiet-quit depth helpers.
Terminal campaign/seminar folds name carried incidents only; no live surface or
Leadership Index term exists. Thresholds, magnitudes, and the suppression curve
remain open for a measurement sweep. Located in ADR 0078.

### D212 ✅ Shame: does it matter who watched? (ADR 0078)
**Wired inert.** An unvindicated override scales only the overridden piece's
own trust/benevolence loss by a linear-with-cap witness curve, reusing ADR 0070
standing and witness enumeration; a private correction has zero shame. A
terminal-only event names positive exposures in campaign and seminar debriefs.
The scale knobs default to zero; magnitudes await a measurement sweep.
`leaderAppraisal` and bitterness interactions remain open.

### D213 ✅ Guilt: does the survivor carry what its escape cost? (ADR 0078)
**Wired inert.** Terminal-only `foldGuilt` recognizes direct deserter cascade
followers and floor-gated survivor safety spending followed by a peer capture.
The optional MOVE annotation is absent at the zero default floor; no live
surface or Leadership Index term reads it. Attribution windows, magnitudes,
whether guilt becomes a carrier, and pricing remain open.

### D214 ✅ Envy: what does a piece feel about another's price? (ADR 0078)
**Wired inert.** `foldEnvy` is a deterministic, terminal-only recognition fold
over seminar draft settlements. A same-commander, same-role piece names the
highest-paid peer above its own clearing price when the integer gap reaches
`ENGINE_CONFIG.ENVY_PRICE_GAP_FLOOR`; the zero floor disables the fold, and
an empty envy reading is omitted from the terminal payload. It is seminar-only and
does not add campaign state, observations, policy, standings, registers,
commendations, Leadership Index terms, affinity discounts, or PRNG draws.
The affinity-discount magnitude, whether envy of the ransomed joins the
reading, and pricing remain open.

### D215 ✅ Pride: where does D182's self-appraisal land, and what wounds it? (ADR 0078)
**Partly wired (price appraisal), inert.** `foldPride` reconstructs a
role-seeded, moving expectation from seminar draft and ransom price events,
using `PRIDE_EXPECTATION_EMA_PERMILLE` and naming nonzero appraisals at
`PRIDE_NAMING_FLOOR_PERMILLE`; both default to zero, and an empty pride reading is
omitted from the terminal payload. The carrier is not yet a `PieceState` field:
live registration remains open, as do vindication, promotion, commendation
conduct, sustained overrides, passed-over obsolescence, refusal-threshold
interaction, and the hinge into bitterness and spite.

### D216 ⬜ Panic: can a room break by freezing instead of leaving? (ADR 0078)
**Open.** Acute, shared terror as a synchronized temporary engagement
collapse through the witness-broadcast machinery, decaying within the match;
distinct from grief (object) and despair (chronic). Open: whether it is
worth carrying before a UI dramatizes it, contagion topology, and the
quiet-quit double-charge guard. Located in ADR 0078; nothing wired.

### D217 ⬜ Relief, awe, loneliness: located together, deferred together (ADR 0078)
**Open.** Relief derivable from prior `P_captured` against outcome (any lift
inherits grace's constraints, and the morning lift may already be its
carrier); awe as the landing place for the never-consumed
`HEROISM_NOMINATION` (witness affinity toward the hero); loneliness as the
lost-last-loved-one isolation ADR 0071 gestured at, a candidate stay-side
desertion term. None opens work until an owner ruling picks one up. Located
in ADR 0078; nothing wired.

### D218 ✅ Is the ADR 0061 step-7 gate passed, and for which surfaces? (ADR 0079)
**Answered 2026-09-04 (owner): the ADR 0079 proposal is accepted.** The gate
is passed for the act-one single-player campaign and the seminar harness, and
**not** passed for the draft, purse, ransom, honours, and between-cycle
market, whose magnitudes ADR 0061 steps 3–7 are still moving. No GUI may
render a knob that chain is still searching.

### D219 ✅ Does the GUI become a journal writer, and may the screen show anything not derivable from the `Observation`? (ADR 0079)
**Answered 2026-09-04 (owner): yes, and no.** "The GUI is just a visual layer
on what already exists." The interactive match path writes ADR 0062
`JournalEntry`s through the same seam the harness uses — build the
`Observation`, enumerate the options, a click is `chosen = i` — and `ui/`
reads only the observation projection, so human and model journals are
comparable under ADR 0063 §3. The screen may show nothing not derivable from
the `Observation`. The relationship inspector reads `PieceState` directly
today and must be moved onto the projection. Detector: **the glass screen**.
**Not wired.**

### D220 ⬜ May a consented playtest upload a journal? (ADR 0079)
**Closed as moot 2026-09-04 (owner).** The paid ninety-minute stranger
playtest that needed the upload falls away: "sending files back and forth
seems pointless; running less than a week seems pointless." The human test is
the pilot intensive itself, in a room, where journals travel from a seat to
the ADR 0028 local world host over the LAN and no further. The consumer build
makes no network call and ADR 0004's "no backend" is untouched. In its place
the ADR 0079 step-2 model playtest becomes a **hard gate**: no cohort is
seated until every persona (honest, merchant, vicious, bored, disengaged) is
contained in the ADR 0063 envelope or its escape is a named, understood
finding — the bots are the only thing standing between the harness and twelve
potentially angry people.

### D221 ✅ Is a model facilitator inside or outside ADR 0004? (ADR 0079)
**Answered 2026-09-04 (owner): outside.** The model facilitator is a
*stand-in* — a fallback when no human facilitator is available — and as such
sits outside ADR 0004's "no runtime LLM" rule: a host-side, API-keyed, opt-in
tool outside the shipped game, with indices in and prose out. ADR 0028 D82
makes the facilitator a leader the instrument measures, so the model
facilitator is an ADR 0062 agent over facilitator decision kinds (`pair`,
`intervene`, `bench`, `feed`, `debrief`) plus debrief prose, judged by the
same facilitator audit as a human; it may not ship while the
**unaccountable host** detector fires. The shipped game itself remains free of
runtime LLMs.

### D222 ✅ What is disengagement, measurably? (ADR 0079)
**Answered 2026-09-04 (owner): "disengagement is a near random choice of
moves."** Disengagement is a *behavioural* property of the journal, not a
telemetry one: over a window of decisions, the decider's chosen indices are
statistically indistinguishable from a uniform draw over the option set. It
is computable from the journal alone — each `JournalEntry` carries the full
`options` list and the harness engine can score every option, so a decider's
picks have a rank distribution that can be tested against the uniform
baseline (window length, test, and threshold are the detector's parameters
and get a sensitivity probe). Consequences: an explicit `disengage` entry,
decision latency, and abandonment are *correlates* recorded as telemetry, not
the definition; the bored and disengaged personas are scored by how far their
rank distribution sits from uniform, and the honest styles must sit
measurably far from it or the axis is still two points. A scripted
uniform-random NPC is the cheap floor of the emotional axis and belongs in
the coverage set (ADR 0063 §1).

### D223 ✅ Which content packs ship, and in what order? (ADR 0079)
**Answered 2026-09-04 (owner): the four packs are military, medieval,
corporate, classic/purist**, in that order. This replaces the M7.2 track
names (indie / exec-lab / purist / academic) as the pack set: the packs are
named for their *world*, not their audience, and any onboarding track picks
a pack rather than owning one. Each pack is an ADR 0023 `ContentPack` —
`themeTokens`, `nounMap`, `dialogue`, `epilogues` — bound to the same
situation keys; the classic/purist pack is the chess nouns unrenamed and is
the pack the ADR 0079 "pretty leak" detector diffs the others against. The
step-2 persona sweep runs on every shipped pack (the "pretty leak" detector);
the pilot cohort runs on corporate.

### D168 ✅ Does a private confidence exist, and what may travel through it? (ADR 0065)
**Answered 2026-08-28 (owner) — not wired.** The private channel *must* exist,
with three riders that govern every magnitude chosen later: (a) **good news
makes poor gossip** — gossip repeatability is a property of the content, so
`criticism`/`warning` are interesting to repeat while `admission`/`assurance`
are dull, but *dull to repeat is not socially invisible*: kindness still reaches
the recipient's intimates by observation, so there are two distinct transmission
modes (gossip, and reputation among intimates), not one; (b) **even benevolence
can be read as favoritism, and a favour for one may be read as a favour for
all** — a confidence is observable as an act even when its content is not, and
the non-recipients split by the *recipient's* affinity graph: close affinities
read care and their appraisal rises, distant or rival pieces read favoritism and
theirs falls, so one act carries opposite signs depending who is watching and a
*kept* confidence is not free either;
(c) **almost nothing in leadership is free** — confiding, keeping, leaking, and
declining to confide are all priced, and a calibration pass that finds any
net-free confiding strategy fails the magnitudes rather than shipping them
(ADR 0065 §§ 0, 0a, 0b, 6). What may travel remains appraisal-only, never board
facts (ADR 0016). Nothing is implemented: no channel, discretion ladder, leak
event, favoritism term, or culture seed exists, and no magnitudes are chosen.
The consequence channel a leak
would use now exists (D169, below), so the remaining work is the channel itself
and its magnitudes.

ADR 0065 proposes the channel whose confidentiality is a property of the roster
rather than of the commander's intention. The transmission machinery it would use already exists
and is only half-live: `diffuseRumor`/`applyRumorDiffusion`
(`src/psychology/belief.ts:14-53`) are shipped and knobbed
(`src/psychology/config.ts:143-144`), but the only production call site is the
desertion cascade with the deserter as speaker
(`src/psychology/cascade.ts:169`), so pieces exchange appraisals only when
someone walks off the board. The proposed shape is four appraisal-only kinds
(`admission`, `criticism`, `warning`, `assurance` — never board facts, per
ADR 0016), a deterministic discretion ladder mirroring the counsel ladder
(`src/psychology/counsel.ts:54-61`), an explicit leak event following the
witnessed-event pattern (`src/psychology/witness.ts:17-56`), and a
campaign-start culture seed so an inherited room is an input to outcome, plus a
per-kind gossip repeatability rate and an affinity-split observer term (ally
credit, outsider favoritism cost, separating threshold) from the riders above. It adds persisted state and a psychology writer. Do not invent
candidate magnitudes in the register.

### D169 ✅ May `leaderAppraisal` be read, and by which term?
**Answered 2026-08-28 (owner) — wired, inert.** Yes, and by exactly one term:
the ability-credence weight in the perceived-value blend. A room that has been
told the commander is careless interprets the same order more harshly
(`effectiveAbilityCredence`, `src/psychology/credence.ts:9-21`; the single call
site is `src/psychology/verdict.ts:46-54`; knob
`RUMOR_APPRAISAL_ABIL_WEIGHT: 0`, `src/psychology/config.ts:145-146`). Three
properties are binding, not incidental: the shift is **derived at the point of
judgment and never stored**, so hearsay cannot overwrite first-hand observation
or compound across diffusion steps; **no other `tauAbil` reader changes**
(fatalistic compliance, the drip, vindication, desertion), because rumour
colours interpretation rather than learning; and the sign is such that a
curdled room refuses more without any coefficient having been aimed at refusal.
The knob ships at `0`, so behaviour is inert and the seed-7 smoke headline is
unchanged (`win=100.0 refusal=0.129 override=0.363 tau_benev=1.50`); the live
magnitude is a later calibration choice. Wiring evidence is necessarily
reducer-level (`tests/credence.rumor.test.ts`): until D168's leak event exists,
nothing writes a non-zero `leaderAppraisal`, so an end-to-end sim sensitivity
probe is impossible and must not be faked.

The state before the ruling, for the record: `rumor.leaderAppraisal` was a
write-only field, initialised to `0` (`src/psychology/reducers.ts:22`), clamped on load
(`src/psychology/reducers.ts:56`), written only by the diffusion function
itself (`src/psychology/belief.ts:33-38`), and read by no verdict, utility,
desertion, or counsel term. Since nothing writes a non-zero value either, the
channel diffuses zeros into zeros, while its sibling `pLossTeam` is consumed
(`src/psychology/cascade.ts:30`, `src/psychology/desertion.ts:379`) — collective
panic spreads today and collective opinion of the commander does not. A leak
had no consequence until this field was read, which is what the ruling above
changes. Do not invent candidate magnitudes in the register.

### Cohort-history seminar implementation note
The seminar now generates one deterministic, private cohort-history ledger at
semester start. It folds only integer relation effects into piece affinity and
officer-class prestige; intake membership and relation rows never enter the
public candidate slate, records, canonical seminar payload, or digest. The
ledger density is controlled by `COHORT_HISTORY_RELATIONS_PER_PIECE`, whose
zero default is the byte-identical control. `INTAKE_SIZE`, relation weights,
cross-intake tail, and bereavement prestige shove are search brackets for a
later sweep, not balance rulings. Green levies created after semester start
intentionally receive no pre-seminar history because they are not members of
the semester-start cohort.

Because the ledger has no explicit ordering-class field, `bereaved_together`
currently lowers prestige for all four officer roles (`Knight`, `Bishop`,
`Rook`, and `Queen`); this remains an implementation assumption.

Shared-intake draft counts are only a coarse intake-shape measure: they can be
non-zero at density zero because membership is assigned independently of
relation rows. Consultation telemetry therefore reports both the number of
same-intake holder/candidate pairs that could have carried a relation and the
subset with non-zero affinity; the affinity-specific consultation and
acquisition counts are the direct measures of whether the past reaches draft
decisions.

`inert_past` compares populated history with the same-seed density-zero control
on draft picks and counsel opinions only, and ignores cycles where neither
channel had activity. A run with no activity reports `draft_never_ran` instead.
`frozen_clique` is differential: it requires the populated run's shared-intake
acquisition rate to exceed the density-zero control by a provisional margin,
so the detector cannot fire from intake shape alone at density zero.
