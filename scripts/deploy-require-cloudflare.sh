#!/usr/bin/env bash
set -euo pipefail
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "::error::${PFOY_CREDENTIAL_ERROR:-Cloudflare deployment credentials are required.}"
  exit 1
fi
