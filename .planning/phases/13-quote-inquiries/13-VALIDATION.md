---
phase: "13"
slug: "quote-inquiries"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21T20:34:24-06:00"
updated: "2026-11-21T20:34:24-06:00"
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

Task IDs are filled in by the planner and executor. The requirement map below is the contract each task must hit.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| INQ-01 | Field rules and messages (name, team, PH mobile only, email, product choice, range, message ≤ 2,000) | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CreateQuoteRequestRequestValidatorTests"` | ❌ W0 | ⬜ pending |
| INQ-01 | zod schema mirrors every server message | unit (web) | `npm --prefix web run test -- --run src/modules/public/quoteSchemas.test.ts` | ❌ W0 | ⬜ pending |
| INQ-01 | Create saves text, answers id and slots; replay with same key returns the same answer | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateQuoteRequestTests"` | ❌ W0 | ⬜ pending |
| INQ-01 | Form states: errors, sending, success, rate limited, failed, maybe-sent; keeps typed values | component | `npm --prefix web run test -- --run src/modules/public/components/QuoteForm.test.tsx` | ❌ W0 | ⬜ pending |
| INQ-02 | Photo by magic bytes, ≤ 10 MB, ≤ 25 MP, slot 0..4, wrong key or id gives the same 404, private folder `{root}/quotes/` | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UploadQuotePhotoTests"` | ❌ W0 | ⬜ pending |
| INQ-02 | Picker refuses wrong type, over 10 MB, a sixth photo, before sending; previews; focus after Remove | component | `npm --prefix web run test -- --run src/modules/public/components/QuotePhotoPicker.test.tsx` | ❌ W0 | ⬜ pending |
| INQ-02 / D-03 | With storage failing, the request is saved, the alert is queued and the slot shows missing | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuotePhotoFailureTests"` | ❌ W0 | ⬜ pending |
| INQ-03 | Honeypot filled or ticket too young: success-shaped answer, nothing saved, log counter | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteBotGuardTests"` | ❌ W0 | ⬜ pending |
| INQ-03 | Expired ticket: 400 ticket code; client refetches and resends once | integration + component | `*QuoteBotGuardTests`; `QuoteForm.test.tsx` | ❌ W0 | ⬜ pending |
| INQ-03 | Sixth create from one address in the window: 429 with Retry-After; settings validated at start | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteRateLimitTests"` | ❌ W0 | ⬜ pending |
| INQ-04 | Alert row commits with the request; rollback queues nothing; no attachment; subject and message cut; HTML-escaped | unit + integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*QuoteAlertEmailTests"` | ❌ W0 | ⬜ pending |
| INQ-04 / D-09 | 21st alert in an hour becomes one overflow email; two parallel creates never exceed 20 | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteAlertCapTests"` | ❌ W0 | ⬜ pending |
| INQ-05 | Status machine: free moves, Converted only by conversion, history rows | unit (Domain, 100%) | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*QuoteRequestTests"` | ❌ W0 | ⬜ pending |
| INQ-05 | List filters, pill counts, search on name, team, phone digits; q over 100 chars is a 400; New count | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListQuoteRequestsTests"` | ❌ W0 | ⬜ pending |
| INQ-05 | Stale version 409; Spam queues photo removals; Manager delete (not Converted) queues removals and audits | integration | `*QuoteRequestStatusTests`, `*DeleteQuoteRequestTests` | ❌ W0 | ⬜ pending |
| INQ-05 | Every new endpoint × {anonymous, Admin, Manager} | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | ✅ add rows | ⬜ pending |
| INQ-05 | Inbox URL state, pills roving focus, NavCount names, fifth tab | component | `npm --prefix web run test -- --run src/modules/admin/pages/QuoteRequestsPage.test.tsx src/components/navigation/Sidebar.test.tsx` | ❌ / ✅ | ⬜ pending |
| INQ-06 | Prefill values; order save links and sets Converted; second save 409 with order number; filtered unique index | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*QuoteConversionTests"` | ❌ W0 | ⬜ pending |
| INQ-06 | 2,000-char message prefills Notes and passes the order schema | unit (web) | `npm --prefix web run test -- --run src/modules/admin/orderFormSchemas.test.ts` | ✅ add case | ⬜ pending |
| INQ-06 / D-22 | Permanent order delete removes the linked request and queues its photos | integration | `*PermanentlyDeleteOrderTests` | ✅ add case | ⬜ pending |
| INQ-07 | Unconverted older than 6 months purged with photos queued; converted kept | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*QuoteRequestRetentionJobTests"` | ❌ W0 | ⬜ pending |
| INQ-07 | Stray sweep covers `{root}/quotes/`; inventory knows quote photo ids | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*StraySweepJobTests"` | ✅ add cases | ⬜ pending |
| INQ-08 | Notice text and link; Privacy 1.1 DRAFT in both `legalPages.ts` and `LegalPages.cs` | component + node | `npm --prefix web run test -- --run src/test/legal-pages.node.test.ts` | ✅ / ❌ | ⬜ pending |
| PERF-01 | Contact within budget (per the OQ-2 ruling) | build gate | `npm --prefix web run build:budget` | ✅ | ⬜ pending |
| A11y, CSP | Contact, inbox, request page: zero axe, no CSP errors, 320 to 1920 px | e2e | `npm --prefix web run e2e -- --grep "@quote"` (after preflight) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Domain tests: `tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs`, `QuoteRequestRetentionTests.cs`
- [ ] Application tests: validators and handlers (create, photo, status, note, delete, prefill, alert test send)
- [ ] Server integration tests: create, photo, bot guards, rate limits, cap, conversion, list, status, delete, authorization rows
- [ ] Infrastructure integration tests: retention job, inventory, email rendering, migration script check
- [ ] Web tests: `quoteSchemas.test.ts`, `QuoteForm.test.tsx`, `QuotePhotoPicker.test.tsx`, `quoteService.test.ts`, admin pages and services, `quoteRequestsSchemas.test.ts`
- [ ] E2E spec with a `@quote` tag and MSW/Testing fixtures for the public form and inbox

No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quote alert reaches the live staff inbox | INQ-04 | Needs the real SMTP account and the owner's address | Owner sets the Quote alerts address on the live site, presses "Send test email", confirms it arrives |
| First live Gallery photo loads on a phone (carry-over D-49 / D-133) | n/a | Live Cloudinary and a real phone | Owner adds one Gallery photo, opens it on a phone, checks it loads from res.cloudinary.com with no CSP error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
