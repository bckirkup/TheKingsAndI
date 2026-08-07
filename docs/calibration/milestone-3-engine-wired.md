# Milestone 3 — Post engine-wiring calibration report

_Date: 2026-08-07. Seed: 7. The historical comparison used 20 matches. The
corrected post-change checks deliberately use small match counts to keep engine
runtime bounded._

## Harness configuration

- Play path: `EnginePort` → ADR 0034 barrier → `insightToEvaluation` (Phase 2).
- Desertion cascade, witnesses, sacrifice attribution, and costly signals are live (Phase 3).
- Runtime simulation defaults to Lozza; CI smoke explicitly uses `--engine=fake`.
- Stockfish remains an explicit high-fidelity calibration option.
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

## Corrected post-change checks

The fake implementation now uses a stable FEN-derived notional value plus a
bounded depth error that shrinks toward the depth-16 limit. This replaces the
invalid depth-seeded pseudo-random score that made the independent leader seat
pure noise.

```text
pnpm sim --matches=2 --campaign=2 --leader=tyrannical --seed=7 --engine=fake
Milestone 3 harness: 2 matches for tyrannical (sim-fake/depth-fixed).
refusal=0.050 quiet_quit=0.024 desertion_campaign=1.000 rout_campaign=1.000
refused_good=0.500 override=0.439 win=0.0 trust_delta=-58.53
WALL_SECONDS=1.080

pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=12 --matches=2 --seed=7 --engine=fake
OUTCOME_TRUST_LOSS_SCALE,12,0.0500,1.0000,0.4393,0.0,-58.53,-50.0
WALL_SECONDS=1.982
```

The reduced run measured refusal 5.0%, desertion 100%, rout 100%, override
43.9%, win score 0.0, plain-chess delta -50.0, and trust delta -58.53. The
negative win delta is now semantically correct because routs score 0 and the
plain-chess baseline uses the same scorer. The different campaign length makes
this directional rather than a replacement for the historical 20-match run.

Lozza was measured with a deliberately reduced one-match, depth-4 calibration
wrapper because production depth 12 is too slow for iterative calibration:

```text
pnpm exec tsx -e "import { createLozzaPort, disposeLozzaPort } from './src/engine/index.ts'; import { runCampaign } from './sim/campaign.ts'; (async()=>{ const base=createLozzaPort(); const engine={determinismId:'lozza-11/depth-fixed/cap-4-calibration', evaluate:(fen:string, depth:number, profile:Readonly<Record<string,number>>={})=>base.evaluate(fen, Math.min(depth,4), profile)}; const result=await runCampaign({matches:1,leader:'tyrannical',seed:7,engine}); console.log(JSON.stringify({id:result.determinismId,summary:result.summary})); await disposeLozzaPort(); })();"
engine=lozza-11/depth-fixed/cap-4-calibration
refusal=0.000 quiet_quit=0.024 desertion_campaign=1.000 rout_campaign=1.000
refused_good=0.000 override=0.429 win=0.0 trust_delta=-31.00
plain-chess win delta=-50.0
WALL_SECONDS=1.257
```

The production-depth probe
`pnpm sim --matches=1 --campaign=1 --leader=tyrannical --seed=7 --engine=lozza`
was stopped after more than three minutes without completing. The initial
attempt also exposed concurrent use of the single Lozza UCI process; the
adapter now serializes requests through a deterministic queue.

The remaining cost is expected from the per-ply actor and leader searches plus
a separate audit search. The current broker's shared-FEN cache cannot reuse a
Lozza depth ladder or true audit result. No larger optimization was attempted
in this PR.

Both corrected reduced checks have the intended negative win delta, but
desertion/rout remain saturated and refusal is below the tyrant target band.
Those are real calibration findings, not fake-engine noise. No coefficients
were tuned to conceal them.

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
pnpm sim --matches=20 --leader=tyrannical --seed=7  # Lozza default
pnpm sim --matches=20 --leader=supportive --seed=7  # Lozza default
pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4 --seed=7
pnpm sim --matches=20 --leader=tyrannical --engine=fake  # CI/test smoke
pnpm sim --matches=4 --leader=tyrannical --engine=stockfish --campaign=4
```
