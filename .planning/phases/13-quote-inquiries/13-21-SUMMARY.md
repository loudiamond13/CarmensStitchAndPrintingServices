---
created: 2026-11-23T18:29:00-06:00
updated: 2026-11-23T18:29:00-06:00
phase: 13-quote-inquiries
plan: 21
subsystem: admin-quote-request-page
tags: [quote-requests, notes, delete, react, react-hook-form, zod, tanstack-query, a11y, tdd]
status: complete

requires:
  - phase: 13-quote-inquiries
    provides: "13-18 POST /quote-requests/{id}/notes (slim answer after W8 WR-01) and DELETE /quote-requests/{id}?version=; 13-19 QuoteRequestPage, QuoteStatusMenu, the detail query and fixtures; 13-17 NEW_QUOTE_COUNT_KEY under ['quote-requests']"
provides:
  - "quoteRequestsService.addNote(id, text, idempotencyKey) and remove(id, version)"
  - "noteSchema (quoteRequestsSchemas.ts): trimmed, 1 to 1,000 characters, the server's words"
  - "QuoteNotesCard: the add-only Internal notes card in the aside above History"
  - "Delete Request (Manager only) with its ConfirmDialog on QuoteRequestPage; aria-disabled with the reason on a Converted request"
  - "INBOX_HEADING_FOCUS and wantsHeadingFocus (quoteRequestNavigation.ts): the inbox focuses its h1 after a delete"
  - "QUOTE_REQUEST_COPY.notes and QUOTE_REQUEST_COPY.remove"
affects: [13-22, 13-23, 13-24]

actuals:
  tokens: 16400
  tasks: 2
  commits: 4
plan_head_before: 2074c0222f92f5d0f86bcdfa8f767f166b524830
plan_head_after: 3636c881ff06ba6748e194f2b0e0c1ce193dffff

tech-stack:
  added: []
  patterns:
    - "After a slim answer (status or note), set the new version on the cached detail at once, then invalidate ['quote-requests'] so the page reads the rest"
    - "A permanent delete removes its detail query in an unmount cleanup, so the page never reads the gone request again before it leaves"
    - "Navigation state { focusHeading: true } asks the next page to focus its h1"

key-files:
  created:
    - web/src/modules/admin/quoteRequestsSchemas.ts
    - web/src/modules/admin/quoteRequestsSchemas.test.ts
    - web/src/modules/admin/components/QuoteNotesCard.tsx
    - web/src/modules/admin/components/QuoteNotesCard.test.tsx
  modified:
    - web/src/modules/admin/services/quoteRequestsService.ts
    - web/src/modules/admin/services/quoteRequestsService.test.ts
    - web/src/modules/admin/pages/QuoteRequestPage.tsx
    - web/src/modules/admin/pages/QuoteRequestPage.test.tsx
    - web/src/modules/admin/pages/QuoteRequestsPage.tsx
    - web/src/modules/admin/pages/QuoteRequestsPage.test.tsx
    - web/src/modules/admin/quoteRequestsCopy.ts
    - web/src/modules/admin/quoteRequestNavigation.ts
    - web/src/modules/admin/components/quoteRequests.recipe.ts
    - web/e2e/quote-request.spec.ts

key-decisions:
  - "Any 404 to the page's own DELETE is the success path: the HTTP client retries a DELETE by itself after a lost answer, so the page cannot tell its own retry from someone else's delete, and either way the request is gone"
  - "After a delete the inbox view the person came from (with its filters) replaces the request in history, so Back never lands on a deleted request"
  - "A note sets the new version on the cached request at once; the note itself shows when the read again lands"
  - "Text typed while a note is sending stays in the box; the box clears only when it still holds the sent note"
  - "A 409 on a note keeps the typed text and shows the page's ConflictBanner"

requirements-completed: [INQ-05]

coverage:
  - id: D1
    description: "Staff add a note (zod mirrors the server: trimmed, 'Write a note first.', 'Keep the note to 1,000 characters or fewer.'); Adding while it sends; the box clears and keeps focus; polite 'Note added.'; the request is read again and the note shows first with the author and time; 'No notes yet.'; one or many newest first; 409 keeps the text; the inbox lists and New count are marked stale"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/quoteRequestsSchemas.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/QuoteNotesCard.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#Internal notes on the page (D-17, UI-SPEC R2 item 4)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-request.spec.ts#@quote staff add a note, and it stays after a reload"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only a Manager sees Delete Request; the confirm names the visitor with Cancel focused; Deleting; the DELETE sends the version; the inbox opens with the toast and focus on its h1; the New count and lists refresh; 404 after its own delete is the same path; 409 shows the ConflictBanner; Converted is aria-disabled with the reason; zero axe violations with the dialog open"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#Delete Request (D-16, UI-SPEC R2 actions and Destructive actions)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestsPage.test.tsx#arriving after a delete"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/quoteRequestsService.test.ts#quoteRequestsService.remove"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-request.spec.ts#@quote a Manager deletes a request after the confirm"
        status: pass
    human_judgment: false
  - id: D3
    description: "Focus order after a delete and after a 409 from the confirm, as a screen reader user hears it"
    requirement: INQ-05
    human_judgment: true
    rationale: "The tests check where focus lands; whether the announcements read well with a real screen reader needs a person"

duration: about 40 min
completed: 2026-11-23
---

# Phase 13 Plan 21: Staff add notes on the quote request page, and a Manager can delete a request Summary

*Created: 2026-11-23T18:29:00-06:00 · Updated: 2026-11-23T18:29:00-06:00*

**The add-only Internal notes card (zod rule equal to the server's, Idempotency-Key, the page reads the request again after the slim answer) and the Manager's Delete Request with a confirm that names the visitor, a 404-safe success path, and focus on the inbox h1 afterwards.**

## What was built

- **Service.** `addNote(id, text, idempotencyKey)` posts `{ text }` and resolves the slim `{ id, noteId, createdAtUtc, version }`. `remove(id, version)` sends `DELETE /quote-requests/{id}?version=` with no body and no Idempotency-Key.
- **Note rule (OR-3).** `noteSchema` trims, then 1 to 1,000 characters, with "Write a note first." and "Keep the note to 1,000 characters or fewer." (the words live in `QUOTE_REQUEST_COPY.notes.errors`). It checks on Add Note, then again as the person types.
- **Notes card (D-17).** In the aside above History. h2 "Internal notes" and the Small muted hint "Only staff see these. A note can't be changed or removed after it's added." Then `Field multiline` "Add a note" (3 rows) and `secondary` `plus` "Add Note" (pending "Adding"; the box stays usable). The list is an `ol` in the server's order (newest first), 16px apart: the author (`ActorName`, with "(former staff)"), the Small muted time, then the text with its line breaks. With none: "No notes yet."
- **After a note.** The box clears and keeps focus, a hidden polite status says "Note added.", the page sets the new version on the cached request at once (so a status change right after is not a false 409) and invalidates `['quote-requests']`, which reads the request again (the note shows first) and marks the inbox lists and the New count stale. A 409 keeps the text and shows the page's ConflictBanner. A 400 puts the server's sentence under the box. A 404 shows the not-found state. Anything else is a danger toast "Couldn't add the note".
- **Delete Request (D-16).** Manager only, `ghost-danger` `trash-2`, beside Change Status. An Admin never sees it. On a Converted request it stays, `aria-disabled`, described by the Small muted "A request that became an order can't be deleted.", and a press does nothing.
- **The confirm.** "Delete this quote request?" / "This deletes the request from {name} and its photos for good. This can't be undone." / `danger` "Delete Request" (pending "Deleting") / "Cancel", with Cancel focused first. Cancel puts focus back on Delete Request.
- **After a delete.** On a 204, or a 404 to the page's own delete (W8 IN-02): the toast "Quote request deleted", the inbox lists and New count are invalidated (the deleted request is left out), the inbox view the person came from replaces the request in history, the inbox focuses its h1, and the detail query leaves the cache once the page has gone. A 409 closes the confirm, then the ConflictBanner takes focus. A 400 shows the server's sentence in the confirm.

## TDD record

The RED outputs are Vitest console text, which `gsd_run check tdd-red-evidence` does not read, so each RED was judged by hand from the real run.

**Task 1 (tracer), notes**
- RED `fda8070a`: 21 of 65 failed, each on its own assertion: "expected [] to deeply equal [ 'Write a note first.' ]" (schema stub), "Unable to find an accessible element with the role "textbox" and name "Add a note"" (card stub and page), "service.addNote is not a function". A first run without stubs failed on "Failed to resolve import", which is not valid RED, so a schema stub and an empty card stub were committed with the tests. The "accepts 1,000" case passed on the stub, as an empty rule accepts it.
- GREEN `8741aba0`: 65 of 65 in the schema, card, service and page files. A stray MSW "request has already been handled" error came from a test whose gated read was still open when it ended; the test now waits for that read.
- Tracer gate: the Task 1 verify (the three unit files, then `npm run e2e -- --grep "@quote" --project chromium`: 18 passed) ran green before Task 2 started.

**Task 2, delete**
- RED `39b8cf4c`: 9 of 98 failed: "Unable to find role="button" and name "Delete Request"" (7 page cases), the inbox h1 `toHaveFocus()`, and "service.remove is not a function". The two Admin cases passed already: there was no button for anyone yet, so they are guards.
- GREEN `3636c881`: 98 of 98 in the page, inbox and service files. One service assertion was corrected in this commit: the fake fetch records "no body" as `null`, not `undefined`.

No REFACTOR commit was needed.

## Checks (quoted)

- Unit, after GREEN: `QuoteRequestPage.test.tsx`, `QuoteRequestsPage.test.tsx`, `quoteRequestsService.test.ts`: "Test Files 3 passed (3)", "Tests 98 passed (98)". `quoteRequestsSchemas.test.ts`, `QuoteNotesCard.test.tsx` with those: 4 files, 65 passed at Task 1. `QuoteStatusMenu.test.tsx` passed with them.
- `no-long-dash.node.test.ts` and `source-layout.node.test.ts`: "Test Files 2 passed (2)", "Tests 8 passed (8)".
- `npm run typecheck`: exit 0.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0.
- `npx prettier --check` on `src/modules/admin` and `e2e/quote-request.spec.ts`: "All matched files use Prettier code style!" (the whole-tree check is in Self-Check below).
- e2e `npm run e2e -- --grep "@quote" --project chromium`, after Task 2: "19 passed (58.1s)", including "@quote staff add a note, and it stays after a reload" and "@quote a Manager deletes a request after the confirm". The fixture guard saw no console error, CSP violation or undeclared failed response.
- The e2e build's budget table: admin JS 225.87 KB of 250.00 (225.82 after W8), Quote form 44.38 of 45.00, contact 148.20 of 150.00, privacy 149.09 of 150.00, CSS 20.55 of 35.00. No limit changed.
- Preflight before each e2e run: ports 5180, 5115, 7028 and 5199 free, no dev or test processes listed.
- gitleaks (pre-commit hook) said "no leaks found" on all four commits. Test data uses made-up names ("Juan Dela Cruz", "Maria Santos", "Jose Ramos", "Notes Tester") and `example.test` addresses only. No em or en dash added in `web/src`.
- Acceptance greps: "Write a note first." in `quoteRequestsSchemas.ts` + `quoteRequestsCopy.ts` = 0 + 1 (total 1, baseline 0; the schema reads it from the copy). "A request that became an order can't be deleted." in `quoteRequestsCopy.ts` = 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A test left its gated read open**
- **Found during:** Task 1 GREEN
- **Issue:** the "version before the read lands" page test ended while its gated detail read was still open, and MSW then reported an unhandled "request has already been handled" error in the next test.
- **Fix:** the test waits for the move's toast and the note in the list before it ends. Two clean runs after.
- **Files modified:** `web/src/modules/admin/pages/QuoteRequestPage.test.tsx`
- **Commit:** 8741aba0

**2. [Rule 1 - Bug] `aria-disabled` with `exactOptionalPropertyTypes`**
- **Found during:** Task 2 GREEN (typecheck)
- **Issue:** `aria-disabled={locked || undefined}` is a type error under the project's strict optional props.
- **Fix:** the disabled pair is spread only when the request is Converted.
- **Commit:** 3636c881

### Plan notes

- **Files outside files_modified:** `quoteRequestNavigation.ts` (the `INBOX_HEADING_FOCUS` state and `wantsHeadingFocus`, next to `quoteBackTarget`), `QuoteRequestsPage.test.tsx` (the inbox h1 focus cases; the plan's Task 2 verify already runs this file) and `quoteRequests.recipe.ts` (the note form, list, author and delete classes).
- **Where the delete goes back to:** the plan says `/admin/quote-requests`; built: the inbox view the person came from (the same path, with its pill and search), replacing the request in history. See owner item 2.
- **Fixtures:** `web/src/test/quoteRequestFixtures.ts` was not touched (13-20 owns it). The note and delete MSW handlers live in the test files. `api.generated.ts` and the OpenAPI snapshot were not touched.
- **Plan commit ledger:** the tool refused the `.git` ledger write in this worktree, so the commits were counted from the known base: `git rev-list --count 2074c022..HEAD` = 4 before this summary.
- **Branch:** the plan text says `gsd/phase-13-quote-inquiries`; this ran on the orchestrator's worktree branch `worktree-agent-a4db5bbd11449c17b` as instructed. No branch was created or switched.
- `npm ci` ran in `web/` of this worktree (the locked packages only; nothing added or changed).
- STATE.md, ROADMAP.md and DECISIONS.md were not touched.

**Total deviations:** 2 auto-fixed (both Rule 1). **Impact:** none on ruled behavior.

## Not run here

- The whole web suite and the other Playwright projects. The orchestrator gate covers them after the merge.

## Flakes

| Seen | Test | What happened | Re-run alone |
|---|---|---|---|
| 2026-11-23, 13-21 Task 2 GREEN | `routes.test.tsx` "a Manager who opens a deleted order stays and sees it read-only" and "an Admin who opens a deleted order is redirected to /admin/orders" | headings not found in time while seven test files and a whole-tree eslint ran at once | 87 of 87 passed |

## Authentication Gates

None.

## Known Stubs

None. The Task 1 RED stubs (an empty rule and an empty card) were replaced in `8741aba0`.

## Threat Flags

None beyond the plan. T-13-62: the button is hidden for an Admin, and the server's Manager policy (13-18, matrix row Admin 403) is the control. T-13-63: the confirm names the visitor, Cancel is focused first, the confirm shows Deleting and ignores repeats while it runs. T-13-SC: no package added or bumped.

## Owner items

Nothing blocks. A is what was built; B is the alternative.

1. **A 404 on the delete.** A (built): any 404 to the page's own delete is treated as deleted, with the same toast and way back, because the HTTP client retries a DELETE by itself after a lost answer and the page cannot tell that retry from someone else's delete. B: only a 404 on a second press counts as deleted; a 404 on the first press shows "Quote request not found" instead.
2. **Where the delete goes back to.** A (built): the inbox view the person came from (its pill and search), replacing the deleted request in history, so Back never lands on it. B: always the plain `/admin/quote-requests`, added as a new history entry, as the plan text reads.
3. **When the new note shows.** A (built): it shows when the read again lands (a moment later); the version is taken at once. B: show it at once from the typed text and the signed-in name, then let the read replace it.
4. **Text typed while a note is sending.** A (built): the box keeps it and clears only when it still holds the sent note. B: always clear the box after a note.
5. **"Note added."** A (built): a hidden polite status, as the UI spec says; the note appearing is the visible sign. B: also a success toast.
6. **The hint and the box.** A (built): the hint sits under the card title, as the UI spec places it. B: also link it to the box with `aria-describedby`, so a screen reader reads the "can't be changed" warning with the box.
7. **A 409 on a note.** A (built): the page's ConflictBanner "Someone else changed this request. Load the latest to see it.", with the typed note kept. B: a note-only line asking the person to press Add Note again.
8. **Wording to confirm.** "Internal notes", "Only staff see these. A note can't be changed or removed after it's added.", "Add a note", "Add Note", "Adding", "Note added.", "No notes yet.", "Couldn't add the note", "Delete Request", "Delete this quote request?", "This deletes the request from {name} and its photos for good. This can't be undone.", "Deleting", "Quote request deleted", "A request that became an order can't be deleted.".
9. No package was added or changed.

## Notes for later plans

- **13-22 (Turn into Order).** The head actions row now holds Change Status (not on Converted) and, for a Manager, Delete Request (its own column with the reason under it). The primary Turn into Order goes first in that row.
- After a conversion, invalidate `['quote-requests']` as the status change and the note do.

## Self-Check: PASSED

- Files exist: `quoteRequestsSchemas.ts`, `quoteRequestsSchemas.test.ts`, `QuoteNotesCard.tsx`, `QuoteNotesCard.test.tsx`.
- Commits on branch `worktree-agent-a4db5bbd11449c17b`: `fda8070a`, `8741aba0`, `39b8cf4c`, `3636c881`.
- TDD gates: a `test(13-21)` commit precedes each `feat(13-21)` commit.
- Final whole-tree checks in `web/`: `npm run lint` exit 0; `npx prettier --check .` "All matched files use Prettier code style!".
