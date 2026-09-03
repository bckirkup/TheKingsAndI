#!/bin/sh
set -eu

: "${RUN_ID:?RUN_ID is required}"
: "${SEED:?SEED is required}"
: "${WEEKS:?WEEKS is required}"
: "${MATCHES_PER_WEEK:?MATCHES_PER_WEEK is required}"
: "${COMMANDERS:?COMMANDERS is required}"
: "${CATALOGUE:?CATALOGUE is required}"
: "${GIT_COMMIT_SHA:?GIT_COMMIT_SHA is required}"
: "${IMAGE_DIGEST:?IMAGE_DIGEST is required}"

shard_index="${AWS_BATCH_JOB_ARRAY_INDEX:-0}"
engine="${ENGINE:-fake}"
output_root="${OUTPUT_DIR:-/work/output}"

case "$shard_index" in
  ''|*[!0-9]*) echo 'AWS_BATCH_JOB_ARRAY_INDEX must be a non-negative integer.' >&2; exit 2 ;;
  *) ;;
esac

validate_positive_integer() {
  name="$1"
  value="$2"
  case "$value" in
    ''|*[!0-9]*|0) echo "$name must be a positive integer." >&2; exit 2 ;;
    *) ;;
  esac
}

validate_integer() {
  name="$1"
  value="$2"
  case "$value" in
    ''|-) echo "$name must be an integer." >&2; exit 2 ;;
    -*)
      digits="${value#-}"
      case "$digits" in
        ''|*[!0-9]*) echo "$name must be an integer." >&2; exit 2 ;;
        *) ;;
      esac
      ;;
    *[!0-9]*) echo "$name must be an integer." >&2; exit 2 ;;
    *) ;;
  esac
}

validate_positive_integer WEEKS "$WEEKS"
validate_positive_integer MATCHES_PER_WEEK "$MATCHES_PER_WEEK"
validate_positive_integer COMMANDERS "$COMMANDERS"
validate_integer SEED "$SEED"

case "$engine" in
  fake|lozza|stockfish) ;;
  *) echo 'ENGINE must be fake, lozza, or stockfish.' >&2; exit 2 ;;
esac

shard_seed=$((SEED + shard_index))
run_dir="$output_root/campaigns/$RUN_ID"
seminar_dir="$run_dir/seminars"
seminar_path="$seminar_dir/seminar-$shard_index.json"
summary_path="$seminar_dir/seminar-$shard_index.summary.txt"
manifest_path="$run_dir/manifest.json"
mkdir -p "$seminar_dir"
cd /app

pnpm sim:seminar \
  "--seed=$shard_seed" \
  "--weeks=$WEEKS" \
  "--matches=$MATCHES_PER_WEEK" \
  "--commanders=$COMMANDERS" \
  "--engine=$engine" \
  "--catalogue=$CATALOGUE" \
  "--out=$seminar_path" >"$summary_path"

write_manifest() {
  node >"$manifest_path.tmp" <<'NODE'
const required = [
  'RUN_ID',
  'SEED',
  'WEEKS',
  'MATCHES_PER_WEEK',
  'COMMANDERS',
  'CATALOGUE',
  'GIT_COMMIT_SHA',
  'IMAGE_DIGEST',
];
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing manifest provenance: ${name}`);
  }
}
const manifest = {
  runId: process.env.RUN_ID,
  seed: Number(process.env.SEED),
  weeks: Number(process.env.WEEKS),
  matchesPerWeek: Number(process.env.MATCHES_PER_WEEK),
  commanders: Number(process.env.COMMANDERS),
  catalogue: process.env.CATALOGUE,
  engine: process.env.ENGINE || 'fake',
  gitCommitSha: process.env.GIT_COMMIT_SHA,
  imageDigest: process.env.IMAGE_DIGEST,
};
process.stdout.write(`${JSON.stringify(manifest)}\n`);
NODE
  mv "$manifest_path.tmp" "$manifest_path"
}

if [ "$shard_index" -eq 0 ]; then
  write_manifest
fi

if [ -n "${S3_BUCKET:-}" ]; then
  : "${AWS_REGION:?AWS_REGION is required when S3_BUCKET is set}"
  export AWS_DEFAULT_REGION="$AWS_REGION"
  s3_root="s3://$S3_BUCKET/campaigns/$RUN_ID/seminars"
  aws s3 cp "$seminar_path" "$s3_root/seminar-$shard_index.json"
  aws s3 cp "$summary_path" "$s3_root/seminar-$shard_index.summary.txt"
  if [ "$shard_index" -eq 0 ]; then
    aws s3 cp "$manifest_path" "s3://$S3_BUCKET/campaigns/$RUN_ID/manifest.json"
  fi
fi

echo "Seminar shard $shard_index completed successfully."
