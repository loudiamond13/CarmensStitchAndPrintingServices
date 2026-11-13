---
phase: 11-public-site-content-management
created: 2026-11-13T07:20:00-06:00
updated: 2026-11-13T07:20:00-06:00
review_path: .planning/phases/11-public-site-content-management/11-REVIEW.md
iteration: 1
findings_in_scope: 48
fixed: 21
skipped: 1
owner: 7
deferred: 11
elsewhere: 8
status: partial
---

# Phase 11: Code review fix report

*Created: 2026-11-13T07:20:00-06:00 · Updated: 2026-11-13T07:20:00-06:00*

**Source review:** `.planning/phases/11-public-site-content-management/11-REVIEW.md` (48 findings: 0 critical, 18 warning, 30 info)
**Branch:** `worktree-agent-a3edead195a1cdddc`, on top of `b6796ce5`
**Where the checks ran:** in the isolated git worktree of this agent (its own `web/node_modules` from `npm ci --ignore-scripts`, its own `bin` and `obj`), not in the main checkout. The numbers can be repeated in the main checkout after the merge.

## Summary

| Outcome | Count | Findings |
|---|---|---|
| Fixed (one commit each) | 21 | WR-A-02, WR-A-03 (look-ahead part), WR-B-01, WR-C-01, WR-C-02, WR-C-03, WR-D-01, WR-D-03, WR-E-01, WR-E-02, WR-E-03, IN-A-01, IN-B-04, IN-C-02, IN-D-01, IN-D-02, IN-D-04, IN-D-05, IN-D-06, IN-E-03, IN-F-02 |
| Skipped, blocked | 1 | WR-A-01 |
| Owner item (not changed) | 7 | WR-B-02, WR-D-02, IN-B-03, IN-B-05, IN-D-03, IN-E-04, IN-F-06 |
| Deferred | 11 | IN-A-02, IN-A-03, IN-A-04, IN-A-05, IN-B-01, IN-B-02, IN-C-01, IN-C-03, IN-E-01, IN-E-02, IN-E-05 |
| Handled in the phase-end e2e pass | 8 | WR-F-01, WR-F-02, WR-F-03, WR-F-04, IN-F-01, IN-F-03, IN-F-04, IN-F-05 |
| Total | 48 | |

WR-A-03 is fixed in its look-ahead part and also carries an owner item (the copy for a far reopening date), so it is counted once, under Fixed. No finding was found wrong.

Every fix has a failing test first. Where a fix only strengthens a test (WR-E-01, WR-E-02, WR-E-03, WR-D-03), the new check was shown to fail on a broken version of the code, or the old test is the thing that was weak (see each row). No package was added or bumped. No schema change, migration, trigger or raw SQL. Nothing under `web/e2e/`, the `e2e` npm script, `tests/Csps.Testing` or `TestingSiteContentSeeder` was touched.

## Outcome of every finding

### Warnings

| Id | Outcome | Commit | What was done |
|---|---|---|---|
| WR-A-01 | Skipped: blocked by file ownership | none | See "Blocked" below. The fix needs five link values changed in `tests/Csps.Testing/PublicContentSeeding.cs`, which the e2e agent owns. |
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
| WR-F-01 | Handled in the phase-end e2e pass | none | Another agent owns it. |
| WR-F-02 | Handled in the phase-end e2e pass | none | Another agent owns it. |
| WR-F-03 | Handled in the phase-end e2e pass | none | Another agent owns it. |
| WR-F-04 | Handled in the phase-end e2e pass | none | Another agent owns it. |

### Info

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
| IN-F-01 | Handled in the phase-end e2e pass | none | Another agent owns it. |
| IN-F-02 | Fixed | `afe0f5d6` | `barlowNoPesoPlugin` stops the build through `this.error` when a face would be left with no range (an empty range is invalid CSS and would widen the face). The test that pinned `''` now expects the error. |
| IN-F-03 | Handled in the phase-end e2e pass | none | Another agent owns it. |
| IN-F-04 | Handled in the phase-end e2e pass | none | Another agent owns it. |
| IN-F-05 | Handled in the phase-end e2e pass | none | Another agent owns it. |
| IN-F-06 | Owner item | none | See below. |

## Blocked

### WR-A-01: domain-level link, email and postal checks

**Why it is not done:** the review is right. The six link rules, the email shape and the postal code live only in `UpdateSiteSettingsRequestValidator`. But `SiteSettings.UpdateBusinessInfo` is also called by `PublicContentSeeding.Demo()` in `tests/Csps.Testing/PublicContentSeeding.cs`, and its links (`https://maps.example.test/...`, `https://facebook.example.test/...`, `https://instagram.example.test/...`, `https://tiktok.example.test/...`) are not on the allow-list. A domain check would make that helper throw in about nine integration test files. That file is in the area the e2e agent owns, so it was not touched.

**The change, ready to apply after the e2e pass:**
1. Domain: put `IsPostalCode`, `IsContactEmail` (one `@` with text on both sides, at most 254 characters, no bracket placeholder) and their messages next to the link rules in `SiteLinks`. In `SiteSettings.UpdateBusinessInfo`, after the `Optional(...)` calls, add an error for each of the six links, the postal code and the email that fails its rule, with the same messages as the validator. Make `UpdateSiteSettingsRequestValidator` call the same helpers, so there is one source of truth.
2. Tests that must change with it: the five link values in `PublicContentSeeding.Demo()` (use `https://maps.app.goo.gl/abc123`, `https://www.google.com/maps/embed?pb=sample`, `https://www.facebook.com/cspsdemo`, `https://www.instagram.com/cspsdemo`, `https://www.tiktok.com/@cspsdemo`, which `SiteSettingsWriteTests` already uses); the matching assertions in `PublicContentReaderTests` (lines 45 to 49 and 110), `PublicSiteEndpointTests` (60 to 62) and `ShellHeadTests` (the `sameAs` pair at line 54); and the `Valid()` values and assertions in `SiteSettingsBusinessInfoTests`. `ShellTestFactory` builds the public DTO directly and needs no change.
3. New domain tests: each bad link, a bad postal code and a bad email are refused with the validator's words, and a valid set still passes.

## Owner items

The owner is away. Nothing below was changed. Each has 2 to 3 options, recommendation first.

### WR-B-02: a Manager-editable column is in `HasData`

1. **Recommended: keep the model, add a schema test.** A test that fails when any migration after the baseline holds an `UpdateData` on `SiteSettings`. No migration change, and it catches the day a seeded default is edited. Reason: it removes the risk without a schema change.
2. Move `Tagline` (and ideally `BusinessName`) out of the `HasData` object with a hand-written migration. Cleanest model, but it changes migrations.
3. Accept the risk and write it down. The columns are new, so nothing is overwritten today.

### WR-D-02: the phone tap zones are named "Previous photo" and "Next photo"

`11-UI-SPEC.md` (the Lightbox lines, and 02 D-06) names the zones "Previous photo" and "Next photo". They move between gallery items, and the 56 px desktop buttons call the same action "Previous image" and "Next image".

1. **Recommended: name the zones "Previous image" and "Next image"** (use `COPY.previousImage` and `COPY.nextImage`, delete the two spare keys, update `GalleryLightbox.test.tsx`). Reason: one name for one action, and a screen reader user on an item with three photos is no longer sent to another team's item by "Next photo".
2. Keep the names and add a hidden description such as "Goes to the next gallery item".
3. Keep as ruled. The thumbnail row ("Show photo 2 of 3") is the real photo selector.

### WR-A-03 (copy part): how a reopening date far away is worded

The look-ahead is fixed. The client still prints only the day name for any reopening more than a day away ("Opens Friday 9:00 AM"). With a 31-day closure that is a Friday weeks later, which reads like the next Friday. The UI spec has no wording for a date. `11-UI-SPEC.md` (HoursCard) also says the Opens part is left out when nothing opens "in the next 14 days"; it is now 38 days, so please confirm that number.

1. **Recommended: print the date when the reopening is more than 6 days away**, for example "Opens Dec 24, 9:00 AM". The server already sends the date.
2. Print both: "Opens Thursday, Dec 24, 9:00 AM".
3. Keep the day name only, and cut the client's reach back to 6 days so a far date shows nothing.

### IN-B-03: the public read 429 says "Too many attempts"

1. **Recommended: add a wording for the public read limit:** "This page is busy right now. Wait a moment, then try again." Reason: the current text reads like a sign-in lockout.
2. Keep "Too many attempts from this address".
3. Other wording from the owner.

### IN-B-05: consent is only a domain rule

1. **Recommended: add `CK_Orders_ShownNeedsConsent` in a forward-only migration**, after checking that no migrated order breaks it. Reason: consent is the Data Privacy Act basis for D-11, and the repo already uses CHECK constraints for such rules.
2. Keep the domain rule and add a test that scans the table for a shown row with no consent.
3. Accept as is.

### IN-D-03: "CSPS Shop" and the social link names are fixed text

1. **Recommended: the map label shows `site.businessName`**, and the social link names stay as they are (they name the profile, not the shop). Reason: after a rename the page would show two names.
2. Record the ruling that all of this brand text stays fixed (the UI spec lists "CSPS Shop" as copy).
3. Use the business name in all of them.

### IN-E-04: the Testing site-content route has no database-name guard

Not reachable in Release or Production. In a Debug host in the Testing environment, an anonymous POST rewrites site content on whatever database the connection string names.

1. **Recommended: make `TestingSiteContentSeeder.ResetAsync` refuse any database except `CSPS_E2E` and `CSPS_Test_<guid>`**, with the existing target guard. Reason: it matches the dev seed rule and costs one check. It has to wait for the e2e pass, which owns that file.
2. Leave it. The earlier Testing routes work the same way.
3. Also require a shared secret header on the route.

### IN-F-06: the owner review tool covers only Home

1. **Recommended: add targets for `/products`, `/gallery`, `/contact` (Blush only) and `/admin/site-content` (both themes, signed in).** Reason: these are the substance of the phase and D-23 is the owner's screenshot review.
2. Keep the list and say in the comment that the e2e screenshots cover the rest.
3. Leave as is.

## Checks

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
| `gitleaks git --log-opts=b6796ce5..HEAD` | 21 commits scanned, no leaks. Every commit was also scanned staged by the pre-commit hook. A grep of the diff for local paths, user names and `BetsLLC` found none. |

## Flakes seen (not caused by these fixes)

The machine was saturated by other sessions during the runs (CPU load at 100 percent, the e2e host and its SQL Server running). Test timeouts of 5 seconds and the 15 second request budgets were hit by tests these commits do not touch.

- **`Csps.Server.IntegrationTests`, full run:** the 14 failures were `TemporaryPasswordTests`, `ListOrdersEndpointTests`, `GalleryMoveTests`, `ManagerEmailChangeTests`, `OrderPaymentsEndpointTests`, `OrderPeopleTests`, `MustChangePasswordTests`, `StaffMoneyBalanceTests`, `OrderConcurrencyTests`, one `AuthorizationMatrixTests` row (a 500 on `PUT .../payments/...`) and the two timing tests. Their durations were 14 to 21 seconds each. All the non-timing classes pass when rerun (185 of 185, matrix 545 of 545).
- **`AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus`:** answered a 500 on some row in 2 of 4 full-class runs while the machine was busy (a different row each time, and it failed the same way with the IN-E-03 change taken out). It passes alone and in the last full-class run (545 of 545).
- **The two timing tests** (`OrderListTimingTests`, `ExpenseListTimingTests`, "answers under 300 ms at p95 on five years of data"): they measured p95 values of 250 to 350 ms while the machine was busy. These commits do not touch the order list or the expense list. See the result of the quiet rerun below.
- **vitest, full suite:** 10670 tests, 38 failed, in 16 files, all in files these commits do not touch (the heavy admin form and modal files, and some node tests that load the Vite config), mostly "Test timed out in 5000ms". Rerun alone, or with a 60 second timeout, every one of them passes: 16 of 16 files. One more failure, `third-party-notices.test.ts`, is a very slow test (it took 515 seconds in the busy run); see the result below.
- `ProductsPage.test.tsx` (axe) and `GalleryPage.test.tsx` (lightbox chunk) each failed once in a busy run and passed alone.

### Rerun results

- **vitest, the 16 files that failed in the busy full run:** all pass when run alone or with a 60 second timeout (`OrderRefundModal` and `StaffMoneyPage.owner` alone: 36 of 36; `OrderFormPage` alone: 84 of 84; `third-party-notices.test.ts` alone: 11 of 11, it takes 96 seconds; the rest passed in the sequential 60 second run). Together with the 374 files that passed in the full run, that is all 390 web test files green (not in a single run).
- **`ExpenseListTimingTests`:** passed on the quieter rerun (1 of 1).
- **`OrderListTimingTests`:** still failed on the quieter rerun: the customer-name search measured p95 412.8 ms against the 300 ms limit (default list 139.6 ms, product type filter 213.1 ms, the rest under 200 ms). No commit here touches the order list or its query. The repo already records the same kind of failure for the expense list under machine load (`.planning/debug/expense-list-timing-load-flake.md`). I could not run this test on the base commit (each run is 6 to 8 minutes and the machine stays busy), so this is not proven to be unrelated: please repeat it alone on a quiet machine.

---

_Fixed: 2026-11-13_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
