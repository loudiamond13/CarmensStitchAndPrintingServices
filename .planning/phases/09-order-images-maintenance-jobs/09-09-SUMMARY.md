---
phase: 09-order-images-maintenance-jobs
plan: 09
subsystem: api
tags: [order-images, image-rules, testing-routes, openapi, docs]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-01 (upload endpoint, TestingImageStorage), 09-05 (size messages), 09-06, 09-07 (photo addresses in the order answer)
provides:
  - GetImageRulesHandler, ImageRulesResponse and GET /api/v1/orders/image-rules (OR-3 single server source)
  - TestingImagesController: GET /api/testing/images/{id} and POST /api/testing/images/fail-next (Debug Testing builds only)
  - docs/api/order-images.md (new), the images field in docs/api/orders.md, the two Testing routes in docs/web/e2e.md, order-image.added in docs/operations/audit-log.md
  - OpenAPI snapshot and generated web types carry ImageRulesResponse
affects: [09-10, 09-14, 09-16, 09-19, 09-27]

created: "2026-11-03T12:05:00-06:00"
updated: "2026-11-03T12:05:00-06:00"

actuals:
  tokens: 40000
  tasks: 3
  commits: 6

plan_head_before: fb71f950efa8e32b8238d7b4a528a2421804fd18
plan_head_after: 76d6eec4443b014efef8ad7e9d9b821e6f1cec64
commits: 6

tech-stack:
  added: []
  patterns:
    - "A Testing-only controller reads its small body by hand so a missing or bad body is one plain 400 for every caller (as TestingExpensesController)"
    - "Rules for the browser come from one handler over the domain constants and the configured settings, so the client cannot drift from the upload"

key-files:
  created:
    - src/Csps.Application/Orders/GetImageRulesHandler.cs
    - src/Csps.Application/Orders/ImageRulesResponse.cs
    - src/Csps.Server/Controllers/OrderImageRulesController.cs
    - src/Csps.Server/Controllers/TestingImagesController.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageRulesEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingImagesEndpointTests.cs
    - tests/Csps.Application.UnitTests/Orders/GetImageRulesHandlerTests.cs
    - docs/api/order-images.md
  modified:
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Server.IntegrationTests/Http/OpenApiOrderWriteContractTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md
    - docs/web/e2e.md
    - docs/operations/audit-log.md

key-decisions:
  - "The rules endpoint names the types jpeg, png, webp and heic (the plan's wording), taken from the ImageKind names; the stored Format column still says jpg"
  - "fail-next takes a count from 0 to 50 (0 clears the switch); anything else, a missing body or bad JSON is a 400. The plan gave no upper bound; 50 is a test-only guard"
  - "The Testing GET returns the original file for every size, as the plan says the size query is ignored"
  - "fail-next uses the store's generic failed outcome, so the upload answers 503 images.storage-failed; there is no separate transient outcome in the port"

patterns-established:
  - "A new anonymous Testing route needs three test-side entries: a matrix row, a TestingAnonymousKeys key and (for a POST) an IdempotencyAllowList entry"

requirements-completed: []
requirements-advanced: [ORD-04, IMG-01, IMG-02]

coverage:
  - id: D1
    description: "Signed-in staff read the server's photo rules (5 photos, 10485760 bytes, 25000000 pixels, 10000 side, jpeg/png/webp/heic, 200 characters); anonymous gets 401"
    requirement: "IMG-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageRulesEndpointTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/GetImageRulesHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Testing store serves an uploaded photo with its stored content type, answers 404 for an unknown id, and fail-next makes the next upload 503 and the one after succeed"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingImagesEndpointTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Release build holds no Testing image route or type"
    requirement: "IMG-01"
    verification:
      - kind: other
        ref: "tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs (Release build proof, whole project 263 of 263)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The upload declares 422 and its summary names orders.locked; the OpenAPI snapshot and generated types carry ImageRulesResponse"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiOrderWriteContractTests.cs, OpenApiSnapshotTests.cs"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D5
    description: "The upload contract, the rules endpoint, the images field and the two Testing routes are written down"
    requirement: "ORD-04"
    verification:
      - kind: other
        ref: "docs/api/order-images.md, docs/api/orders.md, docs/web/e2e.md (grep acceptance checks)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 09: The browser reads the photo rules, e2e gets fake photo routes, and the upload contract is written down Summary

**Staff can read the server's own photo limits at `GET /api/v1/orders/image-rules`, tests and Playwright can load fake photos and make the next uploads fail through two Debug-only Testing routes (no Cloudinary), and the upload contract is documented and pinned.**

## Accomplishments

- `GetImageRulesHandler` builds `ImageRulesResponse` from `OrderImageRules` and the configured `ImageUploadSettings`, so a lowered `Images:MaxBytes` shows up for the browser too. `OrderImageRulesController` is Staff-only and never cached.
- `TestingImagesController` (inside `#if CSPS_TESTING`, `[TestingOnly]`, `[AllowAnonymous]`) serves `TestingImageStorage` bytes at `GET /api/testing/images/{id}` and arms `FailNext` at `POST /api/testing/images/fail-next`. The photo addresses that plan 09-07 builds in the Testing environment now load.
- `docs/api/order-images.md` documents the form parts, the limits, every status and message, the `Idempotency-Key` (which answers are kept), the 5-photo rule, the audit entry and the rules endpoint. `docs/api/orders.md` documents the `images` field with its `thumb`, `viewer` and `fullSize` addresses. `docs/web/e2e.md` documents the two Testing routes.

## Task Commits

1. **Task 1 (tracer): rules endpoint.** `db8611e2` (test, RED) then `ddac04e3` (feat, GREEN)
2. **Task 2: Testing image routes.** `b0d49c5c` (test, RED) then `4ea10b69` (feat, GREEN)
3. **Task 3: contract pin and docs.** `1adc3f85` (test) and `76d6eec4` (docs)

## TDD Gate Compliance

- **Task 1 RED (`db8611e2`):** the endpoint tests and the matrix row ran against no controller: `OrderImageRulesEndpointTests` and `AuthorizationMatrixTests` ended `total: 356, failed: 8, succeeded: 348`. The failures were 404 where 200 was expected (for example `Manager calling GET /api/v1/orders/image-rules ... should be 200 but was 404`). The anonymous 401 test passed in RED because the default-deny fallback already answers 401 for an unknown route; it stays as a guard.
- **Task 1 GREEN (`ddac04e3`):** `OrderImageRulesEndpointTests`, `AuthorizationMatrixTests`, `OpenApiSnapshotTests` and `AuthorizationCoverageTests` ended `total: 379, failed: 0`. The tracer gate (auto mode off, `human_verify_mode` end-of-phase, automated-only verify): the verify commands were re-run end to end and passed before Task 2 started.
- **Task 2 RED (`b0d49c5c`):** `total: 378, failed: 12, succeeded: 366`. The failures include `FailNextWithCountOneMakesTheNextUploadAnswer503...` and the four count cases (404 where 204 or 400 was expected), `AnUploadedPhotoComesBackFromTheItsOwnAddress...`, the three `POST /api/testing/images/fail-next` matrix cases, `DiscoveredEndpointsAreFullyCovered`, `ParallelCallersEachGetTheirOwnStatus` and `EveryDiscoveredPostIsCoveredOrExemptWithAWrittenReason`. `AnUnknownIdAnswers404` and the GET matrix rows passed in RED because the `/api` fallback already answers 404; they stay as guards.
- **Task 2 GREEN (`4ea10b69`):** `total: 391, failed: 0` (Testing images, matrix, idempotency and authorization coverage).
- **Task 3:** the LockedWrites row passed at once (`OpenApiOrderWriteContractTests` `total: 22, failed: 0`) because plan 09-01 already declares the 422 and names `orders.locked` in the summary. It is a pin of existing behavior, so there is no RED for it (commit `1adc3f85`). The docs have no test.
- **REFACTOR:** none.

## Checks I saw (`CSPS_TEST_SQL=localdb`, preflight run first: ports free, no other dev processes)

| Check | Result |
|---|---|
| `dotnet test --project tests/Csps.Server.IntegrationTests` (whole project, after the last code change) | `total: 1912  failed: 2  succeeded: 1910`; the two failures are `OrderListTimingTests` and `ExpenseListTimingTests` (known timing flakes) |
| `*OrderListTimingTests` re-run alone | `total: 1  failed: 0  succeeded: 1` |
| `*ExpenseListTimingTests` re-run alone | `total: 1  failed: 0  succeeded: 1` (it passed alone this time; it failed alone in earlier plans, see deferred-items.md) |
| `*OpenApiOrderWriteContractTests` | `total: 22  failed: 0` |
| `*TestingImagesEndpointTests`, `*TestingEmailsEndpointTests`, `*TestingConfigurationTests` | `total: 15  failed: 0` |
| `tests/Csps.Application.UnitTests` (whole project) | `total: 1983  failed: 0  succeeded: 1983` |
| `tests/Csps.ArchitectureTests` (whole project, includes the Release build proof `ReleaseHasNoEmailSinkTests`) | `total: 263  failed: 0  succeeded: 263` |
| `npm --prefix tools/openapi-gen run check` | `Generated API types match tools/openapi-gen/openapi.v1.json.` |
| `npm --prefix web run typecheck` | exit 0, no output |
| `dotnet build Csps.slnx` | `0 Warning(s)  0 Error(s)` |
| `dotnet format Csps.slnx --verify-no-changes` | exit 0, no output (after one import-order fix in the new test file) |
| `gitleaks protect --staged --no-banner` (each of 6 commits) | `no leaks found` |

Acceptance greps: `image-rules` in the matrix, `ImageRulesResponse` in `api.generated.ts`, `CSPS_TESTING` in `TestingImagesController.cs`, `Idempotency-Key` in `order-images.md`, `fullSize` in `orders.md` all present. `docs/web/e2e.md` keeps its created value and has a new updated value. `docs/api/order-images.md` opens with a title and the `*Created: ... · Updated: ...*` line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Application unit tests for the new handler**
- **Issue:** the plan has only endpoint tests; the Application project must keep at least 95 percent coverage and the no-caller branch is not reachable through the endpoint.
- **Fix:** `GetImageRulesHandlerTests` (rules from the domain and a lowered configuration; no caller ends the session).
- **Commit:** `ddac04e3`

**2. [Rule 3 - Blocking] The idempotency allow-list needed an entry**
- **Found during:** Task 2 RED
- **Issue:** `IdempotencyCoverageTests.EveryDiscoveredPostIsCoveredOrExemptWithAWrittenReason` fails for any POST route without an `Idempotency-Key` check or a written exemption. `IdempotencyAllowList.cs` was not in the plan's file list.
- **Fix:** `POST /api/testing/images/fail-next` has `[IdempotencyExempt("Testing-only test switch, compiled out of Release.")]` and a matching allow-list entry, as the other Testing POSTs.
- **Files modified:** `src/Csps.Server/Controllers/TestingImagesController.cs`, `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs`
- **Commit:** `b0d49c5c`, `4ea10b69`

**3. [Rule 3 - Blocking] Matrix anonymous allow-list**
- **Issue:** the anonymous allow-list in `AuthorizationMatrix.cs` has to name the two new anonymous Testing routes, or the coverage test fails.
- **Fix:** `TestingAnonymousKeys` lists `GET /api/testing/images/{id}` and `POST /api/testing/images/fail-next`.
- **Commit:** `b0d49c5c`

**4. [Rule 2 - Missing critical] Audit guide entry**
- **Issue:** plan 09-01 deferred the `order-image.added` entries in `docs/api/orders.md` and `docs/operations/audit-log.md` to this plan, but `audit-log.md` is not in this plan's file list.
- **Fix:** one row in the audit-log table and one sentence in the orders audit section.
- **Files modified:** `docs/operations/audit-log.md`, `docs/api/orders.md`
- **Commit:** `76d6eec4`

**5. Task 3 had no RED.** See TDD Gate Compliance: the contract already held, so the new LockedWrites row is a pin.

### Auth gates

None.

## Decisions Made

- The four listed under `key-decisions`. None changes product behavior or wording the owner sees; they are inside the test-only seam.

## Known Stubs

None. The Testing routes are real code, compiled only into Debug builds.

## Threat Flags

None beyond the plan's register. T-09-36 (Testing routes reachable in production): the controller sits in `#if CSPS_TESTING`, carries `[TestingOnly]`, and `ReleaseHasNoEmailSinkTests` (a real Release build, type-name and `api/testing` string scan) passed with the new controller present (`total: 263, failed: 0`). T-09-79 (rules endpoint read anonymously): Staff policy plus a matrix row; anonymous gets 401. T-09-SC: no package added or bumped.

## Deferred Issues

- A real upload over 1 MiB still answers 413 until plan 09-14 raises the limit for this route. The new `order-images.md` says so in a note, so the document stays true until then.
- `OrderListTimingTests` and `ExpenseListTimingTests` failed in the full run under load and passed alone. Already in `deferred-items.md`.

## Owner items

Nothing new is parked. In the STATE.md Phase 9 backlog, the 09-07 item (2) (no route behind the Testing photo addresses) is marked resolved by this plan.

## Self-Check: PASSED

- Files: `GetImageRulesHandler.cs`, `ImageRulesResponse.cs`, `OrderImageRulesController.cs`, `TestingImagesController.cs`, the three test files and `docs/api/order-images.md` exist on disk.
- Commits: `db8611e2`, `ddac04e3`, `b0d49c5c`, `4ea10b69`, `1adc3f85` and `76d6eec4` are ancestors of HEAD.
