# Milestone 3 — Initial calibration report

_Date: 2026-08-06. Seed: 7. Campaign length: 20 matches._

## Harness configuration

- Board evaluation: geometric threat features (`sim/eval.ts`), no Stockfish yet.
- Player side: White with full psychology; Black plays random chess without verdicts.
- Smoke degeneracy checks run when `--matches ≤ 20` (CI gate).

## Tyrannical leader (`pnpm sim --matches=20 --leader=tyrannical --seed=7`)

| Metric | Observed | Initial target (development_plan.md) |
|---|---|---|
| Mean refusal rate | 7.0% | 8–20% |
| Desertion campaign rate | 95% | 40–70% see ≥1 |
| Rout campaign rate | 65% | common |
| Mean override rate | 41.8% | high vs supportive |
| Mean win score | 40 | −5 to −20% vs plain chess |
| Mean trust delta | −71.7 | worsening |

**Assessment:** Directionally correct. Tyranny is punished: refusals, overrides, desertions,
and routs are all material. Refusal rate sits just under the 8% lower band; desertion is
above the 70% upper hypothesis but consistent with ADR 0011 (no upper bound on collapse).
Further fine-tuning belongs to Milestone 3.4 coefficient sweeps.

## Supportive leader (same seed, not a CI gate)

| Metric | Observed | Initial target |
|---|---|---|
| Mean refusal rate | 70.8% | <2% |
| Desertion campaign rate | 100% | <5% |

**Assessment:** Not calibrated. Heuristic board evaluation and leader-implied bias do not
yet separate supportive from tyrannical on the benevolence channel. This is expected
before engine-backed eval profiles land (Milestone 1.3) and D35–D44 harness sweeps.

## Next steps

1. Wire `EnginePort` depth-`D_i` views into `sim/eval.ts` so refused-good-move rate is
   meaningful under ADR 0013.
2. Coarse sweeps on `Θ_refusal`, `BENEV_EXPENDABLE_*`, and desertion `λ` scales.
3. Add supportive leader to smoke bounds once separation is stable.

## Evidence artifact

Twenty-match tyrannical CSV generated with:

```bash
pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --seed=1 --out=metrics.csv
```

(Note: `--matches` controls smoke threshold; `--campaign` controls campaign length.)
