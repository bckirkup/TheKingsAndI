# Psychology

Pure reducers and decision functions for Milestone 2.

## Landed

- `ENGINE_CONFIG` with golden + sensitivity probes for every knob
- Deterministic math via `src/core/math.ts` (ADR 0032 §4)
- Search-depth allocation, tactical utility (no additive trust — ADR 0015)
- Credence-weighted perception (`τ_benev`, `τ_abil`) and expendable refusal
- Full verdict ladder including desertion via `U_desert` vs `U_stay` (ADR 0011)
- Override path with witness penalties (ADR 0014)
- Belief channels: leader prior, geometric attention, rumor diffusion (ADR 0016)
- Witness appraisal of desertion (ADR 0018) and sacrifice attribution gate (2.4)
- Outcome→trust and costly-signal credits (ADR 0007)
- Append-only `MatchEvent` union and deterministic replayer (2.6)

## Not yet written

- Orchestration match loop wiring psychology into chess commits
- Full sacrifice detection (engine eval must supply `SacrificeAttribution` per ply)
- Milestone 3 harness leaders and calibration
