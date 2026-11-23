---
created: 2026-11-23T17:16:02-06:00
updated: 2026-11-23T17:18:00-06:00
phase: 13-quote-inquiries
wave: 8
review: 13-REVIEW-W8.md
findings_in_scope: 7
fixed: 5
not_fixed: 2
status: partial
---

# Phase 13: Code Review Fix Report (wave 8)

*Created: 2026-11-23T17:16:02-06:00 · Updated: 2026-11-23T17:16:02-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree). The preflight showed ports 5180, 5115, 7028 and 5199 free and no other dev or test processes before each LocalDB run. LocalDB tests ran with `CSPS_TEST_SQL=localdb` set for each command only. No e2e ran: every change is covered by component or integration tests.

In scope: all seven findings.
- Fixed: WR-01, WR-02, WR-03, WR-04 and IN-03.
- Parked for the owner: IN-01.
- Deferred to plan 13-21 as a note: IN-02.

Each fix is one commit with its tests. Every new or changed test was run red on the old code first, except the WR-01 unit test. That test uses the new answer type, so it could not compile on the old code. The WR-01 integration test was red first.

## Fixed

### WR-01: a note answers only the note id, the time and the version

**Commit:** a0227b61
This is 13-18 owner item 1, option B, as the review recommends. It follows W7 IN-01.
- `POST /api/v1/quote-requests/{id}/notes` now answers `{ id, noteId, createdAtUtc, version }` (`QuoteRequestNoteAddedResponse`).
- The answer has no name, team, phone, email, message, photo address or note text. So the answer the idempotency gate keeps for 24 hours holds none of them.
- `version` is the row version the save reads back.
- The handler no longer reads the detail after the save. It lost its `IQuoteRequestReader` and `IImageDelivery` dependencies, and `GetQuoteRequestHandler.ReadAsync` is private again.
- The idempotency gate is unchanged.
- Updated:
  - the controller's OpenAPI text;
  - the snapshot `tools/openapi-gen/openapi.v1.json`, rewritten with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for that one command;
  - `web/src/types/api.generated.ts`, regenerated with `npm --prefix tools/openapi-gen run generate`;
  - `docs/api/quote-requests.md`: the endpoint table and the "Internal notes" section, with the slim example.
- No web code calls this endpoint yet. The 13-21 note in `<notes_from_earlier_plans>` now says the answer is slim, and that the page must read the detail again after a note.
- 13-18 owner item 2 (should the delete also remove stored answers): with this fix, no. The delete is unchanged, as the review agrees. That is option A on item 2.

Tests:
- Integration, new (`QuoteRequestNoteTests.TheStoredRetryAnswerHoldsNoVisitorDetailsOrNoteText`):
  - It seeds a request with a team, an email, a message and a stored photo, then adds two notes.
  - Then it reads both stored `IdempotencyRecords.ResponseBody` rows.
  - Neither may hold the name, team, email, phone, message, photo file name, `fullSize`, `thumb` or either note's text.
  - On the old code it failed on "Juan Dela Cruz": the stored body was the whole request.
- Integration, changed:
  - The answer has exactly the four members.
  - Its version, note id and time match a following GET.
  - The notes, who wrote them and who last changed the request are now checked through a GET.
- Unit (`AddQuoteRequestNoteHandlerTests`):
  - The answer is exactly `(id, note id, now, the version after the save)`.
  - The test "a request gone before the read is 404" is removed, because there is no read after the save now.

Status: fixed.

### WR-02: a 409 from the Spam confirm leaves focus on Load Latest

**Commit:** 95b5efe7
- Before, the menu told the page about the conflict while the Spam dialog was still open. So the banner's alert mounted next to an open `aria-modal` dialog. Then the dialog closed and moved focus to Change Status.
- Now the menu holds the conflict while the dialog is open. It closes the dialog without asking for focus back. Once the dialog has closed, it tells the page. The banner then mounts and takes focus.
- No wording changed.

Tests:
- Page: Move to Spam, then Mark as Spam answers 409. The alert shows, the dialog is gone, and Load Latest has focus. On the old code, Change Status had focus.
- Menu: the page is told only when no dialog is open. The old code told it while one was open (`expected [ 1 ] to deeply equal [ 0 ]`).

Status: fixed. Requires human verification, because it changes the focus order.

### WR-03: the not-found heading takes focus when it replaces the page

**Commit:** 82187d6b
- The not-found h1 now has `tabIndex={-1}`. It takes focus whenever it replaces a page that was loading or loaded. Moving focus there means a screen reader reads it out.
- That covers three cases: a move that answers 404, the Spam confirm that answers 404, and a first read that answers 404.
- An address that is not a request id shows not found at once, as before, without moving focus.
- This is option 1 of the review (focus the heading), not option 2 (one shared live region).

Tests: three new page tests (after a move, after the Spam confirm, after a first read). Each expects "Quote request not found" to have focus. All three failed on the old code.

Status: fixed. Requires human verification, because it changes the focus order.

### WR-04: Load Latest says when it fails

**Commit:** 4702371a
- A failed Load Latest read now shows a danger toast with the shared `describeHttpError` copy, as `BusinessInfoTab` does. The banner stays and focus stays on Load Latest.
- A 404 resets the detail query. The page then shows not found, which takes focus (WR-03).
- Not changed: the background read after a good move can still fail with no message, as the review notes. That is milder: the badge and the version are already right, and the next read brings the history. The review asked for no fix there.

Tests:
- Load Latest answers 500: "Something went wrong" and "Please try again." show, the banner stays, Load Latest has focus, and the request is still shown.
- Load Latest answers 404: "Quote request not found" has focus, and there is no Change Status.
- Both failed on the old code.

Status: fixed. Requires human verification, because the failure path is a logic change.

### IN-03: the mailto link encodes reserved characters

**Commit:** 0eb56a28
- `QuoteRequestDetailsCard` now builds the link with `mailtoHref`. It percent-encodes `%`, `?`, `#` and `&` with `encodeURIComponent`, in one pass, so nothing is encoded twice.
- The visible text is the address as sent. A plain address gives the same link as before (`mailto:juan@example.test`).
- `%` is encoded as well as the three characters the caller named. Without it, a `%40` in the address would still turn into an `@` in the mail app.

Test: the address `info?cc=other%40example.test&subject=Hi#x@example.test` gives `mailto:info%3Fcc=other%2540example.test%26subject=Hi%23x@example.test`. On the old code the link was raw.

Status: fixed.

## Not fixed

### IN-01: the upload race also applies to the Manager delete (parked for the owner)

No code changed, as asked. The choice is in "Owner items" below.

### IN-02: the delete takes no Idempotency-Key (deferred to plan 13-21)

**Commit:** aa483e74 (planning note only)
- No code changed, as asked.
- `13-21-PLAN.md` `<notes_from_earlier_plans>` has a new line:
  - The gate covers only POST, so a retried delete after a lost 204 answers `404 quote-requests.not-found`.
  - The page must treat a 404 that follows its own delete as "deleted".
  - After a delete it must invalidate `['quote-requests']` and remove the detail query.
  - It must also correct the delete row of `docs/api/quote-requests.md` and the DELETE line in `docs/api/auth.md`.
- Left as it is for now: the delete row of the staff endpoint table in `docs/api/quote-requests.md` still says "with an `Idempotency-Key`". I left it because the caller scoped IN-02 to a note. See owner item 4.

## Flakes and other findings

- None. Every test passed on its first run, in its targeted run and in the grouped runs.
- Not a finding: `npx prettier --check docs/api/quote-requests.md` (from `web/`) reports style issues. The committed file had the same issues before this change, and the project's prettier check covers `web/` only.
- Not a finding: the budget build prints its standing note that public JS in the admin-included build (149.08 KB) is past the 135 KB trigger for the Phase 4 barrel split. It was 149.05 KB after W7.

## Checks

- `dotnet build Csps.slnx -warnaserror`: "Build succeeded.", "0 Warning(s)", "0 Error(s)". Run after WR-01 and again at the end.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0. Run after WR-01 and again at the end.
- Server QuoteRequests tests (`--filter-namespace Csps.Server.IntegrationTests.QuoteRequests`, LocalDB): total 108, failed 0, succeeded 108.
- `QuoteRequestNoteTests` plus `DeleteQuoteRequestTests` (LocalDB): total 20, failed 0, succeeded 20.
- OpenApiSnapshotTests: red before the rewrite (`CommittedSnapshotMatchesTheLiveDocument`). After the rewrite: total 11, failed 0, succeeded 11.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Application unit tests, `--filter-class "*QuoteRequest*"`: total 260, failed 0, succeeded 260. `AddQuoteRequestNoteHandlerTests` alone: 7 of 7.
- Architecture tests: total 290, failed 0, succeeded 290.
- Web tests: "Test Files 5 passed (5)", "Tests 153 passed (153)", with no stderr lines. The files were `QuoteRequestPage.test.tsx`, `QuoteStatusMenu.test.tsx`, `quoteRequestsService.test.ts`, `routes.test.tsx` and `ConflictBanner.test.tsx`.
- `no-long-dash.node.test.ts` and `source-layout.node.test.ts`: 2 files, 8 tests passed.
- `npm run typecheck`: exit 0.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0.
- `npx prettier --check .` (in `web/`): "All matched files use Prettier code style!"
- `npm run build:budget`: exit 0, every row ok. Public JS contact 148.19 KB of 150.00, privacy 149.08 of 150.00. Admin 225.82 of 250.00. Quote form 44.38 of 45.00. CSS 20.54 of 35.00. No limit changed.
- No em or en dash was added in `web/src`. The test data uses `example.test` addresses and made-up names only.
- gitleaks (pre-commit hook) said "no leaks found" on all six commits. No real names, emails, server names or local paths were staged.
- No package was added or bumped. No schema, SQL, trigger or JSON column change.

## Owner items

1. **What the note call answers (WR-01, 13-18 item 1).**
   - A, built: only `{ id, noteId, createdAtUtc, version }`. The stored retry answer holds no visitor details or note text, and the 13-21 page reads the detail again after a note.
   - B: answer the whole request again. Then accept the 24-hour copy outside the purge and the Manager delete, and say so in the Privacy Policy text (D-28).
2. **Should the Manager delete also remove stored answers (13-18 item 2)?**
   - A, built: no. With item 1 as A, staff calls store only ids, statuses, times, versions and plain error text.
   - B: search `IdempotencyRecords` in the delete. That needs a scan of the stored text or a new indexed column, which means a schema change.
3. **The upload race and the delete (IN-01), not built.**
   - A (the review's recommendation, as for Spam in 13-16 item 7): accept that one photo can stay in storage for about 3 days after a delete. Add one sentence to the API doc and to the Privacy Policy text.
   - B: take the same request lock in the upload and in the delete.
4. **When to correct the delete docs (IN-02).**
   - A, built: leave the "with an `Idempotency-Key`" wording in `docs/api/quote-requests.md` and `docs/api/auth.md` until 13-21 touches the delete docs. The 13-21 note says so.
   - B: correct both now in a small docs commit: "no Idempotency-Key; a repeat after success is 404".
5. **How the not-found state is announced (WR-03).**
   - A, built: the heading takes focus when it replaces a loading or loaded page.
   - B: keep one live status region in both branches and put "Quote request not found" in it, with no focus move.
6. **Which mailto characters are encoded (IN-03).**
   - A, built: `%`, `?`, `#` and `&`.
   - B: also encode `=` and the other RFC 6068 reserved characters. Without a `?`, an `=` cannot add a header, so A is enough.

WR-02 and WR-04 change no wording and no ruled behavior. The WR-04 toast uses the shared error copy.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Orchestrator follow-up

- IN-02 docs: the orchestrator corrected the docs after this report. The delete row in `docs/api/quote-requests.md` and two lines in `docs/api/auth.md` no longer say a `DELETE` takes an `Idempotency-Key`; `IdempotencyMiddleware` guards only `POST`. So owner choice 4 (leave the docs until 13-21) is moot.
