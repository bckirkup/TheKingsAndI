# Milestone 3 — Post engine-wiring calibration report

_Date: 2026-08-07. Seed: 7. The historical comparison used 20 matches. The
corrected post-change checks deliberately use small match counts to keep engine
runtime bounded._

For measurements taken after ADR 0037, ADR 0038, and ADR 0039, the numbers in
this historical report are superseded by `2026-08-10-state-of-play.md`.

## Harness configuration

- Play path: `EnginePort` → ADR 0034 barrier → `insightToEvaluation` (Phase 2).
- Desertion cascade, witnesses, sacrifice attribution, and costly signals are live (Phase 3).
- Runtime simulation defaults to Lozza; CI smoke explicitly uses `--engine=fake`.
- The default Lozza CLI depth cap is 4; it is a harness-only tractability cap.
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

The uncapped production-depth probe
`pnpm sim --matches=1 --campaign=1 --leader=tyrannical --seed=7 --engine=lozza`
was stopped after more than three minutes without completing. The initial
attempt also exposed concurrent use of the single Lozza UCI process; the
adapter now serializes requests through a deterministic queue.

The remaining cost is expected from the per-ply actor and leader searches plus
a separate audit search. The current broker's shared-FEN cache cannot reuse a
Lozza depth ladder or true audit result. No larger optimization was attempted
in this PR.

The documented default smoke was measured with the cap:

```text
pnpm sim --matches=20 --leader=tyrannical --seed=7
engine=lozza-11/depth-fixed/hash-16/threads-1/depth-cap-4
refusal=0.076 quiet_quit=0.012 desertion_campaign=0.950 rout_campaign=0.950
refused_good=0.950 override=0.446 win=0.0 trust_delta=-77.58
WALL_SECONDS=4.597
```

## Early trajectory saturation

The new quartile detector was run against the fake engine using the current
coefficients:

```text
pnpm sim --matches=16 --campaign=16 --leader=tyrannical --seed=7 --engine=fake
engine=sim-fake/depth-fixed
quartile=1 matches=1-4 tau_abil=50.00 tau_benev=50.00 refusal=0.077 desertion=1.000 rout=1.000 roster=1.00
quartile=2 matches=5-8 tau_abil=55.55 tau_benev=52.34 refusal=0.046 desertion=0.750 rout=0.750 roster=4.75
quartile=3 matches=9-12 tau_abil=65.00 tau_benev=56.00 refusal=0.053 desertion=1.000 rout=1.000 roster=1.00
quartile=4 matches=13-16 tau_abil=65.00 tau_benev=56.00 refusal=0.101 desertion=1.000 rout=1.000 roster=1.00
```

The fake-engine run is explicitly labelled because it is the deterministic CI
substrate rather than a real-engine fidelity measurement. Its first quartile
already has 100% desertion and 100% rout incidence. The intensive's 16-match
diagnostic therefore collapses well before the end of the second quartile,
which is the approximately 2.5-day point the seminar needs. Today's
coefficients do not meet Milestone 3's exit criteria. No coefficient tuning was
performed.

## Engine timing and memory probe

The corrected Stockfish ceiling was measured on one pinned vCPU with seed 1:

| Engine | Run | Wall time | Plies | Mean per ply |
|---|---|---:|---:|---:|
| fake | pinned single match, seed 1 | 0.886545 s | 20 | 0.044327 s |
| Lozza depth 4 | pinned single match, seed 1 | 1.202602 s | 20 | 0.060130 s |
| Stockfish depth 16 | pinned single match, seed 1 | 6.226720 s | 20 | **0.311336 s** |

The Stockfish determinism ID was
`stockfish-js-18-lite-single/hash-16/threads-1/dmax-16`. All three samples
ended in a natural 20-ply rout rather than at `MAX_PLIES=200`; the Stockfish
measurement is therefore n=1 and is not by itself a campaign-average sample.

The comparable pinned campaign means were:

| Engine | 16 matches | 52 matches |
|---|---:|---:|
| fake | 0.214776 s/match | 0.182405 s/match |
| Lozza depth 4 | 0.319153 s/match | 0.235001 s/match |

Those campaign means came from 16- and 52-match runs with the same harness
configuration and show that a short rout is not representative of a typical
campaign match.

Peak RSS, including the Node process itself, was measured on pinned
single-match runs:

| Engine | Node RSS | Engine child RSS | Total peak RSS |
|---|---:|---:|---:|
| fake | 96.754 MiB | 138.473 MiB | 235.227 MiB |
| Lozza depth 4 | 97.055 MiB | 211.953 MiB | 309.008 MiB |
| Stockfish depth 16 | 96.762 MiB | 470.652 MiB | **567.414 MiB** |

The Stockfish result establishes that a 2 GiB worker has substantial memory
headroom for this single-world workload.

### Single-vCPU seminar projection

The current harness has no cohort concept. The honest approximation used here
is one shared-world seminar costing `participants × matches-per-participant`
single-participant campaign matches. It does not model cohort-specific
cross-student circulation, but it does not split a shared world across cores.

Fake and Lozza use their measured pinned campaign means:

| Participants | Format | Matches | Fake | Lozza depth 4 |
|---:|---|---:|---:|---:|
| 12 | Intensive, 16/person | 192 | 41.237 s / 0.0115 h | 61.277 s / 0.0170 h |
| 24 | Intensive, 16/person | 384 | 82.474 s / 0.0229 h | 122.555 s / 0.0340 h |
| 12 | Nibelungen, 52/person | 624 | 113.821 s / 0.0316 h | 146.641 s / 0.0407 h |
| 24 | Nibelungen, 52/person | 1248 | 227.642 s / 0.0632 h | 293.281 s / 0.0815 h |

The Stockfish single-match sample was a 20-ply rout, so using its raw
6.226720-second match cost would understate the expected campaign cost. Its
ply-normalized rate of 0.311336 s/ply was applied to the measured campaign
mean of approximately 36–38 plies (37 plies for the midpoint estimates below):

| Participants | Format | Matches | Stockfish depth 16, normalized |
|---:|---|---:|---:|
| 12 | Intensive, 16/person | 192 | ~2212 s / **0.61 h** (0.60–0.63 h) |
| 24 | Intensive, 16/person | 384 | ~4423 s / **1.23 h** (1.20–1.26 h) |
| 12 | Nibelungen, 52/person | 624 | ~7188 s / **2.00 h** (1.94–2.05 h) |
| 24 | Nibelungen, 52/person | 1248 | ~14376 s / **3.99 h** (3.89–4.09 h) |

For the pessimistic `MAX_PLIES=200` bound, the same Stockfish ply rate gives
approximately 62.27 seconds per match:

| Participants | Format | Matches | Stockfish at 200 plies |
|---:|---|---:|---:|
| 12 | Intensive, 16/person | 192 | ~3.32 h |
| 24 | Intensive, 16/person | 384 | ~6.64 h |
| 12 | Nibelungen, 52/person | 624 | ~10.80 h |
| 24 | Nibelungen, 52/person | 1248 | ~21.60 h |

The earlier statement that a match took more than 251 seconds is withdrawn.
It was a single aborted observation taken before the `dMax: 8` truncation was
removed, so it is not comparable to the corrected depth-16 measurement and
must not be used for projections.

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
