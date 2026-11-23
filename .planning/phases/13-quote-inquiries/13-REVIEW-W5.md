---
phase: 13-quote-inquiries
created: 2026-11-23T08:46:33-06:00
updated: 2026-11-23T08:46:33-06:00
reviewed: 2026-11-23T08:46:33-06:00
depth: standard
wave: 5
plans: [13-10, 13-11, 13-12]
files_reviewed: 63
files_reviewed_list:
  - docs/api/quote-requests.md
  - src/Csps.Application/Email/AuthEmail.cs
  - src/Csps.Application/Ports/IQuoteRequestReader.cs
  - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/GetNewQuoteCountHandler.cs
  - src/Csps.Application/QuoteRequests/ListQuoteRequestsHandler.cs
  - src/Csps.Application/QuoteRequests/ListQuoteRequestsRequest.cs
  - src/Csps.Application/QuoteRequests/ListQuoteRequestsRequestValidator.cs
  - src/Csps.Application/QuoteRequests/QuoteAlertText.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestListResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestSearchText.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestSettings.cs
  - src/Csps.Infrastructure/Email/AppLinksOptions.cs
  - src/Csps.Infrastructure/Email/EmailHtmlLayout.cs
  - src/Csps.Infrastructure/Email/EmailRenderer.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
  - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
  - src/Csps.Server/Controllers/QuoteRequestsController.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/ListQuoteRequestsRequestValidatorTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/QuoteAlertTextTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/QuoteRequestSettingsTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/ListQuoteRequestsTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertCapTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertEmailTests.cs
  - web/e2e/quote-form.spec.ts
  - web/src/core/api/http/httpClient.test.ts
  - web/src/core/api/http/httpClient.ts
  - web/src/modules/admin/siteContentSchemas.test.ts
  - web/src/modules/public/components/QuoteForm.answersLoad.test.tsx
  - web/src/modules/public/components/QuoteForm.test.tsx
  - web/src/modules/public/components/QuoteForm.tsx
  - web/src/modules/public/components/QuoteFormPhotos.test.tsx
  - web/src/modules/public/components/QuoteFormResult.test.tsx
  - web/src/modules/public/components/QuoteFormResult.tsx
  - web/src/modules/public/components/QuoteMissingPhotos.tsx
  - web/src/modules/public/components/QuotePhotoPicker.test.tsx
  - web/src/modules/public/components/QuotePhotoPicker.tsx
  - web/src/modules/public/components/QuotePhotoSlot.tsx
  - web/src/modules/public/components/QuoteSendAnswers.tsx
  - web/src/modules/public/components/lazyQuotePhotoKit.ts
  - web/src/modules/public/components/lazyQuoteSendAnswers.ts
  - web/src/modules/public/components/quoteForm.recipe.ts
  - web/src/modules/public/copy.ts
  - web/src/modules/public/hooks/useQuoteTicket.test.ts
  - web/src/modules/public/hooks/useQuoteTicket.ts
  - web/src/modules/public/pages/ContactPage.formLoad.test.tsx
  - web/src/modules/public/quotePhotoKit.test.ts
  - web/src/modules/public/quotePhotoKit.ts
  - web/src/modules/public/quotePhotoUpload.ts
  - web/src/modules/public/quotePhotos.test.ts
  - web/src/modules/public/quotePhotos.ts
  - web/src/modules/public/quoteSchemas.test.ts
  - web/src/modules/public/quoteSchemas.ts
  - web/src/modules/public/services/quoteService.test.ts
  - web/src/modules/public/services/quoteService.ts
  - web/src/test/build-output.node.test.ts
  - web/src/test/quoteFixtures.ts
  - web/src/test/quotePhotoFixtures.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 13, Wave 5: Code Review Report

*Created: 2026-11-23T08:46:33-06:00 · Updated: 2026-11-23T08:46:33-06:00*

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 63
**Status:** issues_found

## Summary

This review covers plans 13-10 (the staff alert email and its hourly cap), 13-11 (the staff inbox list and the New count) and 13-12 (the photo upload after the saved text, plus the failure states). The diff is `a49b0708..HEAD`. The generated `openapi.v1.json` and `api.generated.ts` were left out. Test files were read only for reliability and gaps. No tests, dev servers or e2e runs were started.

Items already parked as P13-BL-01 to P13-BL-11 are not raised again. That covers the quiet skip with no log line, the 20-per-address cap, the photo retry rule, the one-photo wording, "not sure" versus "couldn't send", the plain line when the answer piece fails to load, the pixel check, the disabled dropdowns and the Email placeholder.

Checked and found sound:

- **13-10, header and HTML injection (CWE-93, CWE-79):**
  - `QuoteAlertText.OneLine` turns every control and white-space run into one space, so CR, LF, U+2028 and U+2029 cannot reach the subject or a labelled line. The subject is built from the cleaned, cut name.
  - Every `FieldBlock` value goes through `WebUtility.HtmlEncode` before `\n` becomes `<br>`.
  - `EmailRendererTests` covers `<b>`, `<script>` and `Bcc:` in the name, team, product and message.
- **13-10, the cap race (CWE-362):**
  - The alert is queued inside `SaveUnderLockAsync`, after the `quote-requests` lock and in the same transaction as the insert. The count, the overflow check and the enqueue are therefore serial.
  - A rolled-back request queues nothing. `ConflictRetry` drops tracked state before its second pass, so a retry never queues a second alert.
  - `ParallelSendsNeverPassTwenty` tests this with 5 parallel sends at 19.
  - The business hour is floored in the zone and turned back to UTC. Manila has no DST.
- **13-10, privacy:** the visitor is never mailed (D-10), and the outbox stores the content encrypted.
- **13-11, authorization:**
  - `QuoteRequestsController` carries `[Authorize(Policy = Policies.Staff)]` on the class, as `OrdersController` does.
  - Both handlers also refuse a token with no user id.
  - The authorization matrix lists both new actions for anonymous (401), Admin (200) and Manager (200).
  - The staff route (`/api/v1/quote-requests`) does not overlap the public one (`/api/v1/public/quote-requests`).
- **13-11, the query (CWE-943):**
  - The search uses `EF.Functions.Like` with `LikePattern.Contains` and an escape character. The phone match uses digits only.
  - The validator caps `q` at 100 characters after trimming, the page at 1 to 100000 and the size at 10, 20, 50 or 100. The status is compared by name, so `"7"` is refused.
  - No inline SQL and no `DateTime.Now`. `Result<T>` maps to ProblemDetails.
- **13-12, keys and boundaries:**
  - The upload key comes from `crypto.getRandomValues` and is kept in memory only.
  - A retry after "maybe sent" reuses the Idempotency-Key and the upload key, so the replayed create answer fits the photos.
  - `fetch` stays in `core/api/http`. The upload call is in `modules/public/services`. `allowEmptyBody` is opt-in per call.
- **Style rules:** no em or en dash was added in `web/src` or `web/e2e`. The test emails are `example.com`, `example.org`, `.invalid` or UI-spec personas.

The blocker is a photo-loss path in the picker. The warnings are one lead-loss path through file names, a phone-search gap, two picker and a11y faults, and an over-broad catch in the alert path.

## Critical Issues

### CR-01: Photos still being loaded or checked are left out of the send, and the visitor sees a plain "Inquiry sent"

**File:** `web/src/modules/public/components/QuotePhotoSlot.tsx:56-71`, `web/src/modules/public/components/QuotePhotoPicker.tsx:261-290`, `web/src/modules/public/components/QuoteForm.tsx:273-277`

**Issue:**
- The form sends the `photos` state it holds at the moment Send is pressed (`submission.submit({ values, photos })`). Photos join that state only when the picker calls `onChange`.
- On the first tap, `QuotePhotoSlot.choose` waits for both the photo kit chunk and `tickets.ready()`. Only after that does the picker mount and start `addFiles(firstPick)`.
- `addNow` then runs `checkQuotePhotos`: it reads each file's head and decodes each photo for the pixel check. For phone photos of 12 MP or more, that is a noticeable wait per file.
- During this whole window nothing on screen changes: no rows, no skeleton and no status. Send Inquiry stays enabled.
- A visitor on mobile data picks photos, scrolls down and presses Send. The text is saved with no photo names. `sent.missing` is empty, so the success card shows no missing-photos note.
- There are two more failure modes:
  - If the kit finishes loading while the form is pending, the picker mounts with `disabled=true`. `addFiles` then returns early and `firstPickDone` is already true, so the pick is dropped for good.
  - If `addNow` was already running, `onChange` lands after the send captured `[]`. The success card then replaces the form, and the photos are dropped there as well.
- This breaks D-03: "The visitor sees a message that the request arrived but the photos did not." Here staff get no photos and the visitor is never told.
- Neither the component tests nor the e2e photo test cover it. The e2e test waits for the list row before it presses Send.

**Fix:**
- Make the pick visible and make Send wait for it. Keep the extra code in the photo kit piece, because the form has only 0.02 KB of budget left. For example:

```ts
// QuotePhotoPickerHandle
settled: () => Promise<readonly File[]>; // resolves with latest.current after queue.current
```

- In `QuotePhotoSlot`, hold the in-flight load as a promise and expose the same `settled()` through `handleRef` before the picker mounts.
- In `QuoteForm`'s submit handler: `const files = (await pickerRef.current?.settled()) ?? photos;` then `submission.submit({ values, photos: files })`.
- Show a polite "Getting your photos ready" line (or skeleton rows) while the slot or picker is busy.
- Add a component test that presses Send while `loadQuotePhotoKit` or `decode` is still pending, and expects the create call to declare the photo.

No owner decision is needed unless the fix pushes the form past its 45 KB budget (D-35). If it does, the owner must choose between a raise and another cut.

## Warnings

### WR-01: A long file name with an emoji can be cut in half, and then the text itself is never saved

**File:** `web/src/utils/images.ts:206-215` (used by `quotePhotoUpload.ts:27-29` for the declared names)

**Issue:**
- `cleanFileName` caps a name with `cleaned.slice(0, 80)`, which counts UTF-16 units. A name longer than 80 units with an emoji across position 80 keeps a lone high surrogate.
- Wave 5 sends this name inside the create body (`photos: names`). `JSON.stringify` writes it as `"\ud83d"`.
- System.Text.Json refuses a lone surrogate when it reads a string, so the body cannot be read. `PublicQuoteRequestsController` (line 73-76) then falls back to `CreateQuoteRequestRequest.Empty`, which has no ticket. The likely result:
  1. The server answers `ticket-expired`.
  2. The form resends at once with the same broken name and gets the same answer.
  3. The second expired answer is thrown, and the visitor sees "Couldn't send your inquiry. Check your internet connection".
- Every retry fails the same way, so the lead is lost. It is rare (phone camera names have no emoji), but it is a lead-loss path, which this flow must never have.
- Not run: I traced this by reading the code. A test should confirm the exact server answer.

**Fix:** cut by code points, as the server's surrogate-safe `QuoteAlertText.Cut` does:
```ts
const points = Array.from(cleaned);
const limited = points.length > FILE_NAME_LIMIT ? points.slice(0, FILE_NAME_LIMIT).join('') : cleaned;
```
- Add a `quotePhotos.test.ts` or `images.test.ts` row with 79 ASCII characters plus an emoji, and expect no lone surrogate.
- Add a server integration test that posts `photos: ["\ud83d"]` and pins the answer.

### WR-02: Phone search for "091" finds nothing, and "639" or "+639" finds every number

**File:** `src/Csps.Application/QuoteRequests/QuoteRequestSearchText.cs:154-172` (pinned by `ListQuoteRequestsRequestValidatorTests.cs:110`)

**Issue:**
- The leading `0` or `63` is dropped only when 3 or more digits remain after it.
- `091`, the first three characters staff type for `0917...`, therefore stays `091`. No E.164 number (`+63917...`) contains `091`, so the phone part matches nothing until a fourth digit is typed.
- `639` (or `+639`) stays `639`, which every stored Philippine mobile number contains. The search then returns the whole group.
- The comment and `docs/api/quote-requests.md` say the floor exists "so one typed digit never matches every number", but three typed characters do exactly that.
- The test row `[InlineData("091", "091")]` pins the wrong value.

**Fix:**
- Drop the prefix first, then apply the floor to what remains. Treat a text that is only a prefix (`0`, `63`, `09`, `639`, `0 9`) as no phone search:
```cs
if (digits.StartsWith("63", StringComparison.Ordinal)) digits = digits[2..];
else if (digits.StartsWith('0')) digits = digits[1..];
return digits.Length >= MinDigits ? digits : null;
```
- Update the test rows: `091` to null, `0917` to `917`, `639` to null.
- P13-BL-09 parked only the 3-digit floor, not this mismatch. The owner may want to confirm the floor applies after the prefix is dropped.

### WR-03: Take Photo and Choose Photos still open the chooser while sending, and the chosen photos are then dropped without a word

**File:** `web/src/modules/public/components/QuotePhotoPicker.tsx:392-414` (compare `:381-383`)

**Issue:**
- The `browse` link checks `disabled` before it opens the gallery. The two touch buttons only set `aria-disabled` and always call `cameraRef.current?.click()` or `galleryRef.current?.click()`.
- While a send is pending, a phone visitor can open the camera and take a photo. `pick` then calls `addFiles`, which returns at once because `disabled` is true.
- The photo disappears with no message. A screen reader user was told the button is disabled, but it still acted.

**Fix:** guard both handlers the same way as the browse link:
```tsx
onClick={() => { if (!disabled) cameraRef.current?.click(); }}
```
Add a picker test that presses each touch button with `disabled` and expects no `click` on the hidden input.

### WR-04: "Sending your photos" is a live region that appears together with its text, so screen readers may not announce it (WCAG 4.1.3)

**File:** `web/src/modules/public/components/QuoteForm.tsx:465-470`

**Issue:**
- `<p role="status">` is mounted only when `pending && photos.length > 0`, with the text already inside it.
- NVDA and JAWS often do not read a polite live region that is inserted with its content. Only changes to a region that already exists are announced.
- The rest of the codebase keeps a persistent region and changes its text (`LoadingRegion.tsx:57`, `BusinessInfoTab.tsx:519`, `AuthCards.tsx:110`). For a send that can take minutes on mobile data, this line is the only spoken progress.

**Fix:** keep an always-present `<p role="status" aria-live="polite">` inside `quoteFormStatusClasses` and change only its text:
```tsx
<p role="status" aria-live="polite" className={quoteFormStatusTextClasses}>
  {pending && photos.length > 0 ? COPY.sendingPhotos : ''}
</p>
```

### WR-05: The quiet catch around the alert swallows every ArgumentException, so a template bug would stop every alert with no trace

**File:** `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs:184-194`

**Issue:**
- The catch is meant for one case: `OutboxEmailSender` refusing a `.invalid` recipient. But `EnqueueAsync` also runs `EmailRenderer.RenderAsync`.
- Any `ArgumentException` from rendering is caught and dropped too: an `ArgumentOutOfRangeException` from a slice, an `ArgumentNullException` from a null field, or a bad format argument.
- If a later template change throws for some input (an odd name, a missing title), every matching alert is silently lost and nothing is logged.
- D-12 says a failed alert "is logged with no address or content". P13-BL-10 parks only the choice to stay quiet for a refused address, not this wider catch.

**Fix:**
- Make the reserved-domain case explicit, so nothing else is swallowed. For example, add `bool CanReceive(string address)` to `IEmailOutbox`, check it before `EnqueueAsync`, and remove the try/catch.
- Or throw and catch a dedicated `UndeliverableRecipientException`.
- Either way, a real bug in rendering then fails loudly in tests and in the logs. The request is still saved only for the refused-address case.

## Info

### IN-01: "You won't send it twice" is only true if nothing is changed before the second press

**File:** `web/src/modules/public/copy.ts` (`contact.form.maybeSent`), `web/src/modules/public/components/QuoteForm.tsx:72-73`

**Issue:** After a timeout, the same Idempotency-Key is reused only when the values and photos are identical (`identityOf`). If the visitor fixes a typo or adds a photo before pressing again, the press is a new submission with a new key. The first request may already be saved, so staff get two. The copy promises more than the code guarantees.

**Fix:** This is a wording change for the owner. Either soften it (for example "Press Send Inquiry again without changing anything, and it won't be sent twice."), or keep the current words and accept the rare duplicate.

### IN-02: A photo retry after a 429 or 5xx goes out at once, with no wait

**File:** `web/src/modules/public/quotePhotoUpload.ts:74-86`

**Issue:** The one retry fires right after the failure. A 429 from the public upload pool (P13-BL-02: 2 at once, 4 waiting) or a 503 is likely to repeat a moment later. The photo then counts as missing even though a short pause might have saved it. No `Retry-After` is read.

**Fix:** Optional. Wait a short time before the retry (for example 2 seconds, or `Retry-After` capped at 10 seconds).

### IN-03: The upload timeout comment cites the wrong ruling

**File:** `web/src/modules/public/services/quoteService.ts:9`

**Issue:** "A photo may take a while on a slow mobile connection (D-31)". D-31 is the "Inquiry" wording ruling and has nothing to do with upload time.

**Fix:** Drop the tag, or point at the plan item that set the 120 s timeout.

### IN-04: Bidi and zero-width characters stay in the alert subject

**File:** `src/Csps.Application/QuoteRequests/QuoteAlertText.cs:36-51`

**Issue:** `OneLine` removes `Cc` control characters and white space. Format characters (`Cf`) such as U+202E (right-to-left override) and U+200B (zero-width space) survive. A visitor name with U+202E can reverse how the rest of the subject reads in some mail clients. This is a small spoofing risk with no header injection.

**Fix:** Optional. Also drop `UnicodeCategory.Format` characters in `OneLine`, and add a test row such as `"Juan\u202Etxt"`.

### IN-05: The e2e photo test says "the server stores it" but checks only two 200 answers

**File:** `web/e2e/quote-form.spec.ts:43-64`

**Issue:** The test asserts the create and upload status codes and that no "didn't upload" line shows. It never reads the stored request or photo, so a server that answers 200 and drops the file would pass. It also waits for the photo row before pressing Send, so it cannot catch CR-01.

**Fix:** Rename it to what it checks, or read the stored photo count through the testing API or the new staff list (`storedPhotoCount: 1`). Cover CR-01 in the component tests, where the timing can be controlled.

## Owner decisions

- **CR-01:** an owner decision is needed only if the fix needs more than the 45 KB form budget (D-35).
- **WR-02:** a small change to the search rule parked in P13-BL-09. The owner may want to confirm it.
- **IN-01:** a wording change in visitor copy.
- **All other findings:** these are fixes with no change to behavior or wording that the owner has ruled on.

---

_Reviewed: 2026-11-23T08:46:33-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
