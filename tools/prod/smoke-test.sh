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

echo "Checking API health."
curl -fsSL "https://${API_DOMAIN}/health" >/dev/null
echo "Checking API readiness."
curl -fsSL "https://${API_DOMAIN}/ready" >/dev/null
echo "Checking web root."
curl -fsSL "https://${WEB_DOMAIN}/" >/dev/null

