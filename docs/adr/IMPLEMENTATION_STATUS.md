# ADR implementation status (0035–0047)

Agent-facing matrix: **decided** ≠ **shipped**. Prefer this over README banners
when answering “does three-channel credence exist yet?”

| ADR | Topic | Decision | Live code |
|---|---|---|---|
| 0035 | Three-channel keyed credence (D49) | Accepted | **Not wired** — `CredenceState` is still `{tauBenev, tauAbil, abilityObservationCount}`; reputation transfer averages scalars |
| 0036 | Separate engine audit stream (D50) | Accepted | **Not persisted** — true `D_max` eval is ephemeral on the orchestration path |
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

Open calibration decisions (D35, D40, D42–D44, and later magnitude Ds) remain
harness work — do not silently close them by changing defaults without a
report in `docs/calibration/`.

Current balance numbers: `docs/calibration/2026-08-10-state-of-play.md`.
