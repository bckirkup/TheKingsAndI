# Simulation harness

Headless balance harness for Milestone 3. Runs scripted leader policies against
the shipping psychology engine and chess substrate via `src/orchestration/`.

## Usage

```bash
pnpm sim --matches=20 --leader=tyrannical --seed=7
pnpm sim --matches=20 --leader=tyrannical --engine=lozza
pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --seed=1 --out=metrics.csv
pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4 --seed=7
```

Leaders: `tyrannical`, `supportive`, `volatile`, `servant`, `random`,
`pure_tactician`, `redeemer`.

Engines: `lozza` (default runtime), `fake` (explicit CI/test mode), `stockfish`
(explicit high-fidelity calibration mode).

When `--matches` is ≤ 20, smoke degeneracy bounds run before exit (CI gate).

## Layout

| File | Role |
|---|---|
| `cli.ts` | Argument parsing and CSV output |
| `campaign.ts` | Multi-match campaigns with roster carry-over |
| `match.ts` | Single-match wrapper around orchestration |
| `engine.ts` | Harness `EnginePort` factory |
| `leaders.ts` | Scripted leader policies |
| `roster.ts` | Starting roster and campaign merge |
| `eval.ts` | Legacy geometric mapper (play path uses engine insights) |
| `baseline.ts` | Plain-chess win-rate baseline (no psychology) |
| `sweep.ts` | Coefficient sweep runner (M3.4) |
| `metrics.ts` | Per-match and campaign aggregates + trust trajectory |
| `degeneracy.ts` | Non-degeneracy smoke detectors |

Depth-`D_i` insights feed psychology through the ADR 0034 barrier. Psychology
runs for the player side; the opponent plays chess without verdicts unless a
future Milestone 5b enemy-roster path lands.
