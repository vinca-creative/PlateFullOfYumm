#!/usr/bin/env bash
set -euo pipefail
if [ -z "$PFOY_PAGES_PROJECT_NAME" ]; then
  echo "::error::Pages deployment requires repository variable PFOY_PAGES_PROJECT_NAME."
  exit 1
fi
