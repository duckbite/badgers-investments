#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOTSTRAP_DIR="${ROOT_DIR}/infra/terraform/bootstrap"
LEGACY_DIR="${ROOT_DIR}/infra/terraform/envs/prod-legacy"

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

AWS_PROFILE="${AWS_PROFILE:-default}"
export AWS_PROFILE
export AWS_SDK_LOAD_CONFIG="${AWS_SDK_LOAD_CONFIG:-1}"

if [[ "${CONFIRM_PROD_LEGACY_DESTROY:-}" != "1" ]]; then
  echo "Refusing to destroy production legacy stack." >&2
  echo "Set CONFIRM_PROD_LEGACY_DESTROY=1 to proceed." >&2
  exit 1
fi

TFVARS_FILE="${ROOT_DIR}/infra/terraform/envs/prod/terraform.tfvars"
if [[ ! -f "${TFVARS_FILE}" ]]; then
  echo "Missing ${TFVARS_FILE}. (We still read aws_region from it.)" >&2
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

echo "Using region: ${AWS_REGION_FROM_TFVARS}"
echo "Using AWS profile: ${AWS_PROFILE}"

echo "Ensuring Terraform backend exists (bootstrap)."
terraform -chdir="${BOOTSTRAP_DIR}" init -upgrade
terraform -chdir="${BOOTSTRAP_DIR}" apply -auto-approve -var="aws_region=${AWS_REGION_FROM_TFVARS}"

STATE_BUCKET="$(terraform -chdir="${BOOTSTRAP_DIR}" output -raw state_bucket_name)"
STATE_KEY_LEGACY="$(terraform -chdir="${BOOTSTRAP_DIR}" output -raw state_key_legacy)"

BACKEND_FILE="${LEGACY_DIR}/backend.hcl"
cat > "${BACKEND_FILE}" <<EOF
bucket         = "${STATE_BUCKET}"
key            = "${STATE_KEY_LEGACY}"
region         = "${AWS_REGION_FROM_TFVARS}"
encrypt        = true
use_lockfile   = true
EOF

echo "Destroying legacy production stack (remote state: s3://${STATE_BUCKET}/${STATE_KEY_LEGACY})."
terraform -chdir="${LEGACY_DIR}" init -upgrade -reconfigure -backend-config="${BACKEND_FILE}"

LEGACY_RESOURCE_COUNT="$(terraform -chdir="${LEGACY_DIR}" state list 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${LEGACY_RESOURCE_COUNT}" == "0" ]]; then
  echo "Legacy Terraform state is empty." >&2
  echo "Fork the pre-serverless prod state into this key before destroying:" >&2
  echo "  s3://${STATE_BUCKET}/${STATE_KEY_LEGACY}" >&2
  echo "(Copy from backups or from ${STATE_BUCKET}/badgers-investments/prod/terraform.tfstate only if that object still describes ECS/RDS.)" >&2
  exit 1
fi

# RDS deletion protection is enabled by default and must be disabled before deletion.
# Never run a blind targeted apply: if RDS is not in state, Terraform would create a new instance.
if terraform -chdir="${LEGACY_DIR}" state list 2>/dev/null | grep -q '^module\.database\.aws_db_instance\.main$'; then
  PLAN_FILE="$(mktemp)"
  terraform -chdir="${LEGACY_DIR}" plan -var-file="${TFVARS_FILE}" \
    -var="enable_services=false" \
    -var="db_deletion_protection=false" \
    -var="db_skip_final_snapshot=true" \
    -target="module.database.aws_db_instance.main" \
    -out="${PLAN_FILE}" >/dev/null
  if ! terraform -chdir="${LEGACY_DIR}" show -json "${PLAN_FILE}" | python3 -c '
import json, sys
plan = json.load(sys.stdin)
for change in plan.get("resource_changes", []):
    if change.get("type") != "aws_db_instance":
        continue
    actions = change.get("change", {}).get("actions", [])
    if "create" in actions:
        print(
            "Planned create for aws_db_instance; refusing (legacy state does not track this RDS).",
            file=sys.stderr,
        )
        sys.exit(1)
sys.exit(0)
'
  then
    rm -f "${PLAN_FILE}"
    exit 1
  fi
  rm -f "${PLAN_FILE}"

  echo "Disabling RDS deletion protection (targeted apply)."
  terraform -chdir="${LEGACY_DIR}" apply -auto-approve -var-file="${TFVARS_FILE}" \
    -var="enable_services=false" \
    -var="db_deletion_protection=false" \
    -var="db_skip_final_snapshot=true" \
    -target="module.database.aws_db_instance.main"
else
  echo "No module.database.aws_db_instance.main in state; skipping RDS deletion-protection step."
fi

echo "Destroying all legacy resources."
terraform -chdir="${LEGACY_DIR}" destroy -auto-approve -var-file="${TFVARS_FILE}" \
  -var="enable_services=false" \
  -var="db_deletion_protection=false" \
  -var="db_skip_final_snapshot=true"

echo "Legacy production stack destroyed."

