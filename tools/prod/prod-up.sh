#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOTSTRAP_DIR="${ROOT_DIR}/infra/terraform/bootstrap"
PROD_DIR="${ROOT_DIR}/infra/terraform/envs/prod"

function require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

require_command terraform
require_command aws
require_command docker
require_command git
require_command curl
require_command python3

AWS_PROFILE="${AWS_PROFILE:-default}"
export AWS_PROFILE
export AWS_SDK_LOAD_CONFIG="${AWS_SDK_LOAD_CONFIG:-1}"

if [[ ! -f "${PROD_DIR}/terraform.tfvars" ]]; then
  echo "Missing ${PROD_DIR}/terraform.tfvars. Copy terraform.tfvars.example and fill it in." >&2
  exit 1
fi

AWS_REGION_FROM_TFVARS="$(python3 - <<'PY'
import re
from pathlib import Path
content = Path("infra/terraform/envs/prod/terraform.tfvars").read_text(encoding="utf-8")
m = re.search(r'^\s*aws_region\s*=\s*\"([^\"]+)\"\s*$', content, re.M)
print(m.group(1) if m else "")
PY
)"

if [[ -z "${AWS_REGION_FROM_TFVARS}" ]]; then
  echo "Missing aws_region in infra/terraform/envs/prod/terraform.tfvars" >&2
  exit 1
fi

GIT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short=12 HEAD)"
if [[ -n "${PROD_IMAGE_TAG:-}" ]]; then
  IMAGE_TAG="${PROD_IMAGE_TAG}"
else
  IMAGE_TAG="${GIT_SHA}-$(date -u +%Y%m%d%H%M%S)"
fi

echo "Using region: ${AWS_REGION_FROM_TFVARS}"
echo "Using AWS profile: ${AWS_PROFILE}"
echo "Using image tag: ${IMAGE_TAG}"

echo "Bootstrapping Terraform state backend."
terraform -chdir="${BOOTSTRAP_DIR}" init -upgrade
terraform -chdir="${BOOTSTRAP_DIR}" apply -auto-approve -var="aws_region=${AWS_REGION_FROM_TFVARS}"

STATE_BUCKET="$(terraform -chdir="${BOOTSTRAP_DIR}" output -raw state_bucket_name)"
STATE_KEY="$(terraform -chdir="${BOOTSTRAP_DIR}" output -raw state_key)"

BACKEND_FILE="${PROD_DIR}/backend.hcl"
cat > "${BACKEND_FILE}" <<EOF
bucket         = "${STATE_BUCKET}"
key            = "${STATE_KEY}"
region         = "${AWS_REGION_FROM_TFVARS}"
encrypt        = true
use_lockfile   = true
EOF

echo "Applying production infrastructure (phase 1: shared infra only)."
terraform -chdir="${PROD_DIR}" init -upgrade -reconfigure -backend-config="${BACKEND_FILE}"
terraform -chdir="${PROD_DIR}" apply -auto-approve -var-file="terraform.tfvars" -var="enable_services=false"

echo "Building and pushing Docker images to ECR."
bash "${ROOT_DIR}/tools/prod/deploy-prod.sh" "${IMAGE_TAG}"

echo "Applying production infrastructure (phase 2: ECS services enabled)."
terraform -chdir="${PROD_DIR}" apply -auto-approve -var-file="terraform.tfvars" \
  -var="enable_services=true" \
  -var="web_image_tag=${IMAGE_TAG}" \
  -var="api_image_tag=${IMAGE_TAG}" \
  -var="worker_image_tag=${IMAGE_TAG}"

echo "Running Prisma migrations via ECS one-off task."
bash "${ROOT_DIR}/tools/prod/run-migrations.sh" "${IMAGE_TAG}"

echo "Running smoke tests."
bash "${ROOT_DIR}/tools/prod/smoke-test.sh"

echo "Done."

