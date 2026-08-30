# 2026-08-30 — Does cruelty ever lead? Three styles, three seeds

**Question.** D188's replacement gate (owner ruling: *abusive leaders may attain
the rewards they seek — in the mid run*) requires that a cruel style be able to
lead early and pay later. The 2026-08-30 single-seed reading said it never
leads at all. This pass asks whether that survives more than one seed.

**Method.** 3 leader styles × 3 seeds (7, 11, 13), 20 matches each, fake
engine, opponent `tyrannical`, grace inert (`GRACE_RATE_PERMILLE = 0`)
throughout, on the post-D192 carry. Counts are campaign totals; rates and means
are per-match means. Metrics come from `sim/metrics.ts` via `pnpm sim --out`.

## Outcome and its cost

| Cell | Win | Refusal | Overrides | Forced | Desertions | Retirements | Survivors/match | Quiet-quit | Mean ability |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `supportive` s7 | 72.50 | 0.063 | 0 | 0 | 1 | 14 | 7.60 | 0.206 | 58.9 |
| `supportive` s11 | 82.50 | 0.067 | 0 | 0 | 0 | 11 | 8.55 | 0.213 | 51.0 |
| `supportive` s13 | 92.50 | 0.057 | 0 | 0 | 0 | 12 | 8.65 | 0.200 | 50.9 |
| **`supportive` pooled** | **82.50** | 0.063 | 0 | 0 | **1** | 37 | **8.27** | **0.206** | 53.6 |
| `tyrannical` s7 | 52.50 | 0.142 | 960 | 0 | 46 | 19 | 3.35 | 0.034 | 47.7 |
| `tyrannical` s11 | 45.00 | 0.116 | 858 | 0 | 40 | 21 | 3.10 | 0.036 | 41.4 |
| `tyrannical` s13 | 45.00 | 0.141 | 884 | 0 | 40 | 24 | 3.00 | 0.040 | 41.1 |
| **`tyrannical` pooled** | **47.50** | 0.133 | 2702 | 0 | **126** | 64 | **3.15** | **0.037** | 43.4 |
| `steady` s7 | 30.00 | 0.529 | 944 | 21 | 36 | 27 | 2.20 | 0.055 | 22.3 |
| `steady` s11 | 40.00 | 0.532 | 1114 | 27 | 37 | 26 | 2.55 | 0.047 | 24.1 |
| `steady` s13 | 17.50 | 0.552 | 840 | 22 | 47 | 23 | 1.90 | 0.060 | 16.7 |
| **`steady` pooled** | **29.17** | 0.538 | 2898 | 70 | **120** | 76 | **2.22** | 0.054 | 21.1 |

## Readings

**1. The single-seed finding holds: cruelty never leads.** The worst
`supportive` seed (72.50) beats the best `tyrannical` seed (52.50), so the gap
is larger than the seed spread and the earlier reading was not a fluke. D188's
gate is not met, and the failure is in the direction the owner's ruling
forbids — not "cruelty leads too long" but "cruelty never leads".

**2. The trajectory is inverted.** Pooled win score over the first five and the
last five matches of each campaign:

| Style | Matches 1–5 | Matches 16–20 |
|---|---:|---:|
| `supportive` | 76.67 | 86.67 |
| `tyrannical` | 10.00 | 60.00 |
| `steady` | 30.00 | 36.67 |

The cruel style *improves* across a campaign — from 10.00 to 60.00 — while
never catching the kind one. Whatever the tyrant is buying, he buys it late,
which is the opposite of the requirement. The most likely mechanism is
selection rather than leadership: he retires 64 careers and ends with a roster
of green recruits at textbook competence, and the carry (D192) no longer hands
the kind leader that same reset. This is a hypothesis, not a measured cause;
the discriminating run would hold retirements fixed.

**3. What kindness is not being charged for.** The kind room complies
grudgingly: quiet-quit 0.206 against the tyrant's 0.037, a fifth of all moves,
and win score prices none of it. The tyrant's cost is fully priced (126
desertions against 1) and the kind leader's is not priced at all. This is the
most likely place the balance is wrong, and it is a *pricing* defect rather
than a conduct finding.

**4. `steady` is worst on every axis.** Middling insistence draws 0.538 refusal
— four times the tyrant's — and 2898 overrides, and it is the only style whose
candidate list ever runs out (70 forced moves, D191's fallback). A leader who
insists sometimes gets neither authority nor affection, which is a result worth
keeping even though it was not the question.

**5. Grace is not implicated.** `GRACE_RATE_PERMILLE = 0` in every cell; zero
grace events fired anywhere. No grace magnitude can be inferred from this pass,
and none is proposed.

## What this does not say

One opponent (`tyrannical`), one horizon (20 matches), fake engine, three
seeds. Win score is the only outcome measure here and it demonstrably fails to
price quiet-quitting, so "the tyrant loses" is a statement about this
instrument. The 40-match horizon is measured only at seed 7
(`docs/calibration/2026-08-30-the-forced-move-and-the-convert.md`); the
trajectory reading above is within 20 matches.
