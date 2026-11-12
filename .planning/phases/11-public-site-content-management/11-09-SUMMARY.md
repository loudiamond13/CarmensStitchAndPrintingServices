---
phase: 11-public-site-content-management
plan: 09
subsystem: api
tags: [aspnetcore, ef-core, fluentvalidation, audit, rowversion, openapi, allow-list-links]
created: 2026-11-12T00:10:00-06:00
updated: 2026-11-12T00:10:00-06:00

requires:
  - phase: 11-04
    provides: PhilippinePhone (phone rules and the approved phone message)
  - phase: 11-07
    provides: SiteSettings.UpdateBusinessInfo, SitePhoneNumber, the post-commit public cache interceptor, the public site read
provides:
  - "PUT /api/v1/site-settings: a Manager saves the business info, the next public read and page head show it"
  - "GET /api/v1/site-settings widened: every Business Info field, the email, the phones, the version and the last changer"
  - "SiteLinks: https plus exact-host allow-lists for the six public links, and a bracket-placeholder check"
  - "UpdateSiteSettingsRequestValidator with every UI-SPEC Business Info message"
  - "AuditActions.SiteSettingsChanged (catalog now 102)"
  - "tests/fixtures/site-link-cases.json: link accept and refuse cases for the .NET and web tests"
  - "docs/api/site-content.md"
affects: [11-12, 11-30, 11-37]

actuals:
  tokens: 40000
  tasks: 3
  commits: 6
plan_head_before: 484632ee6272ca302992a689efe702ad824a9099
plan_head_after: 32d43cbe3b409a643fc3cb40e42385bf96b85e00

tech-stack:
  added: []
  patterns:
    - "A staff form save: validate (400), version compare (409), domain update, one audit entry in the same save, no-change saves nothing"
    - "Audit detail names changed fields and copies only the name and links, left out when over 400 characters"
    - "A phone-only change touches the settings row so the version, the public ETag and the sitemap date move"
    - "Shared accept and refuse case file read by both stacks (the second one after the phone cases)"

key-files:
  created:
    - src/Csps.Domain/Content/SiteLinks.cs
    - src/Csps.Application/Ports/ISiteContentStore.cs
    - src/Csps.Application/Content/SiteContentErrors.cs
    - src/Csps.Application/Content/UpdateSiteSettingsRequest.cs
    - src/Csps.Application/Content/UpdateSiteSettingsRequestValidator.cs
    - src/Csps.Application/Content/UpdateSiteSettingsHandler.cs
    - src/Csps.Application/Content/SiteSettingsAuditDetail.cs
    - src/Csps.Infrastructure/Content/SiteContentStore.cs
    - tests/fixtures/site-link-cases.json
    - tests/Csps.Testing/SiteContentStores.cs
    - tests/Csps.Domain.UnitTests/Content/SiteLinksTests.cs
    - tests/Csps.Application.UnitTests/Content/UpdateSiteSettingsRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Content/UpdateSiteSettingsHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Content/SiteSettingsWriteTests.cs
    - docs/api/site-content.md
  modified:
    - src/Csps.Domain/Content/SiteSettings.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Content/SiteSettingsDto.cs
    - src/Csps.Application/Content/GetSiteSettingsHandler.cs
    - src/Csps.Infrastructure/Content/ContentRegistration.cs
    - src/Csps.Server/Controllers/SiteSettingsController.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "The staff GET reads the database through ISiteContentStore instead of the cached settings snapshot, because the form needs the version a save is checked against; the cached reader stays for the time zone"
  - "The DTO drops the old contactPhone, addressLine and rowVersion members (the columns stay, D-39) and adds version, phones and the last changer"
  - "The audit detail uses the existing fields= pair format and skips a name or link pair that would pass 400 characters"
  - "Square-bracket placeholders are refused in every text field with a provisional message the owner must approve (see Owner items)"

patterns-established:
  - "FixedSiteContentStore and ThrowingSiteContentStore (tests/Csps.Testing): host tests that need a signed-in GET /site-settings without a database"

requirements-completed: [CONT-01, PUB-02, PUB-03]

duration: about 1h 10m
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 09: A Manager saves the business info and the public site shows it at once Summary

**`PUT /api/v1/site-settings` (Manager only) saves every Business Info field and the phone list with a version check, the UI-SPEC messages, https host allow-lists for the six public links, server stamps and one audit entry, and the next public read and page head show the change with a new ETag.**

## Performance

- **Duration:** about 1h 10m
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 34 (15 created, 10 source and contract files modified, the rest tests and docs)

## Accomplishments

- A Manager saves the business name, tagline, about text, turnaround line, address parts, directions and map links, one to four phones with exactly one main, the Messenger, Facebook, Instagram and TikTok links and the shop email. An empty optional value is stored as not set.
- The staff `GET` now answers every one of those fields, the phones (main first, written as people read them), the version, the last changer's name and time, and the fixed time zone, currency and locale.
- Every UI-SPEC Business Info rule answers 400 on its own field with the approved message. A 100-character name with an n-tilde passes and 101 fails (UTF-16 units).
- `SiteLinks` accepts only `https://` on an exact allow-listed host, with no sign-in part, no port, no space and none of `"'<>\`[]`. `javascript:`, `http:` and bracket placeholders are refused. The same cases live in `tests/fixtures/site-link-cases.json` for plan 11-12's zod tests.
- A stale version answers 409 `edit.stale` and changes nothing. A save with no change stores nothing and keeps the version. A phone-only change touches the settings row, so the version, the public ETag and the sitemap date move.
- One `site-settings.changed` entry per changing save, in the same save.

## Task Commits

1. **Task 1 (tracer): a Manager saves a new tagline and the next public read and page head show it**
   - RED `e7080b54`, GREEN `32ba2cae`
2. **Task 2: every Business Info rule refuses bad input with the approved message**
   - RED `f81beabc`, GREEN `b77e5f91`
3. **Task 3: a stale save gets 409, stamps come from the server, each change is audited**
   - RED `cd5cd2c8`, GREEN `32d43cbe`

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier is not required. Each RED commit precedes its GREEN commit. No REFACTOR commit was needed.

- **Task 1 RED** (`e7080b54`): `SiteSettingsWriteTests` 3 of 3 failed (no PUT route: 404 where 200, 403 and 401 were expected); the matrix row failed for all three callers and the discovery check (`PUT /api/v1/site-settings: matrix row matches no endpoint`). 8 failures in the run.
- **Task 2 RED** (`f81beabc`): `SiteLinksTests` 111 of 113 failed with `NotImplementedException` from the compile-only stub (the two that passed assert constants); `UpdateSiteSettingsRequestValidatorTests` 38 of 54 failed on assertions (the 16 that passed are the ones the Task 1 version and tagline rules already cover).
- **Task 3 RED** (`cd5cd2c8`): `UpdateSiteSettingsHandlerTests` 13 of 18 failed; `AuditActionsTests` 2 and `SiteSettingsTests.MarkPhonesChanged...` 1 failed (count 101 against 102, stub throws); integration 4 of 10 failed (stale 409, no-change, audit entry, phone-only version move).
- **Weak spots, stated plainly:** three integration tests passed at RED (`StampFieldsSentByTheClientAreIgnored...`, `TwoSavesInARowEachGiveADistinctPublicETag`, `ABadFormIs400...`) because the stamp interceptor, the 11-07 cache and the Task 1 validator already gave that behavior; they stay as regression guards. The widened `GET` (Task 3 in the plan) landed in Task 1, because the tracer's 200 answer needs the new values, so `SiteSettingsEndpointTests` was green at Task 3 RED.

## Verification evidence (real output)

- **Task 1 verify** (write, matrix, coverage, OpenAPI snapshot, staff read and the three host tests I changed): `total: 530, failed: 0`. `npm --prefix tools/openapi-gen run check`: `Generated API types match tools/openapi-gen/openapi.v1.json.` The tracer gate: Task 1's `<verify>` is automated only, so it was re-run on the committed tree before expansion (same 530 passed).
- **Task 2 verify:** `SiteLinksTests` and `SiteSettingsTests`: `total: 128, failed: 0`. `UpdateSiteSettingsRequestValidatorTests`: `total: 54, failed: 0`.
- **Task 3 verify:** integration `SiteSettingsWriteTests`, `SiteSettingsEndpointTests`, `OpenApiSnapshotTests`: `total: 25, failed: 0`. Application `UpdateSiteSettingsHandlerTests` and `GetSiteSettingsHandlerTests`: `total: 25, failed: 0`. Domain full run: `total: 1574, failed: 0` (includes `AuditActionsTests`: count 102). `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output, before each GREEN commit.
- **Full suites on the final tree:** Server integration `total: 2412, failed: 0`. Infrastructure integration `total: 1100, failed: 0, succeeded: 1099, skipped: 1` (the skip is pre-existing). Architecture `total: 290, failed: 0`. `dotnet build Csps.slnx`: 0 warnings, 0 errors. Web: `npm --prefix web run typecheck` exit 0, `npm --prefix web run lint` exit 0 (zero warnings), the two web test files that touch the settings types (`siteSettingsService.test.ts`, `AdminLayout.test.tsx`): 71 passed.
- **Coverage gate** (`tools/scripts/Invoke-CoverageGate.ps1`): `Csps.Domain line 100% (3196/3196) branch 100% (1451/1451) PASS`, `Csps.Application line 98.1% (9374/9553) PASS`.
- **The 409** (`TwoManagersReadTheSameVersionTheFirstSaveWinsAndTheSecondGets409AndChangesNothing`): two Managers read version V, the first `PUT` answers 200, the second answers 409 with problem code `edit.stale` and status 409, the stored tagline is the first Manager's, and the second Manager has no audit row.
- **Audit details read back from the database in the integration tests:** a name and tagline change gave `fields=businessName,tagline;businessName=Sample Shop>Renamed Sample Shop` (no tagline text). A phone-only change (the main number swapped and a third number added) gave `fields=phones`, moved the version and the public ETag, and the public phones came back as `+63281234567`, `+639171234567`, `+639187654321`.
- **Acceptance greps:** `UpdateSiteSettings` in `openapi.v1.json`: 5; the PUT matrix row: 1; stamp members in the request (non-comment): 0; `Paste your Messenger link, like https://m.me/yourpage.` in `SiteLinks.cs`: 1; `Choose the main number.` in the validator: 1; `javascript:` in the case file: 1; `ShouldBe(102)` in `AuditActionsTests.cs`: 1; `site-settings.changed` in `AuditActions.cs`: 1; `docs/api/site-content.md` starts with `created:` and `updated:`.
- gitleaks `protect --staged` ran before every commit: no leaks. A manual look at the staged diffs found no local path, real email, host or customer data; every value is fake (`example.test` addresses, `0917 123 4567`, `cspsdemo` page names).

## Decisions Made

- **GET reads the database.** The old staff `GET` used the hour-long cached snapshot. The form needs the live version, and a save would leave that cache stale. `ISiteContentStore.GetViewAsync` reads the row, the phones and the last changer's name directly. `ISiteSettingsReader` stays for the business calendar (time zone). Three older host tests that swapped the reader for `GET /site-settings` now swap the store (`FixedSiteContentStore`, `ThrowingSiteContentStore` in `tests/Csps.Testing`).
- **DTO members.** `contactPhone`, `addressLine` and `rowVersion` are gone from the staff DTO (their columns stay, D-39). `version` replaces `rowVersion`, so the web test fixture and the generated types follow.
- **Phone rows.** Replaced as a set (remove the old rows, add the new ones) in the same save. EF orders the deletes before the inserts, so the unique number and unique-main indexes never clash (proven by the swap-the-main integration test). A save compares the stored rows with the new ones place by place (number, label, main flag) and skips the write when they match.
- **Audit detail.** `fields=a,b,c` always; then `key=old>new` for the name and the six links, each only if the whole detail stays at or under 400 characters. About text, turnaround, address, email and phones are named only. This follows the Phase 6 `AuditDetailFormat`, so the audit viewer reads it like the other events. The plan's phrase "'Tagline changed'" is read as "the field is named, its text is not copied".
- **Domain stays at column limits.** The 100-character name limit lives in the validator; the domain keeps its 120 column limit. A link longer than its column (for example a 301-character Facebook link on an allowed host) passes the validator and is refused by the domain with the plain "Keep this to N characters or fewer." message on that field.
- **Request body.** `phones` uses `number`, `label`, `isMain`. The JSON name for the TikTok link is `tiktokUrl` and for the email `contactEmail`, matching the 11-07 public DTO and the domain field names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests that pinned the old settings read**
- **Found during:** Task 1
- **Issue:** `AccessTokenTests`, `AuthorizationFailureTests` and `ProblemDetailsTests` replaced `ISiteSettingsReader` to make `GET /site-settings` work or fail without a database. The endpoint now reads `ISiteContentStore`. `GetSiteSettingsHandlerTests`, `SiteSettingsEndpointTests` and the web `siteSettingsService.test.ts` fixture pinned the old DTO.
- **Fix:** They now use the store stubs (new `tests/Csps.Testing/SiteContentStores.cs`) and the new DTO shape; `GetSiteSettingsHandlerTests` was rewritten for the store.
- **Files modified:** the six test files above, `web/src/modules/admin/services/siteSettingsService.test.ts`
- **Committed in:** `32ba2cae`

**2. [Rule 3 - Blocking] Existing audit-catalog test pinned the end of `AuditActions.All`**
- **Found during:** Task 3
- **Issue:** `AuditActionsTests.ThePhaseSevenCodesComeAfterThePhaseSixCodesInThisOrder` listed the last nine codes. The new code is last.
- **Fix:** The list now ends with `site-settings.changed`; the test name says so.
- **Committed in:** `32d43cbe`

**3. [Rule 2 - Missing critical] Bracket placeholders refused in text fields, not only in links**
- **Found during:** Task 2
- **Issue:** The plan prohibition says no text holding a bracket placeholder may reach a field the public site shows (RESEARCH P-3); the plan's truth only names the link rules. The UI-SPEC has no message for a bracket in plain text.
- **Fix:** `SiteLinks.HasBracketPlaceholder` is checked in the name, tagline, about text, turnaround line, street, town, province and phone label, with a provisional message ("Replace the text in square brackets with the real words."). A bracket in the email gets the approved email message. See Owner items.
- **Files modified:** `src/Csps.Domain/Content/SiteLinks.cs`, `src/Csps.Application/Content/UpdateSiteSettingsRequestValidator.cs`
- **Committed in:** `b77e5f91`

**4. [Process] Widened `GET` landed in Task 1, version check and audit in Task 3**
- The tracer's 200 answer needs the new members, so the DTO and the store read came with Task 1. The tracer handler left out the version compare, the no-change path and the audit entry, which Task 3 added, so Task 3's RED tests were true failures.

**Total deviations:** 3 auto-fixed (1 Rule 2, 2 Rule 3), 1 process note. **Impact:** no scope creep; no package, migration, schema change or trigger.

## Issues Encountered

- `dotnet format` and the full integration run are slow on this shared machine; the format check ran clean (no output, exit 0) before each GREEN commit.
- The 11-09 plan text says to work on branch `gsd/phase-11-...`; this run used the executor's own worktree branch, as the orchestrator asked.
- The shared broken-windows ledger (`.planning/WINDOWS.md`) was not touched: the parallel executors would conflict on it, and the owner items below are in this SUMMARY.

## Owner items (park for review)

1. **Wording for bracket text (needs the owner's approval).** The message "Replace the text in square brackets with the real words." is mine, not from the UI-SPEC. It shows when a text field still holds something like `[Shop address]`. Options: **(a) keep it as is (recommended)**; (b) give different words; (c) drop the rule for plain text and keep it for links and the email only. The same rule and text must be in plan 11-12's zod schemas. It lives in `SiteLinks.PlaceholderTextMessage`.
2. **Audit viewer labels (plan 11-37).** `web/src/modules/admin/auditCopy.ts` and its test hold a hand-copied list of the 101 audit codes. The catalog is now 102 (`site-settings.changed`). Plan 11-37 already lists `auditCopy`; it needs a label for the new code and the count 102.
3. **Link length edge.** A link on an allowed host that is longer than its column (Messenger 120, Facebook, Instagram, TikTok and directions 300, embed 1000) is refused by the domain with the generic "Keep this to N characters or fewer." message, because the UI-SPEC has no link length rule. Plan 11-12 can mirror it or leave it to the server.

## Known Stubs

None.

## Threat Flags

None new. Planned mitigations are in place: T-11-18 (Manager policy, matrix row 401/403/400, Admin 403 test), T-11-19 (https host allow-lists, embed prefix rule, shared case file read by the domain tests), T-11-20 (no stamp fields in the request, stamp test with hostile values, stale-version 409 two-writer test), T-11-21 (one audit entry per changing save, long texts, email and phones never copied), T-11-SC (no package added or bumped; `npm ci --ignore-scripts` ran only from the lockfiles in `web/` and `tools/openapi-gen/`).

## User Setup Required

None.

## Next Phase Readiness

- Plan 11-12 can build the Business Info tab on `PUT /api/v1/site-settings` and `GET /api/v1/site-settings`, mirror the rules in zod with `tests/fixtures/site-link-cases.json` and `tests/fixtures/philippine-phone-cases.json`, and use the messages exactly as the server sends them.
- Plan 11-30 can add the share picture to the same settings row and call the same cache clearing (it is automatic for any tracked save of a public record).
- The shared requirement IDs (CONT-01, PUB-02, PUB-03) are only partly done by this plan; the orchestrator should mark them complete after the last plan that declares each one.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them).

## Self-Check: PASSED

All created files exist on disk and the six plan commits (`e7080b54`, `32ba2cae`, `f81beabc`, `b77e5f91`, `cd5cd2c8`, `32d43cbe`) are ancestors of HEAD. `git rev-list --count 484632ee..HEAD` was 6 before this SUMMARY commit.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
