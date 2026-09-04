# ADR implementation status (0035–0078)

Agent-facing matrix: **decided** ≠ **shipped**. Prefer this over README banners
when answering “does three-channel credence exist yet?”

This file is the authoritative implementation-status record. ADRs and the
decision register describe what was decided; this matrix records whether the
decided mechanism is actually present in live code. When the register or a
specification disagrees with this file, the live-code status below wins until
the discrepancy is corrected.

| ADR | Topic | Decision | Live code |
|---|---|---|---|
| 0035 | Three-channel keyed credence (D49) | Accepted | **Shipped** — `src/orchestration/credence.ts:1-101`; identity-carried disposition and commander-keyed accounts with orchestration check-out/check-in |
| 0036 | Separate engine audit stream (D50) | Accepted | **Shipped** — `src/engine/types.ts:27-35`, `src/orchestration/headlessMatch.ts:418-421`, `src/orchestration/matchSession.ts:190-192`, `src/persistence/repository.ts:217-231` |
| 0037 | Private evaluation profiles | Accepted | **Shipped** — `privateEvaluation.ts` on both match paths |
| 0038 | Justified refusal authority | Accepted | **Shipped** — authority loss/gain hooks |
| 0039 | Credence prior strength / first match | Proposed (provisional defaults) | Knobs live (`ABIL_PRIOR_STRENGTH`); magnitudes still calibration-open |
| 0040 | Refusal crisis menu | Proposed | **Not in UI tree** |
| 0041 | Stopping the seminar | Proposed | Milestone 5b — not shipped |
| 0042 | Reciprocal authority | Proposed | Partial reducer support; no crisis UI |
| 0043 | Asymmetric ability accretion | Proposed (provisional) | Curvature / loss-multiplier knobs live |
| 0044 | Two-channel ability evidence | Proposed (provisional) | Drip + near-refusal margin knobs live |
| 0045 | Desertion belief / pivotality / shadow | Proposed | Board-loss / pivotality / shadow / attachment **shipped**; magnitudes open |
| 0046 | Release before resignation | Proposed | **Not shipped** |
| 0047 | World-persistent commanders | Accepted | **Sim/world layer shipped**; full seminar host surfaces still Milestone 5b |
| 0049 | Trauma is injury; capture and sustained dread write `B_i` | Accepted for the injury slice; calibration remains open | **Shipped** — `src/psychology/trauma.ts:10-42`, `src/orchestration/headlessMatch.ts:336-358`, `src/orchestration/headlessMatch.ts:442-454`, `src/orchestration/enemyTurn.ts:265-286` |
| 0050 | Machine heroism nomination / human conferral | Accepted for nomination records; thresholds and conferral stand-in open | **Shipped** — `src/orchestration/heroism.ts:16-73`, `src/psychology/types.ts:254-270`, `src/persistence/types.ts:120-123` |
| 0051 | Non-selection, redemption, and obsolescence | Accepted for season-pool slice; calibration remains open | **Shipped** — `sim/pool.ts:27-65`, `sim/pool.ts:376-552`, `sim/season.ts:98-145` |
| 0052 | Exit permanence and static-exchange capture risk | Accepted mechanism; current `625` remains in force pending the fixed-harness evidence review | **Shipped** — `src/psychology/config.ts:90`, `src/psychology/desertion.ts:209`, `src/chess/features.ts:137`; current evidence: `docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md` |
| 0053 | Pawn hope, capture truth, and posthumous class credit | Accepted for mechanism slice; approved/shipped hope `500` and floor `250` | **Shipped** — `src/chess/features.ts:112-151`, `src/psychology/desertion.ts:231-333`, `src/orchestration/psychologyHooks.ts:68-96`; current evidence: `docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md` |
| 0054 | The seminar pool and what a player knows | Accepted direction; staging and magnitudes proposed | **Partly wired** — slices 1–2 render identity and service truth, emit `PROMOTION`, write in-match roles, record attained roles, and count promotions; campaign role carry is flag-gated off by default and cohort prestige is wired at zero; no player-facing bench |
| 0055 | Earned ability from vindicated judgment | Resolved and calibrated at scale `2` / loss multiplier `1` | **Shipped** — `src/psychology/reducers.ts:65-108`, `src/orchestration/psychologyHooks.ts:270-359`, `sim/pool.ts:252-277`, and campaign spread metrics; evidence: `docs/calibration/2026-08-19-earned-ability-magnitude.md` |
| 0056 | Origin-inclusive chair contests and the bench instrument | Accepted for harness/pool slice; app bench remains open | **Shipped in sim** — `sim/pool.ts:39-206`, `sim/season.ts:40-157`, and `sim/degeneracy.ts:1-420`; D148/D150 remain open |
| 0057 | App-side private squad fielding | Accepted for offline/private bench slice; shared market remains out of scope | **Shipped** — `src/app/careerBootstrap.ts:49-79`, `src/app/squadCareer.ts:180-480`, `src/orchestration/matchSession.ts:45-66`, `src/persistence/service.ts:33-185`, and `src/persistence/migrations.ts:8-31`; D148 remains open, while D150's public/private information half is partly wired by the candidate slate and counsel |
| 0058 | Three-channel credence wiring | Accepted for identity/persistence wiring; disposition distribution remains open | **Shipped** — `src/orchestration/credence.ts:1-101`, `src/persistence/types.ts:48-70`, and `src/persistence/migrations.ts:25-52`; shared market remains out of scope |
| 0059 | The draft, the purse, and pieces who scout | **Proposed** — design only; magnitudes owner-owned | **Partly wired** — app and harness share one legal army plus reserve composition (`src/orchestration/squadFielding.ts:180-218`), and the information half adds the public slate and private counsel (`src/persistence/candidateSlate.ts:14-110`, `src/psychology/counsel.ts:3-126`); the economy half adds opt-in priority/purse, acceptance discount, deterministic first-price clearing with an owner-approved opt-in second-price rule, per-commander reserves, configurable bid styles, partial carry, and qualitative acceptance-price bands (`src/core/draftEconomy.ts:1-317`) plus harness-only economy detectors (`sim/degeneracy.ts:418-518`); credence controls counsel disclosure only, candidate rumour appraisal state remains open, `COUNSEL_RIVALRY_PENALTY=20` and band thresholds `750/500/250` are owner decisions, remaining economy magnitudes and detector thresholds are provisional §9 seeds, raw acceptance prices remain harness-only because they invert to hidden reputation, and no draft outcomes are persisted; the seminar harness now creates finite per-side markets, computes demand shortfalls before fielding, applies private counsel to bidder willingness, and carries unspent purse between weeks (`sim/seminarDraft.ts`, `sim/seminar.ts`); `RESERVE_DEPTH=15`, cycle-one drafting, purse/carry/acceptance-discount magnitudes, and D153–D156 remain open |
| 0060 | The scoreboard and the honours | **Proposed** — design only; disclosure depth and salience weights belong to the search | **Partly wired** — debrief-only awards remain (`src/persistence/commendations.ts:245-314`), while the own-record public register is folded from narrow public facts with capture-time role valuation (`src/persistence/register.ts:1-228`); cohort rank, disclosure depth, and honours catalogue remain open |
| 0061 | The order of work | **Proposed** — sequencing only; supersedes ADR 0054 §6 staging from slice 4 onward | **Partly wired** — scarcity step 1 remains wired at zero (`src/orchestration/squadFielding.ts:37-42,234-320`), step 2 adds register, verdict-stability/liveness, register-mirroring probes, and changing-roster commendation folds (`src/persistence/register.ts:1-228`, `src/persistence/commendations.ts:92-346`), and step 3 adds the public candidate slate, deterministic private counsel with credence-only disclosure, zero-default consultation budget, harness heeded-counsel telemetry, provisional counsel detectors, an opt-in draft economy, seminar-week draft integration, and the private pre-seminar cohort-history ledger (`src/persistence/candidateSlate.ts:14-110`, `src/psychology/counsel.ts:3-126`, `src/core/draftConfig.ts:1-50`, `src/core/draftEconomy.ts:1-317`, `src/core/cohortHistory.ts`, `src/psychology/cohortHistory.ts`, `src/core/roleEligibility.ts:1-8`, `sim/metrics.ts:89-118`, `sim/degeneracy.ts`, `sim/seminarDraft.ts`, `sim/seminar.ts`); candidate rumour appraisal state and cycle-one drafting remain open for the shipped path, owner decisions now settle counsel rivalry at `20` and price-band labels/thresholds at `will_come_cheap`/`asks_the_going_rate`/`drives_a_hard_bargain`/`wants_danger_money` with `750/500/250` thresholds, cohort-history and remaining reserve/draft/economy magnitudes remain open search seeds, shared-intake counts are coarse structural telemetry rather than direct affinity evidence, direct consultation denominators are reported, inert-past ignores inactive cycles and frozen-clique is differential against density zero, raw prices stay harness-only, and draft outcomes stay harness-only |
| 0062 | The decision journal and the LLM player | **Proposed** — direction ruled (no live LLM during play); schema questions answered by ADR 0063 | **Partly wired** — the offline journal decorator, canonical options, scripted/recorded agents, digest-checked replay seam, and campaign/CLI plumbing are live (`sim/journal.ts:1-360`, `sim/match.ts:103-176`, `sim/campaign.ts:445-603`, `sim/cli.ts:350-392`); observations are projected field-by-field with qualitative bands only (`src/orchestration/observation.ts:45-97`, `src/core/qualitativeBands.ts:1-85`); no model player, engine-free fold, or fork/counterfactual replay is wired, and disengage is enumerated without a walk-away consequence |
| 0063 | Two duties: coverage and containment | **Accepted** for the duties, the D159–D164 schema answers and the 2026-08-27 D164 ruling; D165 answered by ADR 0064 | **Partly wired** — the coverage *population* now spans both behavioural axes (`sim/leaders.ts:275-325`, `sim/cli.ts:36-59`) and the honest sweep condition is `--opponent=tyrannical`, evidence in `docs/calibration/2026-08-27-the-competent-opponent-and-the-two-axes.md`; the coverage *gate* is still a hand-run sweep read by eye (`sim/degeneracy.ts` fires per campaign, not across styles), the emotional axis is still two points, and no envelope/containment metric, journal, or `disengage` option exists |
| 0064 | The cushion and the repair: what earns benevolence | **Accepted** for D165 and D166 (live magnitudes ruled 2026-08-29) | **Shipped, live** — mechanism, persisted `ruptureDebt`, and the `REPAIR` event are in tree; `BENEV_REGARD_STEP=50` and `BENEV_REPAIR_STEP=30` are live in `src/psychology/config.ts`, while the witness split is live under D176 and the debt ceiling remains inert under the repair-versus-accrual constraint |
| 0065 | The confidence and the culture: a private word that may not be kept | **Accepted** — D168 and D169 both ruled 2026-08-28 (the channel must exist; good news makes poor gossip but still reaches the recipient's intimates; a favour for one reads as care to close affinities and as favoritism to the rest; nothing is free; and `leaderAppraisal` is read by the ability-credence weight) | **Partly wired** — the D169 consumer is in tree and inert: `effectiveAbilityCredence` (`src/psychology/credence.ts:9-21`) is read at the single perceived-value call site (`src/psychology/verdict.ts:46-54`) behind `RUMOR_APPRAISAL_ABIL_WEIGHT: 0` (`src/psychology/config.ts:145-146`), derived rather than stored, with reducer-level wiring evidence in `tests/credence.rumor.test.ts` (an end-to-end sim probe is impossible until something writes a non-zero appraisal). The private channel itself is **not wired** — no private communication, discretion ladder, leak event, favoritism/affinity-split term, per-kind gossip rate, or culture seed exists, and no magnitudes are chosen. The transmission graph it would reuse is half-live: `diffuseRumor`/`applyRumorDiffusion` (`src/psychology/belief.ts:14-53`) are shipped and knobbed (`src/psychology/config.ts:143-144`) but have a single production call site in the desertion cascade (`src/psychology/cascade.ts:169`), so nothing yet writes a non-zero `rumor.leaderAppraisal` for the D169 consumer to read |
| 0066 | The floor under the curdle: what a room can still register | **Accepted** for D167; D166's live magnitudes were ruled 2026-08-29; D170 and D174 were ruled by ADR 0070; D176 was ruled 2026-08-29; D175 was ruled accepted as shipped with no code change | **Wired, partly live** — all three knobs are read on the live paths (`OVERRIDE_WITNESS_BENEV_CLIFF_INPUT` in `src/psychology/override.ts:31-59`, `BENEV_BETRAYAL_CLIFF_PERMILLE` in `src/psychology/credence.ts:100-125`, `BENEV_RUPTURE_DEBT_CEILING` via `clampRuptureDebt` in `src/psychology/clamp.ts:25-32`, applied in betrayal, repair, and `normalizePieceState`), with sensitivity probes in `tests/curdle.floor.test.ts`. `BENEV_BETRAYAL_CLIFF_PERMILLE=250` is live; D174's witness multiplier and D170's standing price are live under D176 at `500` and `2000`, respectively; the debt ceiling remains inert, and D175 accepts the asymptotic tail as shipped behavior with its change-detector retained. The witness broadcast itself is untouched by design |
| 0067 | The cold engine contract: an evaluation is a function of the position | **Accepted** for D171 (cold, ruled 2026-08-28); D172 (may the vendored artifact be patched?) is raised by it and **ruled** by ADR 0068 | **Wired, live** — `UciEngine` clears carried state before every search (`ucinewgame`/`isready`/`readyok` in `src/engine/uci.ts:329-334,360-368`) and cold is the default, with the warm path reachable only through `coldSearch: false`; the policy is part of `determinismId` and of the adapter's per-path state key (`src/engine/adapters/lozza.ts:212-222,117-119`); the ladder LRU default is bounded at `4_096` now that eviction can only cost a re-search (`src/engine/adapters/lozza.ts:15-17`). Probes in `tests/engine.cold.test.ts` (cold invariance after divergent history, warm divergence as the contrast, determinism-ID separation, eviction invariance). **Not done:** the Lozza calibration corpus is not yet re-baselined, and the seed-7 `tyrannical` condition cannot be until D172 is ruled |
| 0068 | The runaway and the unsound score | **Accepted** for D172 (patch the artifact, ruled 2026-08-29); D173 (is a deeper search's rung the canonical value for a depth?) was raised by it and is ruled by ADR 0069 | **Wired, live** — the vendored aspiration loop is bounded and the modification is recorded as a re-appliable diff (`vendor/lozza/lozza.cjs:1089,1099`, `vendor/lozza/patches/0001-bound-the-aspiration-loop.patch`, upstream `namanthanki/lozza#4`); `bench` is unchanged at `613926` nodes, so the patch is a termination fix and not an evaluation change. A parsed score now carries soundness and its raw token (`src/engine/uci.ts:98-140`), `mate 0 → 29_999` is withdrawn, an unsound rung triggers at most two deterministic one-ply re-searches before a typed `UciUnsoundScoreError` (`src/engine/uci.ts:481-520`, adapter and broker alike), and a search that exceeds `maxInfoLinesPerSearch` (default `512`, against a measured real maximum of 22) fails with `UciInfoLineLimitError` and disposes the child rather than truncating (`src/engine/uci.ts:283-297,394-406`). Both policies are in `determinismId` (`score-escalate-2/runaway-512`) and in the adapter's per-path state key; escalations are counted as engine calls in the cost telemetry (`sim/cost.ts`). Probes in `tests/engine.d172.test.ts` (both poison FENs at depths 3–8, classifier, bounded escalation, exhaustion, ceiling sensitivity, order invariance, determinism-ID separation). **Not done:** the Lozza calibration corpus is still un-re-baselined, and no pre-patch Lozza number may be quoted beside a post-patch one — the artifact hash in `determinismId` is what separates them |
| 0069 | The canonical ladder rung: the rung is the value | **Accepted** for D173 (ruled 2026-08-29) | **Wired, live** — ladder reuse remains canonical in the Lozza adapter and shared broker; `ladder-rung-canonical` is included in the Lozza and Stockfish `determinismId` values (`src/engine/adapters/lozza.ts:247-248`, `src/engine/adapters/stockfish.ts:27-30`), while the fake engine has no ladder reuse. The broker's `sharedByFen` and `bestByFenDepth` caches are bounded by `ladderCacheCapacity` (`src/engine/broker.ts:125-129`); ADR 0062's future fork must replay per-piece `D_i` and ladder search depths |
| 0070 | Graded witness loss and per-witness standing price | **Accepted** for D170 and D174 (ruled 2026-08-29); D176 ruled 2026-08-29 in the addendum | **Wired, live** — `OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE=500` and `OVERRIDE_STANDING_PRICE_PERMILLE=2000` are live under D176; `applyBetrayalSignal` accepts a final-drop scale and `witnessAttachmentPermille` prices each witness's own bond. The target charge, witness trust penalty, and `PSYCH_DELTA` audit events remain intact; the measured ledger ruling and linear attachment-shape decision are recorded in the D176 surface evidence |
| 0071 | Captivity and the exchange: being taken is being held | **Accepted** for D177/D181/D183; seminar-only wiring dated 2026-08-30. The exact ruling is “Pieces first get paid during the draft”; D182 magnitude/registration, D178–D180, D184, and D185 remain open | **Partly wired** — seminar pool folding enables the opt-in captive hold, persistent piece cash, pre-draft ransom, captor credit, and inert-by-default benevolence decay. Campaign and season callers do not pass captivity metadata and remain unchanged; unransomed captives never enter draft lots. |
| 0072 | The ceiling on a career, and the mercy nobody buys | **Accepted** for D186 (trauma retires a career on every path) and D187 (trauma relief exists, is unearned, and cannot be purchased) — owner ruling 2026-08-29; **D189 answered 2026-08-30** (the square is a seat, the career is a seat plus a generation); D188 (grace rate and magnitude) remains open with its gate replaced by a trajectory gate, and **D190** (whether the campaign boundary needs its own event stream) is newly open | **Retirement wired and live; grace wired and inert.** `applyCampaignBoundary` (`sim/campaign.ts:117-165`) retires non-King careers at `ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD` (`src/psychology/config.ts:89`, referenced by `src/orchestration/squadFielding.ts:46` so both paths share one number), increments the seat generation, and carries retired career ids in the version-3 checkpoint. `applyGrace` (`src/psychology/trauma.ts:17-23`) is the only transition that lowers an in-range `B_i`; it takes a piece and a relief, writes only `B_i`, and clamps relief non-negative. `GRACE_RATE_PERMILLE`/`GRACE_RELIEF` default to `0` and the draw loop is skipped at that rate, so no PRNG draw is consumed. Boundary facts are derived metrics, not log events — that is D190. Measured at 40 matches (seed 7, fake engine, `--opponent=tyrannical`): tyrannical retires 45 careers and turns over 3.75 careers per seat while win score moves 57.5 → 53.75 |
| 0078 | The uncarried emotions: a location survey | **Survey accepted** (owner request, 2026-09-04); D208–D217 all open | **Nothing wired** — docs-only; every carrier, trigger, and magnitude waits on its own ruling |

## Confirmed implementation gaps

These are status distinctions, not new design decisions:

- **Own-side capture attrition is not counted separately by the harness.** The
  enemy-side `enemyAttrition` counter exists, but player-side captures must be
  inferred as `fielded − survivors − desertions`. More seriously,
  `sim/campaign.ts` discards `runMatch`'s `departedRoster`, so
  `mergeCampaignRoster` re-creates every captured piece via
  `createFreshPieceState` with empty `dyadicAffinity`, `B_i = 0`, and reset
  credence; the season-pool path in `sim/pool.ts` already folds departed state
  back in. This contradicts ADR 0026 §1, and repairing it moves measured
  attrition, so it needs its own before/after evidence.
- **Piece price and piece-held cash are not game state.** `PieceState` has no
  price, wage, or cash field (`src/psychology/types.ts:50-62`); a clearing price
  exists only in the draft observation (`sim/seminarDraft.ts:443,713-744`), and
  the draft economy helpers are documented as not connected to the default
  match path (`src/core/draftConfig.ts:1-5`).
- **Capture injury and sustained dread are wired.** Flat capture injury and
  private-risk dread are reduced in `src/psychology/trauma.ts:10-42` and
  applied before roster synchronization in
  `src/orchestration/headlessMatch.ts:336-358` and
  `src/orchestration/headlessMatch.ts:442-454`; the enemy turn returns its
  captured identity from `src/orchestration/enemyTurn.ts:265-286`. Retirement consumes the preserved
  injured state in `sim/pool.ts:350-399`; the King exemption remains there.
- **Morale is only partially wired.** `M_i` is changed by override and
  witnessed-desertion effects and read by the desertion lambda, but there is no
  general loss, exposure, victory, or recovery update
  (`src/psychology/override.ts:28`, `src/psychology/desertion.ts:57-60`,
  `src/psychology/desertion.ts:264-273`).
- **The D69/D70/D71 community claims are not fully live.** Season-local
  retirement and capture return exist in `sim/pool.ts:350-399`, but the shared
  cross-commander trauma pool, free-agent decline/market, and world-level
  retirement standing described by D69-D71 are not implemented
  (`docs/design_decisions.md:475-495`).
- **D73/D74 and the world/curriculum claims remain partial.** Deterministic
  replay data and AI policies exist, but no registry replay-verification
  service or persistent AI/free-agent market was found
  (`docs/design_decisions.md:507-518`). The headless world exists while the
  full seminar host remains deferred (`src/persistence/README.md:29-30`).
- **Facilitator/cohort surfaces remain partial.** Player commendations are
  implemented, while facilitator awards require the missing world/cohort model
  (`src/persistence/commendations.ts:232-333`).
- **Experience does not grow.** `E_i` is assigned only when a piece is created
  (`src/orchestration/roster.ts:58-65`, `sim/roster.ts:71-78`) and is otherwise
  only clamped (`src/psychology/reducers.ts:32-35`), so ability remains fixed.
- **The shared market is not shipped.** The offline/private app bench is folded
  from match events by `src/app/squadCareer.ts:180-480`; `listFreeAgents`
  continues to expose only the existing roster-management free-agent surface
  (`src/persistence/repository.ts:354-357`).
- **Piece names are partly wired.** Names are stored in
  `src/app/careerBootstrap.ts:44-49` and now render in the roster and piece
  overlay; missing identity records still use a role fallback. Service records
  are folded from match events in `src/persistence/service.ts:33-185`.
- **Promotion truth is partly wired.** Board promotions are consumed by the
  shared helper at `src/orchestration/promotion.ts:18-61`, recorded in the
  event log, and persisted as identity attainment in
  `src/persistence/repository.ts:42-59` and `src/persistence/repository.ts:283-310`.
  Campaign carry remains off by default at
  `src/psychology/config.ts:20-23`; the signed witness channel is wired at zero
  there. Testimony, rumor, and earned-knowledge projections remain unwired.
- **Exact gauge integers are resolved for the shipped overlay.** The piece
  overlay publishes qualitative trust, morale, and trauma labels in
  `src/ui/overlays/PieceOverlay.tsx:44-73`; the numeric leak is removed there
  against ADR 0018. Testimony, rumor, and earned-knowledge projections remain
  unwired.
- **Verdict arithmetic is now qualitative.** Refusal, override, and quiet-quit
  panels explain judgement gap, objection strength, sight, and override cost in
  words, with piece names when available
  (`src/ui/panels/VerdictPanels.tsx:1-205`,
  `src/app/MatchScreen.tsx:235-273`). Testimony, rumor, and earned-knowledge
  projections remain unwired.

Open calibration decisions (D35, D40, D42–D44, and later magnitude Ds) remain
harness work — do not silently close them by changing defaults without a
report in `docs/calibration/`.

Current balance evidence: `docs/calibration/2026-08-18-rebaseline-on-the-fixed-harness.md`.

ADR 0049 leaves the flat capture magnitude, serious-risk threshold, dread
increment, and required run length open for calibration. No decay term is
introduced.
