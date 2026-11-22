---
phase: 12-consent-analytics-legal
plan: 06
subsystem: api
tags: [privacy, legal, public-api, rate-limit, openapi, public-resource]
created: "2026-11-16T20:45:00-06:00"
updated: "2026-11-16T20:45:00-06:00"
status: complete

requires:
  - phase: 11-public-content
    provides: PublicSiteController, ISiteSettingsReader cache, PublicRouteTable, createPublicResource
provides:
  - GET /api/v1/public/privacy-contact (anonymous, no-store, public-read rate limit) answering { email }
  - privacyContactService and usePrivacyContact for plan 12-07's LegalFacts
  - Backstop test proving no page shell or the site facts carry the stored email
affects: [12-07 LegalFacts, 12-05 legal pages]

actuals:
  tokens: 6850
  tasks: 2
  commits: 4
plan_head_before: e72dfe711eb4862e77b6fb20bb78ba7afaaa5f24
plan_head_after: f925a770ca407ad82943c63c398d0e8cc8fb03d1

tech-stack:
  added: []
  patterns:
    - "Sensitive public value gets its own small read, never a field of the site JSON that is embedded as boot data"
    - "Public resource with no boot key and a dynamic import of its service (PERF-01)"

key-files:
  created:
    - src/Csps.Application/Content/PrivacyContactDto.cs
    - src/Csps.Application/Content/GetPrivacyContactHandler.cs
    - tests/Csps.Application.UnitTests/Content/GetPrivacyContactHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PrivacyContactEndpointTests.cs
    - web/src/modules/public/services/privacyContactService.ts
    - web/src/modules/public/services/privacyContactService.test.ts
    - web/src/modules/public/hooks/usePrivacyContact.ts
    - web/src/modules/public/hooks/usePrivacyContact.test.tsx
  modified:
    - src/Csps.Server/Controllers/PublicSiteController.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "Followed D-13 and D-29 as written: the email is a separate read, no boot key, never in PublicSiteDto or JSON-LD"
  - "An empty or whitespace stored email is returned as null"

requirements-completed: [LEGAL-01, LEGAL-04]

coverage:
  - id: D1
    description: "GET /api/v1/public/privacy-contact returns the stored Contact email, or null, and follows a settings save on the next read"
    requirement: LEGAL-01
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Content/GetPrivacyContactHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PrivacyContactEndpointTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The endpoint is in the authorization matrix (200 for anonymous, Admin, Manager) and the anonymous allow-list, and in the OpenAPI snapshot and generated types"
    requirement: LEGAL-04
    verification:
      - kind: integration
        ref: "AuthorizationMatrixTests, AuthorizationCoverageTests, OpenApiSnapshotTests (575 passed)"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D3
    description: "No page shell (every PublicRouteTable.PagePaths path and a 404) and not GET /public/site holds the stored email"
    requirement: LEGAL-04
    verification:
      - kind: integration
        ref: "PrivacyContactEndpointTests.NoPublicPageShellAndNotTheSiteFactsHoldTheStoredEmail"
        status: pass
    human_judgment: false
  - id: D4
    description: "Web service and public resource load the email lazily through a dynamic import"
    verification:
      - kind: unit
        ref: "web/src/modules/public/services/privacyContactService.test.ts, web/src/modules/public/hooks/usePrivacyContact.test.tsx (8 passed)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-16
---

# Phase 12 Plan 06: Privacy Contact Read Summary

*Created: 2026-11-16T20:45:00-06:00 · Updated: 2026-11-16T20:45:00-06:00*

A small anonymous read, `GET /api/v1/public/privacy-contact`, returns the shop's Contact email for the legal pages only. The email stays out of the site JSON, every page shell, the boot data and JSON-LD.

## What was built

- **Server:** `PrivacyContactDto(string? Email)` and `GetPrivacyContactHandler` read the cached `ISiteSettingsReader` (so a Manager's save shows on the next read) and map an empty value to null. A thin `GetPrivacyContact` action sits on `PublicSiteController` (class keeps `[AllowAnonymous]` and the public-read rate limit) with `[ResponseCache(NoStore = true)]`. The handler is registered beside the other content handlers.
- **Contract:** matrix row (200, 200, 200), anonymous allow-list entry, OpenAPI snapshot rewritten, web types regenerated.
- **Web:** `privacyContactService` (OR-5, `client.get('/public/privacy-contact')`) and `usePrivacyContact`, a `createPublicResource` with no boot key, a dynamic import of the service and a five-minute stale time (PERF-01).
- **Backstop:** with the demo email stored, no shell of any path in `PublicRouteTable.PagePaths` plus `/no-such-page`, and not `GET /api/v1/public/site`, contains `shop-private@example.test`. The page list is read at run time, so legal pages added by plan 12-05 are covered.

## TDD record

- **RED 1** (`03da4a1c`): unit run total 5, failed 3 (for example `result.Value.Email should be "shop-private@example.test" but was null`); integration run: 3 endpoint tests and 5 matrix tests failed (no route yet). Semantic assessment: the target tests ran and failed on the planned assertions, not on build or fixture faults (a stub handler returned a null email so the code compiled). The dotnet MTP console output is not one of the formats the `tdd-red-evidence` classifier reads, so this was assessed by hand.
- **GREEN 1** (`2b1b2714`): unit total 5 passed; integration (endpoint, matrix, coverage, OpenAPI snapshot) total 575, failed 0, no warnings in the output.
- **RED 2** (`65832063`): vitest 8 tests, 4 failed on assertions (`expected { email: null } to deeply equal { email: 'shop-private@example.test' }`, `expected 'success' to be 'error'`). The email backstop passes on arrival by design (it guards against future leaks). Stub service and hook made the tests compile.
- **GREEN 2** (`f925a770`): vitest 2 files, 8 tests passed; `npm --prefix web run lint` (`--max-warnings 0`) clean; `no-long-dash` and `source-layout` node tests pass; integration filters (`PrivacyContactEndpointTests`, `PublicSiteEndpointTests`, `PublicPrivacyTests`) total 20, failed 0; `npm --prefix tools/openapi-gen run check` reports types match.

Tracer gate (Task 1): interactive mode with `human_verify_mode: end-of-phase` and an automated-only `<verify>`; the three verify commands were re-run after the GREEN commit and passed, so the plan continued to Task 2.

## Deviations from Plan

None in code. One environment step: the worktree had no `node_modules`, so `npm ci` was run in `tools/openapi-gen` and `web` from the existing lockfiles. No package was added or bumped and both lockfiles are unchanged.

Acceptance note: `grep -c "\"/api/v1/public/privacy-contact\"" AuthorizationMatrix.cs` counts lines and gives 1 (the row holds the path twice on one line; the allow-list key is `"GET /api/v1/public/privacy-contact"`). Both entries exist; the intent is met.

## Auth gates

None.

## Known Stubs

None. The RED-phase stubs were replaced in the GREEN commits.

## Threat Flags

None beyond the plan's threat model (T-12-13 mitigated by the separate read and the backstop; T-12-14 by the public-read rate limit and the in-process cache; T-12-15 accepted per D-29; T-12-SC no packages changed).

## Self-Check: PASSED

- All 8 created files and 5 modified files present (committed in `03da4a1c`, `2b1b2714`, `65832063`, `f925a770`).
- `git rev-list --count e72dfe71..HEAD` was 4 before this summary commit.
- STATE.md and ROADMAP.md not touched (the orchestrator owns them).
