#!/usr/bin/env bash
set -euo pipefail
project_url="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PFOY_PAGES_PROJECT_NAME"
project=$(curl --fail --silent --show-error --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$project_url")
if [ "$(jq -r '.success' <<<"$project")" != "true" ] || ! jq -e --arg sha "$PFOY_RELEASE_SHA" '.result.canonical_deployment.deployment_trigger.metadata.commit_hash == $sha and .result.canonical_deployment.deployment_trigger.metadata.branch == "main"' <<<"$project" >/dev/null; then
  echo "::error::Pages production deployment does not match the current release commit."
  exit 1
fi
