#!/bin/sh
set -eu

: "${AWS_REGION:?AWS_REGION is required}"
: "${ECR_REPOSITORY:?ECR_REPOSITORY is required}"
: "${IMAGE_NAME:?IMAGE_NAME is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

registry="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com"
image="$registry/$ECR_REPOSITORY:$IMAGE_TAG"

aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "$registry"
docker tag "$IMAGE_NAME" "$image"
docker push "$image"

digest="$(aws ecr describe-images \
  --repository-name "$ECR_REPOSITORY" \
  --image-ids imageTag="$IMAGE_TAG" \
  --query 'imageDetails[0].imageDigest' \
  --output text)"
case "$digest" in
  sha256:*) ;;
  *) echo 'ECR did not return an immutable image digest.' >&2; exit 1 ;;
esac
printf '%s@%s\n' "$registry/$ECR_REPOSITORY" "$digest"
