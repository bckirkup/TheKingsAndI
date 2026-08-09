# AWS Spot campaign worker

This image runs one campaign shard per AWS Batch array child. It is
Lozza-only: Stockfish is an optional local/CI engine dependency and is
deliberately excluded from the image by `pnpm install --no-optional` and a
Docker build assertion.

## Required runtime variables

The entrypoint requires:

- `RUN_ID` — logical campaign run identifier.
- `CAMPAIGN_LENGTH` — matches in the one campaign owned by this shard.
- `CAMPAIGNS` — total campaign count for the run.
- `SHARD_COUNT` — Batch array size; must equal `CAMPAIGNS` so each worker owns
  exactly one resumable campaign.
- `LEADER` — a supported leader archetype.
- `SEED` — master integer seed.
- `DEPTH_CAP` — explicit positive Lozza depth cap; there is no image default.
- `GIT_COMMIT_SHA` — source commit supplied by the job definition.
- `IMAGE_DIGEST` — immutable container image digest supplied by the job
  definition.

`AWS_BATCH_JOB_ARRAY_INDEX` supplies the shard index and defaults to `0` when
running outside Batch. `ENGINE` defaults to `lozza`; local validation may set
`ENGINE=fake`.

For S3 operation, also set:

- `S3_BUCKET` — bucket name.
- `AWS_REGION` — region used by the AWS CLI.

The image contains no credentials. In Batch, credentials come from the job
role. If `S3_BUCKET` is unset, every S3 operation is skipped and artifacts are
written below `OUTPUT_DIR`, which defaults to `/work/output`.

The run manifest is written by shard 0 after a successful simulation. It
contains the supplied commit SHA and image digest plus the determinism ID
reported by the shard artifact. The entrypoint fails rather than writing a
manifest without that provenance.

## S3 layout

The entrypoint uses these keys:

```text
campaigns/<run-id>/manifest.json
campaigns/<run-id>/shards/shard-<i>.csv
campaigns/<run-id>/shards/shard-<i>.json
campaigns/_resume/<run-id>/shard-<i>.json
```

The resume prefix is intentionally outside the run directory so it can be
managed by the bucket lifecycle rule. Checkpoints are uploaded while the
simulation runs and again after an interruption. The entrypoint never deletes
objects. Repeated uploads to the same key are tolerated for retry purposes.

## Build

Build from the repository root so the Dockerfile can copy the source tree and
the byte-preserved vendored Lozza artifact:

```bash
docker build \
  --platform=linux/amd64 \
  -f deploy/aws/Dockerfile \
  -t kingsandi-campaign:local .
```

The Node base image is pinned to a Node 20.19.0 amd64 digest. Corepack reads
the repository's `packageManager` field (`pnpm@9.15.4`). Dev dependencies are
installed because the sim runs TypeScript through `tsx`.

## Local run

The local mode requires no AWS account, credentials, bucket, or network access
at runtime:

```bash
mkdir -p /tmp/kingsandi-output
docker run --rm \
  -e RUN_ID=local-fake \
  -e CAMPAIGN_LENGTH=1 \
  -e CAMPAIGNS=1 \
  -e SHARD_COUNT=1 \
  -e LEADER=supportive \
  -e SEED=1 \
  -e DEPTH_CAP=8 \
  -e GIT_COMMIT_SHA=local \
  -e IMAGE_DIGEST=local \
  -e ENGINE=fake \
  -e OUTPUT_DIR=/work/output \
  -v /tmp/kingsandi-output:/work/output \
  kingsandi-campaign:local
```

For a real Lozza smoke, use the same command with `ENGINE=lozza`. The
checkpoint is at:

```text
/tmp/kingsandi-output/campaigns/_resume/<run-id>/shard-0.json
```

## Spot interruption behavior

On `SIGTERM` or `SIGINT`, the entrypoint forwards the signal to the sim. The
sim flushes its latest completed-match checkpoint and exits non-zero; the
entrypoint uploads that checkpoint and also exits non-zero so Batch retries the
array child. A reclaimed shard therefore appears as a failed child by design:
that status can represent a healthy resumable interruption, not a simulation
fault.

On retry, the entrypoint downloads the existing checkpoint when available and
passes it to `pnpm sim --resume`. A missing checkpoint means a clean start.
