# AGENTS.md — AI Agent Guidelines for The Kings and I

## Repository Purpose
*The Kings and I* (internal codename: Living Chess): chess where the pieces have
persistent identities, memory, trust, class prejudice, and the ability to refuse
orders or walk off the board. Doubles as a leadership-dynamics simulation.
**Status: Core match, psychology, persistence, narration, and headless
world/season slices are in tree; the target community/seminar system is not
fully shipped.** Use `docs/adr/IMPLEMENTATION_STATUS.md` as the authoritative
decided-versus-shipped matrix. In particular, commander-keyed credence,
persisted engine audit truth, capture trauma, the shared community/free-agent
model, and facilitator/cohort host surfaces are not all wired. Do not infer
implementation status from an ADR or the decision register alone.

## Read This First
| Doc | Purpose |
|---|---|
| `docs/design_decisions.md` | Decision register — what is settled, what is open. **Check before implementing anything.** |
| `docs/architecture.md` | Target layering and move pipeline |
| `docs/psychology_engine.md` | Math spec restated + reconciliation issues (§10) |
| `docs/spec/psychology-engine.reference.ts` | **Normative** equations, thresholds, coefficients |
| `docs/trust_dynamics.md` | The competence trap: outcome→trust loop, costly signals, intended spiral |
| `docs/desertion_model.md` | Why a piece quits the board; the intended cascade |
| `docs/credence_model.md` | D19: trust as the weight on the leader's judgment |
| `docs/belief_model.md` | How a piece imputes the position — perception, memory, rumor |
| `LICENSING.md` | Dual-license terms and the Stockfish GPL constraint |
| `docs/engine_licensing.md` | `EnginePort`, engine swap strategy, verified permissive candidates |
| `docs/data_model.md` | Entities, Dexie schema, identity rules |
| `docs/development_plan.md` | Milestones 0–8 and their exit criteria (incl. **Milestone 5b**) |
| `docs/calibration/2026-08-13-blocked-on-measurement.md` | **Current state: the model is degenerate for cold styles and the measurement pipelines are broken.** Read before planning calibration or new mechanics |
| `docs/calibration/2026-08-13-cross-style-table.md` | All nine leader styles measured on 248cd08 — collapse is style-invariant and attrition is saturated; compute footprint is bounded. **Superseded by the 08-26 coverage pass:** outcome is no longer style-invariant |
| `docs/calibration/2026-08-26-npc-coverage-and-the-envelope.md` | The nine-style span at the `random` opponent; its outcome-ceiling reading is superseded by the 08-27 pass. Still current for the per-style compute spread (10 s–348 s per match, fake engine) and the promotion-column CSV corruption |
| `docs/calibration/2026-08-27-the-competent-opponent-and-the-two-axes.md` | **Read before any coverage sweep:** sweeps run `--opponent=tyrannical` (the 100.00 four-way tie was a `random`-opponent artifact; win score there ranges 10–82.5), the care/insistence quadrants are now populated, and the emotional axis is *still* two points, so **no containment number may be quoted** |
| `docs/calibration/2026-08-28-the-curdle-and-the-floor.md` | **Read before ruling D166:** ~half of all overrides cost the roster nothing because benevolence is already clamped at `0`, most plies are played after that point, and 78–87% of the loss falls on witnesses rather than the overridden piece — the structural question is D167 |
| `docs/calibration/2026-08-15-desertion-gradient.md` | **Why style does not change the exit decision:** λ cancels out of the desertion comparison, the discriminator is an attachment knife edge at `tauBenev = 50`, and `DESERTION_STAY_ATTACHMENT_PERMILLE` (D145) measures the fix |
| `docs/calibration/2026-08-16-exit-cost-asymmetry.md` | **Historical D146 diagnosis before ADR 0052:** desertion removed the piece just as capture did without an own-future cost, `P_captured` was a threat flag rather than a probability, and pawn standing was 0 by construction |
| `docs/calibration/2026-08-16-exit-permanence-sweep.md` | **D146 default selection:** the CI-seed measurement adopts exit permanence `625`; seed-7 `750` was unsafe at the smoke boundary |
| `docs/calibration/2026-08-17-harness-plays-chess.md` | Harness diagnosis and before/after measurement: repetition truth, pawn advancement, and promotion telemetry |
| `docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md` | Current re-baseline evidence: every calibration opponent was `random`, saturating win score and invalidating `plain_chess_win_delta` |
| `docs/calibration/2026-08-10-state-of-play.md` | Previous harness numbers; tyrannical figures superseded by the 08-13 pass |
| `docs/calibration/milestone-3-engine-wired.md` | Historical post-wiring calibration report |
| `docs/adr/0052-exit-cost-and-capture-probability.md` | D146 exit permanence and static-exchange capture-risk specification |
| `docs/adr/IMPLEMENTATION_STATUS.md` | ADR 0035–0054 decided vs shipped |
| `docs/adr/0053-pawn-hope-and-posthumous-credit.md` | D147 pawn hope, capture truth, and posthumous class credit |
| `docs/calibration/2026-08-18-pawn-hope-sweep.md` | D147 promotion-hope and credence-floor calibration; raw sweep artifacts retained externally |
| `docs/adr/0054-the-seminar-pool-and-what-a-player-knows.md` | D148–D150 seminar-pool direction and open decisions |
| `docs/adr/0062-the-decision-journal-and-the-llm-player.md` | How a model may play at all: offline journal, enumerated options, no live LLM |
| `docs/adr/0063-two-duties-coverage-and-containment.md` | **The NPCs owe coverage, the models owe containment;** D159–D164 answered, D165 answered by ADR 0064 |
| `docs/adr/0064-the-cushion-and-the-repair.md` | **Care cushions benevolence and rupture can be repaired;** D165 and D166 answered, with regard and repair live |
| `docs/adr/0065-the-confidence-and-the-culture.md` | **D168 and D169 ruled; only the D169 consumer is wired, and it is inert:** a private word that may not be kept. The channel must exist; good news makes poor gossip but still reaches the recipient's intimates; a favour for one reads as care to close affinities and as favoritism to the rest; no act in it is free. `leaderAppraisal` is now read by the ability-credence weight (derived, never stored) behind a zero-default knob; rumor diffusion still runs only in the desertion cascade, so nothing writes a non-zero appraisal yet |
| `docs/adr/0066-the-floor-under-the-curdle.md` | **D167 ruled, partly live:** the witness broadcast stays (being rough on one piece curdles the room), the proportional cliff is live at its D166 magnitude, and D170/D174 are ruled by ADR 0070 with their mechanism live under D176 at multiplier `500` and standing price `2000`. The rupture-debt ceiling remains inert under the repair-versus-accrual constraint, and D175 is ruled: the asymptote truncates down and is accepted as shipped behavior |
| `docs/adr/0067-the-cold-engine-contract.md` | **D171 ruled — the engine is cold:** Lozza's transposition table survived between searches, so an evaluation depended on the search history while the cache key and the query barrier assumed it did not. The engine is now cleared (`ucinewgame`) before every search, the cold/warm policy is part of `determinismId`, and the ladder LRU may be bounded. **Every Lozza number in `docs/calibration/` was taken warm and is re-baselined; do not quote it beside a cold run.** Fake-engine evidence is unaffected |
| `docs/adr/0068-the-runaway-and-the-unsound-score.md` | **D172 ruled — the artifact is patched and the engine is not believed.** Lozza's aspiration loop never returns once the window is maximal (two conditions, carried as a recorded diff under `vendor/lozza/patches/`, upstream `namanthanki/lozza#4`), and the deeper defect is that a root search can return `INF` — reported as `score mate -500` and previously parsed into a plausible *losing* score for a won position. An implausible mate distance is engine unsoundness, answered by a deterministic re-search one ply deeper (at most twice, then a loud failure); `mate 0 → 29_999` is withdrawn. The adapter's runaway guard is an output-volume ceiling that **fails**, never truncates, and never a wall clock or a bindable `nodes` budget. **Lozza evidence from before this ADR carries a different artifact hash — do not quote it beside evidence taken after it** |
| `docs/adr/0069-the-canonical-ladder-rung.md` | **D173 ruled — the rung is the value:** ladder reuse remains the shipped policy, so its identity is recorded in the Lozza and Stockfish `determinismId`; both broker per-position caches are bounded under the cold contract, and a future ADR 0062 fork must replay the parent's per-piece `D_i` and ladder search depths |
| `docs/adr/0070-graded-witness-loss-and-standing-price.md` | **D170 and D174 ruled; D176 ruled in the dated addendum:** each witness prices the overridden piece through its own affinity and class prestige, standing can only raise the witness charge, and the mechanism is live at multiplier `500` and standing price `2000`. The ruling is ledger-focused, not a demonstrated conduct improvement |
| `docs/adr/0071-captivity-and-the-exchange.md` | **D177/D181/D183 wired in the seminar path only:** captures may remain as a private **fengr**, draft **hlutr** clearing prices pay piece cash (the exact ruling is “Pieces first get paid during the draft”), and the cycle-purse ransom round credits captors while exposing only who came home. Hold and benevolence-decay knobs are off/inert by default; campaign and season remain disabled. Exchange hope is now a terminal-only debrief fold. The v1 redemption ordering is harness policy, not doctrine. D182 self-appraisal magnitude/registration, D184, D185, and captor affinity remain open; weregild was considered and rejected because ransom prices a return, not a life, and wælreaf is the foreclosed spoils alternative |
| `docs/adr/0072-retirement-and-grace.md` | **D186 and D187 ruled; retirement live, grace wired inert (2026-08-30 amendment):** trauma at `ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD` permanently ends a non-King **career** on every path, including the campaign boundary, and one threshold now serves both paths. **A square is a seat and a career is a seat plus a generation** (D189 answered): retirement closes `${seatId}#${generation}`, increments the seat, and the next match fields a fresh career with no memory of its predecessor. Trauma relief exists as **grace**: unearned, unpurchasable, no leader-controlled input in the term (not standing, purse, credence, style, result, or whether the commander ransomed the piece), no credit to the leader, drawn from the campaign's seeded PRNG at the match boundary, never anticipated (ADR 0011), falling on both armies; `applyGrace` writes only `B_i` and relief is flat — expectation-relative *registration* waits on D182. `GRACE_RATE_PERMILLE`/`GRACE_RELIEF` default to `0` and consume no PRNG draw. **D188's old gate is withdrawn** on the owner's ruling that evil pays in the mid run: the gate is now a trajectory (a cruel style may lead at 10–20 matches; its advantage must not widen, its permanent costs must accrue, and grace may not flatten them). **D190** (the boundary has no event stream, so retirement and grace are derived metrics) is open |
| `docs/adr/0073-hope-courage-and-the-closing-debrief.md` | **D195–D197 ruled; D199 wired; promotion-hope and exchange-hope v1 wired in the closing debrief.** Courage is action against the actor's own expected cost, normalized as asked-risk-relative `min(1, margin / asked)`. Hope transitions are naming-only, debrief-only readings: promotion realization, unreachability, capture, and rekindling, plus terminal exchange realization, self-sprung release, and captivity extinguishment; no formation threshold or cost is introduced. **D198** (what destroying a hope object costs) remains open |
| `docs/adr/0074-the-priced-leader.md` | **D200, D201, and D203 ruled; instrument wired, surface not.** The harness reports the spec §9 Leadership Index (`LI = α·T_final + β·WinScore − γ·UnjustifiedTrauma − δ·QuietQuitTurns`, weights 0.4/0.3/0.2/0.1) per match and pooled per campaign **beside** the win score — the D188 trajectory gate stays on the win score. Every component ships in the CSV, α–δ are not tuning knobs, and the index is audit-only. **Unjustified trauma** (D201) is positive `B_i` deltas within `UNJUSTIFIED_TRAUMA_WINDOW_PLIES` (default 2) of an unvindicated `OVERRIDE` of that piece, meaned over the fielded roster. **D203 (dated addendum): the index is a closing-debrief reading only** — no player-facing surface during play or between matches, no term may be tuned to make a style fail mid-run, and any future D202 carrier prices into the terminal reading only; the harness CSV/CLI are developer instrumentation and unaffected. **D202 (second dated addendum) ruled — the emptied chairs:** δ stays (the quiet-quit term charges the kind room most), and the index gains a fifth term `−ε·EmptiedChairs` (`100·(desertions + trauma-ended careers among the fielded)/fielded`, clamped `0..100`), priced at **ε = 0.2** by the 2026-08-30 measurement sweep. Companion fix: `T_final` is meaned over the *fielded* roster with departed pieces contributing their exit trust (harness column `mean_trust_final`; `mean_trust_end` keeps its survivor semantics for comparability) — a cruel room may no longer shed its witnesses out of its own trust term. Both price into the terminal Judgement Seat reading only; exit attribution (D201's shape through cascades) stays open as a refinement |
| `docs/calibration/2026-08-30-the-index-and-the-scale.md` | **Read before ruling D202 or re-weighting the ADR 0074 index:** the first Leadership Index sweep (3 styles × 10 campaigns × 20 matches, fake engine, `--opponent=tyrannical`, AWS Batch). The index separates the styles with no per-campaign overlap (supportive 61.3–67.1 against tyrannical −32.8–−18.5), but the reading is ~78 points of trust plus ~17 of win score — the quiet-quit term is ≤2 points and charges the *kind* room most (0.197 against 0.039), because the cruel room's disengaged pieces desert or churn out before accumulating quiet-quit turns, so raising δ would penalise kindness. The unjustified-trauma term is nearly inert (supportive charges exactly 0). The 3-seed tyrannical late gain does not reproduce at 10 seeds (52.00 → 49.00) |
| `docs/calibration/2026-08-30-the-emptied-chairs-measured.md` | **Read before ruling the D202 ε magnitude:** the fifth-term measurement sweep (3 styles × 10 campaigns × 20 matches, fake engine, `--opponent=tyrannical`, AWS Batch, ε = 0). The carrier separates kind from cruel with no per-campaign overlap and points the right way — emptied-chair score supportive 4.75 against tyrannical 19.53 / steady 19.84 (~4:1), where δ pointed backwards — but does not separate tyrannical from steady. The trust-population fix is live and nearly inert at this opponent because survivor trust is saturated at −100. Any candidate ε preserves the style ordering, so ε sets legibility, not the verdict; ε is ruled 0.2 on this evidence |
| `docs/adr/0075-the-gamers-and-the-priced-index.md` | **D204 ruled; exploit tier wired, gaming sweep passed.** A third pseudo-player tier — deterministic **exploiters** that optimize the visible scoreboard through the D193 observation seam only (the index and hidden components are structurally invisible to them): `win_maxer`, `generation_cycler`, `cascade_dodger` behind `EXPLOIT_POLICY_CONFIG` in `sim/leaders.ts`. Dismissal fisher, commendation farmer, and tanker are deferred to the seminar path. Pass criterion: an exploiter must not out-read an honest leader of comparable win score at the Judgement Seat (pooled `LI(ε=0.2)`); one that does is a pricing gap owed a D ruling, never a weight tweak |
| `docs/adr/0076-the-fisher-and-the-seminar-seat.md` | **D205/D206 ruled; harness dismissal terminal (room path live at −25, King channel at its inert production default), dismissed match scores the army's real result under the King, `dismissal_fisher` wired, seminar Judgement Seat/observation-carry/tanker/farmer wired.** D205 measured 2026-08-31 and D206 measured 2026-09-03: no pricing gap either time |
| `docs/adr/0077-the-morning-lift.md` | **D207 ruled; the deterministic morning lift is wired at permille 400 (baseline 0).** At every match boundary, each fielded piece in both armies moves a fraction toward the dawn trust baseline, never downward and never by PRNG or leader input; only `T_i` changes |
| `docs/adr/0079-three-trials-before-anyone-loves-it.md` | **The plan after the harness: one journal, three kinds of hand.** The GUI is a journal writer and the screen is the observation projection; the order is journal-in-app (with the harness engine in the browser) → model personas (honest, merchant, vicious, bored, disengaged) with a computed containment envelope → the surface (legibility, four data packs, access) → the local host and a pilot cohort, gated on the personas being contained → the facilitator audit, dashboard, and a model facilitator judged by the same audit. Opens D218–D223 (all ruled; D220 moot); nothing wired |
| `docs/calibration/2026-08-31-the-morning-lift-measured.md` | **Read before the D207 magnitude ruling:** the candidate sweep (4 styles × 10 campaigns × 20 matches per permille ∈ {0, 250, 500, 1000}, baseline 0, fake engine, `--opponent=tyrannical`, AWS Batch). The ply-≤2 repeat-dismissal conveyor breaks on a clean dose–response (150–181/190 at zero → 3–12 at 500 → 0 at 1000; median dismissal ply 1 → 5–7 → 10–15) while every cruel match still ends dismissed; kind/cruel LI separation holds with no per-campaign overlap at every magnitude, the fisher never out-reads honest steady, and at 1000 the priced costs the conveyor masked return (quiet-quit and emptied chairs rise). Recommended candidate `MORNING_LIFT_PERMILLE = 500`; the owner ruled 400 on 2026-09-02 (a touch more conveyor than the knee at 500). The 2026-09-02 addendum densifies the grid to {200..700 by 100}: the response is smooth and monotone, and 500 is the knee — the largest magnitude at which ply-1 dismissal remains possible for every cruel style (600 removes it for steady and the fisher, 700 for all) |
| `docs/calibration/2026-09-03-the-gamers-at-the-seminar-seat.md` | **The D206 gaming sweep — the criterion holds:** 10 seminars × 8 weeks × 16 commanders (five honest styles + `tanker`/`commendation_farmer`/`dismissal_fisher` per side, fake engine, AWS Batch). Compare within a side (dismissal is white-only and the sides face different opposition): at comparable win score every exploiter reads at or below the honest cruel/control styles (white ~85 win: tanker 13.02, fisher 12.75, farmer 10.91 against tyrannical 13.08 / volatile 13.57), and — unlike the campaign sweeps — the exploits also *lose the public standings* (mean rank 11–12/16, ~1 win in 20 semesters), because the opposition is other commanders. No pricing gap; no new ruling owed |
| `docs/adr/0078-the-uncarried-emotions.md` | **D208–D209 and D213–D217 remain open; D210 recognition is partly wired; D211 grief and D212 shame are wired inert.** The survey maps each emotion to its seam under the house disciplines (D203 quarantine, ADR 0073 debrief-only naming, ε measurement, exploit-tier re-runs for play changes); grief carries clamped deterministic mourning and terminal naming only, shame is a terminal-only, default-inert reading that reuses ADR 0070 witnesses and scales only the target's own unvindicated-override loss, and thresholds and magnitudes remain open for measurement |
| `docs/calibration/2026-08-31-the-fisher-at-the-judgement-seat.md` | **The D205 gaming sweep — the criterion holds, and the terminal changes the cruel semester:** 4 styles × 10 campaigns × 20 matches (fake engine, `--opponent=tyrannical`, AWS Batch). At identical pooled win score (67.00) `dismissal_fisher` reads LI(0.2) 3.29 against honest steady's 3.62 (ranges overlap) — courting dismissal buys nothing, and the fisher reaches the terminal *slower* than honest tyranny. Every cruel-style match ends `dismissed_by_room` (600/600; supportive 0/200); trust carry makes matches 2..N dismiss at ply 1, so the cruel styles' win score is the King's and trust freezes near −30 at the firing. **No pre-D205 committed number (the D204 sweep, the semester wall) is comparable to post-D205 evidence.** Trust-carry-into-fresh-matches left open for the owner beside D206 |
| `docs/calibration/2026-08-30-the-gamers-at-the-judgement-seat.md` | **The D204 gaming sweep — the criterion holds:** 6 styles × 10 campaigns × 20 matches (fake engine, `--opponent=tyrannical`, AWS Batch). Every exploiter reads at or below the honest styles at comparable win score (pooled LI(0.2): `win_maxer` −38.34, `generation_cycler` −41.87, `cascade_dodger` −42.01 against tyrannical −27.15 / steady −33.93), because the D193 boundary observation lags the intra-match cascade and the ε-term prices exactly the churn the exploits run on (`cascade_dodger` EC score 72.00 against honest cruelty's ~20). Against a weak (`random`) opponent the *visible* scoreboard is gameable (85–100), as D203 permits — the terminal reading is not. No pricing gap; no new ruling owed |
| `docs/calibration/2026-08-30-the-semester-and-the-wall.md` | **The horizon evidence:** the same three styles at 100-match campaigns (10 seeds each, fake engine, `--opponent=tyrannical`, AWS Batch). No style hits a wall — every trajectory is stationary after the first quintile (supportive holds 84–89, tyrannical settles ~47–50, steady rises then holds ~38–46), the cruel rooms run on a churn conveyor (~3 emptied chairs/match, ~2.7 survivors, flat all semester), and cruelty's advantage does not widen, so the D188 trajectory gate holds at 5× the measured horizon. LI at the ruled ε = 0.2 keeps zero kind/cruel per-campaign overlap; steady converges toward tyrannical on outcome (fake-engine reading, one opponent — do not quote as chess strength) |
| `docs/calibration/2026-08-30-does-cruelty-ever-lead.md` | **Read before choosing any D188 magnitude:** three styles × three seeds, 20 matches, fake engine, grace inert. The cruel style never leads — the worst `supportive` seed (72.50) beats the best `tyrannical` seed (52.50) — and its trajectory is *inverted*, gaining late (10.00 → 60.00 over matches 1–5 against 16–20) without catching kindness. Win score does not price quiet-quitting (0.206 for the kind room against 0.037), which is the most likely pricing defect; `steady` is worst on every axis and is the only style whose candidate list runs out |
| `docs/calibration/2026-08-29-the-cold-engine-and-the-runaway.md` | **Read before any Lozza run:** cold search costs +13%–61% per ply and slightly *less* peak RSS (the ladder LRU is bounded now); `ms_per_match` is not the honest comparison because cold changes the engine's answers and therefore the game. It also records two positions where Lozza's aspiration loop never returns and the child dies of heap exhaustion — warm and cold alike, `MultiPV` 1 and 8 alike — which is D172 |
| `docs/calibration/2026-08-29-the-response-surface-under-the-curdle.md` | **Read before ruling D166 or choosing any D167 magnitude:** the first joint measurement of the five D166/D167 knobs (194 cells, fake engine, seed 7). The proportional cliff is the only knob that removes the free-insistence floor and it is non-monotone (an interior window at or below 250 permille); `OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` cannot grade anything from inside a saturated logistic; `BENEV_RUPTURE_DEBT_CEILING` is unreachable while repair ≤ 30; regard and repair both *enlarge* the fall rather than cushioning it; and **no behavioural metric moves anywhere on the surface** |
| `docs/calibration/2026-08-29-the-graded-witness-surface.md` | **Read before interpreting D176's ruled cell:** the joint D170/D174 surface on the two conditions that still carry free insistence. Grading the witness *down* removes free insistence over a campaign (0.3411 → 0.0000) even though it widens the per-state truncation band — depletion dominates truncation, so the safe direction for `OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE` is down, not up. The standing price sits on the same axis and re-opens the floor at `8000`; the live cell is `500` / `2000`. This is a ledger ruling, not a demonstrated conduct improvement |
| `docs/calibration/2026-08-29-the-roster-nobody-stays-in.md` | **Read before choosing any D168/D169 magnitude or judging D170's effect too weak:** the roster turns over almost completely every match (mean survivors 1.95 of 16 fielded for `tyrannical`, 2.85 for `redeemer`), through capture (10–15 per match) rather than desertion (0–5). Only 1–2 pieces survive five or more matches out of twenty, while survivors hold strong but very sparse bonds (2–4 non-zero affinity edges, mean |affinity| ~67), which is why half of all witness attachments at override time are exactly zero. Own-side captures are a subtraction residual because the harness has no player-side capture counter |
| `docs/calibration/2026-08-30-the-career-that-ends.md` | **Taken before D192 (experience did not survive the match boundary) — do not quote beside a post-fix run.** Read before choosing any D188 grace magnitude or quoting a style comparison over a campaign:** retirement's before/after at 10/20/40 matches on one campaign per condition (fake engine, seed 7, `--opponent=tyrannical`). Retirement accelerates (0.70 → 1.13 careers per match) and the permanent cost lands in identity, not outcome — tyrannical win score 57.50 → 53.75 while careers per seat goes 1.00 → 3.75. Desertions *rise* (57 → 71) because replacements have no attachment. **The kind arm cannot be compared yet:** the redeemer loses at every horizon with 415 desertions, retirement barely fires for it (11 versus 45) because desertion out-races trauma, and the cause is the ADR 0014 forced move — 80% of its overrides are `implicit`, each costing a kind roster 644 in target benevolence against the tyrant's 297. That is **D191**, upstream of D188 |
| `docs/calibration/2026-08-30-the-forced-move-and-the-convert.md` | **Read before pricing D191 or selecting a D188 magnitude:** the post-D192 re-take withdraws the premise that warmth causes forced moves — pure `supportive` takes **zero** overrides of any kind over 40 matches (refusal 0.063, 1 desertion, win 82.50), while the `redeemer`'s forced-move saturation belongs to its style switch: after match 10 **100%** of its overrides are forced, because a warm policy never chooses to insist. The conversion trap (authority spent, affection never bought) is a sociology result; charging 1 135 unchosen moves as insistence is the ledger defect. Also flags that the cruel style now **never leads** at 10/20/40 matches, against D188's mid-run requirement |
| `docs/calibration/2026-08-30-the-veteran-that-remembers.md` | **Read before quoting any campaign number taken before 2026-08-30:** `mergeCampaignRoster` carried every psychological field across a match boundary except `E_i`, so each survivor was re-fielded at its role's textbook competence and D149's earned ability expired with the match (D192, now fixed). With experience carried, competence becomes a career-scale outcome — the supportive arm's ceiling climbs monotonically (80 → 92, all one identity, the King) while the tyrant's falls to 58–66 and his mean ability drops from the mid-sixties to the mid-forties. **No outcome claim:** one campaign per condition, and no behavioural metric moved beyond seed noise |
| `docs/calibration/2026-08-19-piece-quality-and-the-bench.md` | D149 piece-quality and bench calibration; design-only evidence |
| `docs/testing_strategy.md` | Unit + wiring probes (sensitivity); goldens for settled surfaces |
| `docs/llm_integration.md` | Narration port, cost model, safety |
| `docs/risks_and_open_questions.md` | Known hazards |
| `docs/adr/` | Recorded decisions (immutable) |
| `docs/spec/living-chess-srs.md` | Owner's original SRS (requirements source of record) |

## Non-Negotiable Architecture Rules
1. **Deterministic core, narrative skin.** No LLM output ever re-enters game
   state (ADR 0001). Narration is presentation-only.
2. **Seeded randomness only.** All RNG flows through the seeded PRNG module;
   `Math.random` is banned outside it (by lint). Every match records its seed.
   `Math.exp`/`Math.pow`/`Math.log`/trig/`**` are likewise banned (by lint) in
   `psychology/` and `chess/` — JS engines disagree in the last bits, so a replay
   recorded in one browser must not diverge in another. The deterministic math
   module that replaces them lands with its first consumer (ADR 0032 §4).
3. **Depth-limited engine search only.** `go depth N`, never `movetime`; pinned
   stockfish.wasm version. Wall-clock-dependent search breaks every golden test.
4. **Layer boundaries.** A layer imports only from itself, `src/core/`, and
   layers below it (`app > ui > orchestration > psychology > chess > engine`).
   Importing *upward* is the lint error. `psychology/` is stricter still: it
   receives board features as plain data, so it may import `core/` and chess
   *types*, never `chess/` values, `engine/`, or `ui/`. Orchestration and the
   app composition root may import `engine/` (barrier + port construction).
5. **Event log is the source of truth.** Audits, debriefs, and culture drift are
   folds over the log, never separately maintained counters.
6. **Every config knob gets a wiring (sensitivity) probe** — changing the knob
   must change a quantitative output. Prefer unit tests + wiring probes while
   coefficients are still moving; pin exact golden numbers only for settled
   surfaces (see `docs/testing_strategy.md`). A parsed-but-unwired knob is a
   review failure. See the `ci-test-design` skill. A decision may not be
   recorded as answered while its governing state has no implementing write:
   the register entry must carry an implementing `file:line`, or an explicit
   **not wired** marker, and its status must agree with
   `docs/adr/IMPLEMENTATION_STATUS.md`.
7. **Never modify tests to make them pass** — fix the implementation.
8. **Accepted design invariants** (ADRs 0002–0012). A commanded move is always
   the move played (insight is advice, ADR 0008). Refusal is free to re-plan; it
   never costs a turn (ADR 0002). Pieces desert; they never defect (ADR 0003).
   Desertion is an expected-cost decision and its cascade must never be damped
   with cooldowns, caps, or morale floors (ADR 0011). Every piece decides from
   its own depth-`D_i` view and the true evaluation must never reach
   `psychology/` (ADR 0013). The player can always override a refusal, so no
   position is ever unplayable (ADR 0014). No piece is ever wrong about *where*
   a piece stands — divergence is interpretive, never perceptual, and rumor
   carries appraisals only, never board facts (ADR 0016). The player never sees
   the arithmetic; a piece's stated reason may be a rationalization, but it must
   always name a cause (ADR 0018). There is no runtime LLM and no API
   key (ADR 0004). Trust never decays toward a baseline on its own (ADR 0007).
9. **Do not resolve an open decision in `docs/design_decisions.md` by writing
   code.** Ask, or implement behind a config flag with both branches tested.
   D19 and D9 are settled (ADR 0015, ADR 0017); D36–D39 and D41 by ADR 0019;
   D51 by ADR 0021; D48 by ADR 0034. Remaining calibration decisions
   (D35, D40, D42–D44) belong to the harness in Milestone 3. **Open architecture
   decisions must not be resolved silently in code.** D49 and D50 are resolved
   by ADRs 0035 and 0036. (D54 is resolved by ADR 0021; D52/D53 by ADR 0023.)
   Engine results reach psychology only through a per-ply barrier: issued and
   collected in `PieceId` order, frozen, with the seeded PRNG drawn only after
   it closes — `Promise.race`/`Promise.any`/wall-clock timeouts are banned in
   `engine/` and `orchestration/` (ADR 0034). Situation keys are role-abstract —
   they name relationships and events, never board objects — and content ships
   as data packs, so the exec-lab track is a rename rather than a fork. Warmth
   is not required to win: a cold, highly able leader must be able to win a
   career, and `τ_benev` buys resilience rather than compliance (ADR 0024). Both
   armies are led: the opponent is a commander with a real roster, difficulty is
   an opposing *leader policy* and never an engine depth, and no enemy
   psychological state may reach the player except as observable behaviour
   (ADR 0025). Pieces are **community entities**, not save-file contents: capture
   is never permanent, accumulated trauma across *all* commanders can retire a
   piece permanently, and a free agent may decline a commander (ADR 0026).
   Single-player must remain whole with AI commanders only. A world lives exactly
   as long as its curriculum and pieces do not outlive it; only claims about the
   *player* leave — gameable achievements, and an evidence-backed, replay-
   verifiable Certificate of Completion (ADR 0029). The King is a character,
   not the player's avatar: uniform `PieceState`, unpruned attention, and his
   credence is a mandate, not an obedience gate (ADR 0021). Dismissal continues
   the campaign under the King's command with the player spectating, and the
   successor's success or failure is computed from roster state, never scripted
   (ADR 0022).

## Setup
```bash
pnpm install
pre-commit install
```

## Validation Commands
```bash
pre-commit run --all-files
pnpm lint # eslint + prettier check
pnpm typecheck # tsc --noEmit, strict
pnpm test # vitest run
pnpm test:coverage # lcov for the SonarQube gate (ADR 0033)
pnpm sim --matches=20 --leader=tyrannical # Lozza default; use --engine=fake in CI
pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4
```
See the `typescript-toolchain` and `sonarqube-quality-gate` skills.

## Planned Layout
```
src/core/ seeded PRNG, canonical encoder, deterministic math — depends on nothing
src/app/ React shell, routing, theme provider, onboarding tracks
src/ui/ board, overlays, gauges, dashboards (no game logic)
src/orchestration/ match loop; only place allowed to mutate match state
src/psychology/ pure reducers: utility, verdicts, trust/affinity/class bias
src/chess/ chess.js wrapper, piece-identity map, threat features
src/engine/ stockfish.wasm pool + insight broker
src/narrative/ template dialogue + optional LLM adapter
src/persistence/ Dexie schema, migrations, roster export/import
sim/ headless CLI harness, scripted AI leaders, metrics
docs/ planning documents and ADRs
```

## Licensing Hygiene
The project is dual-licensed (AGPL-3.0 + commercial), so **dependency licenses
are a gate**: prefer MIT/BSD/Apache-2.0/ISC and never add a GPL/AGPL-only
dependency without flagging it. Stockfish is GPL-3.0 and is already a known
constraint — see `LICENSING.md`. Contributions require the grant in
`CONTRIBUTING.md`; commit with `git commit -s`.

## Code Conventions
- TypeScript strict; no `any`, no non-null `!` without justification.
- Pure functions in `psychology/` — no I/O, no clock, no RNG except an injected
  seeded generator.
- Discriminated unions for events and verdicts; exhaustive `switch` with a
  `never` default.
- Money/score-like numbers stay integers where possible (trust, morale, affinity
  are integer-valued, clamped).

## PR Requirements
- Lint, typecheck, tests, and headless sim smoke all pass.
- New config keys ship with a wiring (sensitivity) probe; add a golden only
  when the surface is intentionally frozen.
- Decisions that are expensive to reverse ship with an ADR.
- Balance-affecting changes include before/after harness metrics in the PR body.
