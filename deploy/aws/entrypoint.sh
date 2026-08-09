#!/bin/sh
set -eu

: "${RUN_ID:?RUN_ID is required}"
: "${CAMPAIGN_LENGTH:?CAMPAIGN_LENGTH is required}"
: "${SHARD_COUNT:?SHARD_COUNT is required}"
: "${LEADER:?LEADER is required}"
: "${SEED:?SEED is required}"
: "${DEPTH_CAP:?DEPTH_CAP is required}"

shard_index="${AWS_BATCH_JOB_ARRAY_INDEX:-0}"
engine="${ENGINE:-lozza}"
output_root="${OUTPUT_DIR:-/work/output}"

case "$shard_index" in
  ''|*[!0-9]*) echo 'AWS_BATCH_JOB_ARRAY_INDEX must be a non-negative integer.' >&2; exit 2 ;;
esac
case "$SHARD_COUNT" in
  ''|*[!0-9]*|0) echo 'SHARD_COUNT must be a positive integer.' >&2; exit 2 ;;
esac
case "$CAMPAIGN_LENGTH" in
  ''|*[!0-9]*|0) echo 'CAMPAIGN_LENGTH must be a positive integer.' >&2; exit 2 ;;
esac
case "$DEPTH_CAP" in
  ''|*[!0-9]*|0) echo 'DEPTH_CAP must be a positive integer.' >&2; exit 2 ;;
esac

if [ "$shard_index" -ge "$SHARD_COUNT" ]; then
  echo 'AWS_BATCH_JOB_ARRAY_INDEX must be less than SHARD_COUNT.' >&2
  exit 2
fi

run_dir="$output_root/campaigns/$RUN_ID"
resume_dir="$output_root/campaigns/_resume/$RUN_ID"
csv_path="$run_dir/shards/shard-$shard_index.csv"
artifact_path="$run_dir/shards/shard-$shard_index.json"
checkpoint_path="$resume_dir/shard-$shard_index.json"
manifest_path="$run_dir/manifest.json"
mkdir -p "$run_dir/shards" "$resume_dir"
cd /app

if [ -n "${S3_BUCKET:-}" ]; then
  : "${AWS_REGION:?AWS_REGION is required when S3_BUCKET is set}"
  export AWS_DEFAULT_REGION="$AWS_REGION"
  s3_root="s3://$S3_BUCKET"
  if aws s3 cp "$s3_root/campaigns/_resume/$RUN_ID/shard-$shard_index.json" \
      "$checkpoint_path" >/dev/null 2>&1; then
    echo "Resuming from s3://$S3_BUCKET/campaigns/_resume/$RUN_ID/shard-$shard_index.json"
  else
    rm -f "$checkpoint_path"
    echo "No remote checkpoint found; starting a clean shard."
  fi
else
  s3_root=
  echo 'S3_BUCKET is unset; running without AWS access.'
fi

node >"$manifest_path.tmp" <<'NODE'
const manifest = {
  runId: process.env.RUN_ID,
  campaignLength: Number(process.env.CAMPAIGN_LENGTH),
  campaignCount: Number(process.env.SHARD_COUNT),
  leader: process.env.LEADER,
  masterSeed: Number(process.env.SEED),
  depthCap: Number(process.env.DEPTH_CAP),
  engine: process.env.ENGINE || 'lozza',
  shardCount: Number(process.env.SHARD_COUNT),
};
process.stdout.write(`${JSON.stringify(manifest)}\n`);
NODE
mv "$manifest_path.tmp" "$manifest_path"

if [ -n "$s3_root" ]; then
  aws s3 cp "$manifest_path" "$s3_root/campaigns/$RUN_ID/manifest.json"
fi

upload_checkpoint() {
  if [ -z "$s3_root" ] || [ ! -f "$checkpoint_path" ]; then
    return 0
  fi
  aws s3 cp "$checkpoint_path" \
    "$s3_root/campaigns/_resume/$RUN_ID/shard-$shard_index.json"
}

last_checkpoint_signature=
watch_checkpoint() {
  while kill -0 "$sim_pid" 2>/dev/null; do
    if [ -f "$checkpoint_path" ] && [ -n "$s3_root" ]; then
      signature="$(sha256sum "$checkpoint_path" | cut -d ' ' -f 1)"
      if [ "$signature" != "$last_checkpoint_signature" ]; then
        if upload_checkpoint; then
          last_checkpoint_signature="$signature"
        else
          echo 'Checkpoint upload failed; retaining the local checkpoint.' >&2
        fi
      fi
    fi
    sleep 1
  done
}

signal_received=0
forward_signal() {
  signal_received=1
  if kill -0 "$sim_pid" 2>/dev/null; then
    kill -TERM "$sim_pid" 2>/dev/null || true
  fi
}
trap forward_signal TERM INT

set -- pnpm sim \
  "--campaign-length=$CAMPAIGN_LENGTH" \
  "--campaigns=$SHARD_COUNT" \
  "--leader=$LEADER" \
  "--seed=$SEED" \
  "--engine=$engine" \
  "--depth-cap=$DEPTH_CAP" \
  "--shard-index=$shard_index" \
  "--shard-count=$SHARD_COUNT" \
  "--out=$csv_path" \
  "--artifact-out=$artifact_path" \
  "--checkpoint-out=$checkpoint_path"
if [ -f "$checkpoint_path" ]; then
  set -- "$@" "--resume=$checkpoint_path"
fi

"$@" &
sim_pid=$!
watch_checkpoint &
watch_pid=$!

sim_status=0
while :; do
  if wait "$sim_pid"; then
    sim_status=0
    break
  else
    sim_status=$?
  fi
  if ! kill -0 "$sim_pid" 2>/dev/null; then
    break
  fi
done

kill "$watch_pid" 2>/dev/null || true
wait "$watch_pid" 2>/dev/null || true

if [ "$signal_received" -eq 1 ]; then
  upload_checkpoint || echo 'Final checkpoint upload failed.' >&2
  echo 'Shard interrupted; exiting non-zero so Batch retries it.' >&2
  exit 1
fi

if [ "$sim_status" -ne 0 ]; then
  upload_checkpoint || echo 'Final checkpoint upload failed.' >&2
  exit "$sim_status"
fi

if [ -n "$s3_root" ]; then
  aws s3 cp "$csv_path" "$s3_root/campaigns/$RUN_ID/shards/shard-$shard_index.csv"
  aws s3 cp "$artifact_path" "$s3_root/campaigns/$RUN_ID/shards/shard-$shard_index.json"
fi

echo "Shard $shard_index completed successfully."
