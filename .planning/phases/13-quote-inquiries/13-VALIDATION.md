---
phase: "13"
slug: "quote-inquiries"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-21T20:34:24-06:00"
updated: "2026-11-26T00:10:00-06:00"
---

# Phase 13: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `13-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 (MTP v2), Shouldly, NSubstitute, FakeTimeProvider, ArchUnitNET. Web: Vitest 5 + RTL + user-event + MSW 3 + in-house axe matcher. E2E: Playwright 1.63 + @axe-core/playwright |
| **Config file** | `global.json`, `tests/Directory.Build.props`, `web/vitest.config.ts`, `web/playwright.config.ts` |
| **Quick run command** | `CSPS_TEST_SQL=localdb dotnet test --project tests/<Project> --filter-class "*<Class>*"` or `npm --prefix web run test -- --run <path>` |
| **Full suite command** | after `preflight.ps1 -Ports 5180,5115,7028,5199`: `dotnet test Csps.slnx` and `npm --prefix web run verify` |
| **Estimated runtime** | quick about 30 s; full about 15 to 25 min |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched test files.
- **After every plan wave:** preflight, then `dotnet test Csps.slnx`, `dotnet format Csps.slnx --verify-no-changes --no-restore`, `npm --prefix web run verify`, `npm --prefix tools/openapi-gen run check`.
- **Before `/gsd-verify-work`:** full suites green, `npm --prefix web run e2e` for the `@quote` tags in all five projects, `npm --prefix web run lighthouse`.
- **Max feedback latency:** 60 seconds for the quick command.

---

## Per-Task Verification Map

Task IDs are filled in by the planner and executor. The requirement map below is the contract each task must hit. Statuses audited 2026-11-24 by `/gsd-validate-phase 13` (targeted runs: Domain 116/116, Application 316/316, web 1407/1407 in 70 files, Server integration 740/740 in 17 classes, Infrastructure integration 37/37). Re-audited the same day after the UI review fixes: only `quoteRequests.recipe.ts` changed, and its new `quoteRequests.recipe.node.test.ts` plus `QuoteRequestsPage.test.tsx` and `no-long-dash.node.test.ts` pass, 44/44 in 3 files. Re-audited 2026-11-25 after gap plan 13-27 and the 21 review fixes: every changed behavior has a test; run today: Application unit 3517/3517, web 245/245 in the 8 changed files; integration and e2e results come from the fix runs recorded earlier the same day (13-27-SUMMARY.md, 13-REVIEW-FIX-BACKEND.md, 13-REVIEW-FIX-E2E.md), because LocalDB was not reachable from this session.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| INQ-01 | Field rules and messages (name, team, PH mobile only, email, product choice, range, message ≤ 2,000) | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CreateQuoteRequestRequestValidatorTests"` | ✅ | ✅ green |
| INQ-01 | zod schema mirrors every server message | unit (web) | `npm --prefix web run test -- --run src/modules/public/quoteSchemas.test.ts` | ✅ | ✅ green |
| INQ-01 | Create saves text, answers id and slots; replay with same key returns the same answer | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateQuoteRequestTests"` | ✅ | ✅ green |
| INQ-01 | Form states: errors, sending, success, rate limited, failed, maybe-sent; keeps typed values | component | `npm --prefix web run test -- --run src/modules/public/components/QuoteForm.test.tsx` | ✅ | ✅ green |
| INQ-02 | Photo by magic bytes, ≤ 10 MB, ≤ 25 MP, slot 0..4, wrong key or id gives the same 404, private folder `{root}/quotes/` | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UploadQuotePhotoTests"` | ✅ | ✅ green |
| INQ-02 | Picker refuses wrong type, over 10 MB, a sixth photo, before sending; previews; focus after Remove | component | `npm --prefix web run test -- --run src/modules/public/components/QuotePhotoPicker.test.tsx` | ✅ | ✅ green |
| INQ-02 / D-03 | With storage failing, the request is saved, the alert is queued and the slot shows missing | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuotePhotoFailureTests"` | ✅ | ✅ green |
| INQ-03 | Honeypot filled or ticket too young: success-shaped answer, nothing saved, log counter | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteBotGuardTests"` | ✅ | ✅ green |
| INQ-03 | Expired ticket: 400 ticket code; client refetches and resends once | integration + component | `*QuoteBotGuardTests`; `QuoteForm.test.tsx` | ✅ | ✅ green |
| INQ-03 | Sixth create from one address in the window: 429 with Retry-After; settings validated at start | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteRateLimitTests"` | ✅ | ✅ green |
| INQ-04 | Alert row commits with the request; rollback queues nothing; no attachment; subject and message cut; HTML-escaped | unit + integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteAlertEmailTests"` | ✅ | ✅ green |
| INQ-04 / D-09 | 21st alert in an hour becomes one overflow email; two parallel creates never exceed 20 | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteAlertCapTests"` | ✅ | ✅ green |
| INQ-05 | Status machine: free moves, Converted only by conversion, history rows | unit (Domain, 100%) | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*QuoteRequestTests"` | ✅ | ✅ green |
| INQ-05 | List filters, pill counts, search on name, team, phone digits; q over 100 chars is a 400; New count | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListQuoteRequestsTests"` | ✅ | ✅ green |
| INQ-05 | Stale version 409; Spam queues photo removals; Manager delete (not Converted) queues removals and audits | integration | `*QuoteRequestStatusTests`, `*DeleteQuoteRequestTests` | ✅ | ✅ green |
| INQ-05 | Every new endpoint × {anonymous, Admin, Manager} | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | ✅ | ✅ green |
| INQ-05 | Inbox URL state, pills roving focus, NavCount names, fifth tab | component | `npm --prefix web run test -- --run src/modules/admin/pages/QuoteRequestsPage.test.tsx src/components/navigation/Sidebar.test.tsx` | ✅ | ✅ green |
| INQ-06 | Prefill values; order save links and sets Converted; second save 409 with order number; filtered unique index | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteConversionTests"` | ✅ | ✅ green |
| INQ-06 | 2,000-char message prefills Notes and passes the order schema | unit (web) | `npm --prefix web run test -- --run src/modules/admin/orderFormSchemas.test.ts` | ✅ | ✅ green |
| INQ-06 / D-22 | Permanent order delete removes the linked request and queues its photos | integration | `*PermanentlyDeleteOrderTests` | ✅ | ✅ green |
| INQ-07 | Unconverted older than 6 months purged with photos queued; converted kept | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*QuoteRequestRetentionJobTests"` | ✅ | ✅ green |
| INQ-07 | Stray sweep covers `{root}/quotes/`; inventory knows quote photo ids | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*StraySweepJobTests"` | ✅ | ✅ green |
| INQ-08 | Notice text and link; Privacy 1.1 approved 2026-11-25 (D-45) in `legalPages.ts`, `LegalPages.cs` and the fixture | component + node | `npm --prefix web run test -- --run src/test/legal-pages.node.test.ts` | ✅ | ✅ green (2026-11-25, quick 261125-w4m) |
| INQ-05, INQ-07 / G-13-11 | Removal job accepts only the three own folders (`orders/`, `content/`, `quotes/`), refuses lookalike roots and folders; sweep and job share one folder list (13-27) | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageRemovalJobTests"` and `"*PublicIdsTests"`, `"*StraySweepJobTests"` | ✅ | ✅ green (2026-11-25) |
| INQ-05 / G-13-11 | Spam on a request with photos, then a maintenance run, removes the photos; content photos too (13-27) | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ImageCleanupRunTests"` | ✅ | ✅ green (10/10, 13-27-SUMMARY.md) |
| INQ-02 / G1-WR-01 | An upload cut off mid-way queues its photo for removal and always finishes the slot write | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*UploadQuotePhotoHandlerTests"` | ✅ | ✅ green (2026-11-25) |
| INQ-03 / G3-WR-02, G4 | Bot checks run before form validation; forged young ticket refused by signature; no-puzzle create route; parallel posts released together | unit + integration | `*CreateQuoteRequestHandlerTests`; `*QuoteBotGuardTests`, `*CreateQuoteRequestTests`, `*QuoteAlertCapTests`, `*QuoteSenderLimitTests`, `*QuoteRateLimitTests` | ✅ | ✅ green (45/45, 13-REVIEW-FIX-BACKEND.md) |
| INQ-07 / G3-WR-01 | Retention job rolls back when a request is converted mid-batch | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*QuoteRequestRetentionJobTests"` | ✅ | ✅ green (15/15, 13-REVIEW-FIX-BACKEND.md) |
| INQ-04 / D-48 | Send Test Email says why it failed: address can't receive mail (422), no saved address (409), too many (429), other | component | `npm --prefix web run test -- --run src/modules/admin/components/QuoteAlertsCard.test.tsx` | ✅ | ✅ green (2026-11-25) |
| INQ-01, INQ-02 / G5 | Failed-send box hidden while a retry runs; previews keep drawing when a photo is removed; focus moves into the picker after the first pick | component | `npm --prefix web run test -- --run src/modules/public/components/QuoteForm.test.tsx src/modules/public/components/QuoteFormPhotos.test.tsx src/modules/public/components/QuotePhotoPicker.test.tsx` | ✅ | ✅ green (2026-11-25) |
| INQ-05 / G6-WR-01 | Inbox shows no empty state while a kept page waits for the next view | component | `npm --prefix web run test -- --run src/modules/admin/pages/QuoteRequestsPage.test.tsx` | ✅ | ✅ green (2026-11-25) |
| INQ-08 / D-45 | Stray-photo sentence ends "How long we keep it"; /privacy leaves DRAFT, drops noindex and is back in sitemap.xml | node + component + integration | `npm --prefix web run test -- --run src/test/legal-content.node.test.ts src/modules/public/pages/PrivacyPolicyPage.test.tsx src/modules/public/pages/LegalPages.test.tsx` and `SeoEndpointTests` | ✅ | ✅ green (2026-11-25, quick 261125-w4m; `ShellHeadTests` needs LocalDB, runs in CI) |
| PERF-01 | Contact within budget (per the OQ-2 ruling) | build gate | `npm --prefix web run build:budget` | ✅ | ✅ green (post-merge gate 2026-11-24, contact 148.42 of 150 KB) |
| A11y, CSP | Contact, inbox, request page: zero axe, no CSP errors, 320 to 1920 px | e2e | `npm --prefix web run e2e -- --grep "@quote"` (after preflight) | ✅ | ✅ green (13-24 sweep: 150 of 150 across 5 projects, 2026-11-24) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Domain tests: `tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs`, `QuoteRequestRetentionTests.cs`
- [x] Application tests: validators and handlers (create, photo, status, note, delete, prefill, alert test send)
- [x] Server integration tests: create, photo, bot guards, rate limits, cap, conversion, list, status, delete, authorization rows
- [x] Infrastructure integration tests: retention job, inventory, email rendering, migration script check
- [x] Web tests: `quoteSchemas.test.ts`, `QuoteForm.test.tsx`, `QuotePhotoPicker.test.tsx`, `quoteService.test.ts`, admin pages and services, `quoteRequestsSchemas.test.ts`
- [x] E2E spec with a `@quote` tag and MSW/Testing fixtures for the public form and inbox

No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quote alert reaches the live staff inbox | INQ-04 | Needs the real SMTP account and the owner's address | Owner sets the Quote alerts address on the live site, presses "Send test email", confirms it arrives |
| First live Gallery photo loads on a phone (carry-over D-49 / D-133) | n/a | Live Cloudinary and a real phone | Owner adds one Gallery photo, opens it on a phone, checks it loads from res.cloudinary.com with no CSP error |
| Privacy Policy 1.1 and the form notice approved (plan 13-25, D-28) | INQ-08 | Legal text goes final only by the owner's own approval | Done: owner answered A (D-45, 2026-11-25); applied by quick 261125-w4m, the DRAFT-pinning tests now pin the approved state |
| Lighthouse performance 0.92 to 0.94 against 0.95 (P13-BL-30) | PERF | Owner ruling needed; D-29 treats load time as report-only | Owner accepts the gap or asks for a load-time quick task |
| Phone and screen-reader pass of the Contact form, inbox and request page | INQ-01, INQ-05, INQ-06 | axe and e2e cover the automated part only | Owner follows the manual checks list in the phase 999.9 DECISIONS.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-24, re-validated 2026-11-25 after 13-27, the review fixes and quick 261125-w4m (D-45) (every automated row green; the manual-only rows wait on the owner)

## Validation Audit 2026-11-24

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
