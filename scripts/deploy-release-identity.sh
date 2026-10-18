#!/usr/bin/env bash
set -euo pipefail
printf 'release_sha=%s\n' "$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
