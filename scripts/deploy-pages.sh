#!/usr/bin/env bash
set -euo pipefail
echo "PFOY_DEPLOYMENT_STATE=upload_attempted" >> "$GITHUB_ENV"
npx --yes wrangler@4.129.0 pages deploy build --project-name "$PFOY_PAGES_PROJECT_NAME" --branch main --commit-hash "$PFOY_RELEASE_SHA" --commit-dirty=false
echo "PFOY_DEPLOYMENT_STATE=upload_completed" >> "$GITHUB_ENV"
