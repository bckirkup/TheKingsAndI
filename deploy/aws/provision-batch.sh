#!/bin/sh
set -eu

: "${AWS_REGION:?AWS_REGION is required}"
: "${BATCH_SERVICE_ROLE_ARN:?BATCH_SERVICE_ROLE_ARN is required}"
: "${EXECUTION_ROLE_ARN:?EXECUTION_ROLE_ARN is required}"
: "${JOB_ROLE_ARN:?JOB_ROLE_ARN is required}"
: "${ECR_IMAGE:?ECR_IMAGE must be an immutable ECR image reference}"
: "${SUBNETS:?SUBNETS must be a comma-separated subnet list}"
: "${SECURITY_GROUP_IDS:?SECURITY_GROUP_IDS must be a comma-separated security-group list}"
: "${LOG_GROUP:?LOG_GROUP is required}"

compute_environment="${COMPUTE_ENVIRONMENT:-kingsandi-campaign-spot-ce}"
job_queue="${JOB_QUEUE:-kingsandi-campaign-spot-queue}"
job_definition="${JOB_DEFINITION:-kingsandi-campaign-spot}"
max_vcpus="${MAX_VCPUS:-50}"

case "$max_vcpus" in
  ''|*[!0-9]*|0)
    echo 'MAX_VCPUS must be a positive integer.' >&2
    exit 2
    ;;
esac

if ! aws batch describe-compute-environments \
  --compute-environments "$compute_environment" \
  --query 'computeEnvironments[0].computeEnvironmentArn' \
  --output text 2>/dev/null | grep -q '^arn:'; then
  aws batch create-compute-environment \
    --compute-environment-name "$compute_environment" \
    --type MANAGED \
    --state ENABLED \
    --service-role "$BATCH_SERVICE_ROLE_ARN" \
    --compute-resources "type=FARGATE_SPOT,maxvCpus=$max_vcpus,subnets=$SUBNETS,securityGroupIds=$SECURITY_GROUP_IDS"
fi

aws batch update-compute-environment \
  --compute-environment "$compute_environment" \
  --compute-resources "maxvCpus=$max_vcpus,subnets=$SUBNETS,securityGroupIds=$SECURITY_GROUP_IDS"

if ! aws batch describe-job-queues \
  --job-queues "$job_queue" \
  --query 'jobQueues[0].jobQueueArn' \
  --output text 2>/dev/null | grep -q '^arn:'; then
  aws batch create-job-queue \
    --job-queue-name "$job_queue" \
    --state ENABLED \
    --priority 1 \
    --compute-environment-order order=1,computeEnvironment="$compute_environment"
fi

jq -n \
  --arg name "$job_definition" \
  --arg image "$ECR_IMAGE" \
  --arg execution_role "$EXECUTION_ROLE_ARN" \
  --arg job_role "$JOB_ROLE_ARN" \
  --arg log_group "$LOG_GROUP" \
  --arg region "$AWS_REGION" \
  '{
    jobDefinitionName: $name,
    type: "container",
    platformCapabilities: ["FARGATE"],
    containerProperties: {
      image: $image,
      resourceRequirements: [
        {type: "VCPU", value: "1"},
        {type: "MEMORY", value: "2048"}
      ],
      executionRoleArn: $execution_role,
      jobRoleArn: $job_role,
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": $log_group,
          "awslogs-region": $region,
          "awslogs-stream-prefix": "kingsandi"
        }
      },
      networkConfiguration: {assignPublicIp: "ENABLED"},
      fargatePlatformConfiguration: {platformVersion: "LATEST"}
    },
    retryStrategy: {
      attempts: 4,
      evaluateOnExit: [
        {onExitCode: "1", action: "RETRY"},
        {onExitCode: "2", action: "EXIT"},
        {onStatusReason: "Host EC2*", action: "RETRY"},
        {onReason: "Host EC2*", action: "RETRY"}
      ]
    }
  }' >/tmp/kingsandi-job-definition.json
aws batch register-job-definition \
  --cli-input-json file:///tmp/kingsandi-job-definition.json \
  --query 'jobDefinitionArn' \
  --output text
