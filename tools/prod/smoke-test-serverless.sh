#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TFVARS_FILE="${ROOT_DIR}/infra/terraform/envs/prod/terraform.tfvars"

if [[ ! -f "${TFVARS_FILE}" ]]; then
  echo "Missing ${TFVARS_FILE}" >&2
  exit 1
fi

WEB_DOMAIN="$(python3 - <<'PY'
import re
from pathlib import Path
content = Path("infra/terraform/envs/prod/terraform.tfvars").read_text(encoding="utf-8")
m = re.search(r'^\s*web_domain\s*=\s*\"([^\"]+)\"\s*$', content, re.M)
print(m.group(1) if m else "investments.badgers.nl")
PY
)"

API_DOMAIN="$(python3 - <<'PY'
import re
from pathlib import Path
content = Path("infra/terraform/envs/prod/terraform.tfvars").read_text(encoding="utf-8")
m = re.search(r'^\s*api_domain\s*=\s*\"([^\"]+)\"\s*$', content, re.M)
print(m.group(1) if m else "api.investments.badgers.nl")
PY
)"

function wait_for_http_200() {
  local url="$1"
  local label="$2"
  local max_attempts="${3:-30}"
  local sleep_seconds="${4:-5}"
  local attempt=1
  while [[ "${attempt}" -le "${max_attempts}" ]]; do
    if curl -fsSL --max-time 10 "${url}" >/dev/null; then
      echo "${label} OK: ${url}"
      return 0
    fi
    echo "${label} not ready yet (attempt ${attempt}/${max_attempts}): ${url}"
    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done
  echo "${label} FAILED after ${max_attempts} attempts: ${url}" >&2
  return 1
}

echo "Checking API root."
wait_for_http_200 "https://${API_DOMAIN}/" "API root"
echo "Checking web root."
wait_for_http_200 "https://${WEB_DOMAIN}/" "Web root"

