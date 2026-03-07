#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROD_DIR="${ROOT_DIR}/infra/terraform/envs/prod"

IMAGE_TAG="${1:-}"
if [[ -z "${IMAGE_TAG}" ]]; then
  echo "Usage: deploy-prod.sh <image-tag>" >&2
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
require_command docker
require_command python3

AWS_PROFILE="${AWS_PROFILE:-default}"
export AWS_PROFILE
export AWS_SDK_LOAD_CONFIG="${AWS_SDK_LOAD_CONFIG:-1}"

if [[ ! -f "${PROD_DIR}/backend.hcl" ]]; then
  echo "Missing ${PROD_DIR}/backend.hcl. Run prod:up at least once." >&2
  exit 1
fi

terraform -chdir="${PROD_DIR}" init -upgrade -reconfigure -backend-config="${PROD_DIR}/backend.hcl" >/dev/null

WEB_REPO="$(terraform -chdir="${PROD_DIR}" output -raw web_ecr_repository_url)"
API_REPO="$(terraform -chdir="${PROD_DIR}" output -raw api_ecr_repository_url)"
WORKER_REPO="$(terraform -chdir="${PROD_DIR}" output -raw worker_ecr_repository_url)"

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

AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "Building API image."
docker build -f "${ROOT_DIR}/services/api/Dockerfile" -t "${API_REPO}:${IMAGE_TAG}" "${ROOT_DIR}"
docker push "${API_REPO}:${IMAGE_TAG}"

echo "Building worker image."
docker build -f "${ROOT_DIR}/workers/worker/Dockerfile" -t "${WORKER_REPO}:${IMAGE_TAG}" "${ROOT_DIR}"
docker push "${WORKER_REPO}:${IMAGE_TAG}"

echo "Building web image."
docker build -f "${ROOT_DIR}/apps/web/Dockerfile" -t "${WEB_REPO}:${IMAGE_TAG}" "${ROOT_DIR}"
docker push "${WEB_REPO}:${IMAGE_TAG}"

