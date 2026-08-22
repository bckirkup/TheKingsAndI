# ADR implementation status (0035–0061)

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
| 0057 | App-side private squad fielding | Accepted for offline/private bench slice; shared market remains out of scope | **Shipped** — `src/app/careerBootstrap.ts:49-79`, `src/app/squadCareer.ts:180-480`, `src/orchestration/matchSession.ts:45-66`, `src/persistence/service.ts:33-185`, and `src/persistence/migrations.ts:8-31`; D148/D150 remain open |
| 0058 | Three-channel credence wiring | Accepted for identity/persistence wiring; disposition distribution remains open | **Shipped** — `src/orchestration/credence.ts:1-101`, `src/persistence/types.ts:48-70`, and `src/persistence/migrations.ts:25-52`; shared market remains out of scope |
| 0059 | The draft, the purse, and pieces who scout | **Proposed** — design only; magnitudes owner-owned | **Partly wired** — app and harness share one legal army plus reserve composition (`src/orchestration/squadFielding.ts:180-218`), with `RESERVE_DEPTH=15` and legacy factor mapping; reserve/draft magnitudes and D153–D156 remain open |
| 0060 | The scoreboard and the honours | **Proposed** — design only; disclosure depth and salience weights belong to the search | **Partly wired** — debrief-only awards remain (`src/persistence/commendations.ts:245-314`), while the own-record public register is folded from narrow public facts (`src/persistence/register.ts:1-205`); cohort rank, disclosure depth, and honours catalogue remain open |
| 0061 | The order of work | **Proposed** — sequencing only; supersedes ADR 0054 §6 staging from slice 4 onward | **Partly wired** — scarcity step 1 remains wired at zero (`src/orchestration/squadFielding.ts:37-42,234-320`), and step 2 adds register, verdict-stability/liveness, register-mirroring probes, and changing-roster commendation folds (`src/persistence/register.ts:1-205`, `src/persistence/commendations.ts:92-346`, `sim/degeneracy.ts:565-579,707-796`); the orthogonality band is provisional for ADR 0059 §9 and retirement tolerance is wired at zero, with its magnitude open |

## Confirmed implementation gaps

These are status distinctions, not new design decisions:

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
