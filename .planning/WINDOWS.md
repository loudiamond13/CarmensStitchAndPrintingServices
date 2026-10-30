---
schema_version: 1
open_count: 0
waived_count: 1
fixed_count: 3
total_count: 4
last_updated: 2026-10-30T05:31:15.926Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unmet-truth | web/scripts/lighthouse.mjs |  | Lighthouse LCP 2187 ms median on the public route (limit 2000 ms) after quick task 261016 moved TanStack Query out of the public entry (was 2189 ms); fonts, not JavaScript, are the main cost; see .planning/phases/03-ci-cd-staging-deploy/deferred-items.md | waived | Owner, 2026-10-16: keep the current fonts and look for now and move on; the public LCP of about 2.19 s (limit 2.0 s) is accepted until the Phase 11 public pages revisit fonts (options in 03 deferred-items.md). The limit itself is unchanged. | 2026-10-16T12:57:26.932Z | 2026-10-16T15:45:12.233Z |
| 2 | 03 | unmet-truth | .planning/HOSTING-RECORD.md |  | __Secure-csps_2fa cookie on the live HTTPS host not observed by the owner (exists only during the code step); attributes pinned by AuthRegistrationTests and SignInEndpointTests; Unverified until the owner signs off or checks it in dev tools during a code step | fixed |  | 2026-10-17T14:30:35.495Z | 2026-10-17T14:42:20.134Z |
| 3 | 05 | deviation | web/scripts/owner-review.mjs |  | Still lists /admin/profile as an unsigned dev preview; plan 05-13 made it a real guarded page. Deferred to 05-37. | fixed |  | 2026-10-18T04:59:55.135Z | 2026-10-18T21:39:08.059Z |
| 4 | 08 | stub | web/src/modules/admin/pages/OrderPage.tsx |  | Payments, Discounts and Expenses tab panels draw nothing yet; plan 08-12 fills them | fixed |  | 2026-10-30T04:23:49.842Z | 2026-10-30T05:31:15.926Z |

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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-17T14:30:35.495Z",
    "resolved_at": "2026-10-17T14:42:20.134Z",
    "milestone": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "05",
    "file": "web/scripts/owner-review.mjs",
    "line": null,
    "description": "Still lists /admin/profile as an unsigned dev preview; plan 05-13 made it a real guarded page. Deferred to 05-37.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-18T04:59:55.135Z",
    "resolved_at": "2026-10-18T21:39:08.059Z",
    "milestone": null
  },
  {
    "id": 4,
    "kind": "stub",
    "phase": "08",
    "file": "web/src/modules/admin/pages/OrderPage.tsx",
    "line": null,
    "description": "Payments, Discounts and Expenses tab panels draw nothing yet; plan 08-12 fills them",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-30T04:23:49.842Z",
    "resolved_at": "2026-10-30T05:31:15.926Z",
    "milestone": null
  }
]
````
## Notes

- Entry 1, 2026-10-16: in CI and in `npm --prefix web run lighthouse`, LCP is report-only (`REPORT_ONLY_METRICS` in `web/scripts/lighthouse-assert.mjs`) until Phase 11. The 2000 ms limit is unchanged and every other Lighthouse assertion still fails the build. Remove the waiver in Phase 11 (reminder in ROADMAP Phase 11, "Owner decisions to close at discuss step").
