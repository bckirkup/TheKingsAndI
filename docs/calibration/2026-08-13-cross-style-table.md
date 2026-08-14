# Cross-style calibration table — 2026-08-13

_Measured against `main` @ `248cd08` (PR #96 merged, measurability restored).
Companion to `2026-08-13-blocked-on-measurement.md`, which measured only
`tyrannical`, `pure_tactician` and `supportive`; this pass covers all nine
leader styles including the `random` control._

```
pnpm sim --matches=20 --campaign-length=10 --campaigns=2 \
  --leader=<L> --engine=fake --seed=7 --enforce-calibration=false
```

Fake engine, so **absolute rates are not real chess** and must not be quoted as
calibration values. The table is only valid as a relative comparison across
styles, which is exactly the question it is asked to answer.

## The table

| Leader | Refusal | Ref/ply | Quiet quit | Desertion match | Attrition | Rout | Refused-good | Win | Δtrust | Roster |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| random (control) | 0.494 | 0.679 | 0.131 | 1.000 | **0.938** | 1.000 | 0.250 | 0.0 | −108.70 | 1.00 |
| tyrannical | 0.095 | 0.069 | 0.047 | 1.000 | **0.938** | 1.000 | 0.100 | 0.0 | −84.94 | 1.00 |
| volatile | 0.319 | 0.325 | 0.057 | 1.000 | **0.938** | 1.000 | 0.175 | 0.0 | −103.81 | 1.00 |
| pure_tactician | 0.130 | 0.110 | 0.073 | 1.000 | **0.938** | 1.000 | 0.083 | 0.0 | −84.94 | 1.00 |
| redeemer | 0.179 | 0.314 | 0.110 | 1.000 | **0.938** | 1.000 | 0.089 | 0.0 | −94.23 | 1.00 |
| cold_winner | 0.047 | 0.029 | 0.124 | 1.000 | **0.938** | 1.000 | 0.325 | 0.0 | −109.97 | 1.00 |
| rebuilder | 0.541 | 0.860 | 0.091 | 1.000 | **0.938** | 1.000 | 0.168 | 0.0 | −113.25 | 1.00 |
| supportive | 0.451 | 0.600 | 0.850 | 0.850 | **0.938** | 0.400 | 0.474 | 47.5 | −40.04 | 4.5–9.2 |
| servant | 0.187 | 0.130 | 0.216 | 0.250 | 0.281 | 0.000 | 0.568 | 40.0 | +16.29 | 6.5–8.8 |

## 1. The collapse is style-invariant, and the primary metric is saturated

Eight of nine styles report attrition `0.938` — 15 of 16 pieces, to three
decimals, identically — with `rout=1.000`, `roster=1.00` (King only) and
psychological win `0.0` against a control that wins 25–58% of the same spans.
The `random` control collapses exactly like `cold_winner`; `rebuilder`, whose
whole point is rebuilding trust, collapses exactly like `tyrannical`.

Attrition therefore carries **no gradient across leadership behaviour at all**.
That is not a coefficient that needs nudging: the desertion decision is
dominated by a term that does not depend on what the leader does, which is
consistent with the PR #78 collective board-loss pressure identified in the
previous report. Refusal does still spread (0.047 → 0.541), so the refusal
ladder is wired and responsive; only the exit decision is saturated.

`trust-monotonic` fires on eight of nine styles: once trust starts falling it
never recovers within a campaign, which is the same finding from the other side.

## 2. Only overwhelming benevolence credence escapes, and the label is not what does it

Servant is the sole style that keeps a roster, and the discriminator is not the
style label but the magnitude of benevolence credence it manufactures:
`tau_benev` 65–71 per quartile for servant, 15–45 for supportive, 0–12 for all
seven collapsed styles. Supportive shows the intermediate case in its quartiles
— attrition 0.938 → 0.938 → 0.719 → 0.531 as `tau_benev` climbs from 15 to 45 —
so the roster survives only where the attachment residual is fed a very large
benevolence signal. Everything short of that loses the board.

Servant also inverts the trust sign (Δtrust +16.29 vs −85…−113) and keeps
`refused_good=0.568`: the surviving-roster regime has the morale/tactics tension
the model is supposed to produce, while the collapsed regime has none.

## 3. Measurability itself now works

Every style exited `0`, produced a summary and produced artifacts. `supportive`
completes rather than dying on a kingless FEN, and the detectors now fire where
they should: `early-saturation` on quartiles 1 and 2 of every collapsed style
(new information — the collapse is complete before leadership can act),
`supportive-rout` and `no-dilemma` on supportive, `metric-collinearity` on the
styles where trust and benevolence credence have degenerated into the same
variable. A nightly run would now arrive red **with** its evidence attached.

## 4. Compute is a CPU cost, not a memory or disk risk

| Leader | Wall | Peak RSS |
|---|---:|---:|
| pure_tactician | 2:07 | 142 MB |
| redeemer | 3:32 | 147 MB |
| rebuilder | 3:55 | 150 MB |
| tyrannical | 4:14 | 151 MB |
| cold_winner | 4:33 | 148 MB |
| volatile | 7:03 | 146 MB |
| random | 10:32 | 152 MB |
| supportive | 19:52 | 159 MB |
| servant | 44:16 | 152 MB |

Peak RSS is flat at 142–159 MB across all nine styles and fluctuates rather than
growing monotonically; the servant run holds 152 MB for 44 minutes. The whole
nine-style table is 928 KB on disk (804 KB of CSV plus metrics JSON), written at
completion rather than accumulating during the run. Full sequential table:
1 h 39 m on two cores.

So servant is expensive in CPU and bounded in everything else. There is no
memory or disk threat, and no reason to spend a session optimizing the harness
before the model it measures is fixed.

## What this changes

The gating question for Milestone 3 can now be asked, and the answer is that
seven of nine styles plus the control are the same degenerate run. The next work
is the mechanism, not the coefficients:

1. the PR #78 / `686298b8` collective board-loss pressure that makes the exit
   decision leader-independent;
2. the `privateScoreCp` absolute-vs-delta mismatch, where the acting piece
   receives a before/after delta and non-actors receive an absolute score while
   `desertionContextFor` treats both as absolute.

Tuning desertion coefficients against this table would be fitting noise: with
attrition pinned at 0.938 for eight styles there is nothing for a coefficient to
move.
