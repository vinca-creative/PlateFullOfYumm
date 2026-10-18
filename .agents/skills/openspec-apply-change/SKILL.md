---
name: openspec-apply-change
description: Implement an approved OpenSpec change by following its task checklist, project context, and verification requirements. Use when the user asks to apply or implement a change.
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
---

Implement an approved OpenSpec change. This workflow authorizes code and configuration changes within the selected change; it does not authorize production deployment, account changes, or live content writes.

## Steps

1. Resolve the change name from the user request. If unclear, inspect `openspec list --json` and the active change rather than guessing.
2. Run `openspec status --change "<name>" --json` and `openspec instructions apply --change "<name>" --json`. Treat the returned change root, context files, task status, and instructions as authoritative.
3. Read every file listed in `contextFiles`, including proposal, design, capability specs, and tasks. Follow repository guidance and reuse established code patterns.
4. Implement pending tasks in order. Keep changes scoped to the specification. Before editing, inspect the relevant implementation, tests, and configuration. Preserve fail-closed behavior when credentials, source data, or authorization are absent.
5. Verify the changed behavior with the narrowest relevant command or runtime scenario. Do not claim live integration, staging, deployment, or production acceptance without exercising it on an authorized environment.
6. Update the exact task checkbox only after implementation and its acceptance checks are verified. Leave externally blocked or unverified tasks unchecked and document the missing prerequisite.
7. Rerun `openspec instructions apply --change "<name>" --json` after task updates and continue until all reachable tasks are complete or their specific external blockers are recorded. Do not archive an unfinished change.

Never submit production comments, change live WordPress content, configure paid services, or deploy production unless the user explicitly authorizes that action.
