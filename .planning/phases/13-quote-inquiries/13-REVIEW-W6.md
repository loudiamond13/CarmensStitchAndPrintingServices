---
phase: 13-quote-inquiries
created: 2026-11-23T11:48:11-06:00
updated: 2026-11-23T11:48:11-06:00
reviewed: 2026-11-23T11:48:11-06:00
depth: standard
wave: 6
plans: [13-13, 13-14, 13-15]
files_reviewed: 59
files_reviewed_list:
  - docs/api/site-content.md
  - src/Csps.Application/Content/SendQuoteAlertTestHandler.cs
  - src/Csps.Application/Content/SiteContentErrors.cs
  - src/Csps.Application/Email/AuthEmail.cs
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Infrastructure/Email/EmailRenderer.cs
  - src/Csps.Server/Composition/ContentApplicationRegistration.cs
  - src/Csps.Server/Controllers/SiteSettingsController.cs
  - src/Csps.Server/Security/RateLimitSettings.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - tests/Csps.Application.UnitTests/Content/SendQuoteAlertTestHandlerTests.cs
  - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Content/QuoteAlertTestEmailTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
  - tests/Csps.Testing/CspsApiFactory.cs
  - web/e2e/quote-form.spec.ts
  - web/e2e/quote-inbox.spec.ts
  - web/e2e/testing-api.ts
  - web/src/components/brand/Icon.test.tsx
  - web/src/components/brand/icons.ts
  - web/src/modules/admin/auditCopy.test.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/BusinessInfoTab.tsx
  - web/src/modules/admin/components/QuoteAlertsCard.test.tsx
  - web/src/modules/admin/components/QuoteAlertsCard.tsx
  - web/src/modules/admin/components/QuoteRequestsTable.tsx
  - web/src/modules/admin/components/QuoteStatusFilter.test.tsx
  - web/src/modules/admin/components/QuoteStatusFilter.tsx
  - web/src/modules/admin/components/quoteRequests.recipe.ts
  - web/src/modules/admin/hooks/useQuoteRequestsListParams.ts
  - web/src/modules/admin/hooks/useQuoteRequestsQuery.ts
  - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
  - web/src/modules/admin/pages/QuoteRequestsPage.test.tsx
  - web/src/modules/admin/pages/QuoteRequestsPage.tsx
  - web/src/modules/admin/quoteRequestsCopy.ts
  - web/src/modules/admin/quoteStatus.test.ts
  - web/src/modules/admin/quoteStatus.ts
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/services/quoteRequestsService.test.ts
  - web/src/modules/admin/services/quoteRequestsService.ts
  - web/src/modules/admin/services/siteSettingsService.test.ts
  - web/src/modules/admin/services/siteSettingsService.ts
  - web/src/modules/admin/siteContentCopy.ts
  - web/src/modules/public/components/GalleryBody.tsx
  - web/src/modules/public/components/GalleryLightbox.test.tsx
  - web/src/modules/public/components/GalleryLightbox.tsx
  - web/src/modules/public/components/ProductArticle.test.tsx
  - web/src/modules/public/components/ProductArticle.tsx
  - web/src/modules/public/components/QuoteForm.test.tsx
  - web/src/modules/public/components/QuoteForm.tsx
  - web/src/modules/public/components/products.test.tsx
  - web/src/modules/public/hooks/useQuoteProductPreselect.test.ts
  - web/src/modules/public/hooks/useQuoteProductPreselect.ts
  - web/src/modules/public/pages/GalleryPage.test.tsx
  - web/src/test/quoteRequestFixtures.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 13, Wave 6: Code Review Report

*Created: 2026-11-23T11:48:11-06:00 · Updated: 2026-11-23T11:48:11-06:00*

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 59
**Status:** issues_found

## Summary

This review covers plans 13-13 (the Manager's test email to the Quote alerts address), 13-14 (the `?product=` preselect on the quote form) and 13-15 (the staff Quote Requests list). The diff is `8ff68a31..d1383294`. The generated `openapi.v1.json` and `api.generated.ts` were left out. Test files were read only for reliability and gaps. No tests, dev servers or e2e runs were started. Each finding below was traced in the code, and the TanStack Query claims were checked against the installed `@tanstack/query-core` 5.103.2.

Items already parked as P13-BL-13 (test email wording, the 422 case, the one failure toast for 409 and 422, the per-connection limit, the empty audit detail, the trimmed compare) and P13-BL-14 (card order, stale line words, "1 requests", refresh on focus, link color, empty icon) are not raised again.

Checked and found sound:

- **13-13, authorization (CWE-862):**
  - The class carries `Policies.Staff` and the action adds `Policies.Manager`, so both must pass. Default-deny stays.
  - The matrix row gives anonymous 401, Admin 403 and Manager 409. The integration test also checks 403 for an Admin and that nothing is queued.
  - The Site Content route is behind `requireManager`, so an Admin never sees the button.
- **13-13, where the mail goes:** the request has no body. The handler reads the saved address from `ISiteContentStore` only, so a typed but unsaved address can never be mailed, and the endpoint cannot be used to mail a stranger.
- **13-13, privacy (CWE-532):** the audit entry has a null detail. The handler logs nothing. The outbox stores the content encrypted. The integration test scans every captured log event for the address.
- **13-13, flood guard:**
  - `quote-alerts-test` is a sliding window per connection address, 3 in 10 minutes, checked at start-up, with a whole-second `Retry-After`. ASP.NET Core keys each policy's partitions by policy name, so this window is not shared with other limits.
  - The limiter runs before authentication and before the idempotency gate, so a replay or a refused call cannot dodge it.
  - The 409 is rolled back by the idempotency middleware and not stored. The stored 422 is safe, because `useSubmission` takes a new key after a final 4xx.
- **13-13, Result and errors:** `Error.Conflict` maps to 409 and `Error.BusinessRule` to 422, both through `ToHttpResult` and ProblemDetails. The `UndeliverableRecipientException` catch is narrow: the outbox throws it before rendering, so it cannot hide a template bug (unlike W5 WR-05). No inline SQL, no trigger, no `DateTime.Now`.
- **13-13, the button:** `Button` swallows clicks while `aria-disabled`. The reason is linked with `aria-describedby`. `type="button"` keeps it out of the Save flow. The baseline moves on save and on Load Latest, so the "unsaved" reason clears at the right time.
- **13-14, open redirect (CWE-601):**
  - `ProductArticle` and `GalleryLightbox` build the link only from a key that passes `isLineKey`, under a fixed `/contact?product=` prefix. Otherwise they use plain `/contact`.
  - `useQuoteProductPreselect` only compares the value with the loaded lines. It never puts it in a link, a navigation or a request, and it never rewrites the address. The page-view beacon still sends the path only (the e2e checks it).
- **13-14, races:** the key is read once. It is applied only after the lines arrive and only while nothing is chosen, then dropped for good. A choice made before the lines arrive wins. Send Another does not apply it again, because the form stays mounted behind the success card and the hook state survives. The Select option values (`line:{key}`) match what the hook sets.
- **13-15, URL state (WEB-10):**
  - `open` is the default, so it never shows in the URL. `?status=pending` is removed with one replace by the shared normalizer.
  - A status or search change replaces the entry and resets the page. A page change pushes.
  - The search is trimmed and cut to 100 UTF-16 units without a lone surrogate, which matches the server validator. Page sizes are 10, 20, 50 or 100 on both sides.
  - `useSettledListParams` gives one request per settled search.
- **13-15, privacy and injection:** the title is fixed (T-13-44). Visitor text is React text only (T-13-43). The detail link uses `encodeURIComponent(item.id)`. The calls live in `modules/admin/services` over `apiClient` (OR-5).
- **13-15, a11y basics:**
  - The pills are a toolbar named "Show" with one tab stop, arrow wrap, Home and End, `aria-pressed` and 44px height.
  - Empty cells use `EmptyValue` through `ResponsiveTable`. The "photos arrived" words are visually hidden with the space outside the span.
  - The polite region is always present (the W5 WR-04 lesson is applied).
- **Style rules:** no em or en dash was added in `web/src`, `web/e2e` or the server code. The test data uses `example.com`, `.invalid`, UI-spec personas and random fake mobiles.

There is no blocker. The two warnings are both in the inbox's 60-second refresh: one makes the error states blink, re-announce and drop keyboard focus, and one stops a second "new request" from being announced.

## Warnings

### WR-01: The 60-second refresh keeps running after a failure, so the error states blink, interrupt screen readers and drop keyboard focus

**File:** `web/src/modules/admin/hooks/useQuoteRequestsQuery.ts:19-21`, `web/src/modules/admin/pages/QuoteRequestsPage.tsx:82-86, 103-113, 133, 153`

**Issue:**
- `refetchInterval: 60_000` and `refetchOnWindowFocus: 'always'` are the only polling options in the web app. TanStack Query keeps polling after an error: the interval timer in `queryObserver.js` (line 270) checks only focus, not the query status.
- **A failed later refresh:** `staleAt` is null while `query.isFetching` is true. So every 60 seconds, and on every window focus, the stale line and its Try Again button unmount during the retry and mount again when it fails.
- **A failed first load:** a fetch with no data resets the query to `status: 'pending'` (`fetchState` in `query.js` line 486-495). So `firstFailed` turns false, the `ErrorState` unmounts and the skeleton shows. Then the `ErrorState` mounts again when the fetch fails.
- Both the stale line and `ErrorState` are `role="alert"`. Each new mount is read out assertively. A staff member using a screen reader hears "Couldn't load the quote requests." or "Showing figures from 9:41 AM. Couldn't refresh." once a minute while the server or the phone's data is down. Each read cuts off whatever they were doing.
- If keyboard focus is on Try Again when the timer fires, the button is removed and focus falls to `<body>`. The plan says "new rows never move focus", but this moves it with no action from the user (WCAG 2.4.3).
- The Dashboard uses the same stale-line rule, but it does not poll, so there the blink happens only when the user presses Try Again.
- Not covered by a test: `a failed later refresh keeps the rows and shows the stale line` calls `refetchQueries` once. It never lets the interval fire after the error.

**Fix:**
- Stop the automatic refresh while the last read failed, so only Try Again (or recovery on a later focus) reads again:
```ts
refetchInterval: (query) => (query.state.status === 'error' ? false : QUOTE_REQUESTS_REFRESH_MS),
refetchOnWindowFocus: (query) => (query.state.status === 'error' ? false : 'always'),
```
- Keep the stale line mounted while a retry runs, and show the retry as busy instead of removing it:
```tsx
const staleAt = query.isError && data !== undefined ? formatBusinessTime(new Date(query.dataUpdatedAt).toISOString()) : null;
// ...
<Button variant="ghost" size="sm" className={hitAreaClasses} pending={query.isFetching} onClick={retry}>
```
- Add a page test with fake timers: fail a refresh, focus Try Again, advance 60 seconds, then expect focus still on Try Again and no second alert mount.

### WR-02: The "new quote request" line never clears, so a second arrival with the same count is not announced

**File:** `web/src/modules/admin/pages/QuoteRequestsPage.tsx:68-77, 172-174`

**Issue:**
- `arrived` is set to `COPY.arrived(added)` when a refresh brings New requests, and it is never set back to empty.
- A request arrives and the region reads "1 new quote request." Ten minutes later another one arrives. React sets the same text again, so the DOM does not change, and screen readers announce nothing (WCAG 4.1.3). The same is true for any repeat of the same count.
- The old line also stays in the hidden region after a view change. A screen reader user reading to the end of the page later hears "1 new quote request." for a news item that is long past, or one from another pill.
- The page test checks only the first announcement.

**Fix:**
- Clear the text before each new message, or add a counter so the content always changes. For example, clear it on a timer after it is read, and clear it on a view change:
```tsx
useEffect(() => {
  if (arrived === '') return;
  const id = setTimeout(() => { setArrived(''); }, 5_000);
  return () => { clearTimeout(id); };
}, [arrived]);
```
- In the render-time branch, call `setArrived('')` when `seen.view !== view`.
- Add a test with two refreshes that each bring one New request, and expect the second to be announced.

## Info

### IN-01: Requests that slide onto the page or move back to New are announced as "new"

**File:** `web/src/modules/admin/pages/QuoteRequestsPage.tsx:38-41, 69-75`

**Issue:** "New" means "a New-status id on this page that the last answer did not have". Two common changes meet that test without any new lead:
- On a full first page of Open, a colleague marks a request Closed. The next older New request slides up from page 2 and is counted.
- A colleague moves a request back from Spam or Closed to New (D-15 allows it). It joins the Open list and is counted.

In both cases the polite line says "1 new quote request." when none arrived.

**Fix:** Optional. Count only New rows received after the newest `receivedAtUtc` in the last answer for the same view. Or compare `counts.open`, or the New count from `newCount()`, between answers.

### IN-02: The success toast can name an address the test did not go to

**File:** `web/src/modules/admin/components/QuoteAlertsCard.tsx:31, 43-47`

**Issue:**
- The toast names `savedAddress` from this form's baseline. The server mails the address it holds now. If another Manager saved a different address after this form opened, the toast names the wrong one.
- `useSubmission` is called with no data, so every press counts as "the same submission". After a timeout the key is kept, even if the Manager then saves a new address. If the timed-out call did run, the next press replays its stored 202. The toast then names the new address, but the email went to the old one and nothing goes to the new one.
- This is rare, but the whole point of the button is to prove which address works.

**Fix:** Pass the saved address as the submission data, so a changed address always gets a new key: `useSubmission<string, unknown>((key) => siteSettingsService.sendQuoteAlertTest(key))` and `test.submit(saved)`. For the two-Manager case, the 202 could carry the address it used, so the toast names it. That costs nothing in privacy, because only a Manager calls it. Or accept the gap.

### IN-03: Each name in the inbox links to a page that does not exist yet

**File:** `web/src/modules/admin/components/QuoteRequestsTable.tsx:59`, `web/src/modules/admin/routes.tsx:194-195`

**Issue:** The name links to `/admin/quote-requests/{id}`, but only the list route is registered. Until plan 13-19 adds the request page, a click opens the admin "not found" page. The routes Back test passes through that page today. This is expected mid-phase, but it must not ship alone.

**Fix:** None now. Make sure 13-19 lands before `/gsd-ship 13`, and that the routes Back test then checks the request page heading.

## Owner decisions

- **IN-02:** whether the 202 should say which address it used is a small API change. The owner may prefer to accept the gap.
- **All other findings:** these are fixes with no change to behavior or wording that the owner has ruled on.

---

_Reviewed: 2026-11-23T11:48:11-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
