# Simulation harness

Headless balance harness for Milestone 3. Runs scripted leader policies against
the shipping psychology engine and chess substrate via `src/orchestration/`.

## Usage

```bash
pnpm sim --matches=20 --leader=tyrannical --seed=7
pnpm sim --matches=20 --leader=tyrannical --engine=lozza
pnpm sim --matches=20 --leader=tyrannical --engine=lozza --depth-cap=4
pnpm sim --matches=1000 --leader=tyrannical --campaign=20 --seed=1 --out=metrics.csv
pnpm sim --matches=20 --leader=tyrannical --engine=fake --enforce-calibration=true
pnpm sim --matches=3 --campaign=3 --leader=tyrannical --seed=1 --engine=fake --checkpoint-out=checkpoint.json
pnpm sim --matches=6 --campaign=6 --leader=tyrannical --seed=1 --engine=fake --resume=checkpoint.json
pnpm sim:sweep --knob=OUTCOME_TRUST_LOSS_SCALE --values=6,12,18 --matches=4 --seed=7
pnpm sim:census --seed=1 --weeks=4 --matches=2 --commanders=2 --engine=fake --out=census.json
```

`sim:census` runs one seminar with the selected match-time recognition knobs,
then re-folds its recorded weeks across fixed recognition-threshold grids.
It prints per-style incidence tables and writes the same tables, plus play and
record digests, to the requested JSON output.

`--campaign-length=N` is the number of sequential matches in one campaign;
`--campaign=N` remains an alias. `--matches=T` is the total number of matches
across the run, and `--campaigns=M` is the number of independent campaigns.
The total must divide evenly by the campaign length. For compatibility,
`--matches=20` by itself still means one 20-match campaign. Thus the
development-plan command above means 1,000 total matches in 50 independent
20-match campaigns.

Campaigns are the unit of parallelism: matches within a campaign carry roster
state forward and must remain sequential. A local sharded run can use the
same command line with only the shard index changed:

```bash
mkdir -p metrics
seq 0 3 | xargs -P 4 -I{} pnpm sim \
  --matches=1000 --campaign-length=20 --campaigns=50 \
  --leader=tyrannical --seed=1 --engine=fake \
  --shard-index={} --shard-count=4 \
  --out=metrics/shard-{}.csv
pnpm sim:aggregate \
  --inputs=metrics/shard-0.csv.json,metrics/shard-1.csv.json,metrics/shard-2.csv.json,metrics/shard-3.csv.json \
  --out=metrics/run.json
```

Each `--out` CSV has an adjacent `.json` shard artifact containing its run
manifest, campaign assignments, and metrics. CSV metric columns are append-only:
the ability/benevolence trust start/end channels and surviving roster size follow
the historical columns, and the trajectory-band section follows the metric
rows, followed by the cumulative horizon section. The aggregator rejects mismatched
manifests, duplicate or missing campaigns, and incomplete runs rather than
silently producing a partial report. Use `--enforce-calibration=true` on the
simulation or aggregation command when an exit-criterion failure should be
fatal; the default smoke path still reports findings without making them hard
failures.

The JSON artifact also contains a machine-dependent top-level `cost` section
with per-match and per-campaign wall time, engine call counts and depth
histograms, child restarts, RSS samples, and derived rates. Lozza child
recycling is currently opt-in because its warm transposition-table state can
affect search results; the default restart count is therefore zero. The
host-side ladder cache is unbounded by default: eviction forces re-searches on
the warm child, and Lozza's carried state makes those results path-dependent.
Long real-Lozza campaigns can still exhaust memory. Bounding it is opt-in and
changes campaign results until the pending engine determinism-contract
decision is made. Per-match RSS values are process-wide monotonic high-water
marks, not isolated match peaks, and are intended for leak detection. Cost is
observational only: it is excluded from deterministic manifests and aggregate
identity checks.

For a multi-campaign run, do not reproduce one campaign with
`--campaigns=1`: the legacy single-campaign path deliberately uses the master
seed directly to preserve historical byte identity, while multi-campaign runs
derive each campaign seed from the master seed and its zero-based index. Thus
campaign 0 of a 50-campaign run is not the same campaign as a one-campaign run
with the same master seed. To reproduce campaign `i`, keep the multi-campaign
plan and select that campaign's shard:

```bash
pnpm sim \
  --matches=1000 --campaign-length=20 --campaigns=50 \
  --leader=tyrannical --seed=1 --engine=fake \
  --shard-index=17 --shard-count=50 \
  --out=metrics/campaign-17.csv
```

This runs exactly campaign 17 using its derived seed. The shard artifact's
`campaignSeed` is the authoritative record of the seed actually used for each
campaign.

The harness does not yet model a seminar. Seminar participants share a roster
pool and trauma pool, so a cohort is a fold across participants rather than a
set of independent participant jobs. One shard is not one student: sharding is
only across independent campaigns.

Campaign master seeds use a deterministic 32-bit mixing function over the run
master seed and zero-based campaign index. The mix is independent of shard
count; the existing per-match seed rule is then applied inside each campaign.
The manifest records the run master seed and campaign indices. If
`GIT_COMMIT_SHA` is supplied by the runner it is recorded; otherwise the
optional commit field is left unavailable rather than discovered by a fragile
shell command.

Leaders: `tyrannical`, `supportive`, `volatile`, `servant`, `random`,
`pure_tactician`, `redeemer`.

Engines: `lozza` (default runtime), `fake` (explicit CI/test mode), `stockfish`
(explicit high-fidelity calibration mode).

Lozza uses a harness-only default depth cap of 4 so the documented 20-match
smoke remains tractable. `--depth-cap=N` clamps only the depth sent to the
selected engine; it does not change psychology's `calculateEngineSearchDepth`
or any piece state. A capped run is a tractability proxy, not full-fidelity
calibration. Pass `--depth-cap` explicitly (or use Stockfish without a cap)
when measuring engine fidelity.

When `--matches` is ≤ 20, smoke degeneracy bounds run before exit (CI gate).

Campaign output includes four match-index quartile trajectory bands. Each band
reports mean ability trust, mean benevolence trust, bounded refusal rate,
refusals per ply, desertion match rate, desertion attrition, rout rate, mean
surviving roster size, and mean win score. Match indices are assigned by
`floor(((match - 1) * 4) / campaignMatches) + 1`; any remainder matches go to
the earlier quartiles. The CSV appends the channel metrics and roster size to
each existing match row, then appends an explicit pointwise
`trajectory_match` section. Its `mean_tau_abil_end` and
`mean_surviving_roster_size` values describe that match's roster snapshot.
The trajectory-band section averages those same pointwise match-end values
within match-index bands. It also appends a cumulative horizon section with
one row for every prefix of the campaign; horizon `h` reports the campaign
aggregates as if the career ended after match `h`, so its `mean_tau_abil` is a
cumulative mean over matches `1..h`, not the value at match `h`.

The first two quartiles are the early-frustration check: desertion attrition and
rout rates of 80% or more in either early quartile produce an `early-saturation`
finding. The default smoke reports that finding without failing, because
pre-existing balance defects must not block unrelated CI. Pass
`--enforce-calibration=true` to make it a calibration failure. This threshold
is intentionally above the existing 50% supportive bound and marks near-total
early collapse rather than ordinary variation.

Campaign checkpoints are emitted with `--checkpoint-out=path` and resumed with
`--resume=path`. Use `--campaign` with those flags to set the total campaign
length: a checkpoint plus `--campaign` is what makes a campaign segment
resumable. Checkpoints resume only at a completed-match boundary, before the
next match's roster merge; there is no mid-match resume. Resuming requires the
same engine determinism ID, psychology configuration, leader, and seed, and
throws a mismatch error instead of silently producing incomparable numbers.

Scheduled Lozza calibration (N≈100 tyrannical and supportive as parallel jobs,
plus a one-knob sweep) runs in GitHub Actions via
`.github/workflows/nightly.yml` so balance signal does not require Cursor agent
time. Stockfish production-depth runs are `workflow_dispatch` only on that same
workflow, with an explicit match budget. See `docs/testing_strategy.md` §7.

## Layout

| File | Role |
|---|---|
| `cli.ts` | Argument parsing and CSV output |
| `campaign.ts` | Multi-match campaigns with roster carry-over |
| `match.ts` | Single-match wrapper around orchestration |
| `engine.ts` | Harness `EnginePort` factory |
| `leaders.ts` | Scripted leader policies |
| `roster.ts` | Starting roster and campaign merge |
| `eval.ts` | Legacy geometric mapper (play path uses engine insights) |
| `baseline.ts` | Plain-chess win-rate baseline (no psychology) |
| `sweep.ts` | Coefficient sweep runner (M3.4) |
| `metrics.ts` | Per-match and campaign aggregates + trust trajectory bands |
| `degeneracy.ts` | Non-degeneracy smoke detectors |
| `parallel.ts` | Campaign planning, sharding, manifests, and run aggregation |
| `aggregate.ts` | Shard-artifact aggregation CLI |
| `world.ts` | World-persistent commanders (ADR 0047) — pairing, enemy rosters, checkpoints |

Depth-`D_i` insights feed psychology through the ADR 0034 barrier. Both
player and opposing tracked identities run the verdict ladder (Milestone 5b /
ADR 0025); enemy private gauges stay off player-facing surfaces.

## World layer (ADR 0047)

`sim/world.ts` keeps commanders and pieces across campaigns inside one world
curriculum. It is the harness counterpart to seminar persistence — not a
replacement for Dexie careers, and not yet a host/facilitator product surface.
