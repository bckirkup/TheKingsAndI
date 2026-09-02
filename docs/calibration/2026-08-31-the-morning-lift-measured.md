# The Morning Lift Measured — D207 Candidate Magnitudes

Date: 2026-08-31 (UTC). Status: measurement evidence for the D207 magnitude
ruling. The mechanism (ADR 0077) shipped inert in PR #183; nothing in this
document changes code.

## Question

D207 wired a deterministic, lift-only trust movement toward a dawn baseline at
every match boundary, at `MORNING_LIFT_PERMILLE = 0` /
`MORNING_LIFT_TRUST_BASELINE = 0`. The 2026-08-31 fisher sweep showed why it
exists: carried curdled trust turns matches 2..N of a cruel campaign into a
ply-1 dismissal conveyor — the King plays the whole semester. What magnitude
gives the room genuine morning hope without flattening the price of cruelty or
opening a gaming seam?

## Method

AWS Batch (Fargate Spot), 10 campaigns × 20 matches per cell, fake engine,
`--opponent=tyrannical`, depth cap 8, master seed 314159, harness King
`tauAbil` default (room-path dismissal only) — identical parameters to the
2026-08-31 fisher sweep, whose committed artifacts serve as the `permille = 0`
control (its commit predates D207, but the inert wiring is proven byte-identical
to pre-D207 output by the campaign golden in `tests/morningLift.test.ts`).

Candidates: `MORNING_LIFT_PERMILLE ∈ {250, 500, 1000}` with
`MORNING_LIFT_TRUST_BASELINE = 0` (dawn restores toward neutral, never above).
Each candidate is an immutable one-line config commit on a throwaway branch,
its own image, its own job definition revision:

| permille | branch | commit | job definition | image digest (`kingsandi-campaign@`) |
|---|---|---|---|---|
| 250 | `candidate/morning-lift-250` | `7fb0780124c48e8b0ab736685e41cd07bbc4ca0f` | `kingsandi-campaign-spot:11` | `sha256:bd0917fdab7ede02e4b0625296c9fc718de22476c24c000864658d94069f7c3c` |
| 500 | `candidate/morning-lift-500` | `20058ec475141c0a8abe923de9729ad8fd36366c` | `kingsandi-campaign-spot:12` | `sha256:efd17f5e1932b5d0fa1bfea3090a5f1014701cb3875ba299847c98e3876e3af0` |
| 1000 | `candidate/morning-lift-1000` | `3cdeec6c17abf32208679354e59a39195b2b4dcb` | `kingsandi-campaign-spot:13` | `sha256:93e40042d8417ccaff4f2d5df396ed131994b17e99185d7e67896b28499c4036` |

Runs: `s3://kingsandi-campaigns-994254241749-us-east-1/campaigns/mlift-<permille>-<style>/`
for styles `supportive`, `steady`, `tyrannical`, `dismissal_fisher` (12 array
jobs × 10 shards, all shards succeeded).

## Results

Pooled over 200 matches per cell. "Conveyor" = dismissals at ply ≤ 2 among
matches 2..20 (the carried-trust firing squad), out of 190.

### supportive (the invariance check)

| permille | win | LI(0.2) | trust_final | dismissed | conveyor |
|---|---|---|---|---|---|
| 0 | 89.00 | 61.86 | 95.12 | 0/200 | 0/190 |
| 250 | 84.75 | 60.40 | 95.02 | 0/200 | 0/190 |
| 500 | 87.50 | 61.31 | 95.18 | 0/200 | 0/190 |
| 1000 | 86.75 | 60.94 | 95.10 | 0/200 | 0/190 |

The kind room wakes above the baseline, so the lift is a no-op on it by
construction; the small win/LI wobble comes from the *enemy* army also waking
lifted (the spring falls on both armies). Earned trust is never dampened:
trust_final holds at ~95 at every magnitude.

### steady

| permille | win | LI(0.2) | trust_final | QQ | EC | dismissal ply min/med/max | conveyor |
|---|---|---|---|---|---|---|---|
| 0 | 65.75 | 3.62 | −35.22 | 0.82 | 9.66 | 1 / 1 / 55 | 150/190 |
| 250 | 65.25 | 5.13 | −30.56 | 1.61 | 10.28 | 1 / 3 / 55 | 46/190 |
| 500 | 64.00 | 4.44 | −30.87 | 2.44 | 10.81 | 1 / 7 / 55 | 3/190 |
| 1000 | 58.25 | 3.77 | −27.30 | 5.00 | 11.31 | 7 / 15.5 / 73 | 0/190 |

### tyrannical

| permille | win | LI(0.2) | trust_final | QQ | EC | dismissal ply min/med/max | conveyor |
|---|---|---|---|---|---|---|---|
| 0 | 67.00 | 0.42 | −44.36 | 0.75 | 9.28 | 1 / 1 / 11 | 181/190 |
| 250 | 63.50 | 4.14 | −31.93 | 1.32 | 10.03 | 1 / 3 / 13 | 68/190 |
| 500 | 64.75 | 5.00 | −30.69 | 1.79 | 9.84 | 1 / 5 / 19 | 12/190 |
| 1000 | 61.25 | 3.30 | −31.13 | 3.33 | 11.38 | 5 / 11 / 49 | 0/190 |

### dismissal_fisher (the gaming check)

| permille | win | LI(0.2) | trust_final | QQ | EC | dismissal ply min/med/max | conveyor |
|---|---|---|---|---|---|---|---|
| 0 | 67.00 | 3.29 | −36.83 | 0.56 | 10.09 | 1 / 1 / 20 | 158/190 |
| 250 | 64.50 | 4.50 | −31.37 | 0.99 | 11.00 | 1 / 3 / 20 | 64/190 |
| 500 | 60.50 | 3.18 | −31.03 | 1.43 | 12.09 | 1 / 5 / 20 | 5/190 |
| 1000 | 59.75 | 3.21 | −29.37 | 2.68 | 13.38 | 4 / 10 / 53 | 0/190 |

## Readings

1. **The conveyor breaks on a clean dose–response.** Ply-≤2 repeat dismissals
   among matches 2..20 fall from 150–181/190 at zero to 46–68 at 250, 3–12 at
   500, and 0 at 1000; the median dismissal ply rises 1 → 3 → 5–7 → 10–15.
   Every cruel match still ends dismissed (200/200 at every magnitude except
   198/200 for steady at 1000) — the lift changes *when* the room fires the
   commander, never *whether*.
2. **The Judgement Seat is untouched in verdict.** Kind/cruel separation holds
   with no per-campaign overlap at every magnitude (supportive ~61 vs cruel
   0–5). Cruel LI reads ~3–4.5 points kinder at 250–500 (trust −44 → −31) and
   falls back at 1000 as the priced costs the conveyor had been masking return
   (quiet-quit 0.75 → 3.3, emptied chairs 9.3 → 11.4): a commander who is
   *present* longer accrues more of the terminal price. The lift does not
   flatten cruelty's cost; it un-hides it.
3. **No gaming seam opens.** The dismissal fisher never out-reads honest steady
   at any magnitude (fisher 3.18–4.50 vs steady 3.77–5.13), and its win score
   *drops* as the lift grows — a room that hopes longer is fished more slowly.
4. **No mid-run wall appears.** Honest win scores stay in their bands at all
   magnitudes; nothing new bites the kind or the cruel during play.

## Candidate proposal (for the owner's ruling)

- **`MORNING_LIFT_PERMILLE = 500`, baseline 0 — recommended.** Morning is
  real: a fallen commander opens nearly every match with a genuine short
  chance (median re-dismissal ply 5–7, ply-≤2 repeats 3–12/190), yet the room
  can still fire an unrepentant tyrant early — ply-1 re-dismissal remains
  *possible*, just no longer automatic.
- **250 — the half-measure.** A third of cruel matches (46–68/190) still fire
  by ply 2; the conveyor is slowed, not broken.
- **1000 — full dawn.** No early firing at all (minimum dismissal ply 4–7);
  the room's memory of last night stops being able to act in the morning,
  which reads as spring overwriting judgment.

Caveats: fake engine, one opponent (tyrannical), 20-match horizon, baseline 0
only. Relative comparisons only, per the fake-engine evidence rule.
