---
phase: 12-consent-analytics-legal
created: 2026-11-18T15:10:00-05:00
updated: 2026-11-18T15:10:00-05:00
fixed_at: 2026-11-18T15:10:00-05:00
review_path: .planning/phases/12-consent-analytics-legal/12-REVIEW.md
iteration: 1
findings_in_scope: 14
fixed: 10
skipped: 4
status: partial
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-11-18T15:10:00-05:00
**Source review:** `.planning/phases/12-consent-analytics-legal/12-REVIEW.md`
**Iteration:** 1
**Scope:** the 14 Warning findings (WR-*). Info findings are out of scope.

**Summary:**
- Findings in scope: 14
- Fixed: 10 (9 commits: WR-G4-01 and WR-G4-02 share one commit)
- Skipped: 4 (all four need an owner decision)

**Where it ran:** all edits, tests and commits were done in the main checkout on branch `gsd/phase-12-consent-analytics-legal`, as the caller asked. `workflow.use_worktrees` is true in the config, but no worktree, temp branch or recovery sentinel was created. Nothing was pushed or merged. Every test number below comes from the main checkout, so it can be reproduced from this tree.

## Fixed Issues

Each fix was written test first: the new test was run and seen failing, then the fix was made and the test passed. Where the red run could only be a missing symbol, that is said.

### WR-G2-01: The salt cache keeps a salt one day longer than the purge job does

**Files modified:** `src/Csps.Infrastructure/Analytics/AnalyticsSaltCache.cs`, `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs`
**Commit:** 45b6fcb5
**Applied fix:** the cache now keeps only today and yesterday (`SaltDays - 1` back), the same days the purge job keeps. The old test that locked in the wrong boundary was replaced by `TheCacheKeepsOnlyTodayAndYesterdayLikeThePurgeJobDoes`. It failed first ("the purge job deletes this day, so the process must not hold it"), then passed.
**Status:** fixed

### WR-G2-02: A page view or speed sample posted while the visitor clears their data answers 500

**Files modified:** `src/Csps.Infrastructure/Persistence/SqlErrors.cs`, `src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs`, `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs`
**Commit:** 439154a9
**Applied fix:** added `SqlErrors.ForeignKeyViolation` (547). `AddPageViewAsync` and `AddSamplesAsync` now catch that error, detach the rejected rows and end normally, so the beacon answers 204. Two new tests (`APageViewForAVisitClearedAMomentAgoIsDroppedWithoutAnError`, `SamplesForAVisitClearedAMomentAgoAreDroppedWithoutAnError`) failed first with the real `FK_AnalyticsPageViews_AnalyticsVisits_VisitId` and `FK_AnalyticsVitalSamples_AnalyticsVisits_VisitId` errors, then passed.
**Status:** fixed

### WR-G1-01: Two parallel first page views of one visitor create two visits

**Files modified:** `src/Csps.Application/Ports/IAnalyticsVisits.cs`, `src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs`, `src/Csps.Application/Analytics/CollectPageViewHandler.cs`, `tests/Csps.Application.UnitTests/Analytics/CollectPageViewHandlerTests.cs`, `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs`
**Commit:** 89cec3c4
**Applied fix:** new port method `StartUnlessCurrentAsync(visit, since)`. It finds and inserts in one serializable transaction (EF API only, no SQL, no trigger). A caller that loses a deadlock (error 1205) starts again, up to 5 times, and then finds the winner's visit. The handler keeps the fast path (find, then touch) and calls the new method only when no current visit exists. A caller that finds a visit touches it and adds its page view to it.
**Red run:** a parallel test (8 visitors, 3 calls each) was first run against a plain find-then-insert version of the method and failed (more than one visit). It then passed with the transaction, three runs in a row. The handler unit test for the "loses the race" case failed first, then passed.
**Status:** fixed: requires human verification. This is concurrency logic. The old `StartAsync` stays on the port (the store tests use it) but the handler no longer calls it.

### WR-G3-01: Two consent sends can overlap, and a late response can overwrite the newer choice

**Files modified:** `web/src/modules/public/consentSave.ts`, `web/src/modules/public/hooks/useConsent.ts`, `web/src/modules/public/hooks/useConsent.test.tsx`
**Commit:** 23099827
**Applied fix:** sends are queued on a per-store chain (`memory.chain`), so the second choice is posted only after the first was answered. `inFlight` is now a count, not a boolean. The "answered cookie" is recorded only by the last queued send, so a resend after a failed last send still works. The new test fires Accept All then Reject All and checks that the second request does not start until the first is answered, and that the bodies arrive in order (true, false). It failed first (two requests at once), then passed. A second guard test (resend after the last of two sends fails) passed both before and after.
**Status:** fixed: requires human verification (ordering logic)

### WR-G3-02: Map frame stays loaded after the visitor rejects the map

**Files modified:** `web/src/modules/public/consentSave.ts`, `web/src/modules/public/hooks/useConsent.ts`, `web/src/modules/public/components/MapCard.tsx`, `web/src/modules/public/components/contact.test.tsx`
**Commit:** 3992bae4
**Applied fix:** the review's suggested transition check would not have worked. The map is already off when the visitor taps Show Map, so `mapAllowed` never goes from true to false. Instead the store now counts saved choices that turn the map off (`mapRefusals`, set through a new `choseMap` member of `SaveHost`). `MapCard` clears its one-time tap when that count rises (state adjusted during render). A save that leaves the map on keeps the frame. New tests: tap Show Map then Reject All gives no iframe (failed first, then passed), and tap then a save with the map on keeps the iframe.
**Status:** fixed: requires human verification

### WR-G4-03: A rounded display value can contradict its rating word at the thresholds

**Files modified:** `web/src/modules/admin/components/PageSpeedCard.tsx`, `web/src/modules/admin/components/PageSpeedCard.test.tsx`
**Commit:** 3d85f0dd
**Applied fix:** LCP, CLS and INP now round up (to 0.1 s, 0.01 and 1 ms), with a tiny allowance so an exact value such as 0.3 is not pushed up. A value over a limit can no longer show as the limit (2530 ms shows "2.6 s", CLS 0.104 shows "0.11", INP 200.4 shows "201 ms"), and exact limits stay (2.5 s, 0.10, 200 ms). Six new table tests; the three "just over" rows failed first. One existing test changed: 12345 ms now shows "12.4 s" (was "12.3 s").
**Status:** fixed: requires human verification. This changes the figures a Manager reads by up to one display step. The review offered other options (more decimals, whole milliseconds). Rounding up was the review's own simplest suggestion and needs no thresholds in the browser, but the owner may prefer another style.

### WR-G4-01: A failed "business today" call leaves a custom-range page loading forever

**Files modified:** `web/src/modules/admin/hooks/useVisitorStatsToday.ts` (new), `web/src/modules/admin/components/StatsCustomRange.tsx`, `web/src/modules/admin/pages/VisitorStatsPage.tsx`, `web/src/modules/admin/pages/VisitorStatsPage.test.tsx`, `web/src/modules/admin/hooks/useVisitorStatsToday.test.tsx` (new)
**Commit:** c9ee7713 (shared with WR-G4-02, because both use the new hook)
**Applied fix:** the route now reads the failure of the date call. A custom range with no date shows the ErrorState and Try Again (which asks for the date again) and no longer reports loading. New page test: a shared custom-range link with the orders probe answering 500 shows "Couldn't load the visitor stats.", Try Again loads the figures. It failed first, then passed.
**Status:** fixed

### WR-G4-02: After 5 minutes the cached business today is dropped and custom dates silently stop applying

**Files modified:** same commit as WR-G4-01
**Commit:** c9ee7713
**Applied fix:** new hook `useVisitorStatsToday` keeps the last date it was given, so the range inputs keep their limits and typed ranges still apply after the held answer goes stale. Used by the route and by `StatsCustomRange`. Tests: gives the date, keeps it after 6 minutes (Date faked), asks for nothing when not enabled. The red run was a missing module (the hook did not exist yet).
**Status:** fixed

### WR-G5-02: Showcase demo reconfigures the live consent store and never restores it

**Files modified:** `web/src/dev/previews/demoConsent.ts`, `web/src/dev/previews/OpenedCookieSettings.tsx`, `web/src/dev/previews/StaticConsentBar.tsx`, `web/src/modules/public/hooks/useConsent.ts`, `web/src/dev/demoConsent.test.tsx` (new)
**Commit:** 584b6b59
**Applied fix:** `reconfigure` now returns the options it replaced. `seedDemoConsent` remembers the first set (the real cookie reader and the real GPC signal), and both demo components return `restoreDemoConsent` from their effects. The comment on `reconfigure` now says the showcase uses it. Two new tests (Cookie Settings demo and cookie bar demo unmount) failed first on the real assertion (`gpc` still true), then passed.
**Differs from the review:** the review suggested a `restoreConsentStore()` in `useConsent.ts`. That cost about 670 B of public JavaScript in the budget build, which has only about 350 B of room (see below), so the options-returning form was used.
**Status:** fixed: requires human verification

### WR-G5-01: "Manager views add nothing" e2e test can fail on other specs' traffic

**Files modified:** `web/e2e/visitor-stats.spec.ts`, `web/e2e/consent.spec.ts`
**Commit:** 61f50924
**Applied fix:** option 1 of the review. The Manager test now reads the Terms row, opens `/terms` and reads it again under `withSiteContentLock`. The consent "Clear my cookies" journey, the only other non-locked spec that opens `/terms`, now opens it under the same lock (the Terms sweep already ran under it). The false "no other journey opens it" comment was rewritten, and the Manager test's timeout is 480 s because the lock can take up to 6 minutes.
**Evidence:** both edited specs were run in the chromium project and passed (2 passed, 28.2 s). A timing flake cannot be proven fixed by one pass; the fix removes the cause the review named.
**Status:** fixed: requires human verification

## Skipped Issues

All four need an owner decision, so none was changed.

### WR-G1-02: The hashed address prefix is stored for 13 months and nothing reads it

**File:** `src/Csps.Application/Analytics/CollectPageViewHandler.cs:100-112`, `src/Csps.Domain/Analytics/AnalyticsVisit.cs:52-53`
**Reason:** needs owner decision. Dropping `IpHash` is a schema drop (a one-way door), and keeping it changes what the Privacy Policy must say.
**Options:**
1. Stop writing it now and drop the column in a later migration after you approve. Recommended: nothing reads it, and storing less personal data is the safer privacy position.
2. Keep it and write down its purpose (in the decision log and the Privacy Policy).
3. Leave it as it is.
**Original issue:** the hash of the address prefix is written to every visit and kept 13 months, but no code reads it, and its day salt is deleted after two days.

### WR-G1-03: The visitor id and consent cookie gates can be forged, so referrer names and unique visitors can be poisoned

**File:** `src/Csps.Domain/Analytics/ReferrerName.cs:40-58`, `src/Csps.Application/Analytics/IdentifiedCollection.cs:17-22`, `src/Csps.Application/Analytics/CollectPageViewHandler.cs:104-112`
**Reason:** needs owner decision. Signing the visitor id changes the cookie format and the security posture (old cookies stop working). Limiting referrer names changes what the Manager sees and what is stored.
**Options:**
1. Check referrer names as real host names (labels 1 to 63 characters, no leading or trailing hyphen, at least one dot, no trailing dot) and keep them. Recommended first step: it stops junk such as `a`, `..` and bare IP addresses and keeps real source names.
2. Store only the fixed groups (Facebook, Messenger, Instagram, Google, Direct) and one "Other site" bucket. Simplest and closes the unbounded growth, but the Manager loses the real site names.
3. Also sign the visitor id with a server key so only ids the server issued count. Strongest, but a security change to plan on its own.
**Original issue:** a script can set both cookies by hand with fresh ids and post page views with any referrer name, inflating unique visitors and adding spam rows to the referrer list and `DailyReferrerCount`.

### WR-G2-03: One visitor id can write unlimited page view and speed sample rows, and anyone can get a visitor id

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs:36-51, 63-74`, `src/Csps.Server/Controllers/AnalyticsController.cs:36-74`
**Reason:** needs owner decision. A cap needs a number you choose (for example 200 page views per visit), and one speed sample per visit, page and metric needs a unique index (a schema change, additive but still a migration).
**Options:**
1. Add a unique index on (visit, page, metric) so a visit keeps one sample each, and cap page views per visit (for example 200). Recommended: it closes both growth paths. The answer stays 204.
2. Cap only the speed samples (the one-per-metric index) and leave page views alone.
3. Accept the risk for now and note it in the backlog. The anonymous counter is already documented as inflatable.
**Original issue:** no cap per visit, page or metric, so one script could write about 500,000 rows a day, all kept 13 months, and drag the speed figures to any value.

### WR-G2-04: Row-creating anonymous endpoints are limited per address only, and an IPv6 /64 is trivially rotated

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:109-146`
**Reason:** needs owner decision. A site-wide ceiling is a rate-limit number you pick (the review suggests 600 a minute), and a /48 grouping changes who shares a bucket.
**Options:**
1. Add one site-wide ceiling chained to the per-address limit for the four anonymous write routes, for example 600 a minute. Recommended: simple, and it protects the one small database.
2. Group IPv6 by /48 instead of /64 for those routes (a second step, and it may put one office or carrier into one bucket).
3. Do both.
**Original issue:** a client with a /48 or larger IPv6 block gets a fresh allowance in every /64, so consent and clear rows can grow without limit (kept 13 months) and could fill the host's one database.

## Evidence

All commands ran in the main checkout on 2026-11-18. The preflight was run first and showed ports 5180, 5115, 7028 and 5199 free and no other dev or test processes. `CSPS_TEST_SQL=localdb` was set only inside the test processes. Gitleaks found no leaks on every staged change.

.NET (`dotnet test --project ...`, MTP):
- `Csps.Infrastructure.IntegrationTests`, namespace `...Analytics`: 85 passed, 0 failed.
- `Csps.Server.IntegrationTests`, namespace `...Analytics`: 143 passed, 0 failed.
- `Csps.Application.UnitTests`: 3303 passed, 0 failed.
- `Csps.ArchitectureTests`: 290 passed, 0 failed.
- No build warnings were printed in any of these runs.

Web (`vitest`, `tsc`, `eslint`):
- `src/modules/public`: 48 files, 856 passed (run after WR-G3-01).
- `src/modules/admin`: 95 files, 2239 passed, 0 failed (includes the new hook, page and speed card tests).
- `src/dev`, `src/modules/public`, the showcase files: 63 files, 1388 tests, all passing after the last fix (one test of mine was first wrong about the store's starting state and was corrected, see the git history of `src/dev/demoConsent.test.tsx`).
- `src/test` (layout, no-long-dash, cookie inventory, legal content, build config): 16 files, 276 passed.
- `npm run typecheck`: clean. `npm run lint` (`--max-warnings 0`): clean. Prettier check on the changed files: clean.
- `npm run build:budget` passes. Public route figures with the dev routes in the build: Privacy 149,633 B and Contact 149,508 B against the 150,000 B limit (about 350 B of room), admin 223,268 B against 250,000 B.
- Playwright, chromium project only, for the two edited specs: 2 passed (28.2 s).

**Not run:** the whole web suite as one command, the other four Playwright projects (firefox, webkit, pixel, iphone), the whole .NET Server and Infrastructure integration suites outside the Analytics namespaces, and the visual parity suite.

## Things worth knowing

- **Bundle room is very small.** The public JavaScript budget has about 350 B of room (Privacy 149,633 B of 150,000 B in the budget build). While fixing WR-G5-02 a new test file placed in `web/src/dev/previews/` added about 680 B to every public route and broke the budget gate. `web/src/dev/kit.ts` pulls every `*.tsx` in `previews/` into the build with an eager glob. The test now lives in `web/src/dev/`. Anyone adding files to `previews/` should keep this in mind. This relates to IN-G5-08 (the R1 and R2 reserve options need your yes).
- **WR-G4-01 and WR-G4-02 share commit c9ee7713** because both edits use the same new hook in the same files. Each has its own tests.
- **Dead port member:** `IAnalyticsVisits.StartAsync` is no longer called by the handler. It is kept because the store tests use it. It can be removed in a later clean-up.

---

_Fixed: 2026-11-18T15:10:00-05:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
