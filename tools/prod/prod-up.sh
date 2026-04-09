#!/usr/bin/env bash
#
# First-time or full prod stack: apply Terraform for serverless prod (S3, CloudFront,
# Lambda, API Gateway, EventBridge). Does not replace CI for app code updates.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROD_DIR="${ROOT_DIR}/infra/terraform/envs/prod"

if [[ ! -f "${PROD_DIR}/backend.hcl" ]]; then
  echo "Create ${PROD_DIR}/backend.hcl (see backend pattern in infra docs), then re-run." >&2
  exit 1
fi

echo "Applying production Terraform (serverless stack)..."
terraform -chdir="${PROD_DIR}" init -upgrade -reconfigure -backend-config="${PROD_DIR}/backend.hcl"
terraform -chdir="${PROD_DIR}" apply

echo "Next: set GitHub Actions variables from terraform output (web_s3_bucket_id, cloudfront_distribution_id,"
echo "lambda_api_function_name, lambda_worker_function_name, API_DOMAIN, WEB_DOMAIN, AWS_REGION) and run deploy workflow or tools/prod/deploy-prod.sh"
