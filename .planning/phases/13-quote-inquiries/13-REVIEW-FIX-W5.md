---
created: 2026-11-23T09:47:17-06:00
updated: 2026-11-23T09:55:00-06:00
phase: 13-quote-inquiries
wave: 5
review: 13-REVIEW-W5.md
findings_in_scope: 10
fixed: 9
not_fixed: 1
status: partial
---

# Phase 13: Code Review Fix Report (wave 5)

*Created: 2026-11-23T09:47:17-06:00 · Updated: 2026-11-23T09:55:00-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree), with `CSPS_TEST_SQL=localdb` set on the command only. The preflight showed every port free and no other test processes before the LocalDB and e2e runs.

In scope: CR-01, WR-01 to WR-05, IN-02 to IN-05. IN-01 was out of scope: parked for the owner. WR-03 needed no code change (see below), so it is counted as not fixed, with a test that pins the behavior.

## Fixed

### CR-01 (D-03): Send waits for photos still loading or being checked

**Commits:** 5adacfaa (room in the budget), cd36fed4 (the fix), da593d62 (e2e case)
- Send now waits for the photo piece to load and check the first pick, and for any pick the picker is still checking, before the text is saved. `QuotePhotoPickerHandle` has a new `settled()`. The slot gives the form that handle from the first tap, before the picker shows, and hands over to the picker once it shows.
- While Send waits, the Send button shows Sending and the fields are read-only, so nothing typed in that moment is lost.
- The photo piece checks the first pick itself (`firstPick` in `quotePhotoKit.ts`) before the picker shows. A picker that appears while the form is sending can no longer drop it. The picker's old `firstPick` prop is gone; it takes `firstErrors` instead.
- Choose Photos shows its spinner while the photo piece loads, so a second tap cannot replace the first pick.
- A photo dropped on the picker while the inquiry is sending is refused with a plain line instead of vanishing. This is new copy (owner item 1).
- Unchanged: when the photo piece cannot load at all, the photo area shows its existing "couldn't load" line (an alert), and a send then goes without photos.
- Budget: the form imported one link class from `legal.recipe`, which pulled the whole legal page style module (about 0.86 KB gzip) into the form piece. The same class now sits in `quoteForm.recipe` (5adacfaa), and the link looks the same. The form piece went from 44.99 to 44.13 KB, then to 44.23 KB with the fix. No limit changed.

Tests: three form tests in `QuoteFormPhotos.test.tsx` (Send while the ticket and photo piece are held: the create declares `logo.png` and one upload runs, and Choose Photos is busy and opens nothing; Send while a second photo's check is held: both names are declared; a drop while sending shows the refusal), picker tests for `firstErrors`, `settled()` and the refusal while sending, and two `firstPick` tests in `quotePhotoKit.test.ts`. All three form tests failed before the fix. The new e2e case holds the ticket answer, picks a photo and presses Send at once. It failed on the code before the fix (the create had no `photos`), and passes now on chromium and webkit.
Status: fixed. Requires human verification: the timing is new behavior (logic change).

### WR-01: file names are never cut inside an emoji

**Commits:** f26df5cf, 461491fc (the test emoji written as escapes)
`cleanFileName` (web) and `ImageErrors.CleanName` (server, which the web function mirrors) now drop a lone half of an emoji and never cut a name between the two halves of one. The cut stays at 80 UTF-16 units, so both sides still give the same name.
Tests: `images.test.ts` rows for 79 letters plus an emoji (the emoji goes), 78 letters plus an emoji (it stays whole), a lone high and a lone low half, and a check that the JSON of the name has no lone `\ud8..`. `ImageErrorsTests` has the same rows. A new integration test, `ABodyWithHalfAnEmojiInAPhotoNameIsReadAsNoTicketAndSavesNothing`, posts the raw JSON and pins what the server answers today: `photos: ["\ud83d"]` gets a 400 with `quote-requests.ticket-expired` and nothing is saved, while a whole emoji in the name is saved (200). That confirms the review's trace.
Status: fixed.

### WR-02: phone search drops 0 or 63 before the 3-digit floor

**Commit:** b6b02ad6
`QuoteRequestSearchText.PhoneDigits` drops a leading `63` or `0` first, then needs 3 digits. So `0917` and `+63 917` search the same digits (`917`), and `091`, `639`, `+639` or `0 9` alone is no phone search. The 3-digit floor (P13-BL-09) stays. `docs/api/quote-requests.md` says the same.
Tests: the wrong row `091 -> 091` is gone; new rows `09171`, `+639171` and `639171` all give `9171`; `0`, `63`, `091`, `0 9`, `639`, `+639` and `+63 91` give no phone search. A new integration test shows `639`, `+639` and `091` match no stored number.
Status: fixed. The owner may want to confirm the floor applies after the prefix is dropped (owner item 2).

### WR-04 (WCAG 4.1.3): the sending-photos line is always in place

**Commits:** f9f3a703, bea0837e (a Contact page test that now finds its loading line inside the aside)
The polite `role="status"` line under the form now exists from the start, and only its text changes. While empty it takes no room above the error box (`empty:-mb-3`).
Tests: a form test that finds the empty region before Send, then sees the same element carry "Sending your photos. This can take a minute on mobile data.".
Status: fixed.

### WR-05: the alert catch stops only a refused address

**Commit:** 88f9e1df
New `UndeliverableRecipientException` (an `ArgumentException`, so older callers still see the same type). `OutboxEmailSender` throws it for a reserved `.invalid` address, and `CreateQuoteRequestHandler` catches only that. Any other error while the alert is built now surfaces.
Tests: a handler theory with an `ArgumentOutOfRangeException`, an `ArgumentNullException` and a plain `ArgumentException`: each now throws and nothing is committed (all three failed before). The refused-address test uses the new exception, and `EmailOutboxTests` checks the outbox throws exactly that type.
Status: fixed.

### IN-02: a 2-second wait before the photo retry after a busy answer

**Commit:** 1834d3d2
After a 429 or a 5xx, the one retry waits 2 seconds (`RETRY_WAIT_MS`). A network drop, 408 or 409 is still retried at once; a refusal is never retried. `Retry-After` is not read, because `HttpError` does not carry headers.
Tests: new `quotePhotoUpload.test.ts` on fake timers (no second call at 1.99 s, the second call at 2.01 s with the same key, for 429, 500 and 503; at once for network, 408 and 409; a failed retry names the photo; a 422 is not retried). The form failure tests now step a fake clock, so they take no extra real time.
Status: fixed.

### IN-03: the upload timeout comment names the right source

**Commit:** d6e86c2b
The comment now says the 120 s matches the order photo upload, as plan 13-12 set it. D-31 is gone.
Status: fixed.

### IN-04: bidi and zero-width characters are dropped from alert lines

**Commits:** 51071cca, 461491fc (the test characters written as escapes, so no hidden character sits in the source)
`QuoteAlertText.OneLine` drops Unicode format characters (`UnicodeCategory.Format`): the right-to-left override, the zero-width space, bidi marks and isolates, the BOM and the soft hyphen.
Tests: rows `Juan\u202Etxt`, `Juan\u200BCruz`, `\u200EJuan \u2066Cruz\u2069\uFEFF` and `Juan\u00ADCruz`, plus a check that no format character is left in the subject.
Status: fixed.

### IN-05: the e2e photo test is named for what it checks

**Commit:** c8f5dde8
The test is now named "a visitor sends an inquiry with a photo: the create and the upload answer 200 and no photo is named missing". The e2e host has no way to read the stored quote photo (its id is random and the staff list needs a signed-in bearer token), so the name changed, not the check. CR-01 is covered by the component tests and the new e2e case.
Status: fixed.

## Not fixed

### WR-03: the touch photo buttons already ignore a press while sending

**Commit:** 313ac76d (test only)
The review read Take Photo and Choose Photos as live while sending. They are not: the shared `Button` swallows a click when `aria-disabled` is set (WEB-09), the same rule the browse link checks by hand. The new picker test presses browse, Take Photo and Choose Photos with the form sending and expects no chooser to open. It passed before any change, which confirms there was no bug. The real loss path next to it (a photo picked or dropped while sending) is fixed under CR-01.
Status: not fixed, no bug.

### IN-01: "You won't send it twice"

Out of scope by instruction: parked for the owner. The owner decides wording.

## Flakes and other findings

- `GalleryPage.test.tsx` "puts focus back on the tile of the item last shown when the lightbox closes" failed once in a run of all `modules/public` tests. It passed alone twice (28 of 28 each time).
- e2e, webkit only: "@quote the rate limit keeps what the visitor typed" fails at `expect(send).toBeFocused()`. It fails the same way on the code before these fixes (checked by putting back the 5adacfaa web code), so it is not caused by W5. These `@quote` cases had only run on chromium before (the 13-12 note handed the other browsers to 13-24). Left for 13-24.

## Checks

- `dotnet build Csps.slnx`: Build succeeded, 0 warnings, 0 errors.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- .NET tests: Application unit tests 3421 passed; Architecture 290 passed; Infrastructure integration (`EmailOutboxTests`, `EmailRendererTests`) 102 passed; Server integration, the whole `QuoteRequests` namespace, 74 passed; Server integration image and OpenAPI classes (`GalleryAdminTests`, `ProductLinePhotoEndpointTests`, `SharePictureEndpointTests`, `OrderImageMetadataTests`, `OrderImagesEndpointTests`, `OrderImageTypesTests`, `OpenApiSnapshotTests`) 91 passed. All 0 failed. After the escape commit (461491fc), `QuoteAlertTextTests` and `ImageErrorsTests` ran again: 35 passed.
- Web: `npm run typecheck` exit 0; `npm run lint` (max warnings 0) exit 0; `npx prettier --check .` "All matched files use Prettier code style!".
- `npm run build` (fresh production build into `wwwroot` first, as the wave 5 note asks), then the whole web suite `npx vitest run`: 438 files, 11768 tests passed, no stderr lines.
- Budget (`npm run build:budget`, gzip -9): Quote form 44.23 KB of 45.00 (was 44.98 before W5); public JS contact 148.11 of 150.00; privacy 149.00 of 150.00; admin 223.56 of 250.00; CSS 20.50 of 35.00. No limit changed.
- e2e (`npm run e2e -- e2e/quote-form.spec.ts --project chromium --project webkit`): 15 passed, 1 failed (the webkit rate-limit focus check above, which fails the same way without these fixes). The new CR-01 case passed on both browsers.

## Owner items

1. **New copy for a photo dropped while sending (CR-01).** A, built: "Photos can't be added while your inquiry is sending." shows in the picker's error box. B: other words, for example "Wait until your inquiry is sent, then send this photo on Messenger."
2. **Phone search floor after the prefix (WR-02).** A, built: `0` or `63` is dropped first and 3 digits must remain, so `091` or `639` alone is no phone search. B: keep the old rule where the prefix is dropped only when 3 digits remain (then `639` matches every number).
3. **No "Getting your photos ready" line (CR-01).** A, built: while Send waits for photos, the Send button shows the existing "Sending" and Choose Photos shows its spinner; no new line. B: add a polite line such as "Getting your photos ready." (new copy, about 0.05 KB of the 0.77 KB left in the form piece).
4. **IN-01 wording.** Parked, unchanged.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
