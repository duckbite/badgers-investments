#!/usr/bin/env bash

set -euo pipefail

TERRAFORM_DIR="${1:-infra/terraform/envs/prod}"
RESOURCE_ADDRESS="${2:-module.github_actions_oidc.aws_iam_openid_connect_provider.github_actions}"
OIDC_URL="${3:-https://token.actions.githubusercontent.com}"

function require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

require_command aws
require_command terraform

AWS_PROFILE="${AWS_PROFILE:-default}"
export AWS_PROFILE
export AWS_SDK_LOAD_CONFIG="${AWS_SDK_LOAD_CONFIG:-1}"

PROVIDER_ARNS="$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text || true)"
if [[ -z "${PROVIDER_ARNS}" ]]; then
  echo "No IAM OIDC providers found. Skipping import."
  exit 0
fi

FOUND_ARN=""
for arn in ${PROVIDER_ARNS}; do
  url="$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${arn}" --query 'Url' --output text 2>/dev/null || true)"
  if [[ "https://${url}" == "${OIDC_URL}" ]]; then
    FOUND_ARN="${arn}"
    break
  fi
done

if [[ -z "${FOUND_ARN}" ]]; then
  echo "OIDC provider for ${OIDC_URL} not found. Skipping import."
  exit 0
fi

echo "Found existing OIDC provider ARN: ${FOUND_ARN}"
echo "Attempting terraform import into: ${RESOURCE_ADDRESS}"

set +e
terraform -chdir="${TERRAFORM_DIR}" import -no-color "${RESOURCE_ADDRESS}" "${FOUND_ARN}"
exit_code=$?
set -e

if [[ "${exit_code}" -eq 0 ]]; then
  echo "OIDC provider imported successfully."
  exit 0
fi

echo "Terraform import did not succeed (exit ${exit_code}). This may be OK if it's already in state."
exit 0

