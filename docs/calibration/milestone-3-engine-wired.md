# Milestone 3 — Post engine-wiring calibration report

_Date: 2026-08-07. Seed: 7. Campaign length: 20 matches. Engine: `sim-fake/depth-fixed` (depth-`D_i` insight path; Stockfish available via `--engine=stockfish`)._

## Harness configuration

- Play path: `EnginePort` → ADR 0034 barrier → `insightToEvaluation` (Phase 2).
- Desertion cascade, witnesses, sacrifice attribution, and costly signals are live (Phase 3).
- CI smoke uses `--engine=fake` for speed; calibration can switch to Lozza/Stockfish.
- Plain-chess baseline: same move picker, psychology skipped (`sim/baseline.ts`).
- Coefficient sweeps: `pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4`.

## Tyrannical leader (`pnpm sim --matches=20 --leader=tyrannical --seed=7`)

| Metric | Observed | Target (development_plan.md) |
|---|---|---|
| Mean refusal rate | 7.9% | 8–20% |
| Desertion campaign rate | 95% | 40–70% see ≥1 |
| Rout campaign rate | 95% | common |
| Mean override rate | 45.6% | high vs supportive |
| Mean win score | 47.5 | −5 to −20% vs plain chess |
| Plain-chess mean win (same picker) | 27.5 | baseline |
| Win delta vs plain chess | **+20** | target was negative |
| Mean trust delta | −76.7 | worsening |

**Assessment:** Tyranny is still punished by desertion/rout/trust collapse. Cascade lengths are now real (multi-piece within a ply). Refusal sits at the bottom of the 8–20% band. **Win-rate delta vs plain chess is the wrong sign** under the current win-score encoding (routs score 50, which can inflate the psychology campaign relative to unfinished plain-chess games at 50 / losses at 0). Treat the plain-chess comparison as provisional until win scoring for early terminations is calibrated (D35-adjacent).

Trust trajectory (mean trust at end of each match) is exported on `CampaignMetrics.trustTrajectory` (3.3).

## Supportive leader (same seed)

| Metric | Observed | Target |
|---|---|---|
| Mean refusal rate | 0.0% | <2% |
| Desertion campaign rate | 100% | <5% |
| Rout campaign rate | 100% | low |
| Mean override rate | 0.0% | low |
| Mean trust delta | −125.7 | stable/improving |

**Assessment:** Refusal separation vs tyrannical is now correct (0% vs ~8%). **Desertion/rout remain saturated** — supportive still collapses. Benevolence-channel separation is incomplete; cascade contagion from early departures dominates. Next sweeps should target desertion `λ` scales and initial trust / rumor priors before treating M3 as closed.

## Sweep notes

- Runner: [`sim/sweep.ts`](../../sim/sweep.ts) mutates `ENGINE_CONFIG` knobs for the duration of each point and restores them.
- Unit sensitivity confirmed for `OUTCOME_TRUST_LOSS_SCALE` via `applyMatchOutcomeTrust`.
- Campaign-level fingerprints for several knobs are currently clamped by early routs; lengthen campaigns or raise desertion hysteresis before using campaign fingerprints as the sole sensitivity signal.

## Config decision this pass

No coefficient shipped as a new default. Defaults remain those in `src/psychology/config.ts`. The calibrated *process* (baseline + sweep + report) is what this milestone lands; coefficient retunes belong to follow-up PRs once supportive desertion is below 50%.

## Commands

```bash
pnpm sim --matches=20 --leader=tyrannical --seed=7
pnpm sim --matches=20 --leader=supportive --seed=7
pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4 --seed=7
pnpm sim --matches=20 --leader=tyrannical --engine=lozza   # slower, real UCI
pnpm sim --matches=4 --leader=tyrannical --engine=stockfish --campaign=4
```
