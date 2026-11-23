# Phase 13 deferred items and flakes
*Created: 2026-11-22T23:50:00-06:00 · Updated: 2026-11-22T23:50:00-06:00*

Items found while executing Phase 13 that are recorded here instead of being hidden.

## Flakes (each passed when re-run alone)

| Seen | Test | What happened | Re-run alone |
|---|---|---|---|
| 2026-11-22, post-fix gate | `ListDeletedExpensesEndpointTests` (whole class, fixture setup) | LocalDB "Connection Timeout Expired" in the post-login phase while two executors and the full suite ran | 18 of 18 passed |
| 2026-11-22, post-fix gate | `OrderRefundModal.test.tsx` "refuses an amount above the current credit" | Failed once under full-suite load | 34 of 34 passed |
| 2026-11-22, wave 4 gate | `SiteContentLockTests.AMissingLockRowFailsClearlyAndIsNeverReadAsBusy`, `ManagerRosterLockTests.ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded` | LocalDB "Connection Timeout Expired" in the post-login phase (about 14 s), full suite only, no other agents running | 6 of 6 passed |
| 2026-11-22, 13-04 | `LegalPages.test.tsx` old Cookie Policy address | `document.title` raced the lazy route load | passed alone and in a full re-run |
| 2026-11-22, 13-06 | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` | 500 on the test-only `POST /api/testing/site-content`, about 3 in 7 class runs | passed alone 3 of 3 |

The LocalDB login timeouts are the recurring pattern: the full .NET suite opens many `CSPS_Test_<guid>` databases at once on the shared `(localdb)\MSSQLLocalDB` instance. Worth a look in a later quick task (connection timeout or fixture parallelism), not in this phase.

## Deferred review findings

- 13-REVIEW-W1 WR-02: the Cloudinary usage month cursor is saved before the alarm lines are returned. Waiting on the owner (behavior change).
