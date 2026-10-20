---
phase: 05-profile-user-management
plan: 52
subsystem: security
tags: [gap-closure, wr-09, sec-03, rate-limiting, tdd, tracer]
created: "2026-10-19T04:05:00-05:00"
updated: "2026-10-19T04:05:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-REVIEW.md warning WR-09; the Reset rate-limit policy on POST /api/v1/profile/password"
provides:
  - "POST /api/v1/profile/password is in the RateLimitTests list: ten calls pass, the eleventh gets 429 rate-limited with a whole-second Retry-After"
  - "EveryRateLimitedEndpointIsInTheList: a discovery guard that fails when a rate-limited endpoint has no list row or a row matches no endpoint"
  - "docs/api/auth.md auth-reset row names the profile password change and the set-new check"
affects: [Phase 5 verification, future rate-limited endpoints]

actuals:
  tokens: 2400
  tasks: 2
  commits: 3
plan_head_before: 1bf1f0783a754b2e23254fe054453492b742c4b9
plan_head_after: 08e9136027352ab379669c6286dffb876c6a6e6b

tech-stack:
  added: []
  patterns:
    - "Endpoint discovery guard: EndpointDataSource + AuthorizationCoverage.KeysOf, as the authorization-matrix test does"

key-files:
  created: []
  modified:
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - docs/api/auth.md

key-decisions:
  - "The guard matches a list row to a route pattern segment by segment, with each {parameter} standing for one path segment, so the DELETE sessions/{id} row matches without special cases"

requirements-completed: [PROF-03]

coverage:
  - id: D1
    description: "POST /api/v1/profile/password is limited to 10 per address; the eleventh call is 429 rate-limited with Retry-After of at least 1 second"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs#EveryAuthEndpointCarriesItsPolicy"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rate-limited endpoint missing from the test list, or a list row matching no endpoint, fails the build; discovery must find at least 20 endpoints"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs#EveryRateLimitedEndpointIsInTheList"
        status: pass
    human_judgment: false
  - id: D3
    description: "The API guide auth-reset row names the profile password change"
    requirement: "PROF-03"
    verification:
      - kind: command
        ref: "grep -c 'profile password change' docs/api/auth.md"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-19
---

# Phase 5 Plan 52: Rate-limit test for the profile password change Summary

**The per-address limit on the profile current-password check is now pinned by a test row, and a discovery guard fails whenever a rate-limited endpoint is missing from the list (WR-09).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-19T04:00-05:00
- **Completed:** 2026-10-19T04:05-05:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `EveryRateLimitedEndpointIsInTheList` reads `EndpointDataSource` from a `CspsApiFactory` host, keeps endpoints carrying `EnableRateLimitingAttribute`, and checks both directions against `LimitedEndpoints`. It also requires at least 20 discovered endpoints so an empty result cannot pass.
- The new row `{ "POST", "/api/v1/profile/password", 10 }` runs through `EveryAuthEndpointCarriesItsPolicy` against the real limits.
- The `auth-reset` row of `docs/api/auth.md` now lists "set-new check" and "profile password change"; the limit text is unchanged.

## Task Commits

1. **Task 1 (tracer): guard and row** - `eef4696` (test, RED) then `58dc12e` (test, GREEN)
2. **Task 2: API guide row** - `08e9136` (docs)

**Plan metadata:** the docs(05-52) completion commit that follows this file.

## TDD Gate Compliance

- RED (`eef4696`): `EveryRateLimitedEndpointIsInTheList` failed on the intended assertion: "rate-limited endpoints missing from LimitedEndpoints", with `["POST /api/v1/profile/password"]`. The build was clean; the guard found exactly the one missing endpoint.
- GREEN (`58dc12e`): after adding the row, `*RateLimitTests` passed 23 of 23 (20 theory rows, the guard and the two existing facts). No refactor commit was needed.
- Tracer gate: the Task 1 verify command was the GREEN run above; it passed end to end before Task 2.

## Files Created/Modified

- `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs` - the guard, `RowMatches` helper and the profile password row
- `docs/api/auth.md` - `auth-reset` row names the profile password change; `updated` bumped

## Decisions Made

- Row-to-pattern matching is per path segment with `{parameter}` as a wildcard for one segment, which keeps the guard independent of route constraints such as `{id:guid}`.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-05-126 is mitigated by the new row and the guard; no packages, csproj or lock files changed.

## Verification

- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*RateLimitTests"`: 23 passed, 0 failed, no build warnings.
- `grep -c "/api/v1/profile/password"` on the test file: 1. `grep -c EveryRateLimitedEndpointIsInTheList`: 1. `grep -c "profile password change" docs/api/auth.md`: 1.

## Next Phase Readiness

WR-09 is closed. No blockers.
