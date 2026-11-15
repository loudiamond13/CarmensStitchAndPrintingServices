---
phase: 11-public-site-content-management
created: 2026-11-13T07:20:00-06:00
updated: 2026-11-15T00:12:00-06:00
review_path: .planning/phases/11-public-site-content-management/11-REVIEW.md
iteration: 1
review_pass: 3
findings_in_scope: 9
fixed: 9
skipped: 0
owner: 0
deferred: 0
status: all_fixed
second_pass:
  findings_in_scope: 11
  fixed: 11
  skipped: 0
  owner: 0
  deferred: 0
  status: all_fixed
first_pass:
  findings_in_scope: 48
  fixed: 29
  skipped: 0
  owner: 7
  deferred: 12
  elsewhere: 0
  status: partial
---

# Phase 11: Code review fix report

*Created: 2026-11-13T07:20:00-06:00 · Updated: 2026-11-15T00:12:00-06:00*

This file holds three passes. The third pass (1 warning and 8 info items from the third review) is first. The second pass (11 warnings from the second review) follows, then the first pass (48 findings), both unchanged.

## Third pass

**Fixed at:** 2026-11-14T23:59:00-06:00
**Source review:** `.planning/phases/11-public-site-content-management/11-REVIEW.md` (third review pass, diff base `32723645`: 0 critical, 1 warning, 8 info). The scope was all findings.
**Iteration:** 1 (review pass 3)
**Where the work and the checks ran:** in an isolated git worktree (its own `web/node_modules` from `npm ci --ignore-scripts`, its own `bin` and `obj`), on a temporary branch. The 7 commits were then fast-forwarded onto `gsd/phase-11-public-site-content-management`, and the worktree, the temporary branch and the recovery marker were removed. Nothing was pushed or merged. .NET tests ran against `(localdb)\MSSQLLocalDB` with `CSPS_TEST_SQL=localdb` set for those processes only. The preflight check was clean before the first test run and again at the end (no port in use, no dev or test process left running).

### Summary

| Outcome | Count | Findings |
|---|---|---|
| Fixed | 9 | WR-3-01, IN-3-01, IN-3-02, IN-3-03, IN-3-04, IN-3-05, IN-3-06, IN-3-07, IN-3-08 |
| Skipped | 0 | |
| Owner item (question for you) | 0 | |
| Deferred | 0 | |
| Total in scope | 9 | |

No package was added or bumped. No schema change, migration, trigger or inline SQL. No em dash or en dash was added to the diff. Every commit was scanned staged with `gitleaks protect --staged --no-banner --redact`: no leaks, and a look at each staged diff found no real server or database names, connection strings, emails or local paths. No Playwright spec was run (see Checks). No finding is a logic change that needs a human to confirm the rule, but the e2e changes (IN-3-04, IN-3-07) are marked "not run" below.

### Outcome of every finding

| Id | Outcome | Commit | What was done |
|---|---|---|---|
| WR-3-01 | Fixed | `af453d1b` | `ChangingAProductLineTitleShowsOnTheNextLinesReadWithANewETagAndTheOldETagGetsNo304` now starts with `database.ResetAsync()` and `ProductLineSeeding.RestoreSixAsync(database)`, like its neighbours. **No red was seen:** the failure depends on the order tests run in, and I could not make it fail in three whole-class runs before the change (14 of 14 each time). After the change the whole class passes, 14 of 14. The fix removes the cause the review named (the first line depends on what an earlier test left). |
| IN-3-01 | Fixed | `1de20ee8` | `TestingDatabaseGuard` now uses a case-sensitive pattern ending in `\z`, with the guid part spelled out as 8-4-4-4-12 lowercase hex: `^(CSPS_E2E\|CSPS_Test_<8-4-4-4-12 hex>)\z`. `csps_e2e`, capitals in the guid, a final newline and 36 hyphens are all refused now. A comment says the per-test form must match `TestDatabaseName` in `tests/Csps.Testing`. |
| IN-3-02 | Fixed | `1de20ee8` (same commit) | New `TestingDatabaseGuardTests` in `tests/Csps.Infrastructure.IntegrationTests/Content/` (Debug builds only, no database needed). Two accepted names (`CSPS_E2E` and a lowercase-guid `CSPS_Test_` name) and 14 refused ones (`CSPS_Dev`, `CSPS_Legacy_Restore`, `BetsLLC_Dev`, `BetsLLC_E2E`, `CSPS_E2E_Copy`, `csps_e2e`, `CSPS_E2E` plus a newline, the guid in capitals, in lowercase `csps_test_`, with a newline, with 36 hyphens, `CSPS_Test_not-a-guid`, empty and null). I put it in the Infrastructure test project because that project references the guard directly. Red: written first, 6 of 16 failed on the old pattern (the capitals, newline and hyphen cases). Green: 16 of 16. |
| IN-3-03 | Fixed after the owner's answer (D-125, spec not run) | `eb986cf7` | The owner chose option 1. The site content lock wait in `web/e2e/site-content-lock.ts` is now 6 minutes, so setup keeps 2 of the 8 minute budget. A new vitest check reads the wait from the lock file and fails if less than 2 minutes are left. Red: it failed on the 7 minute wait. Green: the two vitest scripts 7 of 7. eslint, Prettier and `npm run typecheck` clean. Comments in `contact.spec.ts` and `site-content-lock.ts` and the e2e guide now say 6 minutes. |
| IN-3-04 | Fixed (spec not run) | `99e05c68` | `public.spec.ts` and `fixture-selftest.spec.ts` no longer have the file-wide 480 s timeout. Their `beforeEach` adds 8 minutes to the test timeout only while `isDemoSeeded()` is false (new export in `site-content-lock.ts`), so only the first test of a worker gets the long budget. `web/scripts/e2e-lock-timeouts.test.ts` accepts this form for a file that calls `ensureDemoSiteContent` and rejects a hook with no extension or an extension under 8 minutes (one new test). Red: not shown for the old specs, because the old file-wide form also passes the check; the new test covers the new form, with a hook that adds 60 s failing. Green: the two vitest scripts 6 of 6. The two specs were typechecked and linted only. I did not restore the old 90 s and 120 s per-test caps, because the review did not ask for them. |
| IN-3-05 | Fixed | `16732b9b` | In the three tab test files, the "keeps the same key" tests (move and Hide in each tab, plus the Products "lost move does not drop a lost Hide's key" test) no longer sleep 50 ms. The backend renames another row during the failed call, and the test waits until that new name shows in the table before it presses again. The new name only reaches the screen after the tab has handled the read-again result (the handler runs as a microtask when the fetch ends, and React draws the data a timer later), so a wrong early reset can no longer slip past. Added one positive Hide test per tab: a lost Hide that the list then shows as already done, then the line or row is shown again by someone else and a failed move on another row makes the tab read the list, then Hide is pressed again and must send a new key. (Pressing Show right after would not prove anything, because changed data already gets a new key.) Mutation checks, run on each tab file and reverted: with the early-reset change (`reset()` before the read-again result is checked), 3 tests failed in Products, 2 in Testimonials and 2 in Gallery; with the toggle comparison forced to false, the new positive Hide test failed in all three tabs (1 failure each). Green: the three tab files and `src/test`, 15 files, 354 of 354. |
| IN-3-06 | Fixed | `945c75bf` | `UploadSlotsCoverageTests` now finds a file in a direct parameter, an array or generic argument (`List<IFormFile>`, `IEnumerable<IFormFile>`), and in the properties of our own form model types (cycles guarded, primitives and `string` skipped). The count of 5 stays. A new theory of 12 rows tests the finder itself (direct, collection, array, list, enumerable, a model with a file property, a model with a list of files, a self-referencing model with none, `string`, `int`, `CancellationToken`, `List<string>`). Green: 15 of 15 in the class. No red (the finder and its tests were written together). |
| IN-3-07 | Fixed (spec not run) | `6b7d19b4` | The form test reads the create answer as `{ id?: string }` and sets `id = body.id ?? null`, so `deleteOrderQuietly` is never called with `undefined`. Typechecked and linted only. |
| IN-3-08 | Fixed | `6757cd1b` | `docs/web/e2e.md` (shared site content section) now names `ensureDemoSiteContent` (once-per-worker seed under the lock, for specs that only read public pages), the 8-minute rule (extension for the first test, `test.setTimeout(480_000)` for tests that take the lock, and the vitest check) and `deleteOrderQuietly` (best-effort cleanup in `finally`). `updated:` bumped, `created:` untouched. |

### Owner item: IN-3-03, the 8 minute test budget has little room over the 7 minute lock wait

**Answered:** option 1, lower the wait to 6 minutes (D-125, owner, 2026-11-15). Applied in `eb986cf7`.

**What it is:** a lock-taking order test first signs in, creates an order and uploads a photo (this can wait up to 4 minutes for the photo host lock), and only then waits up to 7 minutes for the site content lock. If both locks are busy near their limits, setup plus the wait can go past 8 minutes, so the test stops with a generic "Test timeout" and not the clear "site content lock was not free" message. It is rare, and a lock that slow fails the test either way. Every way to fix it changes how long tests may wait, so it is your call. I changed nothing.

1. **Recommended: lower the site content lock wait from 7 to 6 minutes** (one number in `web/e2e/site-content-lock.ts`, and the vitest check follows it). Reason: it needs no new code, and the clear message wins over the generic one. The cost: under heavy load a waiter gives up a minute sooner. That 7 minutes was raised from 4 on purpose in the first pass (WR-F-02), so a sweep holding the lock may need it.
2. Raise the test budget from 8 to 10 minutes for the lock-taking tests (and the file-wide and hook values, and the vitest check). Reason: keeps the 7 minute wait, and costs only a longer wait before a stuck test is reported.
3. Make the lock wait stop when the test ends (pass an abort signal from the test into `acquire`). Cleanest, but it changes the shared lock code in `photo-host-lock.ts` and every caller, and I cannot run the specs here to prove it.

### Checks (third pass)

Everything below ran in the isolated worktree (see the top). Last code commit: `16732b9b`.

| Check | Result |
|---|---|
| `dotnet test` `Csps.Server.IntegrationTests`, `PublicCacheInvalidationTests` (before the fix, run three times) | 14 of 14 each time. The order dependence did not show. |
| `dotnet test` `Csps.Server.IntegrationTests`, `PublicCacheInvalidationTests` (after WR-3-01) | 14 of 14, no warnings. |
| `dotnet test` `Csps.Infrastructure.IntegrationTests`, `TestingDatabaseGuardTests` | Red 6 of 16 on the old pattern. Green 16 of 16. |
| `dotnet test` `Csps.Server.IntegrationTests`, `TestingSiteContentTests` (after the guard change) | 17 of 17. |
| `dotnet test` `Csps.Server.IntegrationTests`, `UploadSlotsCoverageTests` | 15 of 15 (3 before, 12 new rows). |
| .NET build warnings | None. The three Debug test builds succeeded with warnings as errors. The full solution and the Release build were not built. |
| vitest: `scripts/e2e-lock-timeouts.test.ts` and `scripts/e2e-cleanup.test.ts` | 2 files, 6 of 6. |
| vitest: `ProductLinesTab`, `TestimonialsTab`, `GalleryTab` and `src/test` | 15 files, 354 of 354 (351 before, 3 new). |
| `npm run typecheck` in `web/` (three `tsc` projects) | No errors. |
| eslint with `--max-warnings 0` on every web file changed | Exit 0, no output. |
| `prettier --check` on every web file changed | All pass. The whole `e2e` folder shows 4 older files that Prettier would reformat (`gallery.spec.ts`, `link-preview.spec.ts`, `public-sweep.spec.ts`, `site-content-sweep.spec.ts`). None was touched here. |
| Playwright (`public.spec.ts`, `fixture-selftest.spec.ts`, `order-public-website.spec.ts`) | **Not run**, as instructed. IN-3-04 and IN-3-07 are covered by typecheck, lint and the vitest source check only. Please run them once before the phase ships. |
| Full `dotnet test` and the full web vitest run | **Not run** (targeted runs only). |
| `gitleaks protect --staged` before each of the 7 commits | No leaks. |

---

## Second pass

**Fixed at:** 2026-11-14T23:05:00-06:00
**Source review:** `.planning/phases/11-public-site-content-management/11-REVIEW.md` (second review pass, diff base `b6796ce5`: 0 critical, 11 warning, 16 info). The owner asked for all 11 warnings. Info items were out of scope.
**Iteration:** 1 (review pass 2)
**Where the work and the checks ran:** in an isolated git worktree (its own `web/node_modules` from `npm ci --ignore-scripts`, its own `bin` and `obj`), on a temporary branch. The 11 commits were then fast-forwarded onto `gsd/phase-11-public-site-content-management`, and the worktree, the temporary branch and the recovery marker were removed. Nothing was pushed or merged. Tests ran against `(localdb)\MSSQLLocalDB` with `CSPS_TEST_SQL=localdb` set for those processes only. The preflight check was clean before the first test run and before every Playwright run, and it shows no process left running at the end.

### Summary

| Outcome | Count | Findings |
|---|---|---|
| Fixed (one commit each) | 11 | WR-A2-01, WR-A2-02, WR-B2-01, WR-B2-02, WR-B2-03, WR-B2-04, WR-C2-01, WR-C2-02, WR-C2-03, WR-C2-04, WR-D2-01 |
| Skipped | 0 | |
| Owner item (question for you) | 0 | |
| Deferred | 0 | |
| Total in scope | 11 | |

WR-D2-01 changes state handling (when a repeat press gets a new key), so it is marked **fixed: requires human verification** below. No package was added or bumped. No schema change, migration, trigger or inline SQL. The new database guard reads the name from the connection of the EF context. No em dash or en dash was added anywhere in the diff. Every commit was scanned staged with `gitleaks git --staged --no-banner --redact`: no leaks.

### Outcome of every warning

| Id | Outcome | Commit | What was done |
|---|---|---|---|
| WR-A2-01 | Fixed | `ead1993c` | `docs/api/orders.md`: the delete row says the order is taken off at once (shown flag off, gallery entry removed, public cache cleared, customer's OK kept). The restore row says a restore never shows the order again (D-P11-BL-29) and that a legacy order deleted while still shown is taken off by the restore. The audit paragraph says a shown order also writes one `order.taken-off-website` entry after `order.deleted` or `order.restored`, so a client sees two entries. `docs/operations/audit-log.md` had the same gap, so its two order rows say the same. `updated:` bumped in both files, `created:` untouched. |
| WR-A2-02 | Fixed | `56a2347f` | New `TestingDatabaseGuard` (Infrastructure, Debug builds only). `TestingSiteContentSeeder.ResetAsync` throws `InvalidOperationException` unless the context's connection names `CSPS_E2E` or a name matching `^CSPS_Test_[0-9a-f-]{36}$` (read with `context.Database.GetDbConnection().Database`, which opens nothing and runs no SQL). The route checks first and answers **403** in plain words ("The demo reset only runs on the end-to-end test database (CSPS_E2E) or a per-test database (CSPS_Test_<guid>). This host is connected to another database, so nothing was changed."). The message never repeats the database name. `docs/web/e2e.md` says so. Red: 4 new theory rows failed with a 500 (of 17 in `TestingSiteContentTests`). Green: 17 of 17. The four refused names are made-up ones that do not exist, so no real database was reachable even if the guard had failed. |
| WR-B2-01 | Fixed by replacing the assertions (nothing removed outright) | `2b120328` | The two "no orphan" counts could never fail because both foreign keys are `Restrict`. They are replaced by checks the database does not enforce: a created upload or stored photo means the delete answered 422, the line still exists and the row count went up by one; a refused upload means the line is gone and the row count did not move. The edit race checks the upload moved to the new line (200 and 422) or stayed on its old line (400 and 204). Test-only. Green: both race tests pass (2 of 2). No red is possible for a check that agrees with correct behavior. |
| WR-B2-02 | Fixed | `cf9fb66f` | `UploadSlotsCoverageTests` now selects every controller action that takes an `IFormFile` or `IFormFileCollection` (public instance methods, inherited included) and requires both `[EnableRateLimiting(ImageUpload)]` and `[UploadSlot]`, on the action or its controller. The count of 5 stays. Mutation check: with both attributes removed from the share picture action, the test failed and named `SharePictureController.UploadSharePicture` (the old test could not see it). Green: 3 of 3. |
| WR-B2-03 | Fixed | `f60d76cd` | Two new tests in `PublicCacheInvalidationTests` build the legacy state (order deleted but still shown, gallery entry in place, written with `ExecuteUpdate` so no interceptor ran) and restore through the API. One uses the counting cache and asserts clears greater than 0. The other uses the real cache: it reads the public gallery first (so it is cached), restores, and asserts the next public read no longer lists the order. Green: 3 of 3 with the existing legacy endpoint test. No red: the production behavior was already right. Not mutation-checked: removing only the order write rule would not fail the first test, because removing the gallery entry also clears the cache. |
| WR-B2-04 | Fixed | `54483c12` | The stub's `GalleryShareImageUrl` is now hostile (`/</script><script>alert(1)</script>`) for every row, and the `/gallery` row asserts the exact encoded `og:image` tag, the decoded round trip, the large card, and the two closing script tags. Mutation check: with the HTML encoding switched off in `PublicHeadWriter.AppendMeta`, the `/gallery` row failed. Green: 3 of 3. |
| WR-C2-01 | Fixed | `56160be4` | The four lock-taking tests in `order-public-website.spec.ts` now use `test.setTimeout(480_000)`. The non-lock tests stay at 240 s. A new vitest check (`web/scripts/e2e-lock-timeouts.test.ts`) scans every e2e spec and fails when a test that takes the site content lock has less than 8 minutes (or a file-wide `describe.configure` timeout under that). Red: 11 offenders (the 4 order tests and 7 tests in `contact.spec.ts`). Green: 2 of 2. **One addition beyond the review:** `contact.spec.ts` took the lock in every test with only the 30 second default, so it now has `test.describe.configure({ timeout: 480_000 })`, the same line `home`, `gallery` and `products` already have. I did not touch `waitLimitMs`. |
| WR-C2-02 | Fixed | `069d7f9c` | The New Order form test starts waiting for the `POST /api/v1/orders` answer before the click, clicks inside the `try`, reads the new id from the answer, checks the URL, and deletes only when an id was seen (no more `DELETE /api/v1/orders/`). The response is `{ id }` like the create fixtures. Verified by running the spec: see Checks. |
| WR-C2-03 | Fixed | `9ebe4a54` | New `deleteOrderQuietly(page, id)` in `web/e2e/photos.ts`: it calls `deleteOrderThroughApi`, catches any failure and pushes a `cleanup` annotation (`Order <id> was not deleted: ...`) on the test, and never rethrows. All `finally` blocks in `order-public-website.spec.ts` use it. In `site-content-sweep.spec.ts` the two deletes are now independent and the demo reset runs after both (the nested `try` is gone because neither delete can throw). A new vitest check (`web/scripts/e2e-cleanup.test.ts`) fails when those two specs call the throwing delete inside a `finally`. Red: 2 of 3 failed. Green: 3 of 3. I did not add the "reset removes ORD-208x orders" option the review called stronger. |
| WR-C2-04 | Fixed by seeding under the lock (it was workable) | `9854b61b` | New `ensureDemoSiteContent(request)` in `web/e2e/site-content-lock.ts`: the first call in a worker takes the site content lock and runs the demo reset, later calls do nothing. `public.spec.ts` and `fixture-selftest.spec.ts` call it from `beforeEach` and have `test.describe.configure({ timeout: 480_000 })` (the lock can take 7 minutes). Their per-test `setTimeout` overrides (90 s, 120 s) were removed because they would cut that budget. The lock timeout check also covers a file that calls the helper. No tolerance for the 404 was restored. Red: after `home.spec.ts` left the demo orders shown in the database, `npx playwright test public.spec.ts --project=chromium` failed 4 of 12 with 404s on `/api/testing/images/...?size=csps_strip_240` and `csps_w_280` (the new host's in-memory photo store was empty). Green: the same state, `public.spec.ts` and `fixture-selftest.spec.ts` together, 24 of 24 passed (chromium). See the note on this finding below. |
| WR-D2-01 | **Fixed: requires human verification** | `eb596a1f` | In `ProductLinesTab`, `TestimonialsTab` and `GalleryTab`, `reportFailure` no longer calls `move.reset()` and `toggle.reset()` after any successful read-again. It resets only the failed action (a lost move no longer forgets a toggle's key, and the other way round), and only when the read-again list shows the action took effect: for a move, the row's place differs from before the press (a row that left the Gallery page also counts); for Hide or Show, the row already has the target state. A final 404 resets at once. In every other case the key is kept, so a repeat press is replayed or refused as still running (SEC-06), as before the first-pass change. Tests: for each tab, "a lost move that the list does not show keeps the same key" and "a lost Hide that the list does not show keeps the same key" (the fixtures record `hideKeys`), plus "a lost move does not drop the key of a Hide whose answer was lost too" in the Products tab. Red: 7 new tests failed (a new key was sent). Green: the 3 tab files 116 of 116 (the first-pass tests, where the list does show the move, still pass). Please confirm the rule in plain words: after an unclear failure, the same press keeps its key until the list proves it ran. |

### Notes on these fixes

- **WR-C2-04, was the review right?** Partly. Through the supported route (`npm run e2e -- public.spec.ts --project=chromium`, which drops and rebuilds `CSPS_E2E` first) the spec passed before the change, 12 of 12 (and `fixture-selftest.spec.ts` 12 of 12), because a fresh `--reset` leaves no shown order whose photo is missing. It fails when the database is kept from an earlier run and the spec is started directly with `npx playwright test`, which is the case the review described. The helper fixes that case and costs one reset per worker.
- **First-pass owner item IN-E-04 is now done in effect.** WR-A2-02 adds the database-name guard that item recommended (option 1), as the orchestrator directed. The "First pass" section below still lists IN-E-04 as an owner item, because that is what it said when it was written.
- **WR-B2-01 choice:** replaced the assertions (the "remove them" option was not needed because a meaningful end-state check exists).
- **WR-C2-04 choice:** seeded under the lock (the "restore the declared tolerance" option was not needed).
- **Things I did not do (owner decisions or out of scope):** none of the 11 needed an owner ruling. The info items of the second review (IN-A2-01 to IN-D2-03) were out of scope and are untouched, including IN-D2-01 (`viewport-fit=cover`) and IN-D2-03 (PNG size after the redraw), which the review marked as owner choices.

### Checks (second pass)

| Check | Result |
|---|---|
| `dotnet test` `Csps.Server.IntegrationTests`, `TestingSiteContentTests` | 17 of 17 (13 before, with the 4 new rows red). |
| `dotnet test` `Csps.Server.IntegrationTests`, `UploadSlotsCoverageTests` | 3 of 3. |
| `dotnet test` `Csps.Server.IntegrationTests`, the two race tests | 2 of 2. |
| `dotnet test` `Csps.Server.IntegrationTests`, the `ShellHeadTests` script breakout theory | 3 of 3. |
| `dotnet test` `Csps.Server.IntegrationTests`, `AuthorizationMatrixTests` alone | 545 of 545. |
| `dotnet test` `Csps.Server.IntegrationTests`, five classes together (`AuthorizationMatrixTests`, `TestingSiteContentTests`, `UploadSlotsCoverageTests`, `PublicCacheInvalidationTests`, `ShellHeadTests`) | 638 tests, 637 passed, 1 failed (`ParallelCallersEachGetTheirOwnStatus`) in the first run. A second run failed that test and `ChangingAProductLineTitle...` (see Flakes). Both passed when run alone. |
| `dotnet test` `Csps.ArchitectureTests` | 290 of 290. |
| Build | The Debug builds of Infrastructure, Server and the Server integration tests succeeded with warnings as errors (0 warnings). The full solution and the Release build were not built in this pass. |
| `npm run lint` in `web/` (`eslint . --max-warnings 0`) | Exit 0, no output. |
| `npm run typecheck` in `web/` (three `tsc` projects) | No errors. |
| `prettier --check` on every web file changed | All files pass. `site-content-sweep.spec.ts` was edited by hand for the two changed places only, because Prettier would have reformatted unrelated old lines there. |
| vitest: `ProductLinesTab`, `TestimonialsTab`, `GalleryTab` and `src/test` | 15 files, 351 of 351. |
| vitest: `scripts/e2e-lock-timeouts.test.ts` and `scripts/e2e-cleanup.test.ts` | 5 of 5. |
| Playwright, chromium, `public.spec.ts` + `fixture-selftest.spec.ts` after the fix, on the kept database | 24 of 24. |
| Playwright, chromium, `order-public-website.spec.ts` (all 8 tests, including the changed form test), through `npm run e2e` in the main checkout after the fast-forward | 8 passed. |
| Playwright, the other four projects (firefox, webkit, pixel, iphone), `site-content-sweep.spec.ts`, `contact.spec.ts` | **Not run.** I ran only the engine needed to show each change. The `contact.spec.ts` change is a timeout line. The sweep spec change (best-effort delete) is covered by the source check and lint, not by a browser run. |
| Full `dotnet test` and full web vitest | **Not run** (targeted runs only, as asked). |
| `gitleaks git --staged` before each of the 11 commits | No leaks. A look at the diff found no real server or database names, connection strings, emails or local paths. |

### Flakes and a finding to note (not caused by these fixes)

- **`AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus`:** failed in the combined multi-class runs (the same load-related 500 the first pass recorded) and passed alone, and in the full class run (545 of 545).
- **`PublicCacheInvalidationTests.ChangingAProductLineTitleShowsOnTheNextLinesReadWithANewETagAndTheOldETagGetsNo304` fails when the whole class runs, passes alone.** It does not reset the database, and an earlier test in the class leaves Volleyball Jerseys as the first line (the test read "Volleyball Jerseys" where it expected "Basketball Kits"). It fails the same way with my two new tests taken out (I ran the class on the version before `f60d76cd`: 12 tests, same 1 failure), so it is an older order dependence. Suggested fix, not done because it is outside the 11 findings: start that test with `database.ResetAsync()` and `ProductLineSeeding.RestoreSixAsync(database)` like its neighbours.

---


## First pass


**Source review:** `.planning/phases/11-public-site-content-management/11-REVIEW.md` (48 findings: 0 critical, 18 warning, 30 info)
**Branch:** `worktree-agent-a3edead195a1cdddc`, on top of `b6796ce5`
**Where the checks ran:** in the isolated git worktree of this agent (its own `web/node_modules` from `npm ci --ignore-scripts`, its own `bin` and `obj`), not in the main checkout. The numbers can be repeated in the main checkout after the merge.

### Summary

| Outcome | Count | Findings |
|---|---|---|
| Fixed in the review-fix pass (one commit each) | 22 | WR-A-01, WR-A-02, WR-A-03 (look-ahead part), WR-B-01, WR-C-01, WR-C-02, WR-C-03, WR-D-01, WR-D-03, WR-E-01, WR-E-02, WR-E-03, IN-A-01, IN-B-04, IN-C-02, IN-D-01, IN-D-02, IN-D-04, IN-D-05, IN-D-06, IN-E-03, IN-F-02 |
| Fixed in the phase-end e2e pass | 7 | WR-F-01, WR-F-02, WR-F-03, WR-F-04, IN-F-01, IN-F-04, IN-F-05 |
| Owner item (not changed) | 7 | WR-B-02, WR-D-02, IN-B-03, IN-B-05, IN-D-03, IN-E-04, IN-F-06 |
| Deferred or not done | 12 | IN-A-02, IN-A-03, IN-A-04, IN-A-05, IN-B-01, IN-B-02, IN-C-01, IN-C-03, IN-E-01, IN-E-02, IN-E-05, IN-F-03 (not done, see its row) |
| Skipped | 0 | |
| Total | 48 | |

Fixed in all: 29. WR-A-03 is fixed in its look-ahead part and also carries an owner item (the copy for a far reopening date), so it is counted once, under Fixed. No finding was found wrong.

Every fix has a failing test first. Where a fix only strengthens a test (WR-E-01, WR-E-02, WR-E-03, WR-D-03), the new check was shown to fail on a broken version of the code, or the old test is the thing that was weak (see each row). No package was added or bumped. No schema change, migration, trigger or raw SQL. In the first pass nothing under `web/e2e/`, the `e2e` npm script, `tests/Csps.Testing` or `TestingSiteContentSeeder` was touched, because the e2e agent owned them. WR-A-01 was applied afterwards, once that work was merged, and it changes `tests/Csps.Testing/PublicContentSeeding.cs`.

### Outcome of every finding

#### Warnings

| Id | Outcome | Commit | What was done |
|---|---|---|---|
| WR-A-01 | Fixed (applied after the e2e merge) | `2d503631` | `SiteSettings.UpdateBusinessInfo` now refuses each of the six links outside its allow-list, a postal code that is not 4 digits and a shop email that is not shaped like an address, with the validator's own words. `SiteLinks` holds `IsPostalCode`, `IsContactEmail` and their two messages; the request validator calls the same code, so there is one source of truth and no new behavior for valid input. A field that is already too long keeps its single "too long" message. The five demo links in `PublicContentSeeding.Demo()` are now allow-listed values, and the tests that pinned the old ones were updated (`PublicContentReaderTests`, `PublicSiteEndpointTests`, `SiteSettingsBusinessInfoTests`). The three "no @ in a public body" tests allow the `@` of the TikTok profile link now in the demo data. The web zod schema already mirrors every one of these rules, so there is no client change. `docs/api/site-content.md` says the rules live in the domain. Red: the new domain tests failed 22 of 190 (a bad link, postal code or email was accepted); after the change 1896 of 1896 pass. |
| WR-A-02 | Fixed | `b9596606` | `UpdateOrderDetailsHandler` now refuses any details save that leaves a shown order with no team name and no public name, with or without the `publicWebsite` block. Same words as the existing rule ("This order has no team name. Enter the name to show."), on the `teamName` field. New `Order.IsShownWithoutName`. Red: the clear-the-team-name test got a success. Green: 30 of 30 in `UpdateOrderDetailsHandlerTests`. The client schema already checks the same rule on the form, so no client change. Side effect to know: a shown order that already has no name (it was dropped from the gallery silently before) now refuses any details save, even one that changes nothing, until a name is entered. |
| WR-A-03 | Fixed (look-ahead only) + owner item | `2bd8cb3a` | `OpenStatus.LookAheadDays` is now `ShopClosure.MaxSpanDays + 7` (38). The OpenAPI snapshot, the generated types and `docs/api/public-site.md` carry the new number. The four old look-ahead tests were rewritten (the old ones pinned 14), plus a test with a 31-day closure (Dec 5 gives Jan 1). Red: 3 failed. Green: 24 of 24. The date copy is an owner item (below). |
| WR-B-01 | Fixed | `4bd0bb38` | New `[UploadSlot]` mark. `UploadSlotsMiddleware` matches the mark, not the name `UploadOrderImage`. All five upload actions carry it (order photo, gallery upload and replace, product line photo, share picture). New `UploadSlotsCoverageTests`: reflection test that fails when an `[EnableRateLimiting(ImageUpload)]` action has no mark, and two middleware tests. Docs for order images and site content say the cap covers every upload. Red: 3 of 3 failed. Green: 18 of 18 with the rate limit and OpenAPI snapshot tests. |
| WR-B-02 | Owner item | none | See below. |
| WR-C-01 | Fixed (all three tabs) | `295d3f00` | In `ProductLinesTab`, `TestimonialsTab` and `GalleryTab`, `reportFailure` now resets the move and toggle submissions once the list read-again succeeded, so the next press is a new intent with a new key. If the read-again fails the key is kept (replay protection stays). A test per tab: a lost answer, the list shows the move ran, the same arrow again sends a new key. Red: the same key in all three. Green: 109 of 109 in the three tab files. The fix is in the tabs (as the review suggested), not the hooks. |
| WR-C-02 | Fixed | `ef433694` | `GalleryPhotoModal.loadLatest` calls `replacing.reset()`. Test: save with a stale 409, Load Latest, pick the same photo, save: a second photo upload goes out and the form sends that upload's version. Red: one upload only. Green: 25 of 25. |
| WR-C-03 | Fixed | `cd03086c` | `BusinessInfoForm` reads the baseline through a ref (updated in an effect), so a picture upload that answers after a form save still takes the new version. Test: upload held, form saved, upload answers, next save sends the picture version. Red: it sent the old version. Green: 48 of 48. |
| WR-D-01 | Fixed | `f5a4038c` | `publicResource` has a generation counter. A load that started before `invalidate()` is shown but stays stale, and a new load starts when something shows it. Two tests (first load, and a refresh of old data). Red: both failed. Green: 17 of 17 in `lib/public-data`. |
| WR-D-02 | Owner item | none | See below. |
| WR-D-03 | Fixed | `d925d653` | `SiteFooter.test.tsx` and `contact.test.tsx` no longer sleep 50 ms. They spy on the lazy chunk (`FooterHours`, `CallHoursNote`), wait until it has rendered, check that it returned `null`, and then check the page. Checked by breaking `FooterHours` so it renders for a closed week: the test failed. |
| WR-E-01 | Fixed | `3375eb0f` | Both racing delete tests use `ConcurrentRequests.SendTogetherAsync`, run 10 rounds, keep the same allowed status pairs and check that no row points at a deleted line. Test-only change: the allowed outcomes did not change and the tests pass with the gate (no new pair appeared). |
| WR-E-02 | Fixed | `589207ad` | New theory over `/products`, `/` and `/gallery` with a hostile value in the line, Home line, testimonial, recent work, hero tag and gallery text. It checks the closing-tag count, that the boot block holds no `<`, and that the escaped text round-trips. The `/gallery` boot block carries only the site, so that row only proves the page stays inert. Test-only: the encoder was already safe. |
| WR-E-03 | Fixed | `5819c1ca` | The two `ProductLinesMigrationTests` inserts and both closure tests in `ShellHeadTests` clean up in `finally`. Test-only. |
| WR-F-01 | Fixed in the phase-end e2e pass | `46f4c0dd` | The order specs show their orders under the site content lock, read them and delete them. The Testing reset also takes every other shown order off the website (`89512bae`, with the .NET test first). |
| WR-F-02 | Fixed in the phase-end e2e pass | `93483151` | The site content lock waits 7 minutes (was 4) and its timeout message names "site content". A vitest test pins it. |
| WR-F-03 | Fixed in the phase-end e2e pass | `46f4c0dd` | `@order-public-website` has no `pending` branch any more, and the gallery read must answer 200. |
| WR-F-04 | Fixed in the phase-end e2e pass | `84fb9b73` | The 768px products check is now `scrollWidth > clientWidth`. It passed in all five projects. |

#### Info

| Id | Outcome | Commit | What was done |
|---|---|---|---|
| IN-A-01 | Fixed | `0b41450c` | `AuditDetailFormat.Fit` is the one fit rule. `TestimonialAuditDetail.Changed` and `GalleryAuditDetail` use it. Red: a 60-character name of `;` built a detail over 400 characters. Green. |
| IN-A-02 | Deferred | none | Duplicate upload code in four handlers: a refactor, out of scope. |
| IN-A-03 | Deferred | none | Year and closures in a cached snapshot for up to an hour: small effect, needs a design choice (client year or an expiry at Manila midnight). |
| IN-A-04 | Deferred | none | Moving the move-direction constants is a refactor. The upper bound on `ProductTypeIds` is a new server rule and would need its client mirror; not trivial. |
| IN-A-05 | Deferred | none | Taking the site-content lock in the hours handler changes lock order; the window is milliseconds and nothing is lost. |
| IN-B-01 | Deferred | none | The stale-head race is a few milliseconds and needs a key or read-order change in `ShellPage`; not trivial. |
| IN-B-02 | Deferred | none | `sitemap.xml` `lastmod` per page needs new per-page stamps; the docs already say what it is. |
| IN-B-03 | Owner item | none | See below. |
| IN-B-04 | Fixed | `6f011189` | `[ResponseCache(NoStore = true, Location = None)]` on `OpeningHoursController` and `SiteSettingsController`. Two header tests. Red: no `no-store`. Green. |
| IN-B-05 | Owner item | none | See below. |
| IN-C-01 | Deferred | none | The copied row-action machinery is a refactor, out of scope. |
| IN-C-02 | Fixed | `852275af` | `mapEmbedUrl` in `businessInfoSchema` is `z.string().transform(reduceEmbedCode).pipe(...)`, so a send with no blur (Enter on a phone keyboard) also cuts the pasted code down. Test sends the form with the code still in the field. Red: nothing sent. Green: 362 of 362 with the schema tests. |
| IN-C-03 | Deferred | none | Load Latest on another page needs a get-by-id call or an unpaged read; not trivial. |
| IN-D-01 | Fixed | `e08c1f34` | `readBootData` reads the document once even when there is no block. Red: two lookups. Green. |
| IN-D-02 | Fixed | `3cd266b9` | `ProductArticle` leaves a key that fails `isLineKey` out of the element id, and names the title by its place (`product-line-3-title`). |
| IN-D-03 | Owner item | none | See below. |
| IN-D-04 | Fixed | `c2c0b266` | `useSwipe` drops the click swallow on the next pointer down, so a touch swipe that sent no click cannot eat the next tap. Mouse and pen swipes still swallow their own click. Red: the tap was eaten. |
| IN-D-05 | Fixed, different way than suggested | `721fe5f0` | The suggested `preventDefault` on click flips a controlled checkbox the wrong way in React (the box ended up checked). The fix undoes the toggle only for a box with no `checked` prop. A controlled box is unchanged (the old test still passes). |
| IN-D-06 | Fixed | `8fa85776` | The index is in the key for the closure rows and the testimonial cards. Red: React's duplicate key error fails the test through the console guard. |
| IN-E-01 | Deferred | none | The three deadlock scenarios: a test refactor, out of scope. |
| IN-E-02 | Deferred | none | An extra deterministic last-Manager test needs a way to serialise the two requests without a deadlock; not trivial. |
| IN-E-03 | Fixed | `06b8d55f` | The matrix theory clears the demo share picture before the share-picture DELETE row, so a Manager gets exactly 404 and `ManagerAlso` is no longer used there. The parallel test keeps the second status (another row seeds the picture at the same moment) and names it in its failure message. |
| IN-E-04 | Owner item | none | See below. |
| IN-E-05 | Deferred | none | A test-maintenance trade-off, no safety gain either way. |
| IN-F-01 | Fixed in the phase-end e2e pass | `84fb9b73` | `boxOf` names its slot in the error ("Main photo is not on the page"). |
| IN-F-02 | Fixed | `afe0f5d6` | `barlowNoPesoPlugin` stops the build through `this.error` when a face would be left with no range (an empty range is invalid CSS and would widen the face). The test that pinned `''` now expects the error. |
| IN-F-03 | Not done | none | The phase-end e2e report (`11-E2E-PHASE-END.md`) does not mention it, and the git log shows no commit for it. The four specs it names changed only for other reasons (`77b04b1e`, `81b9b436`, `84fb9b73`). The layout-only tests still take no lock, and the business test still reads `.all()` with no wait. Open: either take the site content lock for them or wait for the rows with `await expect(locator.first()).toBeVisible()` before measuring. It is an e2e-only change and needs a browser run, so it was not done here. |
| IN-F-04 | Fixed in the phase-end e2e pass | `84fb9b73` | The sweep deletes both orders, and the demo reset runs even if a cleanup step throws. The two product line photo specs got the same nested `finally`. |
| IN-F-05 | Fixed in the phase-end e2e pass | `f130523c` | The comment in `lighthouse.mjs` now says 15 seconds. |
| IN-F-06 | Owner item | none | See below. |

### Notes on WR-A-01

The block is gone: the e2e work was merged, so the fix was applied. Where the saved recipe differed from the code:

- `ShellHeadTests` (the `sameAs` pair) and `ShellTestFactory` build the public DTO directly through a stub reader and never store the values, so they were left alone. They are not demo data.
- The recipe did not cover three tests that assert "no `@` in a public body" (`PublicContentReaderTests`, `PublicSiteEndpointTests`, `ShellHeadTests`). The demo TikTok link now carries the `@` of a TikTok profile, so each test removes `tiktok.com/@` before it looks for an email sign.
- The "a value one over its limit is refused and one at the limit fits" theory in `SiteSettingsBusinessInfoTests` now builds the at-limit value from a valid link or email, because a filler of `x` no longer passes the shape rule. A Messenger link is at most 113 characters to be valid (the name part is capped at 100), so its column limit of 120 can only be reached by a link the rule refuses; that is the existing allow-list rule, not new behavior.
- `TestingSiteContentSeeder` and the dev seed (`SiteContentSeedStep`) have their own demo values, and those already used allow-listed links, so neither needed a change.

### Owner items

The owner is away. Nothing below was changed. Each has 2 to 3 options, recommendation first.

#### WR-B-02: a Manager-editable column is in `HasData`

1. **Recommended: keep the model, add a schema test.** A test that fails when any migration after the baseline holds an `UpdateData` on `SiteSettings`. No migration change, and it catches the day a seeded default is edited. Reason: it removes the risk without a schema change.
2. Move `Tagline` (and ideally `BusinessName`) out of the `HasData` object with a hand-written migration. Cleanest model, but it changes migrations.
3. Accept the risk and write it down. The columns are new, so nothing is overwritten today.

#### WR-D-02: the phone tap zones are named "Previous photo" and "Next photo"

`11-UI-SPEC.md` (the Lightbox lines, and 02 D-06) names the zones "Previous photo" and "Next photo". They move between gallery items, and the 56 px desktop buttons call the same action "Previous image" and "Next image".

1. **Recommended: name the zones "Previous image" and "Next image"** (use `COPY.previousImage` and `COPY.nextImage`, delete the two spare keys, update `GalleryLightbox.test.tsx`). Reason: one name for one action, and a screen reader user on an item with three photos is no longer sent to another team's item by "Next photo".
2. Keep the names and add a hidden description such as "Goes to the next gallery item".
3. Keep as ruled. The thumbnail row ("Show photo 2 of 3") is the real photo selector.

#### WR-A-03 (copy part): how a reopening date far away is worded

The look-ahead is fixed. The client still prints only the day name for any reopening more than a day away ("Opens Friday 9:00 AM"). With a 31-day closure that is a Friday weeks later, which reads like the next Friday. The UI spec has no wording for a date. `11-UI-SPEC.md` (HoursCard) also says the Opens part is left out when nothing opens "in the next 14 days"; it is now 38 days, so please confirm that number.

1. **Recommended: print the date when the reopening is more than 6 days away**, for example "Opens Dec 24, 9:00 AM". The server already sends the date.
2. Print both: "Opens Thursday, Dec 24, 9:00 AM".
3. Keep the day name only, and cut the client's reach back to 6 days so a far date shows nothing.

#### IN-B-03: the public read 429 says "Too many attempts"

1. **Recommended: add a wording for the public read limit:** "This page is busy right now. Wait a moment, then try again." Reason: the current text reads like a sign-in lockout.
2. Keep "Too many attempts from this address".
3. Other wording from the owner.

#### IN-B-05: consent is only a domain rule

1. **Recommended: add `CK_Orders_ShownNeedsConsent` in a forward-only migration**, after checking that no migrated order breaks it. Reason: consent is the Data Privacy Act basis for D-11, and the repo already uses CHECK constraints for such rules.
2. Keep the domain rule and add a test that scans the table for a shown row with no consent.
3. Accept as is.

#### IN-D-03: "CSPS Shop" and the social link names are fixed text

1. **Recommended: the map label shows `site.businessName`**, and the social link names stay as they are (they name the profile, not the shop). Reason: after a rename the page would show two names.
2. Record the ruling that all of this brand text stays fixed (the UI spec lists "CSPS Shop" as copy).
3. Use the business name in all of them.

#### IN-E-04: the Testing site-content route has no database-name guard

Not reachable in Release or Production. In a Debug host in the Testing environment, an anonymous POST rewrites site content on whatever database the connection string names.

1. **Recommended: make `TestingSiteContentSeeder.ResetAsync` refuse any database except `CSPS_E2E` and `CSPS_Test_<guid>`**, with the existing target guard. Reason: it matches the dev seed rule and costs one check. It has to wait for the e2e pass, which owns that file.
2. Leave it. The earlier Testing routes work the same way.
3. Also require a shared secret header on the route.

#### IN-F-06: the owner review tool covers only Home

1. **Recommended: add targets for `/products`, `/gallery`, `/contact` (Blush only) and `/admin/site-content` (both themes, signed in).** Reason: these are the substance of the phase and D-23 is the owner's screenshot review.
2. Keep the list and say in the comment that the e2e screenshots cover the rest.
3. Leave as is.

### Checks

All run in the isolated worktree (see the top). Last code commit: `afe0f5d6`.

| Check | Result |
|---|---|
| `dotnet build src/Csps.Server -c Release` (builds Domain, Application, Infrastructure and Server in Release) | Build succeeded. 0 Warning(s), 0 Error(s). |
| `dotnet build -c Release` of the whole solution | Fails in test projects that were not touched (for example `OrderReaderDetailSnapshotTests` cannot find `TestingImageDelivery`, because the Testing types are compiled only in Debug). It is not caused by these commits. |
| `dotnet build` (Debug, whole solution, includes all test projects) | Build succeeded. 0 Warning(s), 0 Error(s). |
| `Csps.Domain.UnitTests` | Passed: 1851 of 1851. |
| `Csps.Application.UnitTests` | Passed: 3034 of 3034. |
| `Csps.ArchitectureTests` | Passed: 290 of 290. |
| `Csps.Infrastructure.IntegrationTests` | Passed: 1185 passed, 1 skipped (the live breached-password service, needs `CSPS_LIVE_HIBP=1`), 0 failed. |
| `Csps.Server.IntegrationTests`, one full run | 2814 tests: 2800 passed, 14 failed, in 37 minutes. See "Flakes". After the load went down: the 9 classes of the 11 non-timing failures passed 185 of 185, and `AuthorizationMatrixTests` passed 545 of 545. The 2 timing tests are discussed below. |
| `Csps.Server.IntegrationTests`, the classes these commits touch (run alone) | `UploadSlotsCoverageTests`, `ImageUploadRateLimitTests`, `OpenApiSnapshotTests`, `OpenStatusEndpointTests`, `SiteSettingsEndpointTests`, `OpeningHoursEndpointTests`, `PublicSiteEndpointTests`: 52 of 52. `GalleryAdminTests`, `ProductLinePhotoEndpointTests`, `ShellHeadTests`: 87 of 87. |
| OpenAPI drift check (`node tools/openapi-gen/check.mjs`, after `npm ci` in `tools/openapi-gen`) | "Generated API types match tools/openapi-gen/openapi.v1.json." |
| `npm --prefix web run lint` (`eslint . --max-warnings 0`) | Exit 0, no output. |
| `npm --prefix web run typecheck` (three `tsc` projects) | No errors. |
| vitest, the 15 test files these commits touch, run together | 410 tests; every file passes when run on its own (see "Flakes" for the full-suite run). |
| WR-A-01 (commit `2d503631`, a separate worktree on top of `a6371ff9`, checks in that worktree) | `dotnet build` (Debug, whole solution): 0 Warning(s), 0 Error(s). `dotnet build src/Csps.Server -c Release`: 0 Warning(s), 0 Error(s). `Csps.Domain.UnitTests` 1896 of 1896, `Csps.Application.UnitTests` 3034 of 3034, `Csps.ArchitectureTests` 290 of 290, `Csps.Infrastructure.IntegrationTests` 1185 passed, 1 skipped, 0 failed. `Csps.Server.IntegrationTests` classes `ShellHeadTests`, `TestingSiteContentTests`, `SiteSettingsWriteTests`, `SiteSettingsEndpointTests`, `PublicSiteEndpointTests`, `PublicCacheInvalidationTests`, `OpenApiSnapshotTests`: 123 of 123. No web file changed, so lint, typecheck and vitest were not rerun. |
| `gitleaks git --log-opts=b6796ce5..HEAD` | 21 commits scanned, no leaks. Every commit was also scanned staged by the pre-commit hook. A grep of the diff for local paths, user names and `BetsLLC` found none. |

### Flakes seen (not caused by these fixes)

The machine was saturated by other sessions during the runs (CPU load at 100 percent, the e2e host and its SQL Server running). Test timeouts of 5 seconds and the 15 second request budgets were hit by tests these commits do not touch.

- **`Csps.Server.IntegrationTests`, full run:** the 14 failures were `TemporaryPasswordTests`, `ListOrdersEndpointTests`, `GalleryMoveTests`, `ManagerEmailChangeTests`, `OrderPaymentsEndpointTests`, `OrderPeopleTests`, `MustChangePasswordTests`, `StaffMoneyBalanceTests`, `OrderConcurrencyTests`, one `AuthorizationMatrixTests` row (a 500 on `PUT .../payments/...`) and the two timing tests. Their durations were 14 to 21 seconds each. All the non-timing classes pass when rerun (185 of 185, matrix 545 of 545).
- **`AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus`:** answered a 500 on some row in 2 of 4 full-class runs while the machine was busy (a different row each time, and it failed the same way with the IN-E-03 change taken out). It passes alone and in the last full-class run (545 of 545).
- **The two timing tests** (`OrderListTimingTests`, `ExpenseListTimingTests`, "answers under 300 ms at p95 on five years of data"): they measured p95 values of 250 to 350 ms while the machine was busy. These commits do not touch the order list or the expense list. See the result of the quiet rerun below.
- **vitest, full suite:** 10670 tests, 38 failed, in 16 files, all in files these commits do not touch (the heavy admin form and modal files, and some node tests that load the Vite config), mostly "Test timed out in 5000ms". Rerun alone, or with a 60 second timeout, every one of them passes: 16 of 16 files. One more failure, `third-party-notices.test.ts`, is a very slow test (it took 515 seconds in the busy run); see the result below.
- `ProductsPage.test.tsx` (axe) and `GalleryPage.test.tsx` (lightbox chunk) each failed once in a busy run and passed alone.

#### Rerun results

- **vitest, the 16 files that failed in the busy full run:** all pass when run alone or with a 60 second timeout (`OrderRefundModal` and `StaffMoneyPage.owner` alone: 36 of 36; `OrderFormPage` alone: 84 of 84; `third-party-notices.test.ts` alone: 11 of 11, it takes 96 seconds; the rest passed in the sequential 60 second run). Together with the 374 files that passed in the full run, that is all 390 web test files green (not in a single run).
- **`ExpenseListTimingTests`:** passed on the quieter rerun (1 of 1).
- **`OrderListTimingTests`:** still failed on the quieter rerun: the customer-name search measured p95 412.8 ms against the 300 ms limit (default list 139.6 ms, product type filter 213.1 ms, the rest under 200 ms). No commit here touches the order list or its query. The repo already records the same kind of failure for the expense list under machine load (`.planning/debug/expense-list-timing-load-flake.md`). I could not run this test on the base commit (each run is 6 to 8 minutes and the machine stays busy), so this is not proven to be unrelated: please repeat it alone on a quiet machine.

---

_Fixed: 2026-11-13_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
