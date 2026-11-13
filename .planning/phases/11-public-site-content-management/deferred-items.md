---
created: 2026-11-12T20:05:00-06:00
updated: 2026-11-12T20:05:00-06:00
---

# Phase 11: deferred items found during execution

Out-of-scope problems found while executing a plan. They were not fixed in that plan.

## Found in plan 11-28

### D-28-1: `PublicCacheInvalidationTests.ChangingAProductLineTitle...` depends on the order of the tests in its class

- **Where:** `tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs`, `ChangingAProductLineTitleShowsOnTheNextLinesReadWithANewETagAndTheOldETagGetsNo304` (line 167).
- **What happens:** it expects the first public line to be Basketball ("Basketball Kits" after its own change). It does not put the six lines back first. Two other tests in the same class (`ShowingAPhotoAddOnAShownOrderTakingItOffAndALineHide...` and `ShowingACoverChangeTakingOffShowingAgainAndALineHide...`) end by hiding the Basketball line and do not put it back. When one of them runs before it, the first public line is Volleyball and the test fails with `"Volleyball Jerseys"` where `"Basketball Kits"` was expected.
- **Evidence:** in the full Server run of plan 11-28 it failed (2743 total, 2741 passed), and it failed again when its class ran alone (25 of 26 passed). It passed when run by itself (1 of 1). Nothing in plan 11-28 touches this class or the product line code it reads.
- **Suggested fix (one line):** start the test with `await database.ResetAsync(); await ProductLineSeeding.RestoreSixAsync(database);` like its neighbours.

### D-28-2: `ForgotPasswordTests.TwoRequestsForTheSamePersonAtTheSameMomentLeaveOneUsableLinkEveryRound` is load sensitive

- **Where:** `tests/Csps.Server.IntegrationTests/Auth/ForgotPasswordTests.cs`.
- **What happens:** it failed once in the full Server run of plan 11-28 (22 seconds, while the whole suite ran). It passed when its class ran again (the class run above passed all of its tests). Nothing in plan 11-28 touches the auth code.
