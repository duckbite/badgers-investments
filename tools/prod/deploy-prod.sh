#!/usr/bin/env bash
#
# Local / emergency deploy: build Lambda zips and static web, upload to AWS.
# Requires: AWS CLI, pnpm, terraform outputs (or env overrides), credentials.
# Prefer GitHub Actions “Deploy production (serverless)” for normal releases.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI required" >&2
  exit 1
fi

PROD_DIR="${ROOT_DIR}/infra/terraform/envs/prod"
if [[ ! -f "${PROD_DIR}/backend.hcl" ]]; then
  echo "Missing ${PROD_DIR}/backend.hcl. Initialize prod Terraform backend first." >&2
  exit 1
fi

terraform -chdir="${PROD_DIR}" init -upgrade -reconfigure -backend-config="${PROD_DIR}/backend.hcl" >/dev/null

BUCKET="$(terraform -chdir="${PROD_DIR}" output -raw web_s3_bucket_id)"
DIST_ID="$(terraform -chdir="${PROD_DIR}" output -raw cloudfront_distribution_id)"
API_FN="$(terraform -chdir="${PROD_DIR}" output -raw lambda_api_function_name)"
DAILY_WORKER_FN="$(terraform -chdir="${PROD_DIR}" output -raw lambda_daily_worker_function_name)"
RECOMMENDATION_PROCESSOR_FN="$(terraform -chdir="${PROD_DIR}" output -raw lambda_recommendation_processor_function_name)"

# Region: environment or terraform.tfvars
if [[ -z "${AWS_REGION:-}" ]]; then
  AWS_REGION="$(grep -E '^\s*aws_region\s*=' "${PROD_DIR}/terraform.tfvars" 2>/dev/null | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/' || true)"
fi
if [[ -z "${AWS_REGION:-}" ]]; then
  echo "Set AWS_REGION or add aws_region to terraform.tfvars" >&2
  exit 1
fi
export AWS_REGION

echo "Building web (PUBLIC_API_BASE_URL required for browser API calls)."
if [[ -z "${PUBLIC_API_BASE_URL:-}" ]]; then
  echo "Set PUBLIC_API_BASE_URL (e.g. https://api.example.com)" >&2
  exit 1
fi

pnpm install --frozen-lockfile
pnpm --filter web build
pnpm --filter api build:lambda
pnpm --filter api build:lambda:recommendation-processor
pnpm --filter worker build:lambda:all

echo "Uploading Lambdas."
(cd services/api/dist-lambda && zip -qr "${ROOT_DIR}/api-lambda.zip" .)
(cd services/api/dist-lambda-recommendation-processor && zip -qr "${ROOT_DIR}/recommendation-processor-lambda.zip" .)
(cd workers/worker/dist-lambda/daily && zip -qr "${ROOT_DIR}/daily-worker-lambda.zip" .)
aws lambda update-function-code --function-name "${API_FN}" --zip-file "fileb://${ROOT_DIR}/api-lambda.zip" --region "${AWS_REGION}"
aws lambda update-function-code --function-name "${DAILY_WORKER_FN}" --zip-file "fileb://${ROOT_DIR}/daily-worker-lambda.zip" --region "${AWS_REGION}"
aws lambda update-function-code --function-name "${RECOMMENDATION_PROCESSOR_FN}" --zip-file "fileb://${ROOT_DIR}/recommendation-processor-lambda.zip" --region "${AWS_REGION}"
rm -f "${ROOT_DIR}/api-lambda.zip" "${ROOT_DIR}/daily-worker-lambda.zip" "${ROOT_DIR}/recommendation-processor-lambda.zip"

echo "Syncing static site to s3://${BUCKET}"
aws s3 sync apps/web/build "s3://${BUCKET}/" --delete --region "${AWS_REGION}"

aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*" --region us-east-1 >/dev/null
echo "Deploy finished. Invalidate CloudFront (${DIST_ID}) submitted."
