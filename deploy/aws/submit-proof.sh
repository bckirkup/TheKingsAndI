#!/bin/sh
set -eu

: "${AWS_REGION:?AWS_REGION is required}"
: "${JOB_QUEUE:?JOB_QUEUE is required}"
: "${JOB_DEFINITION:?JOB_DEFINITION is required}"
: "${RUN_ID:?RUN_ID is required}"
: "${CAMPAIGN_LENGTH:?CAMPAIGN_LENGTH is required}"
: "${CAMPAIGNS:?CAMPAIGNS is required}"
: "${SHARD_COUNT:?SHARD_COUNT is required}"
: "${LEADER:?LEADER is required}"
: "${SEED:?SEED is required}"
: "${DEPTH_CAP:?DEPTH_CAP is required}"
: "${GIT_COMMIT_SHA:?GIT_COMMIT_SHA is required}"
: "${IMAGE_DIGEST:?IMAGE_DIGEST is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

jq -n \
  --arg run_id "$RUN_ID" \
  --arg campaign_length "$CAMPAIGN_LENGTH" \
  --arg campaigns "$CAMPAIGNS" \
  --arg shard_count "$SHARD_COUNT" \
  --arg leader "$LEADER" \
  --arg seed "$SEED" \
  --arg depth_cap "$DEPTH_CAP" \
  --arg git_commit "$GIT_COMMIT_SHA" \
  --arg image_digest "$IMAGE_DIGEST" \
  --arg s3_bucket "$S3_BUCKET" \
  '{
    environment: [
      {name: "RUN_ID", value: $run_id},
      {name: "CAMPAIGN_LENGTH", value: $campaign_length},
      {name: "CAMPAIGNS", value: $campaigns},
      {name: "SHARD_COUNT", value: $shard_count},
      {name: "LEADER", value: $leader},
      {name: "SEED", value: $seed},
      {name: "DEPTH_CAP", value: $depth_cap},
      {name: "GIT_COMMIT_SHA", value: $git_commit},
      {name: "IMAGE_DIGEST", value: $image_digest},
      {name: "S3_BUCKET", value: $s3_bucket}
    ]
  }' >/tmp/kingsandi-container-overrides.json

aws batch submit-job \
  --job-name "$RUN_ID" \
  --job-queue "$JOB_QUEUE" \
  --job-definition "$JOB_DEFINITION" \
  --array-properties size="$SHARD_COUNT" \
  --container-overrides file:///tmp/kingsandi-container-overrides.json \
  --query jobId \
  --output text
