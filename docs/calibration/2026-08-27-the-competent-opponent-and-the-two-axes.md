# The competent opponent, and which of the two axes actually widened

## Why this measurement

**D164** is ruled: widen the NPC span before any containment number is quoted
(ADR 0063 §5). The ruling had two parts, and this pass measures both.

1. *Care and insistence are confounded.* The nine styles occupied only the
   diagonal of two axes the harness already treats separately — how much the
   commander pays to keep a piece alive (the `riskWeight` argument to
   `tacticalScore`) and how often he insists after a refusal
   (`shouldOverride`). High care always came with never overriding, low care
   always with overriding constantly, so "cold" and "demanding" were the same
   style. Three styles now fill the empty quadrants (`sim/leaders.ts:275-325`):
   `exacting` (care 20, override 80%), `absentee` (care 0.25, override 5%) and
   `steady` (care 8, override 40%).
2. *Four styles tied at exactly 100.00 win score with identical 20/0/0 records*
   in the 08-26 pass. The ruling asked for a ceiling that separates them.

## Method

Two runs, no source or config change beyond the three new styles, fake engine,
one seed, twenty matches per style:

```bash
# Run A — comparable to the committed 08-26 table (default `random` opponent)
pnpm sim --matches=20 --leader=$STYLE --engine=fake --seed=7

# Run B — against the strongest opposing archetype that exists
pnpm sim --matches=20 --leader=$STYLE --engine=fake --seed=7 --opponent=tyrannical
```

Run A covers the three new styles. Run B covers the four styles that tied at the
ceiling plus the three new ones. As in the 08-18 and 08-26 passes these numbers
are valid for *relative* comparison between styles and must not be quoted as
absolute calibration rates; twenty matches on one seed shows the shape of a
span, not a coefficient. `τ_abil`, `τ_benev` and roster size are the final
quartile (matches 16–20), not a single terminal match.

Logs: `/home/ubuntu/d164-sweep/{A,B}-$STYLE.log` on the measuring host, retained
externally as in the 08-18 pass.

## Result 1: the ceiling was never a ceiling — it was the opponent

Against `--opponent=tyrannical` the tie does not narrow, it disappears:

| style | win | W/D/L | Δ vs plain-chess control | trust Δ | τ_abil | τ_benev | refusal | refused-good | override | quiet-quit | desertions/match | roster | plies |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `exacting` | **82.5** | 15/3/2 | **+15.0** | −70.9 | 25.6 | 5.7 | 0.118 | 0.126 | 0.347 | 0.065 | 0.05 | 5.2 | 114 |
| `supportive` | 65.0 | 11/4/5 | +2.5 | **+34.3** | 1.1 | **82.1** | 0.119 | 0.492 | 0.000 | 0.193 | 0.00 | 6.2 | 106 |
| `cold_winner` | 40.0 | 5/6/9 | −7.5 | −97.1 | 14.4 | 12.4 | 0.071 | 0.213 | 0.304 | 0.087 | 0.50 | 3.4 | 103 |
| `tyrannical` | 30.0 | 4/4/12 | −17.5 | −80.0 | 28.8 | 5.3 | 0.128 | 0.194 | 0.398 | 0.084 | 0.65 | 1.8 | 89 |
| `absentee` | 17.5 | 0/7/13 | −30.0 | −82.7 | 26.7 | 3.3 | **0.839** | 0.293 | 0.270 | 0.189 | **1.00** | 1.6 | 87 |
| `pure_tactician` | 10.0 | 1/2/17 | −37.5 | −82.2 | **59.3** | 6.0 | 0.246 | 0.248 | 0.380 | 0.102 | 0.65 | 1.4 | 80 |
| `steady` | 10.0 | 0/4/16 | −45.0 | **−101.5** | 29.1 | 3.0 | 0.449 | 0.286 | 0.311 | 0.089 | 0.50 | 1.2 | 104 |

The four previously tied styles now score 82.5 / 65.0 / 40.0 / 30.0 with
records from 15/3/2 down to 4/4/12. So the 08-26 saturation was **a measurement
artifact of the default `random` opponent**, exactly the failure mode the 08-18
re-baseline recorded and exactly the one I reproduced by sweeping at the
default. No rescoring is warranted and none is done: `winScore` stays
definitional at 0/50/100, and the correction is to the *method* — a coverage
sweep must be run against `--opponent=tyrannical`, and win scores measured
against `random` should be read as saturated.

One tie survives (`pure_tactician` and `steady` both at 10.0) but with different
records, 1/2/17 against 0/4/16, so it is a scoreboard coincidence rather than
two styles that behave alike.

The `Δ vs plain-chess control` column is the finding worth keeping past this
sweep. The psychology layer *costs* wins for every demanding-cold style
(−7.5 to −45.0 against the same seeds with the layer inert) and *pays* only for
the two high-care styles, +15.0 for `exacting` and +2.5 for `supportive`. ADR
0024 says warmth must not be required to win; against a competent commander the
sharper statement is now available — care in move choice is what pays, and
insistence is free as long as the commander is also protecting the piece
(`exacting` overrides 80% of the time and still tops the table).

## Result 2: the behavioural quadrants land where they were designed to

Run A, directly comparable to the 08-26 nine-style table:

| style | care | override cfg | win | refusal | refused-good | override obs | τ_benev | desertions/match | plies |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `exacting` | 20 | 80% | 97.5 | 0.133 | 0.191 | 0.419 | 0.57 | 0.00 | 61 |
| `steady` | 8 | 40% | 100.0 | 0.507 | 0.208 | 0.385 | 1.11 | 0.05 | 84 |

`absentee` at the `random` opponent is still running at the time of writing —
that pairing (refusal 0.839 against the longest campaigns in the set) is the
most expensive cell in the matrix, and its row will be appended when it lands.
Nothing in the readings below depends on it: `absentee`'s behaviour is measured
in Run B, and Run A exists only for comparability with the superseded 08-26
table.

Refusal rate separates cleanly with care held against insistence (0.133 for
`exacting` against 0.507 for `steady` against 0.839 for `absentee` in Run B),
which is the wiring evidence that the two axes are now independent inputs and
not one axis wearing two names. `exacting` also shows the combination the old
diagonal could not express at all: 0.05 desertions per match and 5.2 pieces
surviving under an 80% override rate, i.e. a demanding commander whose roster
does not disintegrate.

## Result 3: the emotional axis did **not** widen, and now we know why it might not

`τ_benev` after the widening: 82.1 for `supportive` and **≤ 12.4 for every
other style**, including `exacting` — which has the highest care value in the
file. The two-point emotional axis reported on 08-26 is unchanged, so the
coverage failure that matters for a seminar is still open.

What the new quadrants buy is a mechanism reading. `supportive` (override 0.000)
is the only style with high `τ_benev`; every style with an observed override rate
at or above 0.27 lands at or below 12.4, regardless of care. `exacting` protects
its pieces harder than any other style and ends at 5.7. The leading hypothesis
is therefore that **benevolence credence is bought by deference, not by
protection** — the piece scores whether its refusal was honoured, not whether
the order was safe.

That is a hypothesis, not a result, and the sweep cannot settle it because the
discriminating cell does not exist: there is no low-care, never-override style
in the set, so "deference alone" and "deference plus care" are not separated by
this data. `cold_winner` at override 0.304 holding the highest non-supportive
`τ_benev` (12.4) is mildly against a pure-deference reading. The missing cell is
one policy arm and is recorded as **D165**, since if it confirms, widening the
emotional axis is a psychology-layer change (what earns `τ_benev`) rather than
another NPC style — and psychology coefficients are an owner ruling.

## Detectors

`degeneracy=` output across Run B: `metric-collinearity` on five of seven
styles, always including `meanTrustStart/meanTauBenevStart`; `trust-monotonic`
on the same five; `no-dilemma` still on `supportive`, whose win score is 65.0
against a control of 62.5 — so the detector's threshold, not the tie, is what
fires now. `exacting` and `cold_winner` fire **nothing**, the first styles in the
project's history to come back clean against a competent opponent. No detector
fires on either new style in Run A.

## What it costs

| style | run | ms/match | ms/ply | engine calls/ply | peak RSS |
|---|---|---:|---:|---:|---|
| `pure_tactician` | B | 13,531 | 169 | 38.5 | 153 MB |
| `exacting` | A | 14,394 | 237 | 56.0 | 144 MB |
| `tyrannical` | B | 15,934 | 178 | 39.9 | 143 MB |
| `cold_winner` | B | 16,474 | 159 | 37.4 | 148 MB |
| `steady` | B | 24,566 | 236 | 47.8 | 156 MB |
| `supportive` | B | 26,987 | 255 | 48.7 | 143 MB |
| `exacting` | B | 28,500 | 251 | 47.8 | 145 MB |
| `steady` | A | 41,727 | 499 | 64.9 | 144 MB |
| `absentee` | B | 51,742 | 593 | 89.2 | 157 MB |

Consistent with 08-26: cost tracks refusal churn, not match count — `absentee`
at refusal 0.839 costs 3.8× `tyrannical` per match despite the same 20 matches.
Two facts are new. A competent opponent makes campaigns *longer* in plies
(80–114 against 53–70 at the `random` opponent) but *cheaper per ply* for the
cold styles, because a losing campaign resolves fewer insights per ply. And the
whole seven-style Run B took ≈ 3.4 h wall on two cores, so a coverage sweep at
the honest opponent is affordable at roughly the same budget as the saturated
one it replaces. Peak RSS 143–157 MB throughout; memory is still not the
constraint on the fake engine.

## What follows

Half of D164 is discharged and half is not, and the register says so:

- the outcome axis ranges (10.0–82.5, no meaningful tie) once measured against
  a competent commander — no balance magnitude was changed to achieve it;
- the behavioural axes are now independent, with the off-diagonal quadrants
  populated and refusal rate separating them;
- the emotional axis is still two points, so **containment must not be measured
  yet** — an envelope built from this span would still call almost any warm
  behaviour out-of-envelope.

The next step is therefore D165 (does deference alone buy `τ_benev`?), not the
journal.
