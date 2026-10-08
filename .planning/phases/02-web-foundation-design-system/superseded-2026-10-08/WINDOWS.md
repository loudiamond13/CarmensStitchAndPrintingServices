---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-10-08T03:35:56.221Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | stub | web/src/main.tsx | 15 | Tracer main.tsx renders only 'Site update in progress.'; plan 05 adds CSS, plan 14 replaces it with the router | open |  | 2026-10-08T03:35:56.221Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "02",
    "file": "web/src/main.tsx",
    "line": 15,
    "description": "Tracer main.tsx renders only 'Site update in progress.'; plan 05 adds CSS, plan 14 replaces it with the router",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-08T03:35:56.221Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
