#!/usr/bin/env bash
set -euo pipefail
echo "PFOY_DEPLOYMENT_STATE=upload_attempted" >> "$GITHUB_ENV"
npx --yes wrangler@4.129.0 deploy --config wrangler.jsonc
echo "PFOY_DEPLOYMENT_STATE=upload_completed" >> "$GITHUB_ENV"
