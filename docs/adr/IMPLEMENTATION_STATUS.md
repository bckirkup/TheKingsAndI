# ADR implementation status (0035–0054)

Agent-facing matrix: **decided** ≠ **shipped**. Prefer this over README banners
when answering “does three-channel credence exist yet?”

This file is the authoritative implementation-status record. ADRs and the
decision register describe what was decided; this matrix records whether the
decided mechanism is actually present in live code. When the register or a
specification disagrees with this file, the live-code status below wins until
the discrepancy is corrected.

| ADR | Topic | Decision | Live code |
|---|---|---|---|
| 0035 | Three-channel keyed credence (D49) | Accepted | **Not wired** — `CredenceState` is still `{tauBenev, tauAbil, abilityObservationCount}`; reputation transfer averages scalars |
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
| 0052 | Exit permanence and static-exchange capture risk | Accepted — both candidate directions adopted; CI-safe default `625` selected by calibration | **Shipped** — `src/psychology/config.ts:90`, `src/psychology/desertion.ts:209`, `src/chess/features.ts:137` |
| 0053 | Pawn hope, capture truth, and posthumous class credit | Accepted for mechanism slice; calibration defaults open | **Shipped** — `src/chess/features.ts:112-151`, `src/psychology/desertion.ts:231-333`, `src/orchestration/psychologyHooks.ts:68-96` |
| 0054 | The seminar pool and what a player knows | Accepted direction; staging and magnitudes proposed | **Partly wired** — slice 1 renders stored identity, origin, and event-log service records and replaces arithmetic leaks with qualitative labels; promotion remains recorded at `src/chess/board.ts:367-369` and read nowhere, with no `PROMOTION` event or player-facing bench |

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
- **There is no shipped bench.** `activeLineup` fields every `ACTIVE` piece
  (`src/orchestration/rosterActions.ts:132-141`), while `listFreeAgents`
  returns the player's own `DESERTED` pieces
  (`src/persistence/repository.ts:354-357`).
- **Piece names are partly wired.** Names are stored in
  `src/app/careerBootstrap.ts:44-49` and now render in the roster and piece
  overlay; missing identity records still use a role fallback. Service records
  are folded from match events in `src/persistence/service.ts:31-140`.
- **Exact gauge integers are partly resolved.** The piece overlay now publishes
  qualitative trust, morale, and trauma labels in
  `src/ui/overlays/PieceOverlay.tsx:44-73`; the numeric leak is removed there
  against ADR 0018. Testimony, rumor, and earned-knowledge projections remain
  unwired.

Open calibration decisions (D35, D40, D42–D44, and later magnitude Ds) remain
harness work — do not silently close them by changing defaults without a
report in `docs/calibration/`.

Current balance numbers: `docs/calibration/2026-08-10-state-of-play.md`.

ADR 0049 leaves the flat capture magnitude, serious-risk threshold, dread
increment, and required run length open for calibration. No decay term is
introduced.
