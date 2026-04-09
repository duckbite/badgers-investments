#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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
require_command pnpm

AWS_PROFILE="${AWS_PROFILE:-default}"
export AWS_PROFILE
export AWS_SDK_LOAD_CONFIG="${AWS_SDK_LOAD_CONFIG:-1}"

if [[ ! -f "${PROD_DIR}/backend.hcl" ]]; then
  echo "Missing ${PROD_DIR}/backend.hcl. Run prod:up first." >&2
  exit 1
fi

terraform -chdir="${PROD_DIR}" init -upgrade -reconfigure -backend-config="${PROD_DIR}/backend.hcl" >/dev/null

WEB_BUCKET_NAME="$(terraform -chdir="${PROD_DIR}" output -raw web_bucket_name)"
CLOUDFRONT_DISTRIBUTION_ID="$(terraform -chdir="${PROD_DIR}" output -raw cloudfront_distribution_id)"

if [[ -z "${WEB_BUCKET_NAME}" || -z "${CLOUDFRONT_DISTRIBUTION_ID}" ]]; then
  echo "Missing Terraform outputs for web bucket or CloudFront distribution." >&2
  exit 1
fi

echo "Building web."
pnpm -C "${ROOT_DIR}" --filter web build

echo "Uploading web to S3: ${WEB_BUCKET_NAME}"
aws s3 sync "${ROOT_DIR}/apps/web/build" "s3://${WEB_BUCKET_NAME}" --delete

echo "Invalidating CloudFront distribution: ${CLOUDFRONT_DISTRIBUTION_ID}"
aws cloudfront create-invalidation --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" --paths "/*" >/dev/null

echo "Done."

