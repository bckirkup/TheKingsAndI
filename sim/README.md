# Simulation harness

Headless balance harness for Milestone 3. Runs scripted leader policies against
the shipping psychology engine and chess substrate via `src/orchestration/`.

## Usage

```bash
pnpm sim --matches=20 --leader=tyrannical --seed=7
pnpm sim --matches=20 --leader=tyrannical --engine=lozza
pnpm sim --matches=20 --leader=tyrannical --engine=lozza --depth-cap=4
pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --seed=1 --out=metrics.csv
pnpm sim --matches=3 --campaign=3 --leader=tyrannical --seed=1 --engine=fake --checkpoint-out=checkpoint.json
pnpm sim --matches=6 --campaign=6 --leader=tyrannical --seed=1 --engine=fake --resume=checkpoint.json
pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4 --seed=7
```

Leaders: `tyrannical`, `supportive`, `volatile`, `servant`, `random`,
`pure_tactician`, `redeemer`.

Engines: `lozza` (default runtime), `fake` (explicit CI/test mode), `stockfish`
(explicit high-fidelity calibration mode).

Lozza uses a harness-only default depth cap of 4 so the documented 20-match
smoke remains tractable. `--depth-cap=N` clamps only the depth sent to the
selected engine; it does not change psychology's `calculateEngineSearchDepth`
or any piece state. A capped run is a tractability proxy, not full-fidelity
calibration. Pass `--depth-cap` explicitly (or use Stockfish without a cap)
when measuring engine fidelity.

When `--matches` is ≤ 20, smoke degeneracy bounds run before exit (CI gate).

Campaign output includes four match-index quartile trajectory bands. Each band
reports mean ability trust, mean benevolence trust, refusal rate, desertion
rate, rout rate, and mean surviving roster size. Match indices are assigned by
`floor(((match - 1) * 4) / campaignMatches) + 1`; any remainder matches go to
the earlier quartiles. The CSV appends the channel metrics and roster size to
each existing match row, then appends a trajectory-band section.

The first two quartiles are the early-frustration check: desertion and rout
rates of 80% or more in either early quartile are a hard smoke failure. This
threshold is intentionally above the existing 50% supportive bound and marks
near-total early collapse rather than ordinary variation.

Campaign checkpoints are emitted with `--checkpoint-out=path` and resumed with
`--resume=path`. Use `--campaign` with those flags to set the total campaign
length: a checkpoint plus `--campaign` is what makes a campaign segment
resumable. Checkpoints resume only at a completed-match boundary, before the
next match's roster merge; there is no mid-match resume. Resuming requires the
same engine determinism ID, psychology configuration, leader, and seed, and
throws a mismatch error instead of silently producing incomparable numbers.

Scheduled Lozza calibration (N≈100, tyrannical + supportive, plus a one-knob
sweep) runs in GitHub Actions via `.github/workflows/nightly.yml` so balance
signal does not require Cursor agent time. Stockfish production-depth runs are
`workflow_dispatch` only on that same workflow, with an explicit match budget.
See `docs/testing_strategy.md` §7.

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
| `metrics.ts` | Per-match and campaign aggregates + trust trajectory bands |
| `degeneracy.ts` | Non-degeneracy smoke detectors |

Depth-`D_i` insights feed psychology through the ADR 0034 barrier. Psychology
runs for the player side; the opponent plays chess without verdicts unless a
future Milestone 5b enemy-roster path lands.
