# ADR implementation status (0035–0051)

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
- **Headless commander comparisons now use equal ports.** `sim/match.ts:71-90`
  supplies the same scripted `HeadlessLeaderPort` implementation to both
  sides, and `src/orchestration/enemyTurn.ts:490-520` uses it for enemy
  selection; the tactical archetype remains a compatibility fallback.

Open calibration decisions (D35, D40, D42–D44, and later magnitude Ds) remain
harness work — do not silently close them by changing defaults without a
report in `docs/calibration/`.

Current balance numbers: `docs/calibration/2026-08-10-state-of-play.md`.

ADR 0049 leaves the flat capture magnitude, serious-risk threshold, dread
increment, and required run length open for calibration. No decay term is
introduced.
