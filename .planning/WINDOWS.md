---
schema_version: 1
open_count: 1
waived_count: 1
fixed_count: 0
total_count: 2
last_updated: 2026-10-17T14:30:35.495Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unmet-truth | web/scripts/lighthouse.mjs |  | Lighthouse LCP 2187 ms median on the public route (limit 2000 ms) after quick task 261016 moved TanStack Query out of the public entry (was 2189 ms); fonts, not JavaScript, are the main cost; see .planning/phases/03-ci-cd-staging-deploy/deferred-items.md | waived | Owner, 2026-10-16: keep the current fonts and look for now and move on; the public LCP of about 2.19 s (limit 2.0 s) is accepted until the Phase 11 public pages revisit fonts (options in 03 deferred-items.md). The limit itself is unchanged. | 2026-10-16T12:57:26.932Z | 2026-10-16T15:45:12.233Z |
| 2 | 03 | unmet-truth | .planning/HOSTING-RECORD.md |  | __Secure-csps_2fa cookie on the live HTTPS host not observed by the owner (exists only during the code step); attributes pinned by AuthRegistrationTests and SignInEndpointTests; Unverified until the owner signs off or checks it in dev tools during a code step | open |  | 2026-10-17T14:30:35.495Z |  |

````json
[
  {
    "id": 1,
    "kind": "unmet-truth",
    "phase": "03",
    "file": "web/scripts/lighthouse.mjs",
    "line": null,
    "description": "Lighthouse LCP 2187 ms median on the public route (limit 2000 ms) after quick task 261016 moved TanStack Query out of the public entry (was 2189 ms); fonts, not JavaScript, are the main cost; see .planning/phases/03-ci-cd-staging-deploy/deferred-items.md",
    "status": "waived",
    "reason": "Owner, 2026-10-16: keep the current fonts and look for now and move on; the public LCP of about 2.19 s (limit 2.0 s) is accepted until the Phase 11 public pages revisit fonts (options in 03 deferred-items.md). The limit itself is unchanged.",
    "recorded_at": "2026-10-16T12:57:26.932Z",
    "resolved_at": "2026-10-16T15:45:12.233Z",
    "milestone": null
  },
  {
    "id": 2,
    "kind": "unmet-truth",
    "phase": "03",
    "file": ".planning/HOSTING-RECORD.md",
    "line": null,
    "description": "__Secure-csps_2fa cookie on the live HTTPS host not observed by the owner (exists only during the code step); attributes pinned by AuthRegistrationTests and SignInEndpointTests; Unverified until the owner signs off or checks it in dev tools during a code step",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-17T14:30:35.495Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
## Notes

- Entry 1, 2026-10-16: in CI and in `npm --prefix web run lighthouse`, LCP is report-only (`REPORT_ONLY_METRICS` in `web/scripts/lighthouse-assert.mjs`) until Phase 11. The 2000 ms limit is unchanged and every other Lighthouse assertion still fails the build. Remove the waiver in Phase 11 (reminder in ROADMAP Phase 11, "Owner decisions to close at discuss step").
