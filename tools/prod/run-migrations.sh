#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROD_DIR="${ROOT_DIR}/infra/terraform/envs/prod"

IMAGE_TAG="${1:-}"
if [[ -z "${IMAGE_TAG}" ]]; then
  echo "Usage: run-migrations.sh <image-tag>" >&2
  exit 1
fi

function require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

require_command terraform
require_command aws
require_command python3

terraform -chdir="${PROD_DIR}" init -upgrade -reconfigure -backend-config="${PROD_DIR}/backend.hcl" >/dev/null

CLUSTER_ARN="$(terraform -chdir="${PROD_DIR}" output -raw ecs_cluster_arn)"
SUBNET_IDS_CSV="$(terraform -chdir="${PROD_DIR}" output -raw private_subnet_ids_csv)"
ECS_SG_ID="$(terraform -chdir="${PROD_DIR}" output -raw ecs_security_group_id)"
TASK_DEF_ARN="$(terraform -chdir="${PROD_DIR}" output -raw api_task_definition_arn)"

AWS_REGION="$(python3 - <<'PY'
import re
from pathlib import Path
content = Path("infra/terraform/envs/prod/terraform.tfvars").read_text(encoding="utf-8")
m = re.search(r'^\s*aws_region\s*=\s*\"([^\"]+)\"\s*$', content, re.M)
print(m.group(1) if m else "")
PY
)"

if [[ -z "${AWS_REGION}" ]]; then
  echo "Missing aws_region in infra/terraform/envs/prod/terraform.tfvars" >&2
  exit 1
fi

NETWORK_CONFIG="$(python3 - <<PY
import json
subnets = "${SUBNET_IDS_CSV}".split(",") if "${SUBNET_IDS_CSV}" else []
print(json.dumps({"awsvpcConfiguration": {"subnets": subnets, "securityGroups": ["${ECS_SG_ID}"], "assignPublicIp": "DISABLED"}}))
PY
)"

aws ecs run-task \
  --region "${AWS_REGION}" \
  --cluster "${CLUSTER_ARN}" \
  --launch-type FARGATE \
  --task-definition "${TASK_DEF_ARN}" \
  --network-configuration "${NETWORK_CONFIG}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["./node_modules/.bin/prisma","migrate","deploy"]}]}' \
  --count 1 >/dev/null

echo "Migration task started (check ECS task status/logs in CloudWatch)."

