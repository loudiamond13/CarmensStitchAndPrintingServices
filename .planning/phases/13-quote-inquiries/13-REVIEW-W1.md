---
phase: 13-quote-inquiries
wave: 1 (plans 13-01 to 13-04)
created: 2026-11-22T19:30:00-06:00
updated: 2026-11-22T19:30:00-06:00
reviewed: 2026-11-22T19:30:00-06:00
depth: standard
files_reviewed: 70
files_reviewed_list:
  - .github/workflows/maintenance.yml
  - docs/api/quote-requests.md
  - docs/operations/ci.md
  - docs/operations/cloudinary-setup.md
  - docs/operations/mail-setup.md
  - docs/operations/maintenance.md
  - src/Csps.Application/Maintenance/CloudinaryUsageJob.cs
  - src/Csps.Application/Maintenance/StraySweepJob.cs
  - src/Csps.Application/Ports/IQuoteRequestStore.cs
  - src/Csps.Application/Ports/QuoteProductLine.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequest.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequestValidator.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
  - src/Csps.Domain/Content/LegalPages.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestInputs.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestStatus.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261122221314_AddQuoteRequests.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
  - src/Csps.Server/Controllers/OrderImagesController.cs
  - src/Csps.Server/Controllers/ProductLinePhotosController.cs
  - src/Csps.Server/Controllers/PublicQuoteRequestsController.cs
  - src/Csps.Server/Controllers/SharePictureController.cs
  - tests/Csps.Application.UnitTests/Maintenance/CloudinaryUsageJobTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestRequestValidatorTests.cs
  - tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs
  - tests/Csps.Domain.UnitTests/Content/LegalPagesTests.cs
  - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
  - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestFixtures.cs
  - tests/fixtures/legal-pages.json
  - web/scripts/maintenance.mjs
  - web/scripts/maintenance.test.ts
  - web/src/components/states/Note.test.tsx
  - web/src/components/states/Note.tsx
  - web/src/components/states/states.recipe.ts
  - web/src/modules/admin/orderPhotosSchemas.test.ts
  - web/src/modules/admin/orderPhotosSchemas.ts
  - web/src/modules/admin/siteContentSchemas.ts
  - web/src/modules/public/components/LegalPage.test.tsx
  - web/src/modules/public/components/QuotePhotoPicker.test.tsx
  - web/src/modules/public/components/QuotePhotoPicker.tsx
  - web/src/modules/public/components/quoteForm.recipe.ts
  - web/src/modules/public/copy.ts
  - web/src/modules/public/legalPages.ts
  - web/src/modules/public/legalPrivacy.ts
  - web/src/modules/public/pages/LegalPages.test.tsx
  - web/src/modules/public/pages/PrivacyPolicyPage.test.tsx
  - web/src/modules/public/quotePhotos.test.ts
  - web/src/modules/public/quotePhotos.ts
  - web/src/test/legal-content.node.test.ts
  - web/src/test/legal-pages.node.test.ts
  - web/src/utils/images.test.ts
  - web/src/utils/images.ts
  - web/src/utils/phone.test.ts
  - web/src/utils/phone.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 13 Wave 1: Code Review Report
*Created: 2026-11-22T19:30:00-06:00 · Updated: 2026-11-22T19:30:00-06:00*

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 70 (test files read for reliability only; the generated migration designer and OpenAPI snapshot were not read line by line)
**Status:** issues_found

## Summary

Wave 1 covers the anonymous quote create (13-01), the photo picker and its rules (13-02), the daily maintenance schedule with the monthly usage check (13-03) and the Privacy Policy draft (13-04).

The core create path is sound. I traced the request through the controller, validator, handler, domain `Receive`, store and the table:

- Default-deny holds: the controller declares `[AllowAnonymous]` and is in the authorization matrix.
- The record carries no creator, status or order member, so a forged body member has nothing to bind to (SEC-08, CWE-915).
- Time comes from the business clock; money is not involved.
- No inline SQL, no trigger, no JSON column. The migration matches the model, and the check constraints match the enum ranges.
- The validator and the domain use the same constants and the same trimming, so the two layers cannot disagree on a length.
- The product line lookup is a LINQ query, never a string.

No blocker was found. There are 2 warnings (stale "monthly" statements left behind by the D-34 change, and a monthly usage alarm that is committed before it is delivered) and 6 info items. Nothing here is a new finding for the missing rate limiter and bot guards on the create endpoint: that is known and deferred to plan 13-06.

## Warnings

### WR-01: Stale "monthly cleanup" and "once a month" statements remain after the D-34 change to a daily run

**File:** `docs/operations/ci.md:340`, `docs/operations/cloudinary-setup.md:191`, `docs/api/order-images.md:22`, `docs/api/order-images.md:170`, `docs/api/site-content.md:168`, `docs/api/site-content.md:470`
**Issue:** Plan 13-03 changed the workflow, the runbook and three controller summaries (and the generated types) to a daily run. Six places were missed, and some now contradict the pinned workflow:
- `ci.md:340` says "Maintenance calls the site's maintenance endpoint once a month". The line right below it says the cron is `17 19 * * *` (every day).
- `cloudinary-setup.md:191` says "The monthly cleanup looks at both folders".
- `order-images.md` (lines 22 and 170) and `site-content.md` (lines 168 and 470) say a removed file "leaves the store on the next monthly cleanup run". The matching controller summaries were changed to "daily", so the API docs and the generated OpenAPI text now disagree.

The architecture test `TheRunbooksDescribeTheWorkflow` only checks for fixed phrases, so it does not catch this.
**Fix:** Replace each phrase with the daily wording, as was done in the three controllers:
```text
docs/operations/ci.md:340            "once a month"          -> "every day"
docs/operations/cloudinary-setup.md:191  "The monthly cleanup" -> "The daily cleanup"
docs/api/order-images.md:22,170      "next monthly cleanup run" -> "next daily cleanup run"
docs/api/site-content.md:168,470     "next monthly cleanup run" -> "next daily cleanup run"
```
Add a test line that the runbooks and API docs no longer contain "monthly cleanup", so the next schedule change cannot leave the same gap. Bump the `updated:` stamp on each edited file.

### WR-02: The usage check commits the month cursor before its alarm is delivered, so one lost response silences the plan alarm for the whole month

**File:** `src/Csps.Application/Maintenance/CloudinaryUsageJob.cs:85`
**Issue:** `cursors.SaveAsync(CursorName, month, ...)` runs right after the usage read and before the lines (including the "over 80%" and "photo size limit below the upload limit" failed lines) are built or sent. Those lines reach the owner only through the run's HTTP answer to the GitHub script. If that answer is lost (script timeout, network drop, runner cancelled after the server committed), the month is already marked as checked. Every later daily run then returns an empty report, so the red run the owner depends on never comes, and the first chance to see it is the next month. The plan is only checked once a month, and visitors can now upload photos anonymously, so an unnoticed full plan breaks real leads. The doc says the month moves "only after a successful read", which is true of the read but not of the delivery.
**Fix:** The monthly pace is an owner ruling (D-34), so keep it. Narrow the gap with one of these:
- Move the `SaveAsync` to after the lines are built (this does not fix a lost response, but it removes a window where an exception between the read and the return marks the month).
- Better: when the check finds a failed line, do not move the cursor, so the red line repeats on every daily run until the owner fixes the plan. A healthy month is still checked once, and only an unhealthy one repeats.
```csharp
var failed = usage.CreditsPercent > AlarmPercent || usage.StoragePercent > AlarmPercent
    || (usage.ImageMaxBytes > 0 && usage.ImageMaxBytes < uploadSettings.MaxBytes);
// build lines ...
if (!failed)
{
    await cursors.SaveAsync(CursorName, month, cancellationToken).ConfigureAwait(false);
}
```
Update the runbook sentence "turns at most one run red per month" and the matching tests if you take the second option. If the owner wants strictly one red run, record that ruling next to D-34.

## Info

### IN-01: Privacy Policy flips to draft (noindex, out of the sitemap) as soon as this wave merges, before the quote form exists

**File:** `src/Csps.Domain/Content/LegalPages.cs:18`, `web/src/modules/public/legalPages.ts:30`
**Issue:** `Approved: false` with version 1.1 follows D-28 and is pinned by tests, so the behavior is deliberate. The effect is that the live Privacy Policy, which the owner approved at 1.0, becomes a draft: it is sent with `noindex` and leaves `sitemap.xml` (tests were edited to match). The retention lines it now states (6 months for unconverted requests, spam photos within a day) describe jobs that later plans build (13-16 and others). This wave collects personal data (name, phone, email) at the new endpoint while the policy that covers it is a draft and the purge does not exist yet. Plan 13-01's summary already says the branch must not deploy before 13-06; the same hold applies to 13-25 (policy approval) and the 6-month purge.
**Fix:** No code change. Add the privacy approval (13-25) and the retention purge to the release checklist next to the 13-06 limiter hold, so a mid-phase deploy of `main` cannot publish a collecting endpoint with an unapproved policy and no purge.

### IN-02: A line deleted between the lookup and the save gives a 500 instead of a 400

**File:** `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs:50`
**Issue:** `FindShownLineAsync` reads the line outside the save transaction. If a Manager deletes (or the purge removes) the line in the gap, the insert violates `FK_QuoteRequests_ProductLines_ProductLineId` and the visitor gets the generic production 500. The gap is milliseconds wide, so this is rare, and the middleware rolls back and does not store the answer, so a retry works. Low risk.
**Fix:** Optional: do the lookup inside the `InTransactionAsync` callback, or accept the rare 500. Note the choice in the plan summary.

### IN-03: The client phone cap (32) is wider than the quote form's cap (30), and the quote form has no client mirror yet

**File:** `web/src/utils/phone.ts:6`, `src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs:21`
**Issue:** The server refuses a number typed over `QuoteRequestRules.ContactNumberMaxLength` (30, the order limit) before parsing. The shared client helper `phoneE164` only caps at `PHONE_INPUT_MAX` (32). A 31 or 32 character number such as `0917 123 4567` plus 18 spaces passes the helper and fails on the server. OR-3 requires the browser to mirror every server rule. The form schema is a later plan (13-09), so there is no live bug yet.
**Fix:** In the 13-09 schema add an explicit `.max(30)` on the number text before calling `phoneE164`, with a test pinned to the server constant. Also confirm the schema requires `isMobileE164` (the server refuses landlines on this form, the helper accepts them).

### IN-04: `QuoteRequestRules` accepts control characters in the name, team and message

**File:** `src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs:137`
**Issue:** The rules trim and check length only. A visitor can send CR/LF or other control characters in `customerName` or `teamName`. They are stored as typed (EF parameters make that safe). The risk is later: plan 13-10 builds an alert email and the staff screens from this text. A name with a line break placed in an email subject or header would be header injection. Orders have the same behavior, so this is consistent, but this is the first anonymous source of such text.
**Fix:** In 13-10, never put these fields in a header or subject unchanged (strip or replace control characters there), and add a test. Optionally reject control characters in `customerName` and `teamName` in `QuoteRequestRules.Check` and mirror it in the client schema.

### IN-05: Two picks made close together can drop files without the "not added" notice

**File:** `web/src/modules/public/components/QuotePhotoPicker.tsx:137`
**Issue:** `addFiles` checks a pick against `latest.current.length` before the first pick has finished. If a second batch is dropped while the first is still being read (`checkQuotePhotos` awaits `readHead` per file), both batches see the same count. Both are accepted by the check, then `[...latest.current, ...result.accepted].slice(0, rules.maxPhotos)` cuts the extra files with no refusal and no count line. The visitor loses files silently. It needs two drops within a few milliseconds, so it is an edge case. Related: picking the same file twice adds it twice (no duplicate check), and a late preview for a removed photo is written back into `previews` after `remove` filtered it (the entry stays until the next removal, holding one data URL).
**Fix:** Serialize picks (chain each `addFiles` on the previous promise), or after the merge compute the dropped count and show the same `leftOut` line. Guard the preview write: `setPreviews` only when `latest.current.includes(next)`.

### IN-06: `CloudinaryUsageJob` returns an empty report on the quiet days, so a daily run shows no sign that the check was skipped on purpose

**File:** `src/Csps.Application/Maintenance/CloudinaryUsageJob.cs:70`
**Issue:** On 28 to 30 days of each month the job adds no line at all. A person reading the run summary sees no usage line and cannot tell "skipped by design" from "job missing". The runbook explains it, but the run itself does not.
**Fix:** Optional: return one plain (not failed) line such as "Cloudinary usage: checked on the first run of the month" on the quiet days. This adds one line to the run output and the existing test `AddsNoLineLaterTheSameMonth` and the integration test would change with it.

---

_Reviewed: 2026-11-22T19:30:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
