---
name: balance-simulation
description: Run and interpret The King and I headless self-play harness to calibrate psychology weights and detect degenerate balance. Use for any balance, tuning, or emergent-behavior question in TheKingAndI.
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
- One seed per match, derived from a campaign seed; record both in the output so
  any interesting match can be replayed exactly.
- Sweep one parameter at a time. A sweep that moves three weights at once tells
  you nothing about which one mattered.

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
   ADR 0008 it is the only mid-match lever the psychology has.
3. Refusal rate ≈ 0 or ≈ 1 across all styles → thresholds mis-scaled.
4. Trust monotonic regardless of play → something is dead-wired.
5. Class-bias variance ≈ 0 after 20 matches → relationship layer inert.
6. `supportive` win rate ≥ plain chess → there is no dilemma, so there is no game.

Detector 6 is the subtle one: if kindness is strictly optimal, the design's
central tension is absent and no amount of prose will hide it.

## Calibration procedure

1. Fix the acceptance bands *before* tuning (`docs/testing_strategy.md` §4).
2. Coarse pass: order-of-magnitude sweeps (0.1×, 1×, 10×) on the trait weights
   (`w_courage`, `w_empathy`, `w_loyalty`, `w_honor`, `w_ambition`), the
   `Θ_refusal` slope/intercept, and the `ENGINE_CONFIG` benching and
   sacrifice-shift constants — 200 matches each.
3. Fine pass: 1,000 matches on the surviving 2–3 candidate configs.
4. Commit the chosen weights **plus** the metrics file and a short rationale.
   A calibration commit without its evidence is unreviewable.
5. Timebox the whole exercise (one week). Ship "non-degenerate and directionally
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
