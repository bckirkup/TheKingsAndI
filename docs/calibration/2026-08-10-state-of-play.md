# State of play — 2026-08-10

_Measured against `main` @ `ac21192` (PR #69 merged). Supersedes the numbers in
`milestone-3-engine-wired.md`, which predate private evaluation profiles
(ADR 0037), justified refusal authority (ADR 0038), credence prior strength
(ADR 0039), the collective/standing desertion stake, and the refusal-replanning
fixes. Nothing in this pass tuned a coefficient; `ENGINE_CONFIG` still holds the
original defaults._

## How this was measured

```bash
pnpm sim --matches=40 --campaign-length=20 --campaigns=2 --leader=<L> --seed=<7|11> --engine=fake
pnpm sim --matches=20 --leader=<tyrannical|supportive> --seed=7          # Lozza, depth cap 4
```

Health of the tree at the same commit: `pnpm lint`, `pnpm typecheck`,
`pnpm test` (283 tests) and `pnpm build` all pass.

The fake engine is the deterministic substrate; its absolute rates are not real
chess and only the *separation between styles* is meaningful. The two Lozza runs
are the reality check: they agree with the fake engine on the direction of every
finding below, though refusal and quiet-quit run markedly higher under Lozza.
There was no Lozza `servant` run.

## The numbers

| Engine | Leader | Seed | Refusal | Quiet quit | Desertion campaign | Rout campaign | Refused-good | Override | Win | Δtrust |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fake | tyrannical | 7 | 0.154 | 0.156 | 1.000 | 0.725 | 0.408 | 0.395 | 27.5 | −61.98 |
| fake | tyrannical | 11 | 0.163 | 0.174 | 1.000 | 0.575 | 0.322 | 0.400 | 40.0 | −49.20 |
| fake | supportive | 7 | 0.171 | 0.283 | 1.000 | 0.050 | 0.171 | 0.000 | 95.0 | −1.90 |
| fake | supportive | 11 | 0.323 | 0.249 | 0.975 | 0.250 | 0.303 | 0.001 | 72.5 | −28.42 |
| fake | servant | 7 | 0.163 | 0.271 | 1.000 | 0.000 | 0.295 | 0.000 | 97.5 | +2.47 |
| fake | volatile | 7 | 0.212 | 0.114 | 1.000 | 1.000 | 0.348 | 0.111 | 0.0 | −101.36 |
| fake | volatile | 11 | 0.202 | 0.107 | 1.000 | 0.975 | 0.390 | 0.147 | 2.5 | −98.78 |
| fake | random | 7 | 0.343 | 0.093 | 1.000 | 0.975 | 0.301 | 0.030 | 2.5 | −106.97 |
| fake | random | 11 | 0.259 | 0.139 | 1.000 | 0.975 | 0.306 | 0.020 | 2.5 | −106.83 |
| fake | pure_tactician | 7 | 0.225 | 0.259 | 1.000 | 0.900 | 0.512 | 0.293 | 10.0 | −75.45 |
| fake | pure_tactician | 11 | 0.193 | 0.277 | 1.000 | 0.975 | 0.473 | 0.283 | 2.5 | −82.05 |
| fake | redeemer | 7 | 0.800 | 0.387 | 1.000 | 0.750 | 0.348 | 0.116 | 25.0 | −69.65 |
| fake | redeemer | 11 | 0.645 | 0.408 | 1.000 | 0.800 | 0.327 | 0.146 | 20.0 | −74.27 |
| fake | cold_winner | 7 | 0.101 | 0.271 | 1.000 | 0.575 | 0.130 | 0.184 | 42.5 | −64.02 |
| fake | cold_winner | 11 | 0.083 | 0.288 | 1.000 | 0.650 | 0.037 | 0.110 | 35.0 | −74.16 |
| fake | rebuilder | 7 | 0.585 | 0.174 | 1.000 | 0.800 | 0.457 | 0.078 | 20.0 | −89.80 |
| fake | rebuilder | 11 | 0.575 | 0.179 | 1.000 | 0.925 | 0.530 | 0.080 | 7.5 | −102.48 |
| Lozza | tyrannical | 7 | 0.214 | 0.195 | 1.000 | 0.650 | 0.372 | 0.447 | 35.0 | −55.13 |
| Lozza | supportive | 7 | 0.602 | 0.574 | 1.000 | 0.150 | 0.179 | 0.000 | 85.0 | −13.58 |

`servant` at seed 11 was killed at ~9m43s before producing output; every other
run completed. Raw logs, determinism IDs and wall times are the source for this
table.

## What works

- **Benevolence is legible and style-separated.** `τ_benev` ends at ~0 for
  tyrannical on both engines, and 42–66 for supportive/servant. The two-channel
  split of ADR 0019 is doing real work.
- **Override separates cleanly.** Tyrannical overrides on ~40% of plies,
  supportive and servant on ~0%. Detector 2c is satisfied.
- **Rout separates.** 0% servant / 5–25% supportive / 58–73% tyrannical / 98–100%
  volatile and random. A tyrant's roster does collapse, as ADR 0011 intends.
- **Trust delta separates**: +2.5 servant, −2 to −28 supportive, −49 to −62
  tyrannical, −99 to −107 volatile/random.
- **`random` is distinguishable from every scripted style**, so the model is
  responding to leadership behaviour and not to noise.

## Blocking findings

### 1. There is no dilemma: kindness is strictly optimal
`supportive` scores 95.0 and `servant` 97.5 against tyrannical 27.5 and
volatile 0.0, and the `no-dilemma` detector fires on supportive under both
engines. Detector 6 of the balance skill is the one that decides whether a game
exists, and it is currently red: nothing is traded away by being kind. Until a
warm leader pays *something* — tempo, material, the ADR 0024 promise that a
cold, highly able leader can still win a career — the central tension is absent.

> **Metric-definition note:** The refusal and desertion figures in this
> historical report use the pre-fix definitions. Current harness output uses
> bounded refusal rate, retains refusals per ply, labels match incidence as
> desertion match rate, and adds campaign desertion attrition.

### 2. `desertion_campaign` is saturated at 1.000 for every style
Every leader, including `servant` with a 0% rout rate and a roster that stays at
~15 of 16, loses at least one piece in essentially every match. A metric that
reads 1.000 for a saint and for a tyrant carries no signal, and the plan's
40–70% / <5% acceptance band cannot be evaluated against it.

### 3. Two headline metrics do not mean what their acceptance bands assume
- `refusalRate = refusals / plies` (`sim/metrics.ts:276`). Refusal is a free
  re-plan (ADR 0002), so a single ply can contribute several refusals: redeemer
  quartile 4 reports **1.404**. This is not "% of plies refused", which is what
  the 8–20% band in `development_plan.md` is written against.
- `desertionCampaignRate` (`sim/metrics.ts:375`) is the fraction of **matches**
  with ≥1 desertion, not of campaigns, while the band is stated per 20-match
  campaign.

Both bands are therefore being compared against a different quantity. Fixing the
definitions comes before any coefficient sweep, or the sweep optimises the wrong
number.

### 4. `τ_abil` collapses under every leadership style
Ability credence ends at 0.06–25 for eight of the nine styles, including servant
(8–23) and supportive (6–12), while `τ_benev` holds; only `cold_winner` (37–41)
escapes. One of the two channels is a
one-way ratchet down regardless of play, which is detector 4's failure shape
applied to a single channel. ADR 0039 gave credence a prior strength; the
measurements say the prior is not surviving contact.

### 5. Refusal does not discriminate by style, and the oracles are extreme
Refusal sits at 0.15–0.34 for tyrannical, supportive, servant, volatile and
random alike — supportive's target is <2% — while `redeemer` (0.65–0.80) and
`rebuilder` (0.58) are in a different regime entirely. On Lozza, supportive
refuses on 60% of plies and quiet-quits on 57%. Refusal is currently a property
of the position, not of the leader.

### 6. `metric-collinearity` fires on 17 of the 19 completed runs
`survivingRosterSize`/`winScore` are collinear almost everywhere, and the Lozza
tyrannical run collapses seven column pairs. The transcript is reporting one
underlying variable several times over, which will make the audit and the
commendations look richer than they are.

### 7. The harness is far slower than the recorded cost
`milestone-3-engine-wired.md` records ~0.18 s/match on the fake engine; these
40-match fake runs took 123–1147 s. Part of the spread is concurrent execution
on one box, but the fastest uncontended run is still ~3 s/match — roughly an
order of magnitude above the recorded figure, and Lozza's 20-match smoke has
gone from ~4.6 s to 43 s. Private evaluation adds per-piece queries and the
Lozza determinism ID now carries `multipv-8`, both plausible causes. At the
current cost a 1,000-match Milestone 3.2 calibration run is roughly an hour per
configuration, which is what makes a coefficient sweep painful.

## Suggested order for this phase

1. Fix the two metric definitions (finding 3) and re-state the acceptance bands
   against them. Everything downstream is measured with these rulers.
2. Break the desertion saturation (finding 2) — the desertion decomposition
   telemetry from PR #66 already records `U_stay`/`U_desert`/pain/λ per
   departure, so the term responsible is readable without new instrumentation.
3. Investigate the `τ_abil` ratchet (finding 4) as a bug before treating it as a
   coefficient.
4. Only then sweep for the dilemma (finding 1), one knob at a time, with the
   harness cost of finding 7 reduced first if the sweep is to be affordable.

Findings 5 and 6 are expected to move on their own once 2–4 land; re-measure
before treating them as separate work.
