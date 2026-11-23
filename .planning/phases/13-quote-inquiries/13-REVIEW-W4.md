---
phase: 13-quote-inquiries
created: 2026-11-22T23:59:00-06:00
updated: 2026-11-22T23:59:00-06:00
reviewed: 2026-11-22T23:59:00-06:00
depth: standard
wave: 4
plans: [13-07, 13-09]
files_reviewed: 71
files_reviewed_list:
  - docs/api/site-content.md
  - docs/web/budgets.md
  - src/Csps.Application/Content/SiteSettingsDto.cs
  - src/Csps.Application/Content/UpdateSiteSettingsHandler.cs
  - src/Csps.Application/Content/UpdateSiteSettingsRequest.cs
  - src/Csps.Application/Content/UpdateSiteSettingsRequestValidator.cs
  - src/Csps.Application/Ports/ISiteContentStore.cs
  - src/Csps.Domain/Content/BusinessInfo.cs
  - src/Csps.Domain/Content/SiteSettings.cs
  - src/Csps.Domain/Content/SiteSettingsDefaults.cs
  - src/Csps.Infrastructure/Content/SiteContentStore.cs
  - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
  - src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261123031035_AddQuoteAlertsEmail.cs
  - src/Csps.Infrastructure/Seeding/SiteContentSeedStep.cs
  - src/Csps.Server/Endpoints/PublicPageHeads.cs
  - tests/Csps.Application.UnitTests/Content/GetSiteSettingsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Content/UpdateSiteSettingsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Content/UpdateSiteSettingsRequestValidatorTests.cs
  - tests/Csps.Domain.UnitTests/Content/SiteSettingsBusinessInfoTests.cs
  - tests/Csps.Server.IntegrationTests/Content/PublicSiteEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Content/SiteSettingsEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Content/SiteSettingsWriteTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ShellPageTests.cs
  - tests/Csps.Testing/PublicContentSeeding.cs
  - tests/Csps.Testing/SiteContentStores.cs
  - web/e2e/contact.spec.ts
  - web/e2e/quote-form.spec.ts
  - web/playwright.config.ts
  - web/scripts/budget.test.ts
  - web/scripts/budget.ts
  - web/scripts/owner-review.mjs
  - web/scripts/owner-review.test.ts
  - web/scripts/vite-budget-plugin.test.ts
  - web/src/core/api/http/HttpError.test.ts
  - web/src/core/api/http/HttpError.ts
  - web/src/layouts/PublicLayout.tsx
  - web/src/modules/admin/auditCopy.test.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/BusinessInfoTab.test.tsx
  - web/src/modules/admin/components/BusinessInfoTab.tsx
  - web/src/modules/admin/components/QuoteAlertsCard.test.tsx
  - web/src/modules/admin/components/QuoteAlertsCard.tsx
  - web/src/modules/admin/components/showcase/Phase11Demos.tsx
  - web/src/modules/admin/hooks/useSiteSettingsQuery.test.tsx
  - web/src/modules/admin/services/siteSettingsService.test.ts
  - web/src/modules/admin/siteContentCopy.ts
  - web/src/modules/admin/siteContentSchemas.test.ts
  - web/src/modules/admin/siteContentSchemas.ts
  - web/src/modules/public/components/BigContactButton.tsx
  - web/src/modules/public/components/CallHoursNote.tsx
  - web/src/modules/public/components/ContactBigButtons.tsx
  - web/src/modules/public/components/QuoteForm.test.tsx
  - web/src/modules/public/components/QuoteForm.tsx
  - web/src/modules/public/components/contact.recipe.ts
  - web/src/modules/public/components/contact.test.tsx
  - web/src/modules/public/components/lazyQuoteForm.ts
  - web/src/modules/public/components/quoteForm.recipe.ts
  - web/src/modules/public/copy.ts
  - web/src/modules/public/hooks/useQuoteTicket.ts
  - web/src/modules/public/pages/ContactPage.test.tsx
  - web/src/modules/public/pages/ContactPage.tsx
  - web/src/modules/public/quoteFormEvent.ts
  - web/src/modules/public/quoteFormTarget.ts
  - web/src/modules/public/quoteSchemas.test.ts
  - web/src/modules/public/quoteSchemas.ts
  - web/src/modules/public/services/quoteService.test.ts
  - web/src/modules/public/services/quoteService.ts
  - web/src/test/quoteFixtures.ts
  - web/src/test/setup.ts
  - web/src/test/siteContentFixtures.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 13, Wave 4: Code Review Report

*Created: 2026-11-22T23:59:00-06:00 · Updated: 2026-11-22T23:59:00-06:00*

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 71
**Status:** issues_found

## Summary

Plans 13-07 (Manager-only Quote alerts email) and 13-09 (public Get a Quote form). Test files were read for reliability only, and no tests were run.

Checked and found sound:

- **13-07, access and exposure:**
  - The `PUT /api/v1/site-settings` action carries `[Authorize(Policy = Policies.Manager)]` on the action, so the write is enforced on the server and not only in the UI.
  - The address reaches only the staff DTO. No public handler, snapshot or page head maps it, and an integration test searches the public answers and page heads for it.
  - The audit entry names the field and never the value (`fields=quoteAlertsEmail`). The audit label exists in `auditCopy.ts`.
- **13-07, rules and storage:** The migration is additive (one `nvarchar(254)` column with a default, plus a seed-row update). No trigger, JSON column or inline SQL was added. The domain, the FluentValidation rule and the zod rule agree on the length-first order and on the messages.
- **13-09, schema:**
  - It mirrors the server rules for UTF-16 length after trimming, the 30-character cap before the number is read, the mobile-only phone rule, the 254 email cap, the product choice and line key (40 characters), the five quantity values and the 2,000 message cap.
  - The honeypot is sent as typed. It is out of the Tab order, has `autoComplete="off"` and a name that browsers do not fill.
- **13-09, ticket flow:**
  - The form waits out the minimum time after the ticket arrives.
  - On `quote-requests.ticket-expired` it resends once, at once, with `replacementTicket` and a new key.
  - A retry of the same submission repeats the resend's key and ticket.
  - A second expired answer throws to the error box.
  - Success shows only on a 200 that followed the wait.
- **13-09, boundaries and style:**
  - API calls sit in `modules/public/services` and `fetch` stays in `core/api/http`.
  - The public side loads no TanStack Query: the quote form and its hooks use none, and `AdminLayout` is the only `@tanstack/react-query` import in the code I searched.
  - No em or en dash was found in the reviewed `web/src` files, and no real emails, paths or secrets in the added test and e2e files.

The warnings below are in the form's failure paths, one rule mismatch between the browser and the server, the alert address shape, and a coupling to a server setting.

## Warnings

### WR-01: The email rule in the browser accepts text the server refuses, and the visitor then sees a "check your internet" message

**File:** `web/src/modules/public/quoteSchemas.ts:43` (used at line 85)
**Issue:**
- `EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/` only forbids whitespace, `@` and `.` in a part. It allows `< > ( ) , ; : " [ ] \`.
- The server rule `OrderRules.IsValidEmail` requires `MailAddress.TryCreate(text)` to return an address equal to the text. A text such as `Juan<juan@gmail.com>` or `juan(home)@gmail.com` parses as a display name or a comment, so `address.Address != text` and the server answers 400 `email`.
- The comment says the client is "deliberately stricter than the server", but for these characters it is looser. That breaks OR-3 ("every rule the backend validates is checked in the browser first").
- The form does not read server field errors yet (13-12 owns them), so the visitor sees only "Couldn't send your inquiry. Check your internet connection...". No field is marked, and they cannot tell that the email is the problem.
- This is a plausible paste from a phone contact card.

**Fix:** Exclude the specials in every part:
```ts
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@.<>()[\]\\,;:"]+(\.[^\s@.<>()[\]\\,;:"]+)+$/;
```
Add accept and refuse rows for `a<b@c.com`, `a(b)@c.com`, `a,b@c.com` to `quoteSchemas.test.ts`. Better, put the accept and refuse rows in one fixture file that the .NET test also reads, as the phone rule does.

### WR-02: The quote form's lazy piece can take the whole Contact page down

**File:** `web/src/modules/public/pages/ContactPage.tsx:47-55`, `web/src/modules/public/components/lazyQuoteForm.ts:5`
**Issue:**
- `LazyQuoteForm` sits in a `Suspense` with no error boundary. If the dynamic import fails, the lazy component throws to the route error boundary and replaces the whole page. That includes the Messenger and Call buttons.
- Visitors are mostly on phones from Facebook, so a flaky connection or a deploy that renames the hashed chunk is the likely cause.
- The page head comment says "a lead is never lost to a settings read (D-03 spirit)", and this failure loses the lead and the other contact routes.

**Fix:** Wrap the lazy form in a small local error boundary, inside `ContactPage`, whose fallback is a card with a "Reload" button and the Messenger and Call actions. Add a test that rejects the import and expects the aside to survive.

### WR-03: The form's 3 second wait is a constant, but the server's minimum time is a setting from 0 to 60

**File:** `web/src/modules/public/components/QuoteForm.tsx:48`, `docs/api/quote-requests.md:132`
**Issue:**
- The server answers a send that is younger than `QuoteRequests:MinimumSeconds` with a silent 200 and a made-up id, saving nothing. The client shows "Inquiry sent".
- If the owner sets the value above 3 (the doc allows up to 60), every real visitor loses their lead and sees success. This is the "success when nothing was saved" path the flow must never have.
- The ticket answer carries `photoRules` but no minimum time. The 13-09 summary lists the coupling as a note, but it is not a ruling and there is no guard in code.

**Fix:** The safest option is to add `minimumSeconds` to `QuoteFormTicketResponse` and wait `max(that, 0)`. Otherwise, at minimum, cap `MinimumSeconds` at 3 in the startup validation, or document the 3-second limit next to the setting in `quote-requests.md`. The owner should pick, since this changes an API surface.

### WR-04: The Quote alerts address is only checked as "one @ with text on both sides"

**File:** `src/Csps.Domain/Content/SiteLinks.cs:130-139` (called from `UpdateSiteSettingsRequestValidator.cs:78-87` and `SiteSettings.cs`), mirrored by `isEmailShaped` in the admin schema
**Issue:**
- `IsContactEmail` accepts `a b@c`, `a,b@c.com`, `x@y` (no dot) and text with an internal CR or LF, for example `x@y.com\r\nBcc: z`. It has exactly one `@`, and `Trim` only strips the ends.
- This was fine for the display-only shop email. The Quote alerts address is now a mail recipient (INQ-04). A stored value the mail library cannot parse makes every alert fail, and a sender that builds headers from strings would be open to header injection.
- It is Manager-only and the audit never stores it, so this is a robustness and defence-in-depth gap, not an open hole.

**Fix:** For this field only, require no whitespace or control characters, a dotted domain and no `, ; < > ( ) " \`. Reuse the same rule that WR-01 fixes, or call `OrderRules.IsValidEmail`. Mirror it in `quoteAlertsEmailField` in `siteContentSchemas.ts`. Make the alert sender (later plan) parse with `MailboxAddress.TryParse` and skip the alert, never the quote, when parsing fails.

### WR-05: An expired-ticket answer without a replacement leaves the form stuck on the dead ticket

**File:** `web/src/modules/public/components/QuoteForm.tsx:120-130`
**Issue:**
- When the error is `quote-requests.ticket-expired` but `replacementTicket` is missing (a proxy or a future server change drops it), the code rethrows and leaves `tickets` untouched. The held ticket stays the expired one.
- Every later send, even a manual retry with new data, goes out with the same dead ticket and fails the same way. The visitor can only recover by reloading the page or by sending a success first.

**Fix:** In the `replacement === undefined` branch, when the code is `TICKET_EXPIRED_CODE`, call `tickets.refresh()` before the throw, so the next send waits for a fresh ticket:
```ts
if (replacement === undefined) {
  if (isHttpError(error) && error.code === TICKET_EXPIRED_CODE) {
    tickets.refresh();
  }
  throw error;
}
```

## Info

### IN-01: The header "Get a Quote" does nothing useful while the form is loading or after a send

**File:** `web/src/modules/public/quoteFormTarget.ts:10-16`
**Issue:** `focusQuoteForm` scrolls to the column and focuses the first `input, select, textarea` found. While the lazy piece loads, the column holds an `aria-hidden` skeleton, so nothing takes focus. After a successful send the column holds the success card, so nothing takes focus either, and the "Send Another" button is not the target.
**Fix:** Optional. When no field is found, focus the success heading or "Send Another" button, or retry once after the form mounts.

### IN-02: A `docs/api/site-content.md` `updated` timestamp moves backwards

**File:** `docs/api/site-content.md:4`
**Issue:** `updated` changed from `2026-11-22T23:55:00-06:00` to `2026-11-22T21:25:00-06:00`, which is earlier than the value it replaced. The global rule says to change only the updated value on an edit, and it should move forward.
**Fix:** Set it to the real edit time.

### IN-03: The QuoteForm header comment is long and narrates history

**File:** `web/src/modules/public/components/QuoteForm.tsx:1-6`
**Issue:** The OR-2 rule asks for minimal comments. The six-line header and the long trailing notes (for example "Pitfall 4", "D-38") are more than the code needs. This is a style note and fails no rule check.
**Fix:** Cut the header to two lines that say what the file does, and keep the ticket and resend steps as one short comment above `send`.

---

_Reviewed: 2026-11-22T23:59:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
