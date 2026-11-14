---
created: 2026-11-13T19:30:00-06:00
updated: 2026-11-13T19:30:00-06:00
phase: quick-261113-tiq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Csps.Domain/Orders/Order.cs
  - src/Csps.Application/Orders/DeleteOrderHandler.cs
  - src/Csps.Application/Orders/RestoreOrderHandler.cs
  - tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs
  - tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs
  - tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs
  - .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md
  - .planning/phases/11-public-site-content-management/11-VERIFICATION.md
autonomous: true
requirements: [ORD-06, GAL-03, PUB-03]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Deleting an order that is shown on the website turns 'Show on the website' off in the same save, keeps the customer's OK with its who and when, removes the order's gallery entry, and adds one order.taken-off-website audit entry (order number only) right after the order.deleted entry (D-P11-BL-29, the same pattern as a cancel, D-41)"
    - "A restore never puts an order back on the website by itself: after a restore the order reads shownOnWebsite false and customerConsent true, it has no gallery entry, and the public gallery cannot list it"
    - "An order deleted before this rule while still shown (shown date and gallery entry left in place) is taken off by its restore: the shown date is cleared, the leftover gallery entry is removed, and one order.taken-off-website entry follows order.restored. No data migration, no schema change"
    - "Staff can turn a restored order back on deliberately, and it joins the gallery again with no clash on the unique index UX_GalleryEntries_OrderId"
    - "Deleting or restoring an order that was not shown never touches the gallery and writes no order.taken-off-website entry"
    - "The delete of a shown order still clears the public cache after the commit, a restore of an order that the delete already took off is not a public change, and a permanent delete of a shown order still clears the cache"
    - "Domain stays at 100% line and branch coverage and Application at 95% line or more, with zero warnings in build, analyzers, format and tests"
  artifacts:
    - path: src/Csps.Domain/Orders/Order.cs
      provides: "SoftDelete and Restore clear ShownOnWebsiteSinceUtc and keep PublicConsentAtUtc and PublicConsentById (D-P11-BL-29)"
    - path: src/Csps.Application/Orders/DeleteOrderHandler.cs
      provides: "Removes the gallery entry of an order the delete took off and records order.taken-off-website after order.deleted"
    - path: src/Csps.Application/Orders/RestoreOrderHandler.cs
      provides: "Removes a leftover gallery entry of an order deleted while shown and records order.taken-off-website after order.restored"
    - path: tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs
      provides: "API proof: delete takes it off, restore leaves it off, staff can show it again, and a row deleted while shown is taken off by its restore"
  key_links:
    - from: src/Csps.Application/Orders/DeleteOrderHandler.cs
      to: src/Csps.Application/Ports/IGalleryEntries.cs
      via: "takenOff = wasShown && !order.IsShownOnWebsite, then FindForOrderAsync and Remove, exactly as ChangeOrderStatusHandler.cs lines 66 to 77"
    - from: src/Csps.Application/Orders/DeleteOrderHandler.cs
      to: src/Csps.Domain/Auditing/AuditActions.cs
      via: "audit.Record(AuditActions.OrderTakenOffWebsite, OrderAuditDetail.OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.PublicSetting(order))"
    - from: src/Csps.Domain/Orders/Order.cs
      to: src/Csps.Infrastructure/Content/PublicContentInvalidationInterceptor.cs
      via: "the order row's shown date had a value when loaded (IsShownOrderWrite) and the GalleryEntry delete is a public record, so the cache clears after the commit with no new code"
---

<objective>
Build owner ruling D-P11-BL-29 (owner, 2026-11-13): deleting (soft-deleting) an order also turns "Show on the website" off, and the customer's OK is kept. A restore therefore never puts the order back on the public gallery by itself; staff must turn it on again on purpose. This mirrors what a cancel already does (D-41).

Decisions the planner made from the code (follow them, do not re-derive):
- **The rule lives in the Domain**, like the cancel rule: `Order.SoftDelete` clears `ShownOnWebsiteSinceUtc` (the cancel branch in `Order.ChangeStatus`, Order.cs line 1359, is the model). `Order.Restore` clears it too, so a row deleted before this rule while still shown is taken off by its restore. This is the safe path that needs no data migration and no schema change (as far as the planning docs show, Phase 11 has not shipped, so production holds no such rows; dev and test databases may).
- **The handlers mirror the cancel handler** (`ChangeOrderStatusHandler.cs` lines 66 to 77 and 88 to 99): capture `wasShown` before the domain call, `takenOff = wasShown && !order.IsShownOnWebsite`, remove the gallery entry when one is found, and record one `order.taken-off-website` entry with `OrderAuditDetail.PublicSetting(order)` (number only, never the customer) after the main entry, in the same save.
- **The gallery entry must go.** `GalleryEntryConfiguration.cs` line 44 makes `OrderId` unique (`UX_GalleryEntries_OrderId`), and `OrderPublicWebsiteWriter.ApplyGalleryAsync` adds a new entry when staff show the order again. A leftover entry would make that save fail. Re-showing joins the gallery at the top, the same as after a cancel and reopen.
- **No cache code.** `PublicContentInvalidationInterceptor.cs` lines 98 to 119 already clears the public cache after the commit when a saved order had a shown date when it was loaded, and when a `GalleryEntry` row is deleted. A restore of an order the delete already took off changes no public row, so it no longer clears the cache; `PublicCacheInvalidationTests` is updated for that.
- **No change** to `PermanentlyDeleteOrderHandler.cs` (its `wasShown` cache call stays correct; the gallery entry cascades), `ChangeOrderStatusHandler.cs`, `PublicGalleryProjection.cs` (the soft-delete join stays as a second guard), the interceptor, the web client or any schema.
- **UI copy:** cancel has no message that tells staff the order left the website (the order card simply reads "Not shown"; `web/src/modules/admin/publicWebsiteCopy.ts` line 26 is about refusing to show a cancelled order). So no copy is added. Task 3 parks the wording as an owner question (P11-BL-63). No words are invented.

Shape: tracer first. Task 1 is the delete path through Domain, Application and the API (with the cache test kept green). Task 2 expands to the restore guard for rows deleted while shown. Task 3 records the outcome. Each code task goes red, then green, then one commit.

Purpose: ORD-06 (delete and restore), GAL-03 (an order's place on the website is only ever set on purpose), PUB-03 (the public site changes at once). Consent behind success criterion 5 and D-11/D-15 holds: nothing goes public without a deliberate step.
Output: two fix commits, one docs commit, and the SUMMARY.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./.claude/CLAUDE.md
@.planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md

## What the planner found in the code (use it, do not re-derive)

- **Domain** (`src/Csps.Domain/Orders/Order.cs`): `ShownOnWebsiteSinceUtc` (line 171, private set), `PublicConsentAtUtc` and `PublicConsentById` (lines 165 to 168), `IsShownOnWebsite` (line 183). `ChangeStatus` (lines 1348 to 1367) clears the shown date on a move to Cancelled. `SoftDelete` (lines 1376 to 1386) and `Restore` (lines 1390 to 1400) only set or clear the delete pair today, return a bool, and never call `Touch`. Keep that: do not add `Touch` or any new branch (Domain branch coverage is 100%).
- **Delete handler** (`src/Csps.Application/Orders/DeleteOrderHandler.cs`): constructor `(IOrders orders, IAuditTrail audit, IUnitOfWork unitOfWork, IRequestContext requestContext, TimeProvider time)`. `AttemptAsync` (lines 42 to 54) finds the order with `includeDeleted: false`, calls `SoftDelete`, then `orders.LockAsync`, records `order.deleted`, saves once.
- **Restore handler** (`src/Csps.Application/Orders/RestoreOrderHandler.cs`): constructor `(IOrders orders, IAuditTrail audit, IUnitOfWork unitOfWork, IRequestContext requestContext)`. `AttemptAsync` (lines 39 to 50) finds with `includeDeleted: true`, calls `Restore`, records `order.restored`, saves once. It never locks; keep it that way.
- **New constructor parameter:** add `IGalleryEntries gallery` right after `IOrders orders` in both handlers (the cancel handler's order of ports). DI needs nothing new: `src/Csps.Server/Composition/OrdersApplicationRegistration.cs` line 71 registers the handlers by type and `IGalleryEntries` is already registered. The only direct construction is the test harness (`OrderDeleteRestoreHandlerTests.cs` lines 291 to 292).
- **Audit pieces:** `AuditActions.OrderTakenOffWebsite` is `order.taken-off-website` (`src/Csps.Domain/Auditing/AuditActions.cs` line 235). `OrderAuditDetail.PublicSetting(order)` gives `number=ORD-...` (`OrderAuditDetail.cs` line 407). The web audit viewer already labels the action ("Order taken off the website", `web/src/modules/admin/auditCopy.ts` line 126).
- **Tests that pin today's behavior and must be replaced:** `tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs` line 365 (the test whose name ends `P11BL29`) and `tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs` line 372 (the same). Both assert that a delete keeps the order shown.
- **Test that the change makes red if left alone:** `tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs` `EveryWriteToAShownOrderClearsThePublicCache` (line 375) runs `RunOrderWritesAsync` (lines 392 to 500). Its "restore" step and its "permanent delete" step act on the order the "delete" step took off, so both would clear nothing.
- **Patterns to copy:**
  - Cancel tests: Domain `OrderPublicSettingsTests.cs` lines 323 to 362 (uses `Shown`, `Admin`, `Manager`, `Basketball`, `Later`, `Latest`, `NewOrder()`); Application `ChangeOrderStatusHandlerTests.cs` lines 162 to 199 (the `Gallery` substitute and its `entryExists` switch at lines 260 to 262, and a shown order at line 323); Server `OrderPublicSettingsEndpointTests.cs` lines 328 to 369 (helpers `SaveAsync`, `PublicBody`, `GalleryEntryCountAsync`, `OrderAuditActionsAsync`, `OrderAuditDetailAsync`, `StoredSettingsAsync`, and `OrderFixtures.DeleteAsync`, `RestoreAsync`, `ReadDetailAsync`).
  - Setting a private domain value in a unit test: `tests/Csps.Domain.UnitTests/Orders/OrderDetailsTests.cs` line 56 and `tests/Csps.Application.UnitTests/Content/GalleryUploadManagementHandlerTests.cs` line 38 (`typeof(X).GetProperty(nameof(X.Y))!.SetValue(...)`).
  - Marking a row deleted straight in the database in an integration test: `tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseAttributionTests.cs` line 270 (`ExecuteUpdateAsync(set => set.SetProperty(...))`, the EF API, not inline SQL). Use `database.CreateContext()` as the class's other helpers do.
- **Harness caveat:** `OrderDeleteRestoreHandlerTests.Harness.Load` (lines 309 to 326) resets the order after a rollback by calling `Restore` and `SoftDelete`, which clear the shown date once this plan lands. Do not combine a shown order with the lost-race tests.
- **Commands:** `dotnet build Csps.slnx`, `dotnet format Csps.slnx --verify-no-changes` (if it reports changes, run `dotnet format Csps.slnx`, then check `git status --short`), `dotnet test --project tests/<Project>`, and `--filter-class "*ClassName"` to narrow an integration run. Database-backed runs take the `CSPS_TEST_SQL=localdb` prefix on the one command. The coverage gate is `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` (Domain 100% line and branch, Application 95% line; unit tests only). Commit subjects read `type(scope): summary`, for example `fix(11): ...`.

## Owner rules for this executor (subagents do not see CLAUDE.md or memory otherwise)

- **Test-driven:** each code task writes the failing tests first, runs them and quotes the failure. Domain and Server tests must fail on their assertions (the right reason, not setup). An Application test may first fail to compile on the new constructor argument; quote that error. Then make the fix and quote the tests green. Zero warnings in build, analyzers, format and tests.
- **Evidence before done:** quote each command's result tail and exit code. If a test fails, re-run it alone before calling it flaky, and record any flake in the SUMMARY. Never claim a pass you did not see.
- **Scope:** no schema change, no migration, no SQL trigger, no inline SQL in application code (EF LINQ and `ExecuteUpdateAsync` only, and only in tests here), no new or bumped package, no web change. Anything that would change behavior beyond D-P11-BL-29 goes to DECISIONS.md as an owner question with 2 to 3 options, the recommendation first and a one-line reason. Never self-approve.
- **Shared machine:** TheBETSLLC (`C:\Work\TheBETSLLC`) runs on this machine and on the same LocalDB. Before every database-backed test run, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:/Work/dev-tools/preflight.ps1 -Ports 5180,5115,7028,5199`, quote it, and wait if a port is in use by another project or TheBETSLLC's test processes are listed. Run only the integration classes named here. Set `CSPS_TEST_SQL=localdb` only as a prefix on the one command, never at User or Machine level. Never touch a `BetsLLC_*` database, the ports 5173, 5023 or 5099, or any process you did not start. No dev server, Playwright or e2e run.
- **No stdin reads:** never run a bare `cat > file`, `read` or an interactive prompt. Use the Write or Edit tool. Leave no background shell running.
- **Comments (OR-2):** minimal, say what the code does, no history narration. No em dash or en dash in code, comments or docs: use a colon, a period or "to".
- **Commits:** stage by path, never `git add -A` or `git add .`. Before each commit, run `gitleaks git --staged --redact --no-banner --config .gitleaks.toml`. Also scan the staged diff for server or database names, connection strings, real emails, machine names and local `C:/Users/<name>` paths. Test data uses the existing fake fixtures only. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push or merge. Do not commit the PLAN, SUMMARY or STATE (the orchestrator does).
- **Markdown:** every markdown file you create or edit carries created and updated timestamps (ISO 8601, offset -06:00). In YAML frontmatter change only `updated:`. Where a `*Created: ... · Updated: ...*` line sits under the title, change only its Updated value. The SUMMARY gets `created:` and `updated:` in its frontmatter.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End to end: a delete takes a shown order off the website and a restore leaves it off (D-P11-BL-29)</name>
  <files>src/Csps.Domain/Orders/Order.cs, src/Csps.Application/Orders/DeleteOrderHandler.cs, tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs, tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs, tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs, tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs</files>
  <precondition>LocalDB's default instance answers: `sqllocaldb info MSSQLLocalDB` reads Running, or `sqllocaldb start MSSQLLocalDB` starts it (never stop or delete the instance); if it cannot start, stop and report.</precondition>
  <read_first>src/Csps.Domain/Orders/Order.cs (lines 150 to 190 and 1336 to 1400), src/Csps.Application/Orders/ChangeOrderStatusHandler.cs, src/Csps.Application/Orders/DeleteOrderHandler.cs, src/Csps.Infrastructure/Content/PublicContentInvalidationInterceptor.cs (lines 98 to 119), tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs (lines 1 to 30 and 320 to 400), tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs, tests/Csps.Application.UnitTests/Orders/ChangeOrderStatusHandlerTests.cs (lines 160 to 200 and 255 to 330), tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs (lines 320 to 560), tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs (lines 25 to 45 and 370 to 520)</read_first>
  <behavior>
    - Domain: SoftDelete on a shown order returns true, IsShownOnWebsite is false and ShownOnWebsiteSinceUtc is null, HasCustomerConsent stays true with PublicConsentAtUtc and PublicConsentById unchanged; a later Restore returns true and the order stays off with the OK kept.
    - Domain: SoftDelete on an order that has the OK but was never shown keeps the OK and stays off.
    - Application: deleting a shown order removes its gallery entry once, records exactly [order.deleted, order.taken-off-website] with the second detail "number=ORD-2026-0148", both after the lock and before the one save, with one commit, and keeps the OK.
    - Application: deleting a shown order whose gallery entry is already gone removes nothing and still records both entries.
    - Application: deleting an order that is not shown makes no call on the gallery (added to the existing single-entry delete test).
    - Server: a Manager shows an order, deletes it (204): the stored shown date is null, the consent date is kept, the gallery entry count is 0, the order's audit has order.deleted and one order.taken-off-website whose detail holds the number. A restore (204) leaves shownOnWebsite false and customerConsent true, the entry count stays 0 and no second order.taken-off-website is written. Saving "Show on the website" again on purpose answers 200, shownOnWebsite true, and the entry count is 1.
    - Server: deleting an order that was never shown writes no order.taken-off-website entry.
    - Cache: in the shown run every step clears the public cache except "restore", which clears nothing because the delete already took the order off; "delete" and "permanent delete" both clear. The never-shown run is unchanged.
  </behavior>
  <action>RED first. Write or change these tests, run them, and quote the failures.
1. Domain, `OrderPublicSettingsTests.cs`: replace the test at line 365 (name ends `P11BL29`) with `DeletingAShownOrderTurnsShowingOffKeepsTheOkAndARestoreDoesNotPutItBack` and add `DeletingAnOrderThatWasNeverShownKeepsItsOkAndStaysOff`, written like the cancel tests at lines 323 to 362 (D-P11-BL-29).
2. Application, `OrderDeleteRestoreHandlerTests.cs`: give the Harness a `Gallery` substitute of `IGalleryEntries` whose `FindForOrderAsync` returns `GalleryEntry.ForOrder(orderId, 0, Now)` or null by an `entryExists` switch (copy `ChangeOrderStatusHandlerTests.cs` lines 260 to 262), and a `shown` switch that, after `AssignNumber`, calls `Order.SetPublicSettings(new OrderPublicSettings(true, true, null, null), CallerId, <one fixed line Guid>, Now)` and asserts success. Pass `Gallery` as the second argument of `new DeleteOrderHandler(...)`. Add `DeleteAShownOrderTakesItOffRemovesItsGalleryEntryAndRecordsTheTakenOffEntryAfterTheDeleteEntryInOneSave` and `DeleteAShownOrderWhoseEntryIsAlreadyGoneRemovesNothingAndStillRecordsTheTakenOffEntry`, and add `harness.Gallery.ReceivedCalls().ShouldBeEmpty()` to `DeleteMarksTheCallerAndTheServerTimeLocksThenRecordsOneEntryThenSavesOnce`. Assert entry order, `LockedBefore`, `SavesBefore` and `Unit.Saves` as that test does.
3. Server, `OrderPublicSettingsEndpointTests.cs`: replace the test at line 372 (name ends `P11BL29`) with `DeletingAShownOrderTakesItOffTheWebsiteRemovesItsEntryKeepsTheOkAndARestoreDoesNotPutItBack` (Manager session, steps and checks as in the behavior list; re-read the detail with `OrderFixtures.ReadDetailAsync` before the deliberate `SaveAsync`, and count the taken-off entries so a restore adds none), and add `DeletingAnOrderThatWasNotShownWritesNoTakenOffEntry` (mirror line 358).
4. Cache, `PublicCacheInvalidationTests.cs`: in `RunOrderWritesAsync`, right after the "restore" step and only when `shown` is true, put the order back on the website with `SavePublicAsync(client, token, await LatestAsync(), consent: true, show: true, name: "Display Name")` outside `StepAsync`, so "permanent delete" still acts on a shown order. In `EveryWriteToAShownOrderClearsThePublicCache`, assert the steps with zero clears are exactly ["restore"], with a reason string saying the delete already took the order off the website (D-P11-BL-29) so a restore is not a public change. Leave the never-shown test as it is.
Run the Domain project, the Application project (a compile error on the new argument is acceptable RED) and, after the preflight, the two Server classes. Quote the failures.

GREEN.
5. `Order.SoftDelete`: after setting the delete pair, set `ShownOnWebsiteSinceUtc` to null. Add one sentence to its summary: the delete also takes the order off the website and keeps the customer's OK, so a restore never puts it back by itself (D-P11-BL-29, as a cancel does, D-41). No new branch, no `Touch`.
6. `DeleteOrderHandler`: add `IGalleryEntries gallery` after `IOrders orders`. In `AttemptAsync`, capture `wasShown` from the loaded order before `SoftDelete` (keep the existing 404 for a null or already deleted order), set `takenOff = wasShown && !order.IsShownOnWebsite`, and when `takenOff` and `FindForOrderAsync` returns an entry, call `gallery.Remove(entry)` before `LockAsync` (the cancel path's order). After the lock, record `order.deleted` as today, then, when `takenOff`, `audit.Record(AuditActions.OrderTakenOffWebsite, OrderAuditDetail.OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.PublicSetting(order))`, then the one save. Add one sentence to the class summary naming D-P11-BL-29 and the taken-off entry. No cache call (the interceptor clears it after the commit).
Run the verify command and quote it green. Run `dotnet format Csps.slnx` if it reports changes, then `git status --short` to confirm only this task's six files changed. Stage the six files by path, run gitleaks and the staged-diff scan, and commit as `fix(11): take a shown order off the website when it is deleted (D-P11-BL-29)`.</action>
  <verify>
    <automated>dotnet build Csps.slnx && dotnet format Csps.slnx --verify-no-changes && dotnet test --project tests/Csps.Domain.UnitTests && dotnet test --project tests/Csps.Application.UnitTests && powershell -NoProfile -ExecutionPolicy Bypass -File C:/Work/dev-tools/preflight.ps1 -Ports 5180,5115,7028,5199 && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderPublicSettingsEndpointTests" --filter-class "*PublicCacheInvalidationTests" --filter-class "*OrderDeletionTests"</automated>
  </verify>
  <done>The RED run was quoted: the Domain and Server tests failed on the shown date and the gallery entry count, the cache test failed on the restore and permanent delete steps, and the Application project failed on the new argument. After the fix the verify command passes with zero warnings, and after staging and before the commit the staged lines hold no em or en dash (capture `D=$(git diff --cached -U0)` first, then `printf '%s\n' "$D" | grep '^+' | LC_ALL=C grep -cP '\xE2\x80[\x93\x94]'` prints 0). One commit holds the six files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: A restore takes off an order that was deleted while still shown (D-P11-BL-29, no data migration)</name>
  <files>src/Csps.Domain/Orders/Order.cs, src/Csps.Application/Orders/RestoreOrderHandler.cs, tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs, tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs, tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs</files>
  <read_first>src/Csps.Application/Orders/RestoreOrderHandler.cs, tests/Csps.Domain.UnitTests/Orders/OrderDetailsTests.cs (lines 50 to 70), tests/Csps.Application.UnitTests/Content/GalleryUploadManagementHandlerTests.cs (lines 30 to 40), tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseAttributionTests.cs (lines 262 to 275), the Task 1 commit</read_first>
  <behavior>
    - Domain: an order soft-deleted and then given a shown date by reflection (the state a delete saved before this rule left) restores with true, IsShownOnWebsite false, ShownOnWebsiteSinceUtc null, and the OK with its who and when kept.
    - Domain: Restore on a live shown order returns false and leaves it shown (a restore that does nothing changes nothing).
    - Application: restoring such an order removes its leftover gallery entry once and records exactly [order.restored, order.taken-off-website] with the second detail "number=ORD-2026-0148", before the one save.
    - Application: restoring a deleted order that is not shown makes no call on the gallery (added to `RestoreClearsTheMarkAndRecordsOneEntryBeforeTheSingleSave`).
    - Server: a Manager shows an order (entry count 1), the test marks it deleted straight in the database with `ExecuteUpdateAsync` (DeletedAtUtc now, DeletedById the Manager's user id), so the shown date and the entry stay. A restore (204) gives shownOnWebsite false and customerConsent true, the stored shown date is null, the entry count is 0, and the audit has order.restored and order.taken-off-website with the number. Saving "Show on the website" again on purpose answers 200 and the entry count is 1.
  </behavior>
  <action>RED first.
1. Domain, `OrderPublicSettingsTests.cs`: add `RestoringAnOrderDeletedWhileStillShownTurnsShowingOffAndKeepsTheOk` (after `SoftDelete`, set `ShownOnWebsiteSinceUtc` to `Later` with `typeof(Order).GetProperty(nameof(Order.ShownOnWebsiteSinceUtc))!.SetValue(...)`, as `OrderDetailsTests.cs` line 56 does) and `RestoringALiveShownOrderChangesNothing`.
2. Application, `OrderDeleteRestoreHandlerTests.cs`: pass `Gallery` as the second argument of `new RestoreOrderHandler(...)`. Add `RestoreOfAnOrderDeletedWhileStillShownRemovesTheLeftOverEntryAndRecordsTheTakenOffEntryAfterTheRestoreEntry` (use `StartDeleted()`, then set the shown date by reflection; keep it out of the lost-race tests, see the harness caveat), and add `harness.Gallery.ReceivedCalls().ShouldBeEmpty()` to `RestoreClearsTheMarkAndRecordsOneEntryBeforeTheSingleSave`.
3. Server, `OrderPublicSettingsEndpointTests.cs`: add `RestoringAnOrderDeletedWhileStillShownTakesItOffRemovesTheLeftOverEntryAndKeepsTheOk` as in the behavior list. Mark it deleted through `database.CreateContext()` and `ExecuteUpdateAsync` on `context.Orders` (EF API only, no SQL text).
Run them and quote the failures (Domain and Server on the shown date and entry count; Application may fail to compile on the new argument).

GREEN.
4. `Order.Restore`: after clearing the delete pair, set `ShownOnWebsiteSinceUtc` to null, inside the existing guard so a call on a live order still changes nothing. Add one sentence to its summary: a restore never puts the order back on the website and keeps the customer's OK; it also clears a shown date left by a delete saved before D-P11-BL-29. No new branch.
5. `RestoreOrderHandler`: add `IGalleryEntries gallery` after `IOrders orders`. In `AttemptAsync`, capture `wasShown` before `Restore` (keep the 404), set `takenOff = wasShown && !order.IsShownOnWebsite`, remove the entry when `takenOff` and one is found, record `order.restored` as today, then, when `takenOff`, the same `order.taken-off-website` record as Task 1, then the one save. Add no lock. Add one sentence to the class summary naming D-P11-BL-29.
Run the verify command (it includes the coverage gate and the architecture tests) and quote it green. Run `dotnet format Csps.slnx` if needed and check `git status --short`. Stage the five files by path, run gitleaks and the staged-diff scan, and commit as `fix(11): a restore takes off an order that was deleted while shown (D-P11-BL-29)`.</action>
  <verify>
    <automated>dotnet build Csps.slnx && dotnet format Csps.slnx --verify-no-changes && dotnet test --project tests/Csps.Domain.UnitTests && dotnet test --project tests/Csps.Application.UnitTests && dotnet test --project tests/Csps.ArchitectureTests && powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1 && powershell -NoProfile -ExecutionPolicy Bypass -File C:/Work/dev-tools/preflight.ps1 -Ports 5180,5115,7028,5199 && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderPublicSettingsEndpointTests" --filter-class "*PublicCacheInvalidationTests" --filter-class "*OrderDeletionTests" --filter-class "*OrderAuditViewerTests"</automated>
  </verify>
  <done>The RED run was quoted. After the fix the verify command passes with zero warnings, the coverage gate reports Domain 100% line and branch and Application 95% line or more (quote both figures), and after staging and before the commit the staged lines hold no em or en dash (capture `D=$(git diff --cached -U0)` first, then `printf '%s\n' "$D" | grep '^+' | LC_ALL=C grep -cP '\xE2\x80[\x93\x94]'` prints 0). One commit holds the five files.</done>
</task>

<task type="auto">
  <name>Task 3: Record P11-BL-29 as built and park the wording question</name>
  <files>.planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md, .planning/phases/11-public-site-content-management/11-VERIFICATION.md</files>
  <read_first>.planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md (lines 1 to 6, 265 to 275 and 620 to 640), .planning/phases/11-public-site-content-management/11-VERIFICATION.md (lines 1 to 6, 134 to 142 and 320 to 330), the Task 1 and Task 2 commits</read_first>
  <action>1. DECISIONS.md, section P11-BL-29 (line 265): change the status line to `**Status:** decided: A (owner, 2026-11-13) · built in quick 261113-tiq · **Blocks:** nothing.` Keep the ruling paragraph word for word. Replace the sentence "The run leaves restore as it is and finishes everything else." with a short "Built in quick 261113-tiq:" paragraph in plain words: a delete now turns "Show on the website" off and keeps the customer's OK; the order leaves the gallery and the audit log gets an "Order taken off the website" entry next to the delete; a restore never puts it back, and it also takes off an order deleted before this change while still shown, with no data migration; staff turn it on again from the order page and it joins the gallery at the top, the same as after a cancel. Name the two commit short hashes.
2. DECISIONS.md: add a new item before `## Flakes seen in the post-merge gates`, headed `## P11-BL-63 · Words about the website when an order is deleted or restored (quick 261113-tiq)`, with `**Status:** open · **Blocks:** nothing. Built as option A.` Say in plain words that today the delete question reads "It counts nowhere until it's restored." and the restore message reads "{number} counts in lists and totals again.", and neither says the order is off the website; a cancel has no such message either, and after a restore the order page's Public website card reads "Not shown". Options: **A (recommended):** add no new words, because the order card already shows "Not shown", the same as after a cancel. **B:** you give the words for the restore message and, if you want, the delete question, and a small task adds them. Do not write any proposed wording yourself.
3. DECISIONS.md: change only the Updated value on the `*Created: ... · Updated: ...*` line to the current time (offset -06:00).
4. 11-VERIFICATION.md, the `human_verification` entry for P11-BL-29 (lines 137 to 139): keep `test` and `expected`; rewrite `why_human` to say it is answered: ruled A as D-P11-BL-29 (owner, 2026-11-13) and built in quick 261113-tiq, a delete turns "Show on the website" off and keeps the customer's OK, a restore never puts the order back by itself (and takes off one deleted while still shown), so nothing is left for the owner on this item. Keep the YAML valid (one line, double quotes, single quotes inside).
5. 11-VERIFICATION.md, body section `### 5. Ruling on P11-BL-29`: change the **Why human:** sentence "Today a restore puts a shown order back on the website by itself." to past tense ("Before the ruling, a restore put a shown order back on the website by itself.") and add a line `**Result:** ruled A as D-P11-BL-29 (owner, 2026-11-13); built in quick 261113-tiq.` Do not change `status`, `score` or any other item. Change only `updated:` in the frontmatter.
Run the verify command before the commit (it reads the change against HEAD) and quote it green, then stage the two files by path, run gitleaks and the staged-diff scan, and commit as `docs(11): record that D-P11-BL-29 is built and park the delete and restore wording`.</action>
  <verify>
    <automated>test "$(grep -c 'built in quick 261113-tiq' .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md)" -ge 1 && test "$(grep -c '^## P11-BL-63 ' .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md)" -eq 1 && test "$(grep -c '261113-tiq' .planning/phases/11-public-site-content-management/11-VERIFICATION.md)" -ge 2 && D=$(git diff HEAD -U0 -- .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md .planning/phases/11-public-site-content-management/11-VERIFICATION.md) && test -n "$D" && test "$(printf '%s\n' "$D" | grep '^+' | LC_ALL=C grep -cP '\xE2\x80[\x93\x94]')" -eq 0 && git status --short</automated>
  </verify>
  <done>P11-BL-29 reads decided and built in quick 261113-tiq with both commit hashes, P11-BL-63 is parked with options A and B and no invented wording, the verification item 5 and its YAML entry record the result, both files have a new updated time and nothing else in them changed, and one docs commit holds the two files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Staff to API | Authenticated Admin or Manager deletes and restores orders (existing default-deny policies; unchanged) |
| Database to public site | The public gallery reads shown orders; a visitor sees whatever the stored shown date and gallery entry allow |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-tiq-01 | Information disclosure | Order.Restore, RestoreOrderHandler | high | mitigate | A restored order could reappear on the public gallery with no deliberate step. SoftDelete and Restore clear the shown date in the Domain, both handlers remove the gallery entry, and the Server tests prove a restore leaves shownOnWebsite false with no entry (D-P11-BL-29, D-11). |
| T-tiq-02 | Repudiation | DeleteOrderHandler, RestoreOrderHandler | medium | mitigate | Taking an order off by delete or restore is recorded as one order.taken-off-website entry in the same save, after the main entry, as a cancel does (D-41); tests pin the order of the entries. |
| T-tiq-03 | Information disclosure | Audit detail | low | mitigate | The new entries reuse OrderAuditDetail.PublicSetting, which holds the order number only and never the customer (AUDIT-01). |
| T-tiq-04 | Denial of service | Re-showing a restored order | medium | mitigate | A leftover gallery entry would clash with UX_GalleryEntries_OrderId when staff show the order again. Both handlers remove it, and the Server tests show the order again after a restore and expect 200 and one entry. |
| T-tiq-05 | Information disclosure | Public cache after a delete | medium | mitigate | The existing interceptor clears the cache after the commit (the order row had a shown date when loaded, and a GalleryEntry is deleted); the PublicCacheInvalidationTests delete step proves it. |
| T-tiq-06 | Information disclosure | Test and docs files | low | mitigate | Tests reuse the fake fixtures. gitleaks and the staged-diff scan run before each commit, and no real name, email, server or local path enters a tracked file. |
| T-tiq-SC | Tampering | NuGet and npm installs | high | mitigate | No install task exists. The executor adds, bumps or restores no package beyond the locked set and stops to report if one seems needed. |
</threat_model>

<verification>
- Task 1 and Task 2 verify commands pass with zero warnings, and the coverage gate quotes Domain 100% line and branch and Application 95% line or more.
- `git log --oneline -3` shows the three commits, and `git status --short` shows no stray tracked change from this run.
- No dev server, Playwright, e2e, schema, migration, package or web change was made.

## Source coverage audit

| Source | Item | Covered by |
|---|---|---|
| GOAL | D-P11-BL-29: a delete turns "Show on the website" off, the OK stays, a restore never puts it back | Task 1 (delete path), Task 2 (restore guard) |
| CONTEXT | D-41: mirror the cancel rule (Domain rule, gallery entry removed, taken-off audit entry) | Tasks 1 and 2 |
| CONTEXT | D-11: the customer's OK is kept | Tasks 1 and 2 (consent asserted in every layer) |
| CONTEXT | D-15: a delete removes the order from the public site at once (cache) | Task 1 (cache test; existing interceptor) |
| CONTEXT | Rows deleted while shown before the rule: restore forces it off, no data migration | Task 2 |
| CONTEXT | UI copy only if cancel has an equivalent, else an owner question | Task 3 step 2 (P11-BL-63) |
| CONTEXT | Owner rules: TDD, zero warnings, no schema, migration, trigger, inline SQL or package, coverage, shared machine, stage by path, gitleaks | Owner rules block, Tasks 1 and 2 verify |
| CONTEXT | Final task marks P11-BL-29 built and updates the 11-VERIFICATION restore item | Task 3 steps 1, 4 and 5 |
| REQ | ORD-06 (delete and restore) | Tasks 1 and 2 |
| REQ | GAL-03 (an order is published only on purpose) | Tasks 1 and 2 |
| REQ | PUB-03 (public changes show at once) | Task 1 |
| RESEARCH | none (quick task, no research phase) | not applicable |
</verification>

<success_criteria>
- Deleting a shown order takes it off the website and out of the gallery in the same save, keeps the customer's OK, and writes one order.taken-off-website entry after order.deleted.
- A restore never puts an order back on the website, including an order deleted while shown before this change, and staff can show it again on purpose without an error.
- Orders that were never shown behave exactly as before.
- Domain 100%, Application 95% or more, zero warnings, and no schema, migration, package or web change.
- P11-BL-29 is recorded as built, the verification item records the result, and the wording question is parked as P11-BL-63 without invented words.
</success_criteria>

<output>
Create `.planning/quick/261113-tiq-deleting-an-order-turns-show-on-the-webs/261113-tiq-SUMMARY.md` when done. Give it `created:` and `updated:` (offset -06:00), the three commit hashes, each quoted RED and GREEN result, the coverage figures, any flake, and the "Open for the owner" item P11-BL-63.
</output>
