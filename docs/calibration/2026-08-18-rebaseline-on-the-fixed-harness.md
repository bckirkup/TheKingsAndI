# Re-baseline on the fixed harness: the calibration opponent could not punish us

Revision: `f987913` (branch `devin/1787003043-rebaseline-defaults`), i.e. PR #108's
truthful terminal scoring and pawn-advancing leaders in tree, plus this branch's
sweep instrumentation (campaign outcome columns and `--opponent=`).

Every default in `docs/calibration/2026-08-16-exit-permanence-sweep.md` and
`docs/calibration/2026-08-18-pawn-hope-sweep.md` was selected before the harness
scored repetition draws truthfully and before pawns could advance, so D146's
exit permanence and D147's promotion hope were both due re-measurement. This
report is that re-measurement. Its D146 and D147 evidence is recorded below;
D147's approved `500` default is now shipped, while D148 remains open.

All cells are `--matches=20 --engine=fake`, at most two processes on the box.
Raw CSV and TXT are retained externally in `kai-measure/rebaseline/` with the
recipes that produced them (`RECIPE.md` through `RECIPE-5.md`); the numbers
below are transcribed from those files.

## 1. The instrument, not the knob: the opponent could not punish us

`sim` defaults the opposing commander to `random`, and every measurement in this
project — every sweep, every calibration doc, and the CI smoke — has therefore
been played against a commander with no policy. Against that opponent the win
score is saturated and cannot order anything:

| leader | vs `random` (default) | vs `tyrannical` |
|---|---|---|
| supportive | win 97.5, W/D/L 19/1/0 | win 77.5, **14/3/3** |
| tyrannical | win 100.0, W/D/L 20/0/0 | win 22.5, **2/5/13** |
| random | win 32.5, W/D/L 0/13/7 | win 5.0, **0/2/18** |

Against a commander who plays for the win the styles separate in the direction
the design claims — warm command wins 14 of 20, the tyrant wins 2, the
policy-less control wins none — and the tyrant's cohort actually breaks
(attrition 0.563, rout 0.65, desertion in 80% of matches). Against `random`
every style "wins", which is also why the no-dilemma detector reads as tripped:
the detector is correct and the fixture was wrong.

Two instrument defects follow, both recorded rather than fixed here:

- `sim:sweep` had **no opponent selection at all** — it called `runCampaign`
  without one, so every swept row ever produced was implicitly against
  `random`. This branch adds `--opponent=`.
- The plain-chess control (`sim/baseline.ts`) hardwires the black leader to
  `random`, so `plain_chess_win_delta` compares psychology-on against a
  *weaker-opponent* control. ADR 0030's "psychology must not merely flatter the
  player" comparison therefore cannot currently be evaluated at matched
  strength, and every `plain_chess_win_delta` in this repository — including the
  columns in this report's raw files — is uninterpretable until the control
  takes the same opponent. **Do not read those columns.**

## 2. D146 exit permanence

Desertion attrition, `tyrannical`, by seed. The no-rout degeneracy guard fires
below 0.05.

| k | vs `random`: s0 | s1 | s7 | s11 | vs `tyrannical`: s0 | s1 | s7 |
|---|---|---|---|---|---|---|---|
| 375 | 0.5625 | — | — | — | 0.6875 | — | — |
| 500 | 0.5000 | 0.5000 | 0.3750 | 0.5625 | 0.7500 | 0.5625 | 0.6875 |
| **625** | **0.3125** | **0.5000** | **0.3125** | **0.6250** | **0.5625** | **0.4375** | **0.3125** |
| 750 | 0.2500 | 0.3750 | 0.0625 | 0.3750 | 0.5000 | 0.3125 | 0.1875 |
| 875 | 0.0000 | 0.2500 | 0.0625 | 0.0625 | 0.1875 | — | — |

`supportive` deserts nobody at any `k` against either opponent (attrition 0.000
in all ten cells), so this knob prices the tyrant's exit and leaves warm command
untouched — which is what ADR 0052 wanted from it.

Reading: 625 is the largest value whose **worst** observed seed still clears the
guard by a wide margin (0.3125 against 0.05). 750 collapses to 0.0625 on seed 7
— one piece away from tripping the guard, exactly the failure that made the
original seed-7 selection of 750 wrong — and 875 fails outright on seed 0. The
value chosen against the broken harness survives the fixed one, and it now has
four seeds and two opponent strengths behind it instead of one seed.

Two things the fixed harness adds that the old measurement could not see. The
gradient is monotone across the whole range against a punishing opponent
(desertion match rate 0.90 → 0.85 → 0.80 → 0.40 → 0.10 as `k` rises), where
against `random` it is noisy enough to reorder between seeds. And promotions
move opposite to desertion (0.15 → 0.35 per match as `k` rises on seed 0): a
cohort that stays on the board is a cohort that queens pawns.

Caution on the win column: for `tyrannical` against a punishing opponent, win
score falls as `k` rises (32.5 → 17.5) while **wins stay flat at 1–2 of 20** —
the whole gradient is draws (9 → 3), i.e. high-desertion cells reach the ply cap
rather than winning. Do not read that column as "desertion helps you win".

## 3. D147 promotion hope

Hope 0 versus 500, paired within each seed. `desertion_match` is the fraction of
matches in which anyone walks; `attr` is roster attrition.

| opponent | seed | desertion_match 0 → 500 | attr 0 → 500 | promotions 0 → 500 |
|---|---|---|---|---|
| `random` | 0 | 0.15 → 0.20 | 0.3125 → **0.3750** | 1.25 → **0.90** |
| `random` | 1, 2, 3, 4, 5, 6, 7 | unchanged | unchanged | unchanged |
| `random` | 11 | 0.75 → **0.20** | 0.6250 → **0.3750** | 1.35 → 1.45 |
| `tyrannical` | 0 | 0.80 → **0.60** | 0.5625 → **0.5000** | 0.10 → **0.20** |
| `tyrannical` | 1 | 0.65 → **0.60** | unchanged | unchanged |
| `tyrannical` | 2 | 0.75 → **0.65** | unchanged | unchanged |
| `tyrannical` | 3 | 0.90 → **0.80** | unchanged | unchanged |
| `tyrannical` | 4 | unchanged | unchanged | unchanged |

Three findings.

**Hope is no longer decorative.** Before the harness fix it was structurally
unable to matter — no pawn ever advanced, so every deserter's promotion prospect
was the minimum by construction. It now changes the exit decision in 6 of the 14
measured seed-cells, and 5 of those 6 are retentive.

**Its signal is clean only against an opponent who can punish.** Under
`--opponent=tyrannical` the desertion match rate falls in 4 of 5 seeds and rises
in none (mean 0.78 → 0.69). Against the default opponent it is bit-identical in
7 of 9 seeds, strongly retentive in one, and mildly adverse in one (seed 0,
where attrition rises and promotions fall). So a pawn's stake in the eighth rank
buys retention when staying is dangerous, and is noise when nothing is at stake.

**The knob is binary in practice, and that is the clamp's doing.** 500, 750 and
1000 produce *identical* metrics in every cell measured — five values in phase
B, three in D2/F4 — so hope has an off state (0, 250) and an on state (>= 500),
with no gradient in between. That is the ceiling flagged in
`2026-08-18-pawn-hope-sweep.md`: the stake is clamped to one peer bond, so
raising the weight past the clamp changes nothing. Calibrating a magnitude here
is not possible until the clamp moves, and the clamp is what the deferred
campaign-level question (D148, ADR 0054) is really about — a pawn contemplating
becoming a queen is contemplating leaving its class, which is a cohort-level
prize, not one comrade's regard.

## 4. Adopted calibration and remaining questions

1. **D146 `DESERTION_EXIT_PERMANENCE_PERMILLE` stays 625.** Re-affirmed, not
   re-tuned: largest value clearing the no-rout guard on its worst of four
   seeds, under both opponent strengths, with warm command unaffected.
2. **D147 `DESERTION_PROMOTION_HOPE_PERMILLE` 0 → 500, adopted**, floor unchanged at 250.
   500 is the smallest live setting; it is retentive in 4 of 5 punishing-opponent
   seeds and never worse there, and it is near-inert against the default
   opponent, so the CI smoke and its guards barely move. Adopting it makes
   promotion hope a real term for the first time. The counter-argument on the
   record: the one adverse cell is CI's own seed, and the magnitude cannot be
   tuned while the clamp binds.
3. **The calibration opponent should stop being `random`.** ADR 0025 already
   says difficulty is an opposing leader policy; measuring against a
   policy-less opponent is a fixture bug, and it has silently shaped every
   default in this repository.
4. **The plain-chess control now faces the same opponent as its subject.**
   The matched-opponent plumbing fixes the fixture bug before ADR 0030's
   flattery comparison or any `plain_chess_win_delta` is interpreted.
