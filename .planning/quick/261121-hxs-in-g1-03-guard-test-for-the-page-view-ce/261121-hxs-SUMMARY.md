---
created: 2026-11-21T13:11:03-06:00
updated: 2026-11-21T13:11:03-06:00
phase: quick-261121-hxs
plan: 01
subsystem: server rate limiting (analytics page view ceiling)
tags: [rate-limiting, analytics, guard-test, D-138, IN-G1-03]
status: complete
requires: []
provides:
  - "RateLimitingRegistration.PageViewEndpointName (public const, value RecordPageView)"
  - "PageViewCeilingRouteTests guard test"
affects:
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - src/Csps.Server/Controllers/AnalyticsController.cs
tech-stack:
  added: []
  patterns: ["shared public const for an endpoint name read by both the route and a limiter"]
key-files:
  created:
    - tests/Csps.Server.IntegrationTests/RateLimiting/PageViewCeilingRouteTests.cs
  modified:
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - src/Csps.Server/Controllers/AnalyticsController.cs
    - .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-REVIEW-DISPOSITION.md
    - .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md
decisions:
  - "The endpoint name constant is public, not internal: Csps.Server has no InternalsVisibleTo and RateLimitedCode is the public precedent on the same class (planner's discretion, as written in the plan)."
requirements: [ANL-06]
metrics:
  duration: "about 12 minutes"
  completed: 2026-11-21
actuals:
  tokens: 2500
  tasks: 2
  commits: 2
plan_head_before: 006a5fc6d417f01057ce1daafb3abe984571079a
plan_head_after: ffd4171eb4d755b1c55e40652c76a8cdb1cc3401
---

# Quick 261121-hxs: IN-G1-03 guard test for the page view ceiling Summary

The site-wide page view ceiling and the page view action now read their endpoint name from one public constant, `RateLimitingRegistration.PageViewEndpointName` (value still `RecordPageView`), and `PageViewCeilingRouteTests.ExactlyOneEndpointCarriesTheCeilingNameAndItIsThePageViewPost` fails unless exactly one endpoint, POST `api/v1/analytics/page-views`, carries that name (D-138).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `65c18d2b` | fix(261121-hxs): the page view ceiling and its route share one endpoint name, with a guard test (D-138) |
| 2 | `ffd4171e` | docs(261121-hxs): record IN-G1-03 as fixed and close auditor note 4 (D-138) |

## Evidence

**RED** (`dotnet build tests/Csps.Server.IntegrationTests`, exit 1):

```
PageViewCeilingRouteTests.cs(20,42): error CS0117: 'RateLimitingRegistration' does not contain a definition for 'PageViewEndpointName'
Build FAILED.
```

(Two follow-on CS1061 errors on the same file came from the failed type inference.)

**GREEN**, new class: `total: 1, failed: 0, succeeded: 1`, exit 0.

**Mutation check** (controller set to `[EndpointName("RecordPageViewRenamed")]`, reverted, not committed), exit 2:

```
Shouldly.ShouldAssertException : named
    should have single item but had
0
    items and was
[]
Additional Info:
    The site-wide page view ceiling keys on this endpoint name, so exactly one endpoint must carry it.
```

After revert, `git diff` on the controller showed only the one-line `[EndpointName(RateLimitingRegistration.PageViewEndpointName)]` change.

**Gates** (preflight before the integration runs: ports 5180, 5115, 7028, 5199 free, no dev or test processes):

| Gate | Result |
|------|--------|
| `*PageViewCeilingRouteTests` (localdb) | total 1, succeeded 1, exit 0 |
| `*AnalyticsRateLimitTests` (localdb) | total 12, succeeded 12, exit 0 |
| `*OpenApiSnapshotTests` (localdb) | total 11, succeeded 11, exit 0 |
| `tests/Csps.ArchitectureTests` | total 290, succeeded 290, exit 0 |
| `dotnet build Csps.slnx -warnaserror` | Build succeeded, 0 Warning(s), 0 Error(s), exit 0 |
| `dotnet format Csps.slnx --verify-no-changes --no-restore` | no output, exit 0 |
| `"RecordPageView"` literal in `src/Csps.Server` | 1 line (RateLimitingRegistration.cs:20), baseline 2 |
| `public const string PageViewEndpointName` | 1, baseline 0 |
| `EndpointName(RateLimitingRegistration.PageViewEndpointName)` in controller | 1, baseline 0 |
| `git status --porcelain -- tools/openapi-gen web/src/types` | empty |
| Disposition rows / counts | fixed 9, owner 4, deferred 7 rows; `counts: { fixed: 9, owner: 4, deferred: 7, total: 20 }` |
| SECURITY note 4 | `closed by D-138` 1, `Open review item IN-G1-03` 0; both `created:` values unchanged |
| gitleaks on each staged change | no leaks found (both commits); manual scan found no names, emails, servers or local paths |

## Deviations from Plan

1. **RED error code.** The plan expected CS0122 (inaccessible). The compiler reported CS0117 (no definition), because private members of a referenced assembly are not imported into the test compilation. The red is the same fact: the test cannot compile against the private constant.
2. **Branch.** The plan says stay on `gsd/phase-12-consent-analytics-legal`; this run was dispatched into the isolated worktree branch `worktree-agent-a7db029c06e7f1f1d`, so both commits are there. The orchestrator merges them.
3. **SUMMARY commit.** The plan says the orchestrator commits the SUMMARY; the orchestrator's dispatch asked this executor to commit it, so it is committed here. STATE.md and ROADMAP.md were not touched.

No other change: the constant's value, `IsPageView`, the limiter chain and all limits are unchanged. No package, SQL, migration or trigger.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: tests/Csps.Server.IntegrationTests/RateLimiting/PageViewCeilingRouteTests.cs
- FOUND: 65c18d2b (ancestor of HEAD)
- FOUND: ffd4171e (ancestor of HEAD)
