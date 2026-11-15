---
phase: 11-public-site-content-management
created: 2026-11-13T06:10:00-06:00
updated: 2026-11-14T22:05:05-06:00
reviewed: 2026-11-15T04:05:05Z
review_pass: 2
depth: standard
diff_base: b6796ce5
files_reviewed: 129
findings:
  critical: 0
  warning: 11
  info: 16
  total: 27
status: issues_found
---

# Phase 11 code review

*Created: 2026-11-13T06:10:00-06:00 · Updated: 2026-11-14T22:05:05-06:00*

This is the second review pass. It covers only the 129 source, test and doc files changed since the first review (commit b6796ce5). Planning files were left out. Four reviewers ran in parallel at standard depth, one per slice, and their reports are merged below. Finding ids carry the slice letter and a "2" for this pass (for example WR-C2-01), so they do not clash with first-pass ids.

The first-pass report (48 findings, diff base febeb63d) is kept in git: `git show b6796ce5:.planning/phases/11-public-site-content-management/11-REVIEW.md`. The outcome of each first-pass finding is in `11-REVIEW-FIX.md`. Items parked in backlog 999.7 were not reported again. A finding the new changes made worse is marked as such.

All reviewers only read the code. They ran no tests, dev servers or databases, so every failure scenario below comes from reading the code, not from a run.

| Slice | Area | Files | Critical | Warning | Info |
|---|---|---|---|---|---|
| A | Domain, Application, Infrastructure, Server, tools, docs | 30 | 0 | 2 | 3 |
| B | .NET tests | 26 | 0 | 4 | 8 |
| C | Web e2e specs and scripts | 22 | 0 | 4 | 2 |
| D | Web source (web/src) | 51 | 0 | 1 | 3 |
| | **Total** | **129** | **0** | **11** | **16** |

## Slice A: Domain, Application, Infrastructure, Server, tools, docs (30 files)

### Summary

I read every changed file in full and the diff since `b6796ce5`, plus the callers needed to judge it: the cache invalidation interceptor, `ChangeOrderStatusHandler`, `PublicGalleryProjection`, `GalleryEntries`, `Order.SetPublicSettings`, `SignInRequestValidator`, the upload slot wiring in `Program.cs`, and the Testing controller.

No critical issues. The changes are sound where it matters:

- **Delete and restore (D-P11-BL-29).** `PublicContentInvalidationInterceptor.IsShownOrderWrite` also looks at the original value of `ShownOnWebsiteSinceUtc`, so clearing the shown date in `SoftDelete` and `Restore` still clears the public cache. The gallery entry is removed in the same save. The pattern matches `ChangeOrderStatusHandler`. A delete or restore of a never-shown order writes no extra audit entry.
- **Name rule (WR-A-02 fix).** `PublicName` is normalised to null by `SetPublicSettings`, so `IsShownWithoutName` and the projection's `PublicName ?? TeamName` agree.
- **Link, postal and email rules in the domain (WR-A-01 fix).** `SiteLinks.IsContactEmail` is the same shape check as the old `SignInRequestValidator.IsEmailShaped`, and the message text is the same string. `CheckShape` runs only on trimmed non-null values and does not overwrite a "too long" message. The Testing demo values pass the new rules.
- **Upload slot mark (WR-B-01 fix).** Slot middleware runs after authorization (`Program.cs:143-147`), so a refused request never takes a slot. All five actions carry `[UploadSlot]`. The slot limit is shared as the docs now say.
- **Look-ahead (WR-A-03 fix).** `LookAheadDays` is 38, inside the 60 day closure window (`ShopClosure.SearchWindowDays`). The OpenAPI file, the docs and the XML comments all say 38. No "14 days" is left in `src`, `docs/api` or the OpenAPI file.
- **Migration.** The Designer file is byte-identical to the previous Designer from line 18 on, apart from the migration id, so the model snapshot is unchanged. The `IF ... = 0` guard makes it safe to run twice, and `suppressTransaction: true` is correct for this statement. The decision is ruled (D-P11-BL-35) and I do not raise it again.
- **`AuditDetailFormat.Fit`.** The lazy `Where` over the changing `detail` variable works (the predicate is evaluated per item after each loop body). The first pair is at most about 245 characters (80 character team name times 3 for the encoding, plus `team=`), so the first-pair throw cannot happen.

Still open from the first pass (not re-reported): WR-B-02 (HasData tagline), IN-A-02 to IN-A-05, IN-B-01, IN-B-02, IN-B-03, IN-B-05, IN-E-04 (see WR-A2-02, which the new change makes worse).

### Warnings

#### WR-A2-01: `docs/api/orders.md` still describes the old delete and restore behaviour

**File:** `docs/api/orders.md:267-268` and `:668` (file not in the slice list, but the change that made it wrong is: `DeleteOrderHandler.cs:11-13`, `RestoreOrderHandler.cs:9-14`, `Order.cs:1368-1405`)
**Issue:** The API contract page is the one "a future Android app will use". After D-P11-BL-29 it is wrong in three places:
- Line 267: "Delete the order ... The stored settings are not changed." Now a delete clears `shownOnWebsite`, removes the gallery entry and keeps the customer's OK.
- Line 268: "Restore the order ... one that was shown is shown again. This is the current behaviour and it waits for an owner ruling (parked as P11-BL-29)." Now a restore never shows the order again, and the ruling is made.
- Line 668: "A delete writes one `order.deleted` entry and a restore one `order.restored` entry". Now an order that was shown gets a second entry, `order.taken-off-website`, after each of them (`DeleteOrderHandler.cs:221-224`, `RestoreOrderHandler.cs:265-268`). A client that reads the audit log or counts entries per call will be wrong.
`docs/operations/audit-log.md` is likely stale in the same way (not checked line by line). Failure scenario: an Android developer reads the page, restores a deleted shown order and expects it live on the website. It is not.
**Fix:** Rewrite the two table rows to match `Order.SoftDelete` and `Order.Restore` (shown date cleared, gallery entry removed, OK kept, restore never re-shows, legacy rows deleted before the ruling are un-shown by a restore). Change line 668 to say that a delete or restore of an order that was shown also writes one `order.taken-off-website` entry in the same save. Bump the file's `updated:` timestamp.

#### WR-A2-02: The Testing reset now also changes the website state of every other order in the database (IN-E-04 still open, now worse)

**File:** `src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs:165-178` (route: `src/Csps.Server/Controllers/TestingSiteContentController.cs:16-31`)
**Issue:** `ResetDemoOrdersAsync` now loads every order that is not `DEMO-GALLERY-*` and has a shown date, deletes the gallery entries of all of them and sets each shown date to null. The route is `[AllowAnonymous]`, has no database-name guard, and is active whenever a Debug (`CSPS_TESTING`) host runs in the Testing environment. IN-E-04 was already open for site content. The reset now reaches the orders table too. Failure scenario: a developer starts the Testing host with a connection string that names `CSPS_Dev` (or a restored copy of real data) and any anonymous caller, or a stray e2e run, un-shows every live order on the website. The customer's OK is kept, but the staff have to re-show each one by hand.
**Fix:** Do what the first-pass owner item recommended, and do it now because this change widens the reach. Make `ResetAsync` refuse any database name except `CSPS_E2E` and `CSPS_Test_<guid>` (read the name from `context.Database.GetDbConnection().Database`) and throw `InvalidOperationException` otherwise. If the owner prefers not to change it, record this as a ruled acceptance in the 999.7 backlog next to IN-E-04.

### Info

#### IN-A2-01: Two docs edited without bumping their `updated:` timestamp

**File:** `docs/api/order-images.md:3` (updated `2026-11-04T00:50:00-06:00`), `docs/api/public-site.md:3` (updated `2026-11-12T21:20:00-06:00`)
**Issue:** Commits `4bd0bb38` (the shared upload cap sentence) and `2bd8cb3a` (38 days) changed both files on 2026-11-13 but left the `updated` value alone. The project rule is that every markdown edit changes the updated value. `site-content.md`, `deploy.md` and `e2e.md` were bumped correctly.
**Fix:** Set `updated:` in both files to a 2026-11-13 timestamp with offset `-06:00`.

#### IN-A2-02: The "shown order needs a name" rule lives in the handler, not the domain

**File:** `src/Csps.Application/Orders/UpdateOrderDetailsHandler.cs:140-147`, `src/Csps.Domain/Orders/Order.cs:185-186` and `:1509`
**Issue:** The WR-A-02 fix adds `Order.IsShownWithoutName` but only `UpdateOrderDetailsHandler` calls it. `Order.UpdateDetails` still accepts a blank team name on a shown order, so any other future caller (an import, a tool, the Android API through another handler) can reproduce the silent disappearance from the gallery. The name rule is also written twice in the domain (`CheckPublicSettings` at line 1509 and `IsShownWithoutName`). A legacy order that is already shown with no name now refuses every unrelated details save (for example a notes edit) with a team name error, which is correct but surprising.
**Fix:** Make `UpdateDetails` return the same validation error when the result would be shown with no name, and let `CheckPublicSettings` use `IsShownWithoutName`-style logic through one private helper, so the rule exists once. Keep the handler check only if the domain change is not wanted.

#### IN-A2-03: Testing photo store keeps every demo file from every reset

**File:** `src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs:260-269`, `src/Csps.Infrastructure/Images/TestingImageStorage.cs:121-125`
**Issue:** `NewDemoPhotoId` seeds a new file under a fresh GUID id on every reset (about 12 files). The old demo orders and uploads are removed with `RemoveRange`, and nothing removes their files from the in-memory store. A long e2e run (hundreds of resets, one per spec file or test) grows the host's memory slowly. The size is tiny (the file is 70 bytes), so this is not a bug today.
**Fix:** Before the reset removes the old demo rows, remove the files they name (call `RemoveAsync` or a small `Forget(publicId)` on the Testing storage), or reuse one fixed id per demo slot.

---

_Reviewed: 2026-11-14T08:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer), slice A, second pass_
_Depth: standard_

## Slice B: .NET tests (26 files)

### Summary

The new and changed tests mostly pin the production changes well: the delete and restore take-off behavior (D-P11-BL-29), the domain-level link, postal code and email rules, the 38-day look-ahead, the audit-detail fit, the Read Committed Snapshot migration and the upload slot attribute. The Read Committed Snapshot tests are the strongest: a deterministic two-transaction check, a script check that every `ALTER DATABASE` names `CURRENT`, a double run, and an undo and redo. Cleanup is safe: every new database goes through `CspsDatabase` (`CSPS_Test_<guid>`, re-checked before any drop), and the one master-level read in `IsOnAsync` is a `SELECT` by name. No `BetsLLC_*` exposure. Fixture data is clearly fake. No unseeded randomness. The only real-clock uses are harmless.

There are no blockers. Four warnings are tests that cannot fail or that miss the behavior they claim to guard. Eight info items are smaller.

No new endpoint was added, so the authorization matrix needs no new row. The matrix tightening (exact status after clearing the share picture) is correct.

### Warnings

#### WR-B2-01: The new "no orphan" race assertions cannot fail (foreign keys already guarantee them)

**File:** `tests/Csps.Server.IntegrationTests/Content/GalleryAdminTests.cs:480-487` (called at 450 and 468); `tests/Csps.Server.IntegrationTests/Content/ProductLinePhotoEndpointTests.cs:239-242`
**Issue:** Both new checks count rows that point at a product line that no longer exists. That state cannot exist in this schema. `GalleryEntryConfiguration.cs:42` and `ProductLinePhotoConfiguration.cs:25` both declare the foreign key with `DeleteBehavior.Restrict`, so SQL Server refuses the delete or the write itself. The count is always 0 whatever the code does. The real failure of the race (an FK violation surfacing as a 500) is already caught by the status-pair assertions. So the assertions add run time (an extra context and query in each of 20 rounds) and a false sense of end-state coverage. The doc comment "The end state of a race: no upload names a line that is gone" reads as stronger than it is.
**Fix:** Drop both orphan checks, or replace them with an end-state check the database does not already enforce. For example, when the status pair is (Created or OK, 422), assert that the upload or photo row names a line that still exists and is visible in `rig.ListAsync()`. When the pair is (400 or 404, 204), assert no row was created.

#### WR-B2-02: The upload-slot coverage test keys on the rate-limit attribute, so an upload action that forgets both attributes passes

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/UploadSlotsCoverageTests.cs:22-31`
**Issue:** The test finds actions that carry `[EnableRateLimiting(ImageUpload)]` and checks that they also carry `[UploadSlot]`. Its stated purpose is "covers every upload endpoint, found by endpoint metadata and not by one name". A new action that takes an `IFormFile` and carries neither attribute is invisible to it, so the app-wide cap of two uploads (T-09-27, CWE-770, the 256 MB pool) is silently skipped. The hard-coded `Count.ShouldBe(5)` only helps when the rate-limit attribute is present. The scan also covers only `DeclaredOnly` methods and method-level attributes. A class-level `[EnableRateLimiting]` or an inherited action would be missed.
**Fix:** Select upload actions by what makes them uploads, for example any public action with an `IFormFile` parameter or `[RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]`. Then require both `[EnableRateLimiting(ImageUpload)]` and `[UploadSlot]`:
```csharp
var uploadActions = typeof(OrderImagesController).Assembly.GetTypes()
    .Where(type => typeof(ControllerBase).IsAssignableFrom(type))
    .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance))
    .Where(m => m.GetParameters().Any(p => p.ParameterType == typeof(IFormFile)))
    .ToList();
// then assert each has EnableRateLimiting(ImageUpload) and UploadSlot, and keep Count == 5
```

#### WR-B2-03: Nothing tests that restoring an order left shown clears the public cache

**File:** `tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs:376-382` (and `tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs:427-459`)
**Issue:** `RestoreOrderHandler` now removes the left-over gallery entry and clears the shown date of an order that was deleted while still shown (a pre-D-P11-BL-29 delete). That is a public change. Until the public cache is invalidated, `/`, `/gallery` and the boot data keep listing a work item that has been removed, for up to an hour (the `ShellPage` cache TTL). The edited cache test now asserts the opposite for the normal restore: it expects exactly zero clears, and adds a re-show step outside the counted steps. The endpoint test for the legacy path (`RestoringAnOrderDeletedWhileStillShown...`) checks only the database, the audit entry and the order detail. No test would fail if the interceptor missed this path (for example if the invalidation rule ever ignores an order that is soft-deleted in the same save).
**Fix:** Add a cache test that builds the legacy state (the `MarkDeletedInPlaceAsync` idea, with the shown date and the gallery entry left in place), restores through the API with the counting cache, and asserts `Clears > 0`. Also assert that the public gallery read no longer lists the order.

#### WR-B2-04: The `/gallery` row of the script-breakout theory exercises no hostile data

**File:** `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs:753-790` (the `[InlineData("/gallery", false)]` row at 756)
**Issue:** For the Gallery page, `ShellPage` uses the read only for `ShareImageUrl` (`ShellPage.cs:243-252`). The test puts hostile text in the gallery items and pills, but none of it reaches the page head or the boot block. The stub's `GalleryShareImageUrl` stays at its default, and the one field the page does read is never made hostile. The `/gallery` case can only pass, so it verifies nothing about gallery text. Its name and `bootCarriesTheText=false` suggest it does.
**Fix:** Set the stub's `GalleryShareImageUrl` to a hostile value (for example `FailingTagline` or `"x\"><script>alert(1)</script>"`) and assert the og:image and twitter:image content is attribute-encoded and the page still has exactly the expected closing tags. Or drop the row and say plainly in a comment that gallery items never reach the shell.

### Info

#### IN-B2-01: The messenger "at the limit" case is 113 characters, not the 120 limit

**File:** `tests/Csps.Domain.UnitTests/Content/SiteSettingsBusinessInfoTests.cs:391`
**Issue:** `Pad("https://m.me/", Math.Min(max, 113))` builds a 113-character link, because the shape rule caps the handle at 100 characters. The test name says "one at the limit fits", but for `messengerUrl` it checks 113 and the 120 column limit is unreachable by a valid value. Lengths 114 to 120 return the shape message and have no case. The test is still valid, only mislabeled.
**Fix:** Add a comment at that line that the messenger limit is set by the 100-character handle. Add one case that a 114-character link gets the messenger message.

#### IN-B2-02: `LookAheadDays` test restates the constant

**File:** `tests/Csps.Domain.UnitTests/Content/OpenStatusTests.cs:217-220`
**Issue:** `OpenStatus.LookAheadDays.ShouldBe(ShopClosure.MaxSpanDays + 7)` is the same expression as the production constant. It cannot fail. The two boundary tests above it (closed through day 38 gives none, a 37-day closure finds day 38) already pin the real behavior.
**Fix:** Delete the test, or assert the literal 38 so a change to `MaxSpanDays` is forced to be a visible decision.

#### IN-B2-03: `AuditDetailFormat.Fit` has no direct tests

**File:** `tests/Csps.Application.UnitTests/Content/TestimonialAuditDetailTests.cs:16-27` (production: `src/Csps.Application/Common/AuditDetailFormat.cs:94-104`)
**Issue:** `Fit` is a newly public shared helper, covered only through the gallery and testimonial wrappers. Three cases have no test: `Fit()` with no arguments throws `IndexOutOfRangeException` instead of an argument error; a first pair longer than 400 characters is kept, so the audit write still throws; and the order-dependent drop (a long middle pair dropped while a shorter later one is kept). The testimonial test passes by a margin of one character: "fields=..." is 34 characters, plus a 366-character name pair, plus a separator is 401. A one-character change in the field list flips which branch it tests. It also never asserts that the `name` pair was dropped.
**Fix:** Add `AuditDetailFormatTests` for `Fit`. In the testimonial test, add `detail.ShouldNotContain("name=")`.

#### IN-B2-04: DDL in a non-migration test

**File:** `tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs:134`
**Issue:** The blocker changed from an `UPDATE` to `ALTER TABLE dbo.SiteSettings ADD ReaderBlocker int NULL`, because reads no longer wait on a row lock under Read Committed Snapshot. It holds a schema lock for the cache-factory timing check. The change is on an ad hoc `CSPS_Test_<guid>` database, so it is safe, but it is inline schema-changing SQL in a test that is not a migration test. After the `CommitAsync` the column stays (harmless, the database is dropped). The comment explains the reason well.
**Fix:** None needed beyond keeping the comment. If the owner wants no DDL outside migrations, a `sp_getapplock`-based block would not hold up readers under Read Committed Snapshot, so the DDL is the practical option.

#### IN-B2-05: Race tests have no timeout, and the round count is duplicated

**File:** `tests/Csps.Server.IntegrationTests/Content/GalleryAdminTests.cs:436,453`; `tests/Csps.Server.IntegrationTests/Content/ProductLinePhotoEndpointTests.cs:224`; `tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs:434`; `tests/Csps.Testing/ConcurrentRequests.cs` (shared helper)
**Issue:** `ConcurrentRequests.SendAllTogetherAsync` takes no cancellation token and has no timeout. A request that hangs (for example a regression back to a lock wait or deadlock) hangs the run until the host kills it, instead of failing the test. `GalleryAdminTests` uses a `RaceRounds = 10` constant while the other two files repeat a literal 10. The two-upload test is a probabilistic guard: with the deterministic `ReadCommittedSnapshotMigrationTests` test beside it, that is fine, but the test name "BothSaveEveryTime" overstates it.
**Fix:** Wrap the gate wait in `.WaitAsync(TimeSpan.FromSeconds(60), TestContext.Current.CancellationToken)`. Move the round count to one shared constant.

#### IN-B2-06: Reflection on a private setter is copied into two test projects

**File:** `tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs:~410` and `tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs:~107`
**Issue:** Both tests recreate the legacy "deleted while shown" state with `typeof(Order).GetProperty(nameof(Order.ShownOnWebsiteSinceUtc))!.SetValue(...)`. This depends on a non-public setter. If the property gets an `init`-only or backing-field-only shape it throws at run time with a reflection error, not a compile error. The same trick is copied in two places.
**Fix:** Put one `OrderTestState.MarkShownWhileDeleted(order, instant)` helper in `tests/Csps.Testing` and use it from both. Or expose the legacy state through the existing `Order.Import` snapshot path.

#### IN-B2-07: The slot-cap test checks only the status code

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/UploadSlotsCoverageTests.cs:49-53`
**Issue:** The 429 test asserts `reached == false` and the 429 status. It does not check the `Retry-After` header or the problem body (the `rate-limited` code), both of which the middleware writes. The line `taken.IsAcquired.ShouldBeTrue()` checks the test's own lease and proves nothing about the middleware.
**Fix:** Assert `context.Response.Headers.RetryAfter` is "60" and read the body for the problem code. Remove the `taken.IsAcquired` lines.

#### IN-B2-08: Gaps around the new shown-without-name guard

**File:** `tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs:415-451`
**Issue:** The three new tests cover clearing the team name with no name, with a stored public name, and while the same request takes the order off the site. Two cases are missing. The first is a request that clears the team name and sets a new public name in the same `PublicWebsite` block: it should be allowed, and a guard run before the block is applied would wrongly refuse it. The second is a whitespace-only team name, since `IsShownWithoutName` uses `IsNullOrWhiteSpace`. There is also no HTTP-level test of the 422 and its `teamName` field message. The handler mutates the loaded aggregate before the guard returns the failure. Only `Saves == 0` proves nothing is written, which relies on the unit of work not saving that tracked instance later.
**Fix:** Add the two handler cases. Add one endpoint test that a PUT clearing the team name of a shown order answers 422 with `errors.teamName`.

---

_Reviewed: 2026-11-14T12:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice C: Web e2e specs and scripts (22 files)

### Summary

The changes since b6796ce fix most of what the prior review reported: the order public-website specs now show, read and delete under the site content lock; the lock waits 7 minutes and names itself in the timeout error; the sweep resets the demo in a nested `finally`; the public sweep now actually asserts `problems` (before this change the array was filled and never checked, so the test could not fail); the vite plugin fails the build instead of emitting an empty `unicode-range`. No secrets, real emails, local paths, forbidden ports or long dashes were found in the 22 files (checked with a search for U+2013 and U+2014; ports are 5199 only).

Four warnings remain, all in the new lock-and-cleanup structure or in the removal of the 404 declarations. No critical issues.

### Warnings

#### WR-C2-01: order-public-website specs wait on a 7 minute lock but time out after 4 minutes

**File:** `web/e2e/order-public-website.spec.ts:74, 136, 308, 351` (the four tests that now take `withSiteContentLock`)
**Issue:** The lock now allows a waiter 7 minutes (`site-content-lock.ts:13`, comment: "Specs that take this lock allow 8 minutes"). These four tests still call `test.setTimeout(240_000)`. Sweep specs hold the lock for minutes, and the order is created and a photo uploaded before the wait starts, so a test queued behind two sweeps hits the 4 minute test timeout while it is still in `acquire`. Failure scenario: the test fails with a generic "Test timeout of 240000ms exceeded", not the lock error. Worse, `acquire` cannot be cancelled: the abandoned promise keeps polling, later takes the lock, runs `showFromWindow` against a closed page, throws, and releases. Each orphan holds the lock for a moment and delays real waiters. Every other lock-taking spec uses 480_000.
**Fix:** Use `test.setTimeout(480_000)` in the four lock-taking tests (the non-lock tests at 203, 248 and 410 can stay at 240_000). Better, give the lock's `waitLimitMs` a margin under the test timeout (for example 6 minutes) so the readable lock error fires before the test timeout does.

#### WR-C2-02: New Order form test can leave a shown order behind and then delete order id ''

**File:** `web/e2e/order-public-website.spec.ts:329-343`
**Issue:** `Save Order` is clicked and `expect(page).toHaveURL(...)` runs before the `try`. If the save request succeeds but the URL assertion times out (slow redirect, busy host), the order exists, is shown at the top of the shared gallery, and no `finally` will delete it. The `id` is read from `page.url()` with `?? ''`, so when the URL did not match, `deleteOrderThroughApi(page, '')` would call `DELETE /api/v1/orders/` and fail the test with a 404/405 message that hides the real failure. Consequence of a leaked shown order: later gallery specs that expect the four demo orders (`gallery.spec.ts` counts, first tile) fail until the next `seedDemoSiteContent`, which does take non-demo shown orders off, so the damage is limited to the window between.
**Fix:** Capture the id from the save response instead of the URL, and put the click inside the `try`:
```ts
await withSiteContentLock(async () => {
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/v1\/orders$/.test(new URL(r.url()).pathname));
  let id: string | null = null;
  try {
    await page.getByRole('button', { name: 'Save Order' }).click();
    id = ((await (await saved).json()) as { id: string }).id;
    await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
    ...
  } finally {
    if (id !== null) await deleteOrderThroughApi(page, id);
  }
});
```
(Adjust the response parsing to the real create response shape.)

#### WR-C2-03: Cleanup in `finally` throws over the real failure and one delete skips the next

**File:** `web/e2e/order-public-website.spec.ts:109-111, 154-156, 340-342, 358`; `web/e2e/site-content-sweep.spec.ts:299-303`
**Issue:** Every new `finally` calls `deleteOrderThroughApi`, which calls `apiToken` (a refresh round trip) and `expect(...).toBe(204)`. If the test failed because the session or page was lost, the cleanup throws too, and the thrown error replaces the original assertion failure, so the report shows "POST /api/v1/auth/refresh" instead of the real cause. In `site-content-sweep.spec.ts`, if the `plain` delete throws, the `cancelled` delete is skipped (it is not shown, so it only leaves residue). In the order spec the order stays shown after a failed delete, which is the state WR-C2-02 describes, and nothing recovers it.
**Fix:** Make the order cleanup best effort and report it separately, for example a helper `deleteOrderQuietly(page, id)` that catches, records `test.info().annotations.push({ type: 'cleanup', description })`, and does not rethrow, so the original error wins. Delete both sweep orders independently (`await Promise.allSettled([...])`) before the `seedDemoSiteContent` in the inner `finally`. A stronger option is the one the prior review gave: have `ResetDemoOrdersAsync` also remove orders whose number starts with the `ORD-208` family.

#### WR-C2-04: Removing the 404 declarations makes public.spec and fixture-selftest depend on a demo reset they do not run

**File:** `web/e2e/public.spec.ts:29-68, 71-79, 107-125`; `web/e2e/fixture-selftest.spec.ts:119-287` (the removed `beforeEach` at the top of each)
**Issue:** The removed guard lines were correct only because the demo reset stores real tiny photo files. `TestingImageStorage` keeps files in memory (`src/Csps.Infrastructure/Images/TestingImageStorage.cs:30`), and `SeedShownOrdersAsync` in the dev seed (`SiteContentSeedStep.cs:217`) shows orders from `--reset` of `CSPS_E2E` whose photo ids are not in that store. Until some spec has called `seedDemoSiteContent`, Home (Recent work) and the Gallery request photos that answer 404. `public.spec.ts` and `fixture-selftest.spec.ts` load `/`, `/gallery` and others and take neither the lock nor the seed, so they now fail on `/api/testing/images/` when run alone (`npx playwright test public.spec.ts`, `--grep @public`, a rerun of one failed spec, or any worker order where they start first on a fresh host). A full run hides this because `contact`, `gallery` and `home` sort earlier and seed.
**Fix:** Either run `seedDemoSiteContent` under `withSiteContentLock` in a `beforeAll`/first step of those two files, or keep a declared tolerance for `/api/testing/images/` 404 in specs that do not reset the demo. Verify with `npx playwright test public.spec.ts --project=chromium` against a freshly reset `CSPS_E2E` (run only after the preflight check).

### Info

#### IN-C2-01: "Take Off" test never proves the order was listed before it was taken off

**File:** `web/e2e/order-public-website.spec.ts:143-153`
**Issue:** The last assertion is `expect(await publicGalleryTeams(request)).not.toContain(order.team)`. It passes when the order never reached the gallery at all (for example a show that saved the flags but made no gallery entry), so it cannot fail for the bug it names.
**Fix:** After `showFromWindow` and the "Shown" checks, add `expect(await publicGalleryTeams(request)).toContain(order.team);` so the later `not.toContain` is a real before and after.

#### IN-C2-02: `barlowNoPesoPlugin` edge cases: wildcard ranges and an empty list give a misleading result

**File:** `web/scripts/vite-preload-font-plugin.ts:86-87, 95-112, 126-129`
**Issue:** `RANGE_TOKEN` does not parse wildcard tokens (`U+20??`), so such a token is kept as written and would still list U+20B1 with no error. Fontsource does not emit wildcards today, so this is theoretical. Also an originally empty `unicode-range: ;` gives `kept === ''` and the build error says "lists only U+20B1", which is wrong for that input.
**Fix:** Treat an unparseable non-empty token as a build error (`this.error`) rather than keeping it silently, and test `list.trim() === ''` separately with its own message.

---

_Reviewed: 2026-11-14T12:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice D: Web source (web/src) (51 files)

### Summary

I read every file in the list, judged the changes since b6796ce as whole code, and checked the earlier fixes (WR-C-01, WR-C-02, WR-C-03, WR-D-01, IN-C-02, IN-D-01, IN-D-02, IN-D-04, IN-D-05, IN-D-06, D-P11-BL-65) for correctness. Most of the new code holds up. I found no blockers.

What I checked and found sound:

- `publicResource.ts`: the generation counter handles both cases (first load and refresh of old data). No loop, since each follow-up load starts once per invalidate. A failed follow-up load keeps the shown data and the next subscriber reloads it. `reset()` bumps the generation as well.
- `bootData.ts`: caching `null` is correct, and `resetBootData()` still clears it.
- `useSwipe.ts`: the new `disarm` logic is correct for touch swipes (no click), for mouse swipes (the click is swallowed), and for a second pointer down. No dangling listener can act on an unmounted component.
- `Checkbox.tsx`: the uncontrolled, aria-disabled case is correct. A controlled box is unchanged, because React puts it back.
- `images.ts`: every decodable photo is redrawn on a canvas, so EXIF, GPS and ICC data are dropped. `imageOrientation: 'from-image'` applies the rotation before the redraw, and the redrawn JPEG carries no orientation tag, so there is no double rotation. The bitmap is closed in `finally`. Previews are `data:` URLs (the CSP has no `blob:`), so there is no object-URL leak. The HEIC raw path is covered on the server by `ImageMetadataStripper.Heic.cs`.
- `siteContentSchemas.ts`: the `transform(reduceEmbedCode).pipe(...)` form works. The key still fails closed for a non-Google src.
- `MapCard.tsx`: the iframe loads only an `https://www.google.com/maps/embed` address, and only after the click. There is no `dangerouslySetInnerHTML` anywhere in the slice.
- Tailwind output (I compiled the two new arbitrary classes with `scripts/class-gate.mjs`): `calc(var(--spacing-contact-bar) + var(--space-6) + env(safe-area-inset-bottom))` and the `max(...)` form both come out as valid CSS with the spaces around `+`. The four map-road stroke tokens equal the old hex values.
- OR-4: no U+2013 or U+2014 character was added in `web/src` by this diff.
- OR-5 and OR-6: no `fetch` call or new file placement outside the owner tree.

### Warnings

#### WR-D2-01: Resetting the move and toggle submissions after a refetch drops the Idempotency-Key while the first request may still be running on the server

**File:** `web/src/modules/admin/components/ProductLinesTab.tsx:314-320` (the same code is at `TestimonialsTab.tsx:313-319` and `GalleryTab.tsx:354-360`)
**Issue:** `mayHaveSaved(error)` is true for a timeout, a cancelled request, a dropped connection and a 5xx. For a timeout or a dropped connection the server may still be working on the request, because the client gave up first. The old behaviour kept the key, so a repeat press was replayed or got a 409 "still running" (SEC-06). The new code resets the submission as soon as the list read-again succeeds, and a successful read does not prove the first move has committed.

Scenario: the Manager presses "Move up", the request times out at the client while the server is slow, and the refetch returns the old order. `reset()` runs and the Manager presses "Move up" again. The second press carries a new key, so both moves apply and the row ends two places up instead of one. The tests only cover the case where the lost answer's move had already committed before the refetch.

The `reset()` calls also clear `lastRef` for the other action: a lost `move` also forgets the key of a `toggle` whose answer was lost.

**Fix:** reset only when the refetched list proves what the failed action did, and keep the key otherwise. For a move, compare the refetched order with the order before the press, and reset only when the row's place changed (the action has run, so the next press is a new intent). For a hide or show, reset only when `isActive` already equals the target. A simpler, safer option is to reset only for a final answer such as the 404 branch and keep the key for network and 5xx errors, which makes this fix a no-op for most cases but matches the old protection. Example for the move:

```tsx
void query.refetch().then((result) => {
  if (result.isError) return;
  const after = result.data?.findIndex((item) => item.id === line.id);
  if (after !== undefined && after !== indexBefore) {
    move.reset();
  }
  // toggle: if (result.data?.find((i) => i.id === line.id)?.isActive === !line.isActive) toggle.reset();
});
```

### Info

#### IN-D2-01: The safe-area padding added for the Contact bar, the footer and the scroll padding has no effect without `viewport-fit=cover`

**File:** `web/src/modules/public/components/contact.recipe.ts:174-176` (also `SiteFooter.tsx:44-47`, `PublicLayout.tsx:32-35`); the viewport tag is `web/index.html:8`
**Issue:** `env(safe-area-inset-bottom)` is 0 unless the page opts in with `viewport-fit=cover`. The viewport tag is `width=device-width, initial-scale=1`, and no other file in the repository sets `viewport-fit` (I searched .html, .cs, .ts and .tsx). The "UI review fix 6" change and its tests therefore pass, but on a phone the bar does not move and the extra padding is always 0. The admin tab bar uses the same pattern, so the two stay consistent, but the claim "the safe area is added" is not true on a device.
**Fix:** either add `viewport-fit=cover` to the viewport tag (an owner call, because it changes how the whole page lays out under the notch and the home indicator, and the admin pages would need the same check), or drop the `env()` terms and say in the SPEC-DEVIATION comment that the safe area is not used yet. Do not leave the comment and the tests claiming a device behaviour that cannot happen.

#### IN-D2-02: `useSwipe` cleanup does not drop a pending swallow

**File:** `web/src/modules/public/hooks/useSwipe.ts:75-79`
**Issue:** the effect cleanup removes the three pointer listeners but not the capture `click` listener or its 100 ms timer that `swallowClick` may have armed. If `minDistance` changes (the effect re-runs) or the lightbox closes in that window, the old swallow stays on the element for up to 100 ms, and then the timer calls `removeEventListener` on the old element. It is harmless today (the swallow is removed by its own timer, and `once` covers the click), but it is the one listener the cleanup misses.
**Fix:** call `disarm?.()` in the cleanup:

```ts
return () => {
  disarm?.();
  element.removeEventListener('pointerdown', onDown);
  ...
};
```

#### IN-D2-03: A photo under the size limit can now be refused as too large after the redraw, and the PNG path has no way to shrink the file

**File:** `web/src/utils/images.ts:217-221`
**Issue:** since D-P11-BL-65 every decodable photo is redrawn, and the size limit applies to the redrawn file. A canvas PNG is usually larger than an optimised source PNG (no filter search, no palette), so a PNG that was just under `maxBytes` (a large screenshot or a logo sheet) can come back over it and is refused with `reason: 'size'`, even though the picked file was within the limit. The user sees a size refusal for a file smaller than the stated limit. JPEG and WebP have a quality knob (0.85) that could be lowered, but the code does not retry. The tests cover the case only with a mocked encoder.
**Fix:** for JPEG and WebP, retry once or twice at a lower quality (for example 0.7 then 0.55) before returning `size`. For PNG, either accept the refusal and make the message say "after it was prepared for upload", or re-encode as JPEG when the PNG has no transparency. This is an owner-visible behaviour choice, so it may be a backlog item rather than a change.

---

_Reviewed: 2026-11-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
