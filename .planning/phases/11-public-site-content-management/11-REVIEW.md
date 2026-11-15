---
phase: 11-public-site-content-management
created: 2026-11-13T06:10:00-06:00
updated: 2026-11-14T23:22:00-06:00
reviewed: 2026-11-15T05:22:00Z
review_pass: 3
depth: standard
diff_base: 32723645
files_reviewed: 28
findings:
  critical: 0
  warning: 1
  info: 8
  total: 9
status: issues_found
---

# Phase 11 code review

*Created: 2026-11-13T06:10:00-06:00 · Updated: 2026-11-14T23:22:00-06:00*

This is the third review pass. It covers only the 28 non-planning files changed by the eleven fix commits made after the second-pass report (commit 32723645): WR-A2-01, WR-A2-02, WR-B2-01 to WR-B2-04, WR-C2-01 to WR-C2-04 and WR-D2-01. Finding ids carry a "3" for this pass (for example WR-3-01).

The second-pass report (27 findings, diff base b6796ce5) is kept in git: `git show 32723645:.planning/phases/11-public-site-content-management/11-REVIEW.md`. The first-pass report is still at `git show b6796ce5:.planning/phases/11-public-site-content-management/11-REVIEW.md`. Items deferred or parked in backlog 999.7 (see `11-REVIEW-FIX.md`) were not reported again.

The review only read code and the diffs. It ran no tests, no dev server, no Playwright and touched no database. Every failure scenario below comes from reading the code, not from a run. Where the report cites a test result, it is the result written in `11-REVIEW-FIX.md`.

## Summary

No critical issues. All eleven second-pass warnings are resolved in the code. The two changes that needed the closest look hold up:

- **The new `TestingDatabaseGuard`.** It reads the database name from the context's connection (`GetDbConnection().Database`), opens nothing, and allows only `CSPS_E2E` and `CSPS_Test_<guid>`. `CSPS_Dev`, `CSPS_Legacy_Restore`, any `BetsLLC_*` name, an empty name and the made-up near misses are all refused. The route checks first and answers 403, and `ResetAsync` checks again and throws, so a caller that skips the route (a future test or tool) is still stopped. The refusal text does not repeat the database name. The check runs before the gate wait and before any write. The per-test database names come from `CspsDatabase` (lowercase guid with hyphens), which the guard accepts, and CI uses a database called `CSPS_E2E` on the container, which it also accepts. The guard is name-only (it does not check the server), which matches the rule it was asked to follow. Two small gaps are in IN-3-01 and IN-3-02.
- **Idempotency-Key retention in the three admin tabs.** `useSubmission` keeps a key only for a failure that may have run (no answer, 5xx, 408, 409), and the server never stores a 5xx (`IdempotencyGate.cs:362`), so a kept key after a 5xx is harmless. The new `reportFailure` resets only the failed action, only after a successful read-again that shows the action took effect (a move: the row's place changed or it left the page; Hide or Show: the row already has the target state), and at once for a final 404. I traced the three tabs for index bases (`index` is taken from the same raw list that the refetch searches; Gallery uses the whole-list place through `values.page` and `values.size`), for a row that disappears (`index` is -1, so a move counts as done and a toggle keeps the key, which is harmless because the row is gone), and for closure staleness (`reset` only touches a ref and state setters, so the closure from the press is safe). I found no bug. The test gaps are in IN-3-05.

One warning remains: a class-level test order dependence that the fix report itself recorded (WR-3-01). Eight info items follow.

### Outcome of each second-pass warning

| Id | Result | Evidence |
|---|---|---|
| WR-A2-01 | Resolved | `docs/api/orders.md:267-268` and `:668` and the two rows of `docs/operations/audit-log.md` now match `DeleteOrderHandler` and `RestoreOrderHandler` (shown flag off, gallery entry removed, OK kept, restore never re-shows, a second `order.taken-off-website` entry after `order.deleted` or `order.restored` when the order was shown). `updated:` was bumped. |
| WR-A2-02 | Resolved | `TestingDatabaseGuard.cs` plus the check in `TestingSiteContentSeeder.ResetAsync:117` and in `TestingSiteContentController.Reset:33`. Four refused-name rows in `TestingSiteContentTests.cs:356-373`. |
| WR-B2-01 | Resolved | The orphan counts are replaced by end-state checks against the two answers (`GalleryAdminTests.cs:480-520`, `ProductLinePhotoEndpointTests.cs:239-252`). I checked every allowed status pair against the branch it takes; each one matches. |
| WR-B2-02 | Resolved | `UploadSlotsCoverageTests.cs:22-40` now selects every public action with an `IFormFile` or `IFormFileCollection` parameter (inherited included) and requires both attributes on the action or its class. A narrow edge is in IN-3-06. |
| WR-B2-03 | Resolved | Two new tests (`PublicCacheInvalidationTests.cs:385-422`) build the legacy state with `ExecuteUpdate` (no interceptor runs) and check both the clear count and the next public read. |
| WR-B2-04 | Resolved | `ShellHeadTests.cs:772-773` makes the one field the Gallery page reads (`GalleryShareImageUrl`) hostile, and `:797-803` asserts the exact encoded tag and the round trip. |
| WR-C2-01 | Resolved, one small residual | The four lock-taking order tests use 480 s, `contact.spec.ts` has a file-wide 480 s, and `e2e-lock-timeouts.test.ts` guards it. The margin over the 7 minute lock wait is thin once the pre-lock setup is counted (IN-3-03). |
| WR-C2-02 | Resolved | `order-public-website.spec.ts:329-349` starts the wait before the click, clicks inside the `try`, takes the id from the create answer, and deletes only when an id was seen. |
| WR-C2-03 | Resolved | `deleteOrderQuietly` (`photos.ts:171-182`) catches and annotates. All `finally` blocks in both specs use it, the two sweep deletes are independent, and `e2e-cleanup.test.ts` pins it. |
| WR-C2-04 | Resolved | `ensureDemoSiteContent` (`site-content-lock.ts:26-39`) seeds once per worker under the lock, and both specs call it from `beforeEach`. The cost is in IN-3-04. |
| WR-D2-01 | Resolved | `reportFailure` in all three tabs resets only the failed action and only when the list proves it ran, or on a final 404. A kept key after a 5xx is safe on the server. Test gaps in IN-3-05. |

## Warnings

### WR-3-01: `ChangingAProductLineTitleShowsOnTheNextLinesReadWithANewETagAndTheOldETagGetsNo304` does not reset its database and fails when its class runs together

**File:** `tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs:166-193`
**Issue:** This test reads the first product line and expects it to be "Basketball Jerseys" (it renames it to "Basketball Kits" and back). It never calls `database.ResetAsync()` and `ProductLineSeeding.RestoreSixAsync(database)`. Its neighbours do (lines 199-200, 239-240, 300-301, 452-453). The class shares one database, so the first line depends on what an earlier test left behind. `11-REVIEW-FIX.md` ("Flakes and a finding to note") records that the test failed in a whole-class run (it read "Volleyball Jerseys" where it expected "Basketball Kits"), passes alone, and fails the same way on the version before the new tests, so the order dependence is old. The class is in this pass's scope because the second-pass fix edited it, and the fix report left the failure open. Failure scenario: a full `Csps.Server.IntegrationTests` run (CI) goes red on this test even though nothing is wrong in the product.
**Fix:** Start the test the way its neighbours start:
```csharp
await database.ResetAsync();
await ProductLineSeeding.RestoreSixAsync(database);
```
before `CspsApiFactory.ForDatabase(...)`. This is the fix the fix report already suggested.

## Info

### IN-3-01: The guard's pattern is looser than the project's own test-database rule

**File:** `src/Csps.Infrastructure/Content/TestingDatabaseGuard.cs:32`
**Issue:** The project rule for a disposable test database is the case-sensitive `^CSPS_Test_[0-9a-f-]{36}$` (`tests/Csps.Testing/CspsDatabase.cs:270`, CLAUDE.md OR-1). The guard uses the same shape with `RegexOptions.IgnoreCase`, so `csps_e2e` and `CSPS_TEST_...` in capitals pass. It also ends with `$`, which in .NET also matches before a final newline, so `"CSPS_E2E\n"` passes. `[0-9a-f-]{36}` accepts 36 hyphens or any non-guid mix. None of these can reach a real database today (SQL Server names are case-insensitive on the default collation, and a name with a newline is not realistic). The guard is the line of defence for the "never touch other databases" rule, so it should be as strict as the rule it copies.
**Fix:** Use `\z` and no `IgnoreCase`, and check the guid part with `Guid.TryParseExact(name[10..], "D", out _)` and a lowercase compare, or keep the regex as `^(CSPS_E2E|CSPS_Test_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\z`. The duplicate of the rule (Infrastructure cannot reference `tests/Csps.Testing`) can stay, with a comment that it must match `TestDatabaseName`.

### IN-3-02: Nothing tests that the guard accepts the allowed names

**File:** `tests/Csps.Server.IntegrationTests/Testing/TestingSiteContentTests.cs:356-373`
**Issue:** The new theory covers four refused names. The accepting side is covered only for `CSPS_Test_<guid>` (every other test in the class runs on one). `CSPS_E2E` is never checked in .NET, and none of the edge names are checked (`csps_e2e`, a trailing newline, an empty name, a `BetsLLC_*` name, `CSPS_Dev`, `CSPS_Legacy_Restore`). A typo in the pattern that refused `CSPS_E2E` would break every e2e run, and one that let `CSPS_Dev` through would remove the protection, and neither would fail a .NET test.
**Fix:** Add a plain unit theory on `TestingDatabaseGuard.IsAllowedName` (no database needed): accepted `CSPS_E2E` and a lowercase-guid `CSPS_Test_` name; refused `CSPS_Dev`, `CSPS_Legacy_Restore`, `BetsLLC_Dev`, `CSPS_E2E_Copy`, `""`, `null` and `"CSPS_E2E\n"`.

### IN-3-03: The 8 minute test budget has little room over the 7 minute lock wait

**File:** `web/e2e/order-public-website.spec.ts:74-76, 136-138, 308, 351-361`; `web/e2e/site-content-lock.ts:15`; `web/e2e/photo-host-lock.ts:28, 98`
**Issue:** Each lock-taking order test first signs in, creates the order and uploads a photo (`openOrderWithPhoto`, which itself waits up to 4 minutes for the photo host lock), and only then waits up to 7 minutes for the site content lock. The setup plus a 7 minute wait can pass 8 minutes, so the generic "Test timeout" can still fire before the readable "site content lock was not free" error. The `acquire` loop is not cancelled by a test timeout, so the abandoned call can still take the lock later and run against a closed page. This is the same shape as WR-C2-01 but only when both locks are contended near their limits, so it is much less likely, and a lock that slow fails the test either way. The vitest check only compares the numbers `480_000` and `7 * 60 * 1000` and cannot see the setup.
**Fix:** Give the site lock a wait limit a margin below the test budget (for example 6 minutes with a comment), or make `acquire` stop when the test is over (pass an `AbortSignal` from `testInfo`). Keep the vitest check.

### IN-3-04: A file-wide 480 s timeout and the removed per-test caps slow every failure in `public.spec.ts` and `fixture-selftest.spec.ts`

**File:** `web/e2e/public.spec.ts:10-14, 114-117`; `web/e2e/fixture-selftest.spec.ts:9-15, 185-190`
**Issue:** Only the first test of a worker needs the long budget (the one that takes the site lock in `ensureDemoSiteContent`). The file-wide `describe.configure({ timeout: 480_000 })` gives every test 8 minutes, and the old 90 s and 120 s caps on the sideways-scroll and axe-speed tests were removed. A hang in a layout test, or in one of the fixture self-tests that probe failure paths, now takes 8 minutes to report. The axe-speed test still asserts its own 10 s limit, so that one is safe.
**Fix:** Keep the default timeout and extend it only when the seed runs:
```ts
test.beforeEach(async ({ request }, testInfo) => {
  if (!isDemoSeeded()) testInfo.setTimeout(testInfo.timeout + 480_000);
  await ensureDemoSiteContent(request);
});
```
(export a small `isDemoSeeded()` from `site-content-lock.ts`) and change `e2e-lock-timeouts.test.ts` to accept this form for a file that calls the helper.

### IN-3-05: The key retention tests rely on a sleep and miss the positive Hide and Show branch

**File:** `web/src/modules/admin/components/ProductLinesTab.test.tsx:441-460, 514-531`; `TestimonialsTab.test.tsx:471-508`; `GalleryTab.test.tsx:662-698`
**Issue:** Two gaps.
1. Each "keeps the same key" test waits for the second list read, then sleeps 50 ms, then presses again. The 50 ms is what gives a wrong reset time to run. On a slow machine the refetch answer is handled after the second press, so a version of the code that resets by mistake would still send the same key and the test would pass. The first pass removed the same 50 ms sleep pattern from the footer tests (WR-D-03).
2. The new `control === 'toggle'` comparison (`isActive` or `isShown` equals the target) has no positive test. The three "sends a new key once the list shows it ran" tests cover only moves. A change that made the toggle branch never reset (for example comparing the wrong field) would not fail any test. A reversed comparison would be caught by the negative tests.
**Fix:** Replace the sleep with a wait on a visible condition that proves the refetch result was handled (for example the row's label or order after the refetch, or `await waitFor` on a count that only changes after the `.then`), and add one test per tab: a lost Hide whose refetch shows the row hidden, then a second press of the same control sends a new key (`hideKeys[1] !== hideKeys[0]`).

### IN-3-06: The upload-slot coverage test still misses an upload action that takes its file through a form model or a list

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/UploadSlotsCoverageTests.cs:22-26`
**Issue:** The new filter finds only actions with a parameter typed exactly `IFormFile` or `IFormFileCollection`. An action that takes `[FromForm] UploadModel model` with an `IFormFile` property, or `List<IFormFile>` or `IEnumerable<IFormFile>`, is not found, so it could skip `[UploadSlot]` and the shared cap of two uploads (T-09-27, CWE-770) with all tests green. The five current actions take `IFormFile` directly, so nothing is wrong today. This is a smaller version of WR-B2-02.
**Fix:** Test the parameter type and the properties of a form model, for example a helper `CarriesFile(Type t) => t == typeof(IFormFile) || t == typeof(IFormFileCollection) || (t.IsGenericType && t.GetGenericArguments().Any(CarriesFile)) || t.GetProperties().Any(p => CarriesFile(p.PropertyType))` (guard against cycles and primitives), then keep the count at 5.

### IN-3-07: The new order test can pass `undefined` as the order id to the delete

**File:** `web/e2e/order-public-website.spec.ts:339`
**Issue:** `id = ((await (await created).json()) as { id: string }).id` trusts the cast. If the create answer is a validation problem (a body with no `id`), `id` is `undefined` at run time, the `finally` test `id !== null` is true, and `deleteOrderQuietly(page, undefined)` calls `DELETE /api/v1/orders/undefined` and writes a misleading "was not deleted" annotation. It cannot hide the real failure (the delete is quiet), so this is only noise.
**Fix:** `const body = (await (await created).json()) as { id?: string }; id = body.id ?? null;`.

### IN-3-08: `docs/web/e2e.md` does not mention the new helpers

**File:** `docs/web/e2e.md:214-216` (the shared site content section, edited by WR-A2-02)
**Issue:** The doc was updated for the 403, but the section that explains how specs take the demo and the lock does not mention `ensureDemoSiteContent` (the one-time seed for specs that only read public pages, with an 8 minute budget) or `deleteOrderQuietly` (best-effort cleanup in `finally`). A new spec author will copy the old pattern and hit the missing-photo 404 or a throwing cleanup again.
**Fix:** Add two sentences to that section naming both helpers and the 8 minute rule. Bump `updated:`.

---

_Reviewed: 2026-11-15T05:22:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
