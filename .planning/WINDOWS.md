---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-10-16T12:57:26.932Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unmet-truth | web/scripts/lighthouse.mjs |  | Lighthouse LCP 2185-2261 ms on the public route (limit 2000 ms); measured 2267 ms before plan 03-09; see .planning/phases/03-ci-cd-staging-deploy/deferred-items.md | open |  | 2026-10-16T12:57:26.932Z |  |

````json
[
  {
    "id": 1,
    "kind": "unmet-truth",
    "phase": "03",
    "file": "web/scripts/lighthouse.mjs",
    "line": null,
    "description": "Lighthouse LCP 2185-2261 ms on the public route (limit 2000 ms); measured 2267 ms before plan 03-09; see .planning/phases/03-ci-cd-staging-deploy/deferred-items.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-16T12:57:26.932Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
