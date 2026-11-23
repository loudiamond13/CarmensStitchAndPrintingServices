# Phase 13 deferred items and flakes
*Created: 2026-11-22T22:47:00-06:00 · Updated: 2026-11-23T15:02:00-06:00*

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

The LocalDB login timeouts are the recurring pattern: the full .NET suite opens many `CSPS_Test_<guid>` databases at once on the shared `(localdb)\MSSQLLocalDB` instance. Worth a look in a later quick task (connection timeout or fixture parallelism), not in this phase.

## Deferred review findings

- 13-REVIEW-W1 WR-02: the Cloudinary usage month cursor is saved before the alarm lines are returned. Waiting on the owner (behavior change).

## Stale build hid a failing check (wave 5)

`build-output.node.test.ts` reads the built site in `src/Csps.Server/wwwroot` and only rebuilds when it is missing. The main checkout had a build from 2026-11-21, so the full suite passed while a fresh build failed on the 13-09 placeholder `you@gmail.com` (fixed in f1fd0076, owner item P13-BL-11 item 7). Later gates should rebuild the web app first.

## Webkit e2e failure handed to plan 13-24 (W5 fixes)

"@quote the rate limit keeps what the visitor typed" fails its "Send is focused" check on webkit. It fails the same way with the code from before the W5 fixes, so the fixes did not cause it. The `@quote` cases had run only on chromium; plan 13-24 runs them on every browser and must fix or record this one.
