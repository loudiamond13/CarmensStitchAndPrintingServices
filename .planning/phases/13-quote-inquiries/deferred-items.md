# Phase 13 deferred items and flakes
*Created: 2026-11-22T22:47:00-06:00 · Updated: 2026-11-26T04:25:00-06:00*

Items found while executing Phase 13 that are recorded here instead of being hidden.

## Flakes (each passed when re-run alone)

| Seen | Test | What happened | Re-run alone |
|---|---|---|---|
| 2026-11-22, post-fix gate | `ListDeletedExpensesEndpointTests` (whole class, fixture setup) | LocalDB "Connection Timeout Expired" in the post-login phase while two executors and the full suite ran | 18 of 18 passed |
| 2026-11-22, post-fix gate | `OrderRefundModal.test.tsx` "refuses an amount above the current credit" | Failed once under full-suite load | 34 of 34 passed |
| 2026-11-22, wave 4 gate | `SiteContentLockTests.AMissingLockRowFailsClearlyAndIsNeverReadAsBusy`, `ManagerRosterLockTests.ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded` | LocalDB "Connection Timeout Expired" in the post-login phase (about 14 s), full suite only, no other agents running | 6 of 6 passed |
| 2026-11-22, 13-04 | `LegalPages.test.tsx` old Cookie Policy address | `document.title` raced the lazy route load | passed alone and in a full re-run |
| 2026-11-22, 13-06 | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` | 500 on the test-only `POST /api/testing/site-content`, about 3 in 7 class runs | passed alone 3 of 3 |
| 2026-11-23, 13-11 | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` | Same 500 on `POST /api/testing/site-content` while other agents used LocalDB | passed on re-run and in two later runs |
| 2026-11-23, 13-12 | `PublicLayout.test.tsx` | Failed under full web-suite load in the executor's worktree | 48 of 48 passed alone; passed in the wave 5 gate |
| 2026-11-23, wave 5 gate | `CompanyExpenseCheckTests.TheLegacyHolderCannotPay` (LegacyFitCheck) | LocalDB connection error during the full .NET suite | LegacyFitCheck alone: 275 passed, 1 skipped |
| 2026-11-23, W5 fixes | `GalleryPage.test.tsx` "puts focus back on the tile..." | failed once in a run of all `modules/public` tests | alone: passed twice |
| 2026-11-23, W5 post-fix gate | `GalleryPage.test.tsx` "puts focus back on the tile..." (second time, recurring under load) | failed in the full vitest run | alone: 28 passed, three runs in a row |
| 2026-11-23, W5 post-fix gate | `ManagerRosterLockTests`, `OrderListStoreTests` (PaymentMethod rename), `OrderDiscountsMigrationTests` | LocalDB connection error (SNI) during the full .NET suite | Infrastructure tests alone: 1329 passed, 0 failed |
| 2026-11-23, plan 13-14 | `QuoteForm.test.tsx` "shows the pending label Sending while the request runs" | failed once in the full web suite | alone: 3 of 3 passed |
| 2026-11-23, plan 13-15 | `no-long-dash.node.test.ts` | ran past its 5 s limit (5210 ms) under machine load | alone: passed in 2.8 s |
| 2026-11-23, plan 13-14 | `scripts/license-policy.test.ts` "exits 1 on a stricter policy" | fails in a fresh worktree ("No packages found in this path"), as in 13-09 and 13-12 | passes in the main checkout |
| 2026-11-23, plan 13-17 | `QuoteForm.test.tsx` "shows the pending label Sending..." (second time, recurring under load) | failed in the full web suite | alone: 1 of 1, whole file 50 of 50 |
| 2026-11-23, wave 7 gate | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` (second time, after 13-11) | failed in the full .NET suite | the class alone: 590 passed |
| 2026-11-23, wave 7 gate | `TrialImportTests.TwoBusyOutcomesAreReportedAsBusy` (LegacyFitCheck) | LocalDB connection error (SNI) in the full .NET suite | the class alone: 7 passed |
| 2026-11-23, plan 13-18 | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` (third time) | failed once in a GREEN run | alone 1 of 1; class 593 of 593 |
| 2026-11-23, plan 13-19 | `routes.test.tsx` (2 cases), `OrderFormPage.test.tsx` (10 cases), `ExpensesPage.test.tsx`, `UsersPage.test.tsx`, `QuoteFormPhotos.test.tsx` (Sending) | 5 s and 15 s timeouts in the full web suite while 13-18 ran .NET builds and tests | alone: routes 87 of 87, OrderFormPage 84 of 84, the other three 204 of 204 |
| 2026-11-23, wave 8 gate | `ReadOnlyGuardTests.RawSqlCommandsAreRefusedAndChangeNothing` (LegacyFitCheck) | LocalDB connection error (SNI) in the full .NET suite | the class alone: 24 of 24 passed |
| 2026-11-23, plan 13-21 | `routes.test.tsx` (2 deleted-order cases) | failed while several files and a whole-tree eslint ran at once | the file alone: 87 of 87 |
| 2026-11-23, wave 9 gate | `routes.test.tsx` "list to request to Back restores the pill, the search and the rows" | failed in the full web suite | the file alone: 87 of 87 |
| 2026-11-23, wave 9 gate | LegacyFitCheck `CompanyExpenseCheckTests`, `TrialSeederTests`, `TrialImportTests` (one case each) | LocalDB connection errors in the full .NET suite | the project alone: 275 passed, 1 skipped |
| 2026-11-23, wave 9 gate | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` (fourth time) | failed in the full .NET suite | the class alone: 599 of 599 |
| 2026-11-23, wave 9 post-fix gate | `PublicLayout.test.tsx` "sends one view with the path only for /gallery?q=jersey#top" | failed in the full web suite | the file alone: 48 of 48 |
| 2026-11-23, wave 9 post-fix gate | `ManagerRosterLockTests`, `SiteContentLockTests` (deadlock cases), `AnalyticsVisitsMigrationTests` | LocalDB connection error (SNI) in the full .NET suite | the three classes alone: 19 of 19 |
| 2026-11-23, wave 10 gate | `routes.test.tsx` "list to request to Back restores the pill..." (third time) | failed in the full web suite | the file alone: 87 of 87. Fixed in the W10 fixes (ff9dd757): two 1-second waits now 10 seconds |
| 2026-11-23, wave 10 gate | `OrderListStoreTests` (PaymentMethod rename) | LocalDB connection error (SNI) in the full .NET suite | the class alone: 21 of 21 |
| 2026-11-23, wave 10 post-fix gate | `GalleryPage.test.tsx` "puts focus back on the tile..." (third time in a full run, recurring) | failed in the full web suite | the file alone: passed. Worth a quick task to make it steady, as was done for the routes test in the W10 fixes |
| 2026-11-24, plan 13-23 | `QuoteFormPhotos.test.tsx` "loads the picker when photos are chosen and lists them..." | failed once in a run of 36 files | the file alone: 24 of 24; the same 36 files again: 725 of 725 |

## Stale test cache hides a new dev preview (plan 13-23)

Vitest keeps transformed files in `web/node_modules/.vitest-cache`. `src/dev/kit.ts` finds the preview files with `import.meta.glob`, and the cached copy kept the old file list, so a new preview (`QuoteFormDemo`) showed as "Missing component" until the cache folder was deleted. A checkout that already has that folder may see the same after this plan merges: delete `web/node_modules/.vitest-cache` and run again. Worth a quick task to turn that cache off for `kit.ts` or for the whole run.
| 2026-11-24, W11 fixes | `QuoteFormPhotos.test.tsx` "starts no upload before the text is saved" | the Sending state lasts only the 1 s ticket wait, so a loaded machine can miss it | the file alone: 25 of 25, three runs |
| 2026-11-24, W11 fixes | `OrderFormPage.test.tsx`, `ProfilePage.test.tsx` (13 timeouts) | failed while the 13-24 sweep ran in parallel | alone: 188 of 188 |

- Follow-up (W11 WR-03): `web/src/test/quoteRequestFixtures.ts` still uses `0917 555 0101`-style numbers, which are valid Philippine mobile numbers; switch them to the UI-SPEC sample style in a later quick task.
| 2026-11-24, plan 13-24 | `quote-nav` "dashboard strip" (webkit) | sign-in stuck on Verify Code and timed out | alone: 3 of 3 |
| 2026-11-24, plan 13-24 | LegacyFitCheck `TrialImportTests` (duplicate number case) | LocalDB connection timeout | the class alone: 7 of 7 |
| 2026-11-24, plan 13-24 | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` (fifth time) | 500 instead of 204 | the class alone: 599 of 599. Recurring: worth a quick task |
| 2026-11-24, plan 13-24 | `QuoteRequestPage.test.tsx` "deletes with the version..." and `GalleryPage.test.tsx` "asks for the lightbox chunk only when a tile is first pressed" | first `npm run verify` run | each file alone twice: 88 of 88; the second verify run passed all 12,187 |
| 2026-11-24, post-sweep gate | LegacyFitCheck `ColumnInventoryTests.AFakeRunListsNoUnknownColumns` | LocalDB connection error in the full .NET suite | the class alone: 11 of 11 |
| 2026-11-24, showcase e2e fix | `ComponentShowcasePage.lazy.test.tsx` | failed once in a five-file run | alone 3 of 3; the five files then passed twice (129 of 129) |

- Follow-up (UI review fix 3): the quote form placeholder heights (`min-h-[696px]`, `pg-phone:min-h-[1000px]` in `quoteForm.recipe.ts`) need a Playwright check that compares them with the loaded form at 320, 768 and 1440 px (jsdom has no layout).

The LocalDB login timeouts are the recurring pattern: the full .NET suite opens many `CSPS_Test_<guid>` databases at once on the shared `(localdb)\MSSQLLocalDB` instance. Worth a look in a later quick task (connection timeout or fixture parallelism), not in this phase.

## Deferred review findings

- 13-REVIEW-W1 WR-02: the Cloudinary usage month cursor is saved before the alarm lines are returned. Waiting on the owner (behavior change).

## Stale build hid a failing check (wave 5)

`build-output.node.test.ts` reads the built site in `src/Csps.Server/wwwroot` and only rebuilds when it is missing. The main checkout had a build from 2026-11-21, so the full suite passed while a fresh build failed on the 13-09 placeholder `you@gmail.com` (fixed in f1fd0076, owner item P13-BL-11 item 7). Later gates should rebuild the web app first.

## Webkit e2e failure handed to plan 13-24 (resolved in 13-24, commit 50a280de: Safari does not focus a button on a mouse click; the test now presses Send from the keyboard) (W5 fixes)

"@quote the rate limit keeps what the visitor typed" fails its "Send is focused" check on webkit. It fails the same way with the code from before the W5 fixes, so the fixes did not cause it. The `@quote` cases had run only on chromium; plan 13-24 runs them on every browser and must fix or record this one.

## Sending flakes and 1 second test timeouts: root causes fixed (13-REVIEW G7A-WR-01, G7A-WR-02)

The recurring "Sending" flakes in the rows above (13-14, 13-17, 13-19 and the W11 fixes) raced the real 1 second ticket wait. Commit 4e50549b makes those three tests hold the create call and release it by hand. Commit 8a589018 raises the Testing Library async timeout from 1 s to 5 s in the jsdom setup, which covers the load timeouts in the 13-19 row. The rows stay as the record of what was seen.

## Full web suite flakes after the whole-phase review fixes (2026-11-25)

Two full `npm run test:coverage` runs on a quiet machine (no other test run, about 15 minutes each) each failed a different set of tests. All of them pass when their files run alone (4 files, 204 of 204). A different set fails every time, mostly with the 5 s per-test timeout, so this is load, not the fixes.

- Run 1: 11 failed of 12,214. OrderFormPage.test.tsx (8: Idempotency-Key retry, four Public website card cases, three Turn into Order prefill cases), OrderItemModal.test.tsx (Saving ignores Esc), OrderRefundModal.test.tsx (customer credit), GalleryPage.test.tsx (focus on tile 30).
- Run 2: 5 failed of 12,214. OrderFormPage.test.tsx (4: discard dialog while saving, two photo draft cases, description window), OrdersPage.test.tsx (axe).

- Run 3 (2026-11-25, after quick 261125-w4m, `npx vitest run` while the verifier ran its own test runs on the same machine): 3 failed of 12,219. The failing names were cut off from the captured output, so they are not known. A second full run straight after, with nothing else running, passed 12,219 of 12,219. Same load pattern as runs 1 and 2.

Follow-up worth a quick task: the per-test timeout (Vitest default 5 s) now equals the Testing Library wait timeout set by G7A-WR-01, and OrderFormPage.test.tsx is the file that runs out of time under load. A longer `testTimeout` for the jsdom project, or splitting OrderFormPage.test.tsx, would make the full suite steady.

## CI end-to-end flakes on the Phase 13 branch (2026-11-26)

CI run 45777412323, attempt 1 (sha 9e630ab3): 2 failed, 1,044 passed, 22 skipped. Both tests passed on the run before (45764612079, sha bb7886de), and none of the changes between the two runs touches these screens. The end-to-end host cannot run on this machine (in-app shells cannot reach LocalDB), so the failed job was re-run in CI instead of alone here. Attempt 2: 1 failed, 1,045 passed, 22 skipped. The gallery test passed; the shell test failed again on pixel, this time at 414x896.

- `[chromium] site-content-gallery.spec.ts:74` (a Manager adds E2E-Riders): "Photo chosen" showed, the Save Photo button had focus and Enter was pressed about 180 ms after the file was chosen, but no save request reached the server and the form showed no error. The test waited 20 s for "Photo added". The previous run passed this test in 4.1 s.
- `[pixel] shell.spec.ts:78` (tab bar at 375x812): after scrolling to the end of /dev/components, the last content ended at 921 px while the tab bar's top was at 744 px. The page most likely grew after the scroll (late layout on the long showcase page). The same test passed at 320x568, 414x896 and 767x900 in the same run.

- Attempt 2, `[pixel] shell.spec.ts:78` at 414x896: last content at 834.5 px, tab bar top at 827 px. The miss changes from run to run (177 px, then 39 px short of the end), so it is timing, not layout. In the browser on the dev site at 414x896, at the true end the last section ends at 795 px and the tab bar starts at 827 px: the page is fine.

Fixed in the test: the end check now scrolls to the true end (`scrollHeight - clientHeight`) and waits until the page height and the scroll position hold for 3 frames, instead of reading one frame after a single scroll. Checked in the browser: settles in 6 frames with the same 32 px gap. The gallery Save race stays a follow-up worth a quick task if it fails again: find why an Enter on Save Photo can be lost right after a photo is chosen.
