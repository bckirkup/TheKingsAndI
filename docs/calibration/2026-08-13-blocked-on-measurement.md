# What is blocking progress — 2026-08-13

_Measured against `main` @ `efeaaa0` (PR #93 merged). Read with
`2026-08-10-state-of-play.md`, whose numbers this pass supersedes for
`tyrannical`; that report predates roughly 25 merged PRs and 12 ADRs of model
change._

The blocker is not a missing feature. It is that **the model on `main` is now
fully degenerate for cold styles, and every pipeline that would have told us so
is either red or unable to complete a run.** Milestone 3's gating question —
whether the psychology is interesting and non-degenerate — cannot currently be
asked, let alone answered.

## 1. Under `tyrannical` and `pure_tactician` the roster is gone by match 1

`pnpm sim --matches=40 --campaign-length=20 --campaigns=2 --leader=<L> --seed=7 --engine=fake`

| Leader | Refusal | Quiet quit | Desertion match | Attrition | Rout | Refused-good | Override | Win | Δtrust | Surviving roster |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| tyrannical | 0.115 | 0.049 | 1.000 | 0.938 | 1.000 | 0.150 | 0.345 | 0.0 | −84.66 | 1.00 |
| pure_tactician | 0.152 | 0.088 | 1.000 | 0.938 | 1.000 | 0.105 | 0.273 | 0.0 | −84.66 | 1.00 |
| supportive (20/1) | 0.119 | 0.219 | 0.150 | 0.375 | 0.000 | 0.638 | 0.000 | 55.0 | +13.83 | — |

`roster=1.00` is a count (`meanSurvivingRosterSize = result.roster.length`), so
**only the King is left**, in all four quartiles, in both campaigns. The
per-quartile lines are identical (`attrition=0.938 rout=1.000 roster=1.00`) and
`tau_abil_role` contains one key, `King`. The plain-chess control wins 25–50% of
the same spans while the psychological side wins 0.00 at every span
(`span=3 … delta=−50.00`, `span=20 … delta=−25.00`).

Two different leader policies producing byte-identical `Δtrust` (−84.66) and
attrition is itself a signal: collapse is complete before leadership behaviour
can differentiate anything. Compare 2026-08-10, where tyrannical was rout 0.65 /
win 35.0. This is a regression introduced somewhere in PRs #70–#94, not a
coefficient that needs nudging.

`no-dilemma` still fires on supportive (win 55.0 with no rout), so finding 1 of
the 08-10 report is unresolved as well — but it is now the *second* problem.

### Bisected to `686298b8` (PR #78, ADR 0045's grounded desertion loss)

`git bisect` from `ac21192` to `main`, discriminating on
`--matches=8 --campaign-length=8 --campaigns=1 --leader=tyrannical --seed=7 --engine=fake`:

| Revision | Rout (campaign) | Surviving roster (Q1–Q4) | Win | Δtrust |
|---|---:|---|---:|---:|
| `182713a2` (parent, PR #77) | 0.375 | 8.50 / 8.50 / 8.00 / 16.00 | 62.5 | −43.59 |
| `686298b8` (PR #78) | 1.000 | 1.00 / 1.00 / 1.00 / 1.00 | 0.0 | −85.08 |

The transition is one commit, not a gradual drift. So the collapse arrived with
the ADR 0045 desertion redesign — the ADR whose magnitudes were recorded as
"open for calibration", shipped with defaults that make desertion unconditional.

### The mechanism: departures now happen at a knife-edge margin

Per-departure decomposition of one deterministic match
(`--matches=1 --leader=tyrannical --seed=7 --engine=fake`), current `main`
versus the good parent, at the first mass departure wave:

| Term | `main` (ply 47, 8 departures) | `182713a2` (ply 29, 14 departures) |
|---|---:|---:|
| `U_desert − U_stay` | **+0.493** | **+3.868** |
| collective stay-loss `P_lossIfStay·λ·50` | +3.707 | +4.853 |
| residual leave / attachment | −3.214 | −3.110 |
| pain `P_captured·pain·shadow` | **+0.000** | +3.429 |
| standing | −0.000 | −1.303 |

with `pLossBoard 0.356`, `P_lossIfStay 0.253`, `pivotality 0.013`,
`shadowFactor 0.747`, `attachment 0.825`, `λ 0.293`.

No single new term dominates. The wave is the difference between two large
opposing terms, and it starts with **no capture pain and no standing cost at
all** — where the parent's first wave was initiated by capture pain (+48.0 on
`w:R:a1`, `ΔU = +45.256`). Desertion has become a low-margin decision driven by a
*belief about losing the board* rather than by anything that happened to the
piece, and ADR 0011's undamped cascade then takes over from a +0.49 margin.
Pivotality (~0.16 utility points) and attachment are not the pressure;
attachment currently **resists** desertion (−3.214 versus the old fixed 0.3
residual stake) and merely fails to offset the new collective stake.

A wiring defect sits underneath this and should be fixed before any magnitude is
touched: `desertionContextFor` (`src/psychology/cascade.ts:24-30`) applies the
absolute-score board-loss formula to `privateScoreCp`, but that field carries two
different quantities on the same ply — non-actor pieces get an absolute post-move
score (`insight.ts:379`) while the acting piece gets a before/after **delta**
(`evaluation.ts:22`). Measured actor deltas range −316…+442 cp with mixed signs,
and three refusal retries at one ply produced actor values of −85, +2 and +208,
so the acting piece's `P_lossIfStay` is not commensurable with its peers' and
moves with the retry. (This is narrower than first supposed: the deltas do *not*
sit near zero, so there is no universal flat 50% belief.) Its exact contribution
to the collapse is separable only by a replay that feeds the actor its absolute
score with all other terms held fixed.

## 2. The nightly calibration pipeline has produced nothing since 2026-08-11

`nightly.yml` runs the tyrannical Lozza campaign with
`--enforce-calibration=true`, which exits non-zero when a degeneracy detector
fires. Because that is the **first** step, the supportive campaign, the
`OUTCOME_TRUST_LOSS_SCALE` sweep, and the artifact upload never run:

- 2026-08-13 (`31679534942`) — failed at 5m10s, `Degeneracy detected for tyrannical`
- 2026-08-12 (`31575693995`) — failed at 5m09s, same detector
- 2026-08-11 (`31469549906`) — last successful run

So the enforcement gate suppresses the measurement exactly when the model is
degenerate, which is precisely when the numbers are needed. Enforcement belongs
in a final step (or a non-blocking check with artifacts always uploaded), not
ahead of data collection.

## 3. Two of the five requested harness runs cannot complete at all

- `--leader=supportive --matches=40 --campaign-length=20 --campaigns=2` dies
  deterministically at the campaign boundary with `Invalid FEN: missing black
  king` after ~14s. The same leader at `--matches=20 --campaigns=1` completes,
  so this is campaign-continuation state, not setup.
- `--leader=servant` in the same 40/2 shape produced no output for ~19 minutes
  and was terminated.

`volatile`, `cold_winner` and `rebuilder` were not reached. There is therefore
no current cross-style table, and no way to produce one without fixing these.

## 4. Harness cost is state-dependent and unbudgetable

Fake engine, this pass: tyrannical 5.68 s/match, pure_tactician 2.49 s/match,
supportive 31.56 s/match (20 matches in 631s). Lozza depth-cap 4: 2.82 s/match.
A one-knob three-value sweep at 40 matches is therefore anywhere between 5
minutes and 1 hour, which is why no sweep has been run despite `sim:sweep` and
the Batch/Spot path (#61, #62) existing. The 08-10 report already flagged this
(finding 7) and it has not improved.

## 5. Meanwhile the calibration debt has grown

ADRs 0039–0051 landed after the last measurement. `IMPLEMENTATION_STATUS.md`
records most of them as shipped *with magnitudes open for calibration*, so each
one adds knobs to a sweep that cannot currently run. D49 (three-channel keyed
credence, ADR 0035) remains **not wired**, and reputation transfer, passports and
recruitment all still wait on it.

## Suggested order

1. **Restore measurability before anything else.** Fix the supportive 40/2 FEN
   crash and the servant hang; move `--enforce-calibration` behind data
   collection in `nightly.yml` so a degenerate model still uploads its numbers.
2. **Treat §1 as a regression in `686298b8` (PR #78)**, not as a coefficient to
   re-tune around. Settle the term-level mechanism first — including the
   `privateScoreCp` delta-versus-absolute inconsistency above — before changing
   any ADR 0045 magnitude.
3. Re-run the full cross-style table and replace the 08-10 numbers.
4. Only then return to the dilemma (08-10 finding 1) and the coefficient sweep,
   with the per-match cost of §4 reduced first.
5. Hold new ADRs that add calibration-open magnitudes until 1–3 land.

Raw logs, CSVs and shard artifacts for this pass are the source for §1, §3 and
§4.
