---
created: 2026-11-23T00:20:00-06:00
updated: 2026-11-23T00:20:00-06:00
phase: 13-quote-inquiries
wave: 4
review: 13-REVIEW-W4.md
findings_in_scope: 7
fixed: 7
not_fixed: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report (wave 4)

*Created: 2026-11-23T00:20:00-06:00 · Updated: 2026-11-23T00:20:00-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree), with `CSPS_TEST_SQL=localdb` set on the command only.

In scope: WR-01 to WR-05, IN-02 and IN-03. IN-01 was left out on purpose.

## Fixed

### WR-03 (D-41): the form waits the minimum seconds the server sends

**Commit:** c4606f66
The ticket answer (`GET /api/v1/public/quote-requests/ticket`) now carries `minimumSeconds` from `QuoteRequests:MinimumSeconds`. The ticket-expired 400 carries `minimumSeconds` next to `replacementTicket`, as a number. `Error.Extensions` now holds text or numbers (`IReadOnlyDictionary<string, object>`) so the number is not sent as text. The form waits `issuedAt + minimumSeconds` after the ticket arrives and the hard-coded 3 seconds and the `minimumWaitMs` prop are gone. A replacement ticket is already back-dated by the server, so the resend still goes at once, and the holder keeps the minimum seconds of that answer. Docs, OpenAPI snapshot and web types are refreshed.
Tests: handler tests for the answer (0, 7, 60) and the 400 (0, 3, 60), two integration tests with `MinimumSeconds=7`, holder tests, an `HttpError` parse test, and five fake-timer form tests (7 s waited, 1 s, 0 s, expired then resend, ticketless first try).
Status: fixed.

### WR-04 (D-42): one stricter email rule for the shop email and the Quote alerts address

**Commit:** 8dce3807 (and de77ba18, a Prettier line wrap of the same file)
`SiteLinks.IsContactEmail` now refuses white space and control characters (so CR and LF), `, ; < > ( ) "`, a domain without a dot, and a domain with an empty part. It still needs exactly one `@`, the 254 cap and no bracket placeholder. The same rule is `isContactEmail` in `siteContentSchemas.ts`, used by both fields, with the same messages. Saved data is not changed.
Tests: one shared file, `tests/fixtures/email-cases.json`, read by `EmailCasesTests` (.NET) and `siteContentSchemas.test.ts` (web). It holds the cases you named (accepted: `name@gmail.com`, `a.b+c@shop.ph`; refused: `a b@c.com`, `x@y`, `a,b@c.com`, a line break inside, `Juan<juan@gmail.com>`, `a(b)@c.com`) and more. One old test row, `a@b` accepted, now reads `a@b.co`.
Status: fixed. Note: I added `isContactEmail` as its own function and left `isEmailShaped` in `authSchemas.ts` as it was, because that one also checks the sign-in and profile emails, whose server rule did not change (D-42 names only the shop and alerts emails).

### WR-01: the quote form email rule refuses what the server refuses

**Commit:** 07c0d9fe
`isPlainEmail` in `quoteSchemas.ts` replaces the old regex. It refuses ASCII spaces and control characters and `" ( ) , : ; < > [ \ ]`, extra `@`, a leading dot, a double dot and an empty domain part. I checked the character set against the real .NET parser for all ASCII: no mismatch. The wrong "stricter" comment is rewritten.
Tests: the quoteEmail part of the shared `email-cases.json` runs through `OrderRules.IsValidEmail` (.NET) and `isPlainEmail` plus the form schema (web).
Status: fixed, with two known gaps, both written in the comment and in the cases file: the browser is stricter than the server on a quoted local part, an IP address as the domain, and a domain ending in one lone dot (no visitor types these; the cases file lists them as `browserOnlyRefuse`), and a few rare letters that .NET rewrites (for example some combining marks) are left to the server.

### WR-02: a failed quote form load keeps the aside

**Commit:** d5b28f68
New `QuoteFormSlot` (a small error boundary around the lazy form) replaces the bare `LazyQuoteForm` on the Contact page. When the piece cannot load, `ErrorState` shows "Couldn't load the inquiry form." with "Try Again" (words in `PUBLIC_COPY.contact.formLoadFailed`). Try Again builds a new lazy component, so the piece is imported again. Messenger, Call, hours and the map stay.
Tests: `QuoteFormSlot.test.tsx` (loads, rejected import, axe, retry loads, retry fails again) and `ContactPage.formLoad.test.tsx` (the real route with a form module that throws: the message shows and the Messenger and Call links stay).
Status: fixed. `docs/web/budgets.md` still names `LazyQuoteForm` (line 228); I did not touch it.

### WR-05: an expired answer without a replacement reads a new ticket

**Commit:** 0d4c93fc
When the ticket-expired answer has no `replacementTicket`, the form now calls `tickets.refresh()` before it rethrows, so the next send waits for a new ticket.
Tests: a form test where the first create answers expired with no replacement: the alert shows, a second ticket is read, and the next send carries `ticket-2`.
Status: fixed.

### IN-02: site-content.md `updated` no longer moves backwards

**Commit:** d80f3a58
`docs/api/site-content.md` `updated` is now `2026-11-23T00:05:00-06:00`, later than the `2026-11-22T23:55:00-06:00` it lost. The WR-04 commit then bumped it to `2026-11-23T00:10:00-06:00` for its own text edit. Note: the clock on this machine reads about 23:40 on 2026-11-22, so these values are ahead of the real time. They are monotonic, which is what the rule asks for.
Status: fixed.

### IN-03: QuoteForm header comment

**Commit:** 1d23f3fa
The six-line header is now two lines that say what the file does. The comment above `send` lost its work-item tag.
Status: fixed.

## Not fixed

None. IN-01 was out of scope.

## Checks

- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors.
- .NET tests: Domain 2178 passed, Application 3331 passed, Architecture 290 passed, Server integration (`SiteSettingsWriteTests`, `SiteSettingsEndpointTests`, `CreateQuoteRequestTests`, `QuoteBotGuardTests`, `OpenApiSnapshotTests`) 54 passed, plus `CreateQuoteRequestTests` alone 12 passed. All 0 failed.
- Web: `npm run typecheck` clean, `npm run lint` (max warnings 0) clean, vitest on `modules/public`, `core/api`, the site content schema and tabs, and the layout and no-long-dash node tests: all passed (1451 and 8 tests).
- Budget (`npm --prefix web run build:budget`, gzip -9): Quote form 44.04 KB of 45.00 (was 43.89), public JS contact 147.61 of 150.00, public JS privacy 149.04 of 150.00. No limit changed.
- The OpenAPI snapshot was written once with `CSPS_WRITE_OPENAPI_SNAPSHOT=1`, the web types regenerated, both committed in c4606f66, and the snapshot test passes without the variable.

## For the owner

- Items 2 and 3 now share `tests/fixtures/email-cases.json`, a new file, so the .NET and web tests cannot drift.
- The Privacy row has 0.96 KB left; the quote form piece has 0.96 KB left. Plan 13-12 (photo picker, D-43) must stay in its own piece.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
