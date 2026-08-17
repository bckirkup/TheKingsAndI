# Harness Plays Chess

## Diagnosis

Before this change, every scripted style used a greedy one-ply argmax. Equal
scores were resolved by legal-move generation order, there was no awareness of
repeated positions, and the score contained no positional term. The resulting
policies repeatedly selected rook shuffles and reached threefold-repetition
draws rather than playing varied games. On the pool path, controlled campaigns
recorded only 1–8 own-pawn moves per match, the highest pawn rank was 4, and
there were 0 promotions in 180 matches.

The outcome instrument had a second defect. `LivingBoard.isGameOver()` includes
threefold repetition, while the old `scoreMatchOutcome` treated every game-over
board as decisive using turn parity. In the supportive 20-match observation,
18 apparent wins were repetition draws rather than checkmates or enemy routs.

The harness now penalizes moves entering a previously seen position, rewards a
small improvement in promotion prospect, and uses seeded tie-breaking among
equal-scoring candidates. Outcome scoring distinguishes checkmate from drawn
positions and routs. Promotion counts are folded from `PROMOTION` events.

## Fake-engine before/after measurement

Each run used 20 matches, one campaign, the fake engine, and the default seed.
The baseline was measured from `origin/main` before this change; the after
measurement was taken from this branch.

| Leader | Before mean plies | After mean plies | Before W/D/L | After W/D/L | Before desertion match / attrition | After desertion match / attrition | After promotions/match | Promotion match rate |
| --- | ---: | ---: | --- | --- | --- | --- | ---: | ---: |
| tyrannical | 81.0 | 48.8 | 19/0/1 | 20/0/0 | 0.100 / 0.125 | 0.150 / 0.313 | 1.250 | 0.800 |
| supportive | 123.7 | 61.6 | 15/2/3 | 19/1/0 | 0.100 / 0.063 | 0.000 / 0.000 | 1.400 | 0.950 |
| random | 171.3 | 171.3 | 0/11/9 | 0/13/7 | 0.950 / 0.500 | 0.950 / 0.500 | 0.150 | 0.100 |

The before CLI predated promotion telemetry; the baseline promotion count was
0 from the controlled measurement and the 180-match pool-path observation.
After promoted-role totals were tyrannical Queen 21/Rook 4, supportive
Queen 26/Bishop 1/Rook 1, and random Bishop 2/Queen 1.

Mean plies did not rise for tyrannical or supportive because the revised
instrument reaches decisive positions sooner instead of counting repetition
shuffles as outcomes. Random was unchanged. The previous parity-scored
repetition wins are no longer decisive wins; non-checkmate, non-rout endings
are drawn. Exact repetition-draw share is not currently emitted as a separate
metric.

## Promotion refusal evidence

The approximately 16% tyrannical underpromotion rate is an emergent refusal
effect, not a promotion-generation defect. In a seed-11 tyrannical-versus-
random fake-engine match, the leader first chose `dxc8=Q`, but the pawn refused
that order because the promotion square carried the same `pCaptured = 0.8`
static-exchange risk for every promotion. The refusal event was:

```text
REFUSAL { ply: 15, pieceId: 'w:P:c2', san: 'dxc8=Q', utility: 1.318, threshold: 2.34, perceivedValue: 1.31 }
```

Refusal is free to re-plan under ADR 0002, so the next pass accepted
`dxc8=R`. All four promotions were legal and generated. In the captured
post-refusal candidate list, the scores were Bishop **47.18**, Knight
**47.18**, and Rook **67.18**; Queen was absent because it had already been
refused, not because it was illegal or tied away. No behavior was changed by
this finding. The remaining question — whether a refusal keyed by SAN should
allow the same piece to accept a different promotion of the same move — is a
design question for the decision register and is intentionally not decided
here.

## Harness-runtime follow-up

The tyrannical 20-match smoke takes approximately **350 seconds**; the
per-candidate board clone in `repetitionCountAfter` dominates runtime, so
hoisting the promotion-prospect total was behavior-preserving but not a
measured speedup.

## Calibration caveat

Every default calibrated before this fix — D146 exit permanence **625**, the
D147 hope weight and credence floor, and the degeneracy gate's oracle
comparison in `sim/baseline.ts`/`sim/degeneracy.ts` — was chosen against the
broken instrument and is due re-measurement. No calibration value was
re-tuned in this change.
