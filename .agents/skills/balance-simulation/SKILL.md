---
name: balance-simulation
description: Run and interpret The Kings and I headless self-play harness to calibrate psychology weights and detect degenerate balance. Use for any balance, tuning, or emergent-behavior question in TheKingsAndI.
---

# Balance Simulation & Calibration

The harness is how we find out whether the psychology model is *interesting*.
It is not optional tooling; it is the primary validation instrument (Milestone 3
in `docs/development_plan.md`, before UI work).

## Planned interface

```bash
pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --seed=1 --out=metrics.csv
```

Scripted leader styles: `tyrannical`, `supportive`, `volatile`, `servant`,
`random`. Each is a deterministic policy over `(position, rosterState)` that
chooses moves with a characteristic disregard for or attention to piece welfare.
`random` is the control: it must produce metrics distinguishable from all others,
or the model is not responding to leadership behavior at all.

## Run configuration rules

- Narration is an authored tree with no model call anywhere (ADR 0004), so the
  harness needs no "LLM off" switch and costs nothing to run.
- Engine in deterministic mode: fixed depth, single thread, fixed hash.
- `pnpm sim` defaults to the real Lozza engine behind a harness-only
  `--depth-cap=4` wrapper. The documented 20-match smoke takes about 5 seconds
  on the reference box. The wrapper records the cap in the determinism ID; it
  does not change `calculateEngineSearchDepth`, psychology, or piece `D_i`
  allocation.
- CI must select the fast deterministic substrate explicitly:
  `pnpm sim --matches=20 --leader=tyrannical --engine=fake`.
- Stockfish production-depth runs are on-demand or nightly only. The measured
  cost is more than 251 seconds **per match** for one production-depth
  tyrannical match, so a Stockfish sweep requires an explicit runtime budget.
  Never launch one as casual verification.
- One seed per match, derived from a campaign seed; record both in the output so
  any interesting match can be replayed exactly.
- Sweep one parameter at a time. A sweep that moves three weights at once tells
  you nothing about which one mattered.

The coherent fake engine is a legitimate fast substrate for deterministic
relative comparisons: it uses a stable FEN-derived deep-limit score plus a
bounded error term that shrinks with depth. Its absolute rates are not real
chess and must not be quoted as calibration results.

## Verification discipline

- While iterating, run only the targeted Vitest files covering the changed
  behavior.
- Before opening a PR, run the full gate once: lint, typecheck, full test,
  build, the simulation smoke, and `pre-commit run --all-files`.
- Run `pnpm test:coverage` only when the SonarQube gate requests coverage.
- For status questions, read the committed numbers in
  `docs/calibration/` first. Do not re-run the harness merely to repeat a
  previously recorded result.
- Prefer GitHub Actions over Cursor agent sessions for routine harness runs
  (`docs/testing_strategy.md` §7): PR CI uses `--engine=fake`; nightly Lozza
  calibration lives in `.github/workflows/nightly.yml`. Agents interpret
  artifacts and triage failures — they are not the scheduled runner.

## Metrics to collect

refusal rate · **refused-good-move rate** · quiet-quit ply share · desertion
incidence per campaign · cascade length · trust
trajectory (mean/variance, per role class) · class-bias drift · roster turnover
and its win-rate cost · win rate vs. plain-chess control at matched engine
strength · archetype classification distribution.

## Degeneracy detectors (fail the build)

1. Desertion rate ≈ 0 for `tyrannical` → no consequences. A tyrant whose roster
   never routs is a bug, not a balanced game (ADR 0011).
2. Desertion rate > 80% for `supportive` → noise dominates signal.
2b. Refused-good-move rate ≈ 0 → refusal is toothless, and under ADR 0002 +
   ADR 0008 it is the only mid-match lever the psychology has. It also means
   pieces have gone omniscient despite ADR 0013.
2c. `tyrannical` and `supportive` override at indistinguishable rates, or nobody
   ever overrides → the override price (D35) is mis-tuned (ADR 0014).
3. Refusal rate ≈ 0 or ≈ 1 across all styles → thresholds mis-scaled.
4. Trust monotonic regardless of play → something is dead-wired.
5. Class-bias variance ≈ 0 after 20 matches → relationship layer inert.
6. `supportive` win rate ≥ plain chess → there is no dilemma, so there is no game.

Detector 6 is the subtle one: if kindness is strictly optimal, the design's
central tension is absent and no amount of prose will hide it.

## Calibration procedure

1. Fix the acceptance bands *before* tuning (`docs/testing_strategy.md` §4).
2. Use a deliberately small, documented run first when estimating direction
   or cost. Record the exact engine, depth cap, seed set, match count, and wall
   time in `docs/calibration/`.
3. Coarse pass: order-of-magnitude sweeps (0.1×, 1×, 10×) on the trait weights
   (`w_courage`, `w_empathy`, `w_loyalty`, `w_honor`, `w_ambition`), the
   `Θ_refusal` slope/intercept, and the `ENGINE_CONFIG` benching and
   sacrifice-shift constants — 200 matches each. Stockfish requires an
   explicit runtime budget before this step.
4. Fine pass: 1,000 matches on the surviving 2–3 candidate configs.
5. Commit the chosen weights **plus** the metrics file and a short rationale.
   A calibration commit without its evidence is unreviewable.
6. Timebox the whole exercise (one week). Ship "non-degenerate and directionally
   correct," not "elegant."

## Interpreting results

- Never "fix" a cascade with damping — see ADR 0011. If a rout looks wrong,
  the bug is in `λ_i` scaling or in legibility, not in the cascade.
- Look at *distributions*, not means. A model with the right mean desertion rate but
  bimodal outcomes plays as random cruelty.
- Always ask which ply the narrative turning point landed on. If turning points
  cluster at ply 1–3, pieces are judging the player before the player has done
  anything.
- Cross-check with a human playtest before accepting a config. The harness can
  only prove the model is *non-degenerate*, never that it is fun.
