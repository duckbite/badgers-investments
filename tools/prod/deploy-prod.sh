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

function ensure_buildx_builder() {
  local builder_name="badgers-investments"
  if ! docker buildx inspect "${builder_name}" >/dev/null 2>&1; then
    docker buildx create --name "${builder_name}" --use >/dev/null
  else
    docker buildx use "${builder_name}" >/dev/null
  fi
  docker buildx inspect --bootstrap >/dev/null
}

function does_ecr_image_tag_exist() {
  local repository_url="$1"
  local image_tag="$2"
  local aws_region="$3"
  local repository_name="${repository_url#*/}"
  aws ecr describe-images --repository-name "${repository_name}" --image-ids "imageTag=${image_tag}" --region "${aws_region}" >/dev/null 2>&1
}

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

PLATFORMS="${DOCKER_PLATFORMS:-linux/amd64,linux/arm64}"
ensure_buildx_builder

echo "Building API image."
if does_ecr_image_tag_exist "${API_REPO}" "${IMAGE_TAG}" "${AWS_REGION}"; then
  echo "API image tag already exists in ECR. Skipping push: ${API_REPO}:${IMAGE_TAG}"
else
  docker buildx build --platform "${PLATFORMS}" -f "${ROOT_DIR}/services/api/Dockerfile" -t "${API_REPO}:${IMAGE_TAG}" --push "${ROOT_DIR}"
fi

echo "Building worker image."
if does_ecr_image_tag_exist "${WORKER_REPO}" "${IMAGE_TAG}" "${AWS_REGION}"; then
  echo "Worker image tag already exists in ECR. Skipping push: ${WORKER_REPO}:${IMAGE_TAG}"
else
  docker buildx build --platform "${PLATFORMS}" -f "${ROOT_DIR}/workers/worker/Dockerfile" -t "${WORKER_REPO}:${IMAGE_TAG}" --push "${ROOT_DIR}"
fi

echo "Building web image."
if does_ecr_image_tag_exist "${WEB_REPO}" "${IMAGE_TAG}" "${AWS_REGION}"; then
  echo "Web image tag already exists in ECR. Skipping push: ${WEB_REPO}:${IMAGE_TAG}"
else
  docker buildx build --platform "${PLATFORMS}" -f "${ROOT_DIR}/apps/web/Dockerfile" -t "${WEB_REPO}:${IMAGE_TAG}" --push "${ROOT_DIR}"
fi

