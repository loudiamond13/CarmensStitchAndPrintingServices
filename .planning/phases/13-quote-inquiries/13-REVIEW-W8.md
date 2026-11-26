---
phase: 13-quote-inquiries
created: 2026-11-23T16:24:06-06:00
updated: 2026-11-23T16:24:06-06:00
reviewed: 2026-11-23T16:24:06-06:00
depth: standard
wave: 8
plans: [13-18, 13-19]
files_reviewed: 59
files_reviewed_list:
  - docs/api/quote-requests.md
  - src/Csps.Application/Ports/IQuoteRequestReader.cs
  - src/Csps.Application/Ports/IQuoteRequestStore.cs
  - src/Csps.Application/QuoteRequests/AddQuoteRequestNoteHandler.cs
  - src/Csps.Application/QuoteRequests/AddQuoteRequestNoteRequest.cs
  - src/Csps.Application/QuoteRequests/AddQuoteRequestNoteRequestValidator.cs
  - src/Csps.Application/QuoteRequests/DeleteQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/GetQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestAuditDetail.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestDetailResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestNote.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestNoteConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261123212018_AddQuoteRequestNotes.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
  - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
  - src/Csps.Server/Controllers/QuoteRequestsController.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/AddQuoteRequestNoteHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/AddQuoteRequestNoteRequestValidatorTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/DeleteQuoteRequestHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs
  - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
  - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteRequestReaderDetailSnapshotTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/DeleteQuoteRequestTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestNoteTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStaffRig.cs
  - web/e2e/quote-request.spec.ts
  - web/src/components/media/PhotoTile.test.tsx
  - web/src/components/media/PhotoTile.tsx
  - web/src/components/states/ConflictBanner.test.tsx
  - web/src/components/states/ConflictBanner.tsx
  - web/src/modules/admin/auditCopy.test.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/QuoteHistoryCard.tsx
  - web/src/modules/admin/components/QuoteRequestDetailsCard.tsx
  - web/src/modules/admin/components/QuoteRequestPhotosCard.tsx
  - web/src/modules/admin/components/QuoteRequestsTable.tsx
  - web/src/modules/admin/components/QuoteStatusMenu.test.tsx
  - web/src/modules/admin/components/QuoteStatusMenu.tsx
  - web/src/modules/admin/components/quoteRequests.recipe.ts
  - web/src/modules/admin/hooks/useQuoteRequestQuery.ts
  - web/src/modules/admin/pages/QuoteRequestPage.test.tsx
  - web/src/modules/admin/pages/QuoteRequestPage.tsx
  - web/src/modules/admin/quoteRequestNavigation.ts
  - web/src/modules/admin/quoteRequestsCopy.ts
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/services/quoteRequestsService.test.ts
  - web/src/modules/admin/services/quoteRequestsService.ts
  - web/src/test/quoteRequestFixtures.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 13, Wave 8: Code Review Report

*Created: 2026-11-23T16:24:06-06:00 · Updated: 2026-11-23T16:24:06-06:00*

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 59
**Status:** issues_found

## Summary

This review covers plan 13-18 (add-only staff notes and the Manager's permanent delete, server side) and plan 13-19 (the staff quote request page, with photos, history, the status menu and the Spam confirm). The diff is `bd27b371..af38923a`.

- Left out: the generated files (`openapi.v1.json`, `api.generated.ts`, the migration Designer and the model snapshot) and the planning files.
- Test files were read only for reliability and gaps.
- No tests, dev servers or e2e runs were started. Only small read-only greps were run.
- The owner items in the two SUMMARYs are not raised again, except 13-18 item 1 and item 2. The caller asked for a ruling on those two. That leaves out: notes on a Converted request, no note cap, the delete audit detail, Converted checked before the version, the wording, the Cover mark, the one-photo sentence, where the badge sits, the "Saving" label and Try Again with no busy look.

Checked and found sound:

- **Authorization (CWE-862, CWE-639):**
  - The controller carries `Policies.Staff`. The delete adds `Policies.Manager`, so both must pass.
  - The notes action inherits Staff, so both roles may use it, as D-17 says.
  - The matrix has both new rows. Notes: anonymous 401, both roles 400 before the lookup. Delete: anonymous 401, Admin 403, Manager 404.
  - There is no PUT, PATCH or DELETE route for one note, and a route-table test checks it (D-17).
- **Note write:**
  - Who and when come from `requestContext.UserId` and the clock. A forged `createdById` is ignored.
  - The validator and the domain both trim, then check 1 to 1,000. The column is `nvarchar(1000)`, so the limits agree.
  - `QuoteRequestNote.Id` is `ValueGeneratedNever()`, so EF tracks a note found through the navigation as Added, not Modified.
  - The note moves `EditVersion`. The save then stamps who last changed the request and moves its row version. A lost race is retried once through `ConflictRetry`, and a second loss is a 409.
  - The audit detail is `note=<id>` only, with no text (CWE-532).
- **Delete transaction (D-16):**
  - The version is parsed first (400). Then, in one `InTransactionAsync`: find with photos (404), refuse Converted (400), compare the version (409), `Enqueue` each stored public id with `QuoteDeleted`, a tracked `Remove`, one audit entry, and one save.
  - The save's `WHERE` clause checks the row version again. `ConcurrencyConflictException` becomes the same 409.
  - The notes and history cascade in the database. EF removes the loaded photo places. No other table points at `QuoteRequests` yet.
  - `Enqueue` is used, not `EnqueueNowAsync`, so a failed save queues nothing. A test fails the audit write and checks that nothing is deleted or queued.
  - The audit detail is `status=<key>;photos=<n>`, with no customer details.
- **Detail read:** the notes query is the fourth command inside `ReadDetailOnceAsync`, so it sits inside the W7 row-version loop. A note moves the version, so a note that lands between the commands makes the reader read everything again.
- **Migration:**
  - Additive only: one table, two indexes, a cascade FK to `QuoteRequests` and a NO ACTION FK to users.
  - No trigger, no JSON column, no inline SQL in the diff.
  - Users are soft-deleted, so the NO ACTION author link never blocks anything.
- **Web, project rules:**
  - No em or en dash in any added line of `web/src`, `web/e2e`, `src` or `docs`.
  - Calls stay in `modules/admin/services`. Visitor text is React text only. There is no `style` attribute.
  - The document title is fixed, and the path holds only the id (CWE-598).
  - 13-19 has no form, so OR-3 does not apply yet. The notes form comes in 13-21.
- **Open redirect (CWE-601):** `quoteBackTarget` runs `safeReturnUrl`, which refuses `//`, control characters, backslashes, double encoding and dot segments, and keeps the path under `/admin`. The path before `?` or `#` must then equal `/admin/quote-requests` exactly. A crafted `state.from` can only lead to the inbox with a query string.
- **Shared component changes:**
  - `PhotoTile.hasCover` defaults to `true`, and `ConflictBanner.title` and `body` default to the shared copy. No existing caller passes them, so the order pages and the settings screens look the same as before.
  - In readonly mode a tile renders one `button[aria-label]` (the thumb), so the photo card's focus-return index is right.
- **Cache after a slim status answer:**
  - `onMoved` puts the new status and version on the cached detail, then invalidates `['quote-requests']`. That refetches the detail and marks the inbox lists and the New count stale.
  - The next move uses the new version.
  - `failed` uses `errorUpdatedAt > dataUpdatedAt`, so Try Again on a failed first read keeps the same alert and button (the W7 WR-01 lesson).

There is no blocker. There are four warnings:

- one on privacy: the note answer;
- three on failure states in the page: the 409 inside the Spam confirm, the request that is gone after a move, and Load Latest failing with no message.

## Warnings

### WR-01: The note call stores the visitor's details and every note for 24 hours, where the Manager delete and the purge cannot reach them

**File:** `src/Csps.Application/QuoteRequests/AddQuoteRequestNoteHandler.cs:61`, `src/Csps.Server/Controllers/QuoteRequestsController.cs:140-155`, `docs/api/quote-requests.md:390-391`

**Issue:**
- `POST /quote-requests/{id}/notes` passes the idempotency gate. Its 200 answer is the whole detail: name, team, phone, email, message, every private photo address and the text of every note so far.
- The gate stores that answer as plain text in `IdempotencyRecords.ResponseBody` for 24 hours. Each note adds one more full copy.
- W7 IN-01 made the status change answer slim for exactly this reason. The note call brings the same problem back, on the call staff will use most.
- A Manager delete (D-16, for example a removal request under RA 10173) cannot find these copies. A record holds the route pattern, the user, a keyed hash of the path and body, and the answer. It does not hold the request id.
- A retry with the same key after the delete replays the stored answer. So the deleted request's details can be served again for up to 24 hours.
- Nothing in the web calls this endpoint yet (13-21 adds the form), so no copy exists today. The fix is cheap now.

**Fix:** Make the answer slim, as for the status change. This is 13-18 owner item 1, option B.
```csharp
// AddQuoteRequestNoteHandler: answer what the page needs to go on, never the request.
public sealed record QuoteRequestNoteAddedResponse(Guid Id, Guid NoteId, DateTimeOffset CreatedAtUtc, string Version);
// After the save, read only the row version back, as ChangeQuoteRequestStatusHandler does, and drop IQuoteRequestReader and IImageDelivery.
```
- Then refresh the OpenAPI snapshot, the types and `docs/api/quote-requests.md`.
- 13-21 already invalidates the detail query after a note.
- Add a test like `TheStoredRetryAnswerHoldsNoVisitorDetailsOrPhotoAddresses` for the notes call. It should also check that the stored body holds no note text.

**Should the delete also remove stored answers (13-18 owner item 2)?**
- With WR-01 fixed, no. Every POST on a staff request would then store only ids, statuses, times, versions and plain error text.
- The visitor's own POST answers hold only the request id and the photo file names.
- A delete that searches the stored answers would need a `ResponseBody.Contains(id)` scan, or a new indexed column for the request id. That adds schema and cost for little gain.
- Recommendation: B on item 1, A on item 2.

### WR-02: A 409 from inside the Spam confirm leaves focus on Change Status, not on Load Latest

**File:** `web/src/modules/admin/components/QuoteStatusMenu.tsx:95-98, 127-141, 144-149`

**Issue:**
- In the dialog, `useSubmission` calls `onFailure` before `submit` resolves. So `onConflict()` raises the page's banner while the dialog is still open.
- Then `confirmSpam` calls `closeSpam()`, which sets `focusAfterDialog`.
- The menu's effect has no dependencies and runs after the banner's own focus effect, because the banner comes first in the tree. It moves focus to Change Status.
- So the user ends on the button that will fail again with the old version, not on Load Latest. On the non-dialog path, the page test pins focus on Load Latest (`QuoteRequestPage.test.tsx:293`).
- The banner's `role="alert"` is inserted while an `aria-modal` dialog is open. Some screen readers ignore content outside a modal dialog, so the alert may not be read either.
- No test covers a 409 from the Spam confirm.

**Fix:**
- When the confirm ends in a conflict, close the dialog first without asking for focus back. Raise the conflict only once the dialog has closed.
```tsx
const conflictAfterDialog = useRef(false);
// onFailure: if (isConflict(error)) { if (inDialog.current) { conflictAfterDialog.current = true; } else { onConflict(); } return; }
// confirmSpam: if (isConflict(outcome.error)) { setSpamOpen(false); return undefined; } // no focusAfterDialog
useEffect(() => {
  if (!spamOpen && conflictAfterDialog.current) {
    conflictAfterDialog.current = false;
    onConflict(); // the banner mounts after the dialog has gone and takes focus
  } else if (focusAfterDialog.current && !spamOpen) {
    focusAfterDialog.current = false;
    buttonRef.current?.focus();
  }
});
```
- Add a page test: a request with photos, Move to Spam, Mark as Spam answers 409. Expect the alert, and expect Load Latest to have focus.

### WR-03: When a move finds the request gone, focus falls to the page and nothing is announced

**File:** `web/src/modules/admin/components/QuoteStatusMenu.tsx:99-103`, `web/src/modules/admin/pages/QuoteRequestPage.tsx:155-171, 222-230`

**Issue:**
- A 404 on a move (another Manager deleted the request, or the purge ran) calls `resetQueries` and shows no toast.
- The page body unmounts and the skeleton shows. `LoadingRegion` announces "Loading the quote request…".
- Then the 404 lands, and `if (notFound)` returns a different tree. That tree has no `LoadingRegion`, and its h1 has no `tabIndex` and never takes focus.
- So the Change Status button (or the open Spam dialog) disappears and focus falls to `<body>` (WCAG 2.4.3). The screen reader hears "Loading the quote request…" and then nothing (WCAG 4.1.3).
- The same silent swap happens on a first read that answers 404.

**Fix:**
- Give the not-found h1 `tabIndex={-1}`. Focus it when the not-found state replaces a page that had data or a pending move. For example, pass a `focusOnShow` flag set from `onFailure` through a ref on the page.
- Or keep one live status region in both branches, and put "Quote request not found" in it.
- Add a page test: a move answers 404. Expect the "Quote request not found" heading to have focus.

### WR-04: When Load Latest fails, nothing is shown, and a deleted request stays on screen

**File:** `web/src/modules/admin/pages/QuoteRequestPage.tsx:203-211`

**Issue:**
- `loadLatest` acts only when the read works. If the read fails, `loadingLatest` goes back to false, the banner stays, and no message is shown.
- The same banner is on screen, so the user cannot tell the press did anything.
- If the read answers 404 (deleted or purged), the old request stays on screen with its Change Status menu. The next move gets a 404 and lands in WR-03.
- `BusinessInfoTab.loadLatest` (`components/BusinessInfoTab.tsx:296-306`) shows a danger toast with `describeHttpError` on failure. This page does not follow that pattern.
- The background read after a successful move can fail silently too. Then the history has no new row and, after Spam, the photos stay with no removal note until the next read. That is milder, because the badge and the version are already right.

**Fix:**
```tsx
const result = await query.refetch();
setLoadingLatest(false);
if (result.isError) {
  if (isHttpError(result.error) && result.error.status === 404) {
    void queryClient.resetQueries({ queryKey: quoteRequestKey(id) }); // then the not-found state, focused as in WR-03
    return;
  }
  const copy = describeHttpError(result.error);
  if (copy !== null) toast.show({ tone: 'danger', title: copy.title, message: copy.body });
  return;
}
```
- Add a test where Load Latest answers 500 (expect the toast, the banner kept, and focus on Load Latest). Add one where it answers 404 (expect the not-found state).

## Info

### IN-01: The upload race now also applies to the Manager delete (owner)

**File:** `src/Csps.Application/QuoteRequests/DeleteQuoteRequestHandler.cs:79-85`, `docs/api/quote-requests.md` ("Deleting a request")

**Issue:**
- `FindAsync` reads the photo places without a lock. A visitor's upload fills an empty place with a conditional `ExecuteUpdate`, which does not move the request's version.
- If that fill commits between the find and the save, the delete removes the row without queuing the file.
- `StraySweepJob` finds the file only once it is 2 days old. So after a delete "for good", one photo can stay in storage for about 3 days.
- This is the same limit as 13-16 owner item 7 (Spam), which the owner accepted as A. The delete was not named there, and the docs say "Each stored photo is queued" with no exception.

**Fix:** Owner choice:
- A: accept it for the delete too, and add one sentence to the docs and to the Privacy Policy text.
- B: take the same request lock in the upload and in the delete.

### IN-02: The docs say the delete takes an Idempotency-Key, but the gate covers only POST

**File:** `docs/api/quote-requests.md:221`, `src/Csps.Server/Security/IdempotencyMiddleware.cs:110-128`

**Issue:**
- `TryGetCoveredRoute` returns false for anything that is not a POST, so the delete's key is ignored. Nothing is stored or replayed.
- A retry after a lost 204 then gets `404 quote-requests.not-found`, not the 204 again.
- The test rig sends a key, which hides this.
- `docs/api/auth.md:138` makes the same claim about every DELETE, so this mistake is older than this wave.

**Fix:**
- Correct line 221: "no Idempotency-Key; a repeat after success is 404".
- In 13-21, treat a 404 that follows the page's own delete as "deleted".
- Optional: correct `auth.md:138` in a docs pass.

### IN-03: The `mailto:` link is built from the raw address

**File:** `web/src/modules/admin/components/QuoteRequestDetailsCard.tsx:75`

**Issue:**
- `OrderRules.IsValidEmail` uses `MailAddress.TryCreate`, which allows `?`, `&`, `=`, `#` and `%` in the local part.
- A visitor can send an address such as `info?cc=other%40example.test&subject=Hi@example.com`. A staff click then opens a mail with a different To, an added Cc and a set subject.
- The visible text shows the whole address, and the visitor controls only their own lead, so the impact is low.

**Fix:** Encode the characters RFC 6068 reserves before building the link.
```ts
const mailtoHref = (email: string): string => `mailto:${email.replace(/[%?#&]/g, (c) => encodeURIComponent(c))}`;
```
Add a test with such an address.

## Notes for later plans (not findings)

- **13-21 notes form (OR-3):** the zod schema must trim, then require 1 to 1,000 characters, with "Write a note first." and "Keep the note to 1,000 characters or fewer.".
  - .NET `string.Trim()` and JS `String.prototype.trim()` treat a few characters differently, such as U+FEFF. Test a note that is only U+FEFF on both sides, so the browser and the server agree.
- **13-21 delete:** see IN-02 for the 404 on retry. After a delete, invalidate `['quote-requests']` and remove the detail query, so the inbox and the New count update.

## Owner decisions

- **WR-01 and 13-18 items 1 and 2:**
  - Recommended: B on item 1 (a slim note answer) and A on item 2 (the delete does not search stored answers).
  - The other way: keep the full answer, add the 24-hour copy to the Privacy Policy text (D-28), and add a stored-answer search to the delete.
- **IN-01:** accept the about-3-day stray removal for the delete as well, or lock uploads against the delete.
- **WR-02, WR-03, WR-04, IN-02 and IN-03** are fixes that change no wording or behavior the owner has ruled on. The toast in WR-04 uses the shared error copy.

---

_Reviewed: 2026-11-23T16:24:06-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
