# Simulation harness

Headless balance harness for Milestone 3. Runs scripted leader policies against
the shipping psychology engine and chess substrate via `src/orchestration/`.

## Usage

```bash
pnpm sim --matches=20 --leader=tyrannical --seed=7
pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --seed=1 --out=metrics.csv
```

Leaders: `tyrannical`, `supportive`, `volatile`, `servant`, `random`,
`pure_tactician`, `redeemer`.

When `--matches` is ≤ 20, smoke degeneracy bounds run before exit (CI gate).

## Layout

| File | Role |
|---|---|
| `cli.ts` | Argument parsing and CSV output |
| `campaign.ts` | Multi-match campaigns with roster carry-over |
| `match.ts` | Single-match wrapper around orchestration |
| `leaders.ts` | Scripted leader policies |
| `roster.ts` | Starting roster and campaign merge |
| `eval.ts` | Board features → psychology evaluation inputs |
| `metrics.ts` | Per-match and campaign aggregates |
| `degeneracy.ts` | Non-degeneracy smoke detectors |

Board evaluation uses geometric threat features (no Stockfish yet). Psychology
runs only for the player side; the opponent plays chess without verdicts.
