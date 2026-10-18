#!/usr/bin/env bash
set -euo pipefail

failed() {
  [[ "${!1:-}" == failure ]]
}
not_succeeded() {
  [[ "${!1:-}" != success ]]
}

if failed CLOUDFLARE_OUTCOME || failed PAGES_CLOUDFLARE_OUTCOME || failed PAGES_PROJECT_OUTCOME || failed PAGES_BRANCH_OUTCOME; then
  printf 'configuration_missing\n'
elif not_succeeded SNAPSHOT_OUTCOME || not_succeeded BUILD_OUTCOME || failed HEADERS_OUTCOME; then
  printf 'build_failed\n'
elif failed PREDEPLOY_OUTCOME; then
  printf 'source_changed\n'
elif failed DEPLOY_OUTCOME || failed PAGES_DEPLOY_OUTCOME || failed PAGES_VERIFY_OUTCOME; then
  printf 'deploy_failed\n'
else
  printf 'smoke_failed\n'
fi
