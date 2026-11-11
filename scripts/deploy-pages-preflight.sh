#!/usr/bin/env bash
set -euo pipefail
if [[ ! "$PFOY_PAGES_PROJECT_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "::error::Pages project name must contain only lowercase letters, digits and hyphens."
  exit 1
fi
project_url="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PFOY_PAGES_PROJECT_NAME"
project=$(curl --fail --silent --show-error --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$project_url")
if [ "$(jq -r '.success' <<<"$project")" != "true" ] || [ "$(jq -r '.result.production_branch' <<<"$project")" != "main" ]; then
  echo "::error::Pages project must exist and have production branch main before deployment."
  exit 1
fi
origin_host=$(node -e 'process.stdout.write(new URL(process.env.PFOY_PUBLIC_SITE_ORIGIN).host)')
project_subdomain=$(jq -r '.result.subdomain' <<<"$project")
if [ "$origin_host" = "$project_subdomain" ]; then
  exit 0
fi
domains=$(curl --fail --silent --show-error --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$project_url/domains")
if [ "$(jq -r '.success' <<<"$domains")" != "true" ] || ! jq -e --arg host "$origin_host" '[.result[]? | select(.name == $host and .status == "active")] | length == 1' <<<"$domains" >/dev/null; then
  echo "::error::The configured public origin must be the selected Pages project's pages.dev host or an active custom domain."
  exit 1
fi
