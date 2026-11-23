---
created: 2026-11-23T15:00:00-06:00
updated: 2026-11-23T15:00:00-06:00
phase: 13-quote-inquiries
wave: 7
review: 13-REVIEW-W7.md
findings_in_scope: 3
fixed: 3
not_fixed: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report (wave 7)

*Created: 2026-11-23T15:00:00-06:00 · Updated: 2026-11-23T15:00:00-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree). The preflight showed ports 5180, 5115, 7028 and 5199 free and no other dev or test processes before the .NET test runs and before the full web test run. LocalDB tests ran with `CSPS_TEST_SQL=localdb` set for each command only. No e2e ran: every change is covered by component or integration tests.

In scope: WR-01, IN-01 and IN-02. All three are fixed.

Each fix is one commit with its tests. Every new or changed test was run red on the old code first.

## Fixed

### WR-01: the strip keeps its failure line while a read runs again

**Commit:** 0e52d834
- With no data, TanStack Query sets the count query back to `pending` (and `error` to null) at the start of every read. So after a failed first read, the strip swapped its alert and Try Again for the skeleton on every 60-second re-read and on Try Again, and focus fell to the page.
- The strip now counts a read as failed while `isError` is true or `errorUpdatedAt > dataUpdatedAt`. Neither time is reset by a read, so the failure stays until a read succeeds. The skeleton shows only before any read has ended.
- `NewQuoteCountQuery` gains `errorUpdatedAt` and `dataUpdatedAt`. `shownNewQuoteCount` is unchanged: the nav shows nothing either way.
- No wording changed.

Tests (`QuoteRequestsStrip.test.tsx`): the unit test with a hand-made `{ isError: true, isFetching: true }` and no data is removed, because the real query never gives that state. Two fed tests replace it, with an MSW server that always answers 500 and holds each read until the test lets it go:
- After a failed first read, with focus on Try Again, pressing Try Again keeps the same alert node and the same button, focus stays on it, the button has `aria-busy="true"`, there is no busy region and no "Loading the new quote requests" line. After the read fails again, the same alert is still there and focus is still on Try Again.
- The same checks after the 60-second clock reads again (fake clock).

Both failed on the old code ("expected false to be true" on the alert still being connected).
Status: fixed. Requires human verification: the failure state is a logic change.

### IN-01: the status change answers only the new status and version

**Commit:** 42c2bdaa
Option A, built while the owner is away (owner item 1).
- `POST /api/v1/quote-requests/{id}/status` now answers `{ id, status, statusChangedAtUtc, version }` (`QuoteRequestStatusChangedResponse`). It has no name, team, phone, email, message or photo addresses, so the answer the idempotency gate stores for 24 hours holds none of them.
- `version` is the row version the save reads back, so the next change can use it. The handler no longer reads the detail after the save, so it lost its `IQuoteRequestReader` and `IImageDelivery` dependencies. `GetQuoteRequestHandler.ReadAsync` is now private.
- The idempotency gate is unchanged.
- Updated: the controller's OpenAPI text, the snapshot `tools/openapi-gen/openapi.v1.json` (rewritten with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for that one command), `web/src/types/api.generated.ts` (`npm --prefix tools/openapi-gen run generate`; `run check` says the types match), and `docs/api/quote-requests.md` (the endpoint table and the "Changing the status" section, with the slim example).
- No web code calls this endpoint yet. `13-19-PLAN.md` has a new line in `<notes_from_earlier_plans>`: the answer is slim, so after a move the page must refetch the detail (`['quote-requests', 'detail', id]`) and invalidate `['quote-requests']`. Its `updated:` value was `2026-11-23T15:30:00-06:00`, a time still in the future, so it is now the real edit time, `2026-11-23T14:30:00-06:00`.

Tests:
- Integration (`QuoteRequestStatusTests`): the move answers exactly the four members, the same version and change time a following GET gives, and a version different from the old one. The history, the photos, the removal time and who changed it are now checked through a GET in every test that read them from the answer.
- Integration, new: `TheStoredRetryAnswerHoldsNoVisitorDetailsOrPhotoAddresses` seeds a request with a team, an email, a message and a stored photo, moves it, and reads the stored `IdempotencyRecords.ResponseBody`. It must not hold the name, team, email, phone, message, photo file name, `fullSize` or `thumb`. On the old code it held the whole request.
- Unit (`ChangeQuoteRequestStatusHandlerTests`): the answer is exactly `(id, "contacted", now, the version after the save)`. `FakeUnitOfWork` gets an optional after-save action so the test can give the request a new version the way the database does. A lost save race is still a 409 with no commit.

Status: fixed.

### IN-02: the detail read is one snapshot

**Commit:** c007b2f7
- `QuoteRequestReader.GetDetailAsync` still reads the request, the photo places and the history in three commands. Then it reads the row version again. Every status move updates the request row, so it changes the version. When the version moved, the reader reads everything again, up to three times. After the last attempt it returns the latest read. This is the pattern `OrderReader` already uses (IWB-WR-04).
- A photo arriving does not change the version, which is by design. That is not a mixed answer: the request row does not depend on a photo being filled.
- One extra small command per read. No SQL, no lock hint and no schema change.
- `docs/api/quote-requests.md` says the request, its photos, its history and `version` always come from one save.

Tests (`tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteRequestReaderDetailSnapshotTests.cs`, new). The test is deterministic: an EF command interceptor makes a real Spam move on a second connection just before the photo places are read, once.
- The answer is Spam, has no photos, has the removal time, has the Spam history row, and has the version stored now. On the old code it answered New, with the photos already gone.
- An unchanged request takes 4 commands (the old code took 3). An unknown request takes 1 and gives null.

Status: fixed.

## Not fixed

None.

## Flakes and other findings

- None. Every test passed on its first run, in its targeted run and in the full runs.
- Not a finding: the budget build prints its standing note that public JS in the admin-included build (149.05 KB) is past the 135 KB trigger for the Phase 4 barrel split. That note was already there before this fix (W6: 149.10 KB).

## Checks

- `dotnet build Csps.slnx -warnaserror`: "Build succeeded.", "0 Warning(s)", "0 Error(s)".
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Server QuoteRequests tests (`--filter-namespace Csps.Server.IntegrationTests.QuoteRequests`, LocalDB): total 88, failed 0, succeeded 88.
- AuthorizationMatrix (`--filter-class "*AuthorizationMatrix*"`): total 590, failed 0, succeeded 590.
- OpenApiSnapshotTests: total 11, failed 0, succeeded 11. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Application unit tests: total 3444, failed 0, succeeded 3444.
- Also run: Infrastructure QuoteRequests tests (21 passed, 0 failed), `QuoteRequestRetentionJobTests` (13 passed, 0 failed), architecture tests (290 passed, 0 failed).
- `npm run typecheck`: exit 0.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0.
- `npx prettier --check .`: "All matched files use Prettier code style!"
- Fresh production build (`NODE_ENV=production node node_modules/vite/bin/vite.js build`): exit 0, "built in 21.23s", no warnings.
- Whole web suite (`npx vitest run`, after the fresh build): "Test Files 447 passed (447)", "Tests 11926 passed (11926)", exit 0, no stderr lines.
- Budget (`npm run build:budget`): exit 0, every row ok. Public JS contact 148.17 KB of 150.00, privacy 149.05 of 150.00; admin 225.55 of 250.00; Quote form 44.38 of 45.00; CSS 20.53 of 35.00. No limit changed.
- No em or en dash was added anywhere in the diff. The test data uses `example.com` and `example.test` addresses and made-up names only. gitleaks (pre-commit hook) found no leaks on any of the three commits.

## Owner items

1. **What the status change answers (IN-01).** A, built: only `{ id, status, statusChangedAtUtc, version }`, so the stored retry answer holds no visitor details, and the 13-19 page reads the detail again after a move. B: answer the whole request again and accept the 24-hour copy outside the purge and the Manager delete, and say so in the Privacy Policy text (D-28). The order calls store their full answers the same way. They hold customer details too, but no deletion for good has been promised for them, so they were left as they are.

No other owner choice came up. WR-01 and IN-02 change no wording and no ruled behavior.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
