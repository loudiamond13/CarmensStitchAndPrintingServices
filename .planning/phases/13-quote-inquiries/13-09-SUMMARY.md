---
created: 2026-11-22T22:20:00-06:00
updated: 2026-11-22T22:20:00-06:00
phase: 13-quote-inquiries
plan: 09
subsystem: public-web
tags: [quote-form, react-hook-form, zod-mini, lazy-chunk, bundle-budget, honeypot, ticket, contact-page, tdd, playwright]

requires:
  - phase: 13-quote-inquiries
    provides: "13-01 anonymous create and the field rules and words; 13-02 the shared phone helper and the photo picker (not wired yet); 13-06 the form ticket, honeypot, minimum time and limits; review fixes D-38 (replacement ticket), D-39, D-40"
provides:
  - "The Get a Quote form on /contact (text fields, product choices, honeypot, D-27 privacy notice, Inquiry sent and Send Another), loaded as its own lazy piece"
  - "quoteService (getTicket, create), useQuoteTicket, quoteSchemas (quoteFormSchema, toCreateQuoteRequest, QUOTE_QUANTITIES), QuoteForm, LazyQuoteForm, ContactBigButtons"
  - "ProblemDetails.replacementTicket (core/api) so a client can use the D-38 replacement ticket"
  - "A Quote form row at 45 KB in build:budget and docs/web/budgets.md"
  - "The Contact layout of App. E.4 (form left and first, aside with Messenger, Call, hours, phones, map), SETTINGS-FAIL, the header Get a Quote on /contact, the new /contact meta description"
  - "web/src/test/quoteFixtures.ts (answerQuote, quoteTicketHandler) for the form tests of later plans"
affects: [13-12, 13-10, 13-11, 13-19]

actuals:
  tokens: 34800
  tasks: 3
  commits: 7
plan_head_before: e1c74e96e444055ea28c11fb0ff00b52e84f6a4a
plan_head_after: 97fbf004f0b75f3ae3b95f08912800e944a421b2

tech-stack:
  added: []
  patterns:
    - "zod/mini with named imports for a form on the public side: a shared chunk counts whole against a piece's budget, so the form avoids the classic zod bundle the admin forms share"
    - "Length limits are refinements on string length (UTF-16 units), because zod 4 counts code points and the server counts UTF-16 units"
    - "A ticket holder outside React (createQuoteTicketHolder) with a thin hook, plain state, no TanStack Query on the public side"
    - "The layout sends a window event and the page answers it, so page-only code stays out of the layout chunk every public page loads"

key-files:
  created:
    - web/src/modules/public/services/quoteService.ts
    - web/src/modules/public/hooks/useQuoteTicket.ts
    - web/src/modules/public/quoteSchemas.ts
    - web/src/modules/public/components/QuoteForm.tsx
    - web/src/modules/public/components/lazyQuoteForm.ts
    - web/src/modules/public/components/ContactBigButtons.tsx
    - web/src/modules/public/quoteFormEvent.ts
    - web/src/modules/public/quoteFormTarget.ts
    - web/src/test/quoteFixtures.ts
    - web/e2e/quote-form.spec.ts
  modified:
    - web/src/modules/public/pages/ContactPage.tsx
    - web/src/modules/public/copy.ts
    - web/src/modules/public/components/quoteForm.recipe.ts
    - web/src/modules/public/components/contact.recipe.ts
    - web/src/layouts/PublicLayout.tsx
    - web/src/core/api/http/HttpError.ts
    - web/scripts/budget.ts
    - web/playwright.config.ts
    - web/scripts/owner-review.mjs
    - src/Csps.Server/Endpoints/PublicPageHeads.cs
    - docs/web/budgets.md
  removed:
    - web/src/modules/public/components/ContactNowCard.tsx

key-decisions:
  - "The form uses zod/mini, not the classic zod the admin forms use, so its own piece fits the 45 KB row (classic: 49.36 KB with two fields; mini: 40.61 KB)"
  - "The ticket lives in plain state (useQuoteTicket), not TanStack Query, because the public side must never load that library (PERF-02)"
  - "The form waits out the minimum time (3 seconds, a client constant matching QuoteRequests:MinimumSeconds) after the ticket arrives, and resends once with the replacement ticket and a new Idempotency-Key (D-38, review fix note)"
  - "The form copy stays in PUBLIC_COPY.contact as the plan says, which costs every public page row about 0.7 KB"
  - "The layout sends a window event for the header Get a Quote, and the Contact page does the scroll and focus"

patterns-established:
  - "A new mini length rule: atMost(max, message) counting UTF-16 units"
  - "Test hosts and MSW: answerQuote() records tickets and creates; setup.ts answers the ticket read by default so the Contact page renders in any test"

requirements-completed: [INQ-01, INQ-08]

coverage:
  - id: D1
    description: "INQ-01: on /contact a visitor fills Your name and Contact number, presses Send Inquiry and sees Inquiry sent (focus on the title, toast, Send Another); the request goes to the real API"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/QuoteForm.test.tsx#QuoteForm send (INQ-01)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-form.spec.ts#@quote a visitor sends a text-only inquiry and sees Inquiry sent"
        status: pass
    human_judgment: false
  - id: D2
    description: "OR-3: quoteSchemas mirrors every server rule with the same words, at the same edges (100, 30 typed and mobile only, 254, 2,000 UTF-16 units), zod in jitless mode"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/quoteSchemas.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-24: Product type offers the visible lines in Products page order after two fixed choices that show at once; Quantity offers the five ranges; a failed read keeps the two fixed choices with no message"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/QuoteForm.test.tsx#QuoteForm product choices (D-24)"
        status: pass
    human_judgment: false
  - id: D4
    description: "INQ-08, D-27, INQ-03: the accurate privacy notice comes before Send Inquiry with Privacy Policy linking to /privacy in the same tab; the honeypot is out of the Tab order in an aria-hidden hidden wrapper, and a filled honeypot still shows success; zero axe violations"
    requirement: INQ-08
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/QuoteForm.test.tsx#QuoteForm honeypot and notice (INQ-03, INQ-08, D-25, D-27)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-form.spec.ts#@quote at 1440px the form card is on the left and the aside is beside it (page axe)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Contact layout: form first and left, aside with the Messenger and Call buttons, hours, phones and map, no What to send card; only the aside shows a settings failure and the form still sends; the header Get a Quote on /contact scrolls to the form and focuses Your name; 320px has one column and no sideways scroll"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/ContactPage.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-form.spec.ts#@quote at 320px the form comes first, the fields stack in one column and nothing scrolls sideways"
        status: pass
    human_judgment: false
  - id: D6
    description: "The /contact meta description reads Ask for a quote, message us on Messenger or call the shop. See our hours, address and map. in the server head and the client copy"
    requirement: INQ-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellPageTests.cs#PublicPageGetsItsOwnHead"
        status: pass
    human_judgment: false
  - id: D7
    description: "D-35: the form is its own lazy piece with its own 45 KB row; the Contact route stays at or under 150 KB and no limit was raised"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/scripts/budget.test.ts#evaluateBudgets: the quote form piece has its own row (D-35)"
        status: pass
      - kind: other
        ref: "npm run build:budget: Contact 147.20 KB, Quote form 43.89 KB"
        status: pass
    human_judgment: false
  - id: D8
    description: "How the form looks and feels on a real phone (spacing, the growing message box, the placeholder swap) and whether the owner accepts the form copy"
    verification: []
    human_judgment: true
    rationale: "Look and feel on a phone is for the owner's UI review (the placeholder heights were measured at 320px and 1440px only)."

duration: 85min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 09: A visitor sends a quote request from the Contact page Summary

*Created: 2026-11-22T22:20:00-06:00 · Updated: 2026-11-22T22:20:00-06:00*

**The Contact page now holds the Get a Quote form first, loaded as its own 43.89 KB lazy piece (zod/mini, react-hook-form) that checks every server rule in the server's words, waits out the bot minimum time, resends once with the replacement ticket, shows the honest privacy notice and the Inquiry sent state, while the Contact page itself stays at 147.20 KB.**

## Performance

- **Duration:** about 85 min (no start stamp was recorded; estimated from the first read to the last commit, 22:02)
- **Tasks:** 3 (one tracer and two TDD tasks)
- **Commits:** 7 (6 test and feature commits and one test speed fix), plus this summary
- **Files changed:** 36 (about 2,200 lines added, 210 removed); no API change, so no OpenAPI refresh

## Accomplishments

- **Task 1, the tracer (INQ-01, D-35).** `quoteService` (`getTicket`, `create` with the Idempotency-Key), `useQuoteTicket`, a first `QuoteForm` (name and number), `LazyQuoteForm` behind a `Suspense` placeholder, the 45 KB `Quote form` row in `budget.ts` with its tests and docs, and the first `@quote` e2e against the real API. The e2e host lifts the quote limits for its one process and uses a 1 second minimum time. Tracer verified end to end before expanding: unit tests, `build:budget` and `1 passed` in the chromium e2e.
- **Task 2 (OR-3, INQ-08, D-24, D-27).** `quoteFormSchema` mirrors every rule of `QuoteRequestRules` with the server's words and edges. The form has the seven fields in the UI-SPEC order (autocomplete, input modes, hint, the Message box that grows from 6 to 12 rows), the product lines after two fixed choices, the five quantity ranges, the honeypot `subjectLine`, and the D-27 notice with a Privacy Policy link before Send Inquiry.
- **Task 3 (App. E.4, SETTINGS-FAIL).** `ContactPage` is rebuilt: form card left and first on phones, aside with the Messenger and Call big buttons (`ContactBigButtons`), hours, phones and map. `ContactNowCard` and the What to send card are gone. Only the aside shows a settings failure and the form still sends. The header Get a Quote, pressed on /contact, scrolls to the form and focuses Your name. The head lead uses a comma for the long dash. The /contact meta description is the new one on the server and in the client copy.
- **D-38 and the minimum time (review fix notes).** `ProblemDetails.replacementTicket` is read from the expired-ticket 400. The form waits `QUOTE_MINIMUM_WAIT_MS` (3 seconds) after the ticket arrives, so a normal send is never caught as too fast, and an expired-ticket answer is resent once, at once, with the replacement ticket and a new Idempotency-Key. A second expired answer shows the send-failed line.
- **IN-03 (13-REVIEW-W1).** The number is counted on the trimmed text at 30 characters before it is read, and must be a mobile (a landline fails), with tests pinned to the server cases and the shared phone cases.

## Task Commits

1. **Task 1, tracer: a visitor's name and number go to a saved request, in budget**
   - RED: `ba4aecc8` (test)
   - GREEN: `a406460a` (feat)
2. **Task 2, TDD: every field, the product choices, the honeypot and the privacy notice**
   - RED: `f24b1f37` (test)
   - GREEN: `73788147` (feat)
3. **Task 3, TDD: the Contact layout, SETTINGS-FAIL, the header CTA and the meta description**
   - RED: `8a15fbbd` (test)
   - GREEN: `93fba432` (feat)

4. **Test fix:** `97fbf004` (the long-message check pastes its 2,001 characters, so it stays fast under a full suite run; it timed out at 5 seconds once while everything else ran)

No refactor commit: nothing needed cleaning after GREEN.

## TDD Gate Compliance

Each `test(13-09)` commit precedes its `feat(13-09)` commit. Each RED used compile-only stubs, so the failures are on assertions. The RED runs are vitest output (the classifier `gsd_run check tdd-red-evidence` was **not run**: the RED states were no longer on disk when I noticed, so the evidence below is the quoted vitest counts and my own reading of why each failed).

| Task | Run | Result | Semantic assessment |
|---|---|---|---|
| 1 | `quoteService.test.ts`, `QuoteForm.test.tsx`, `budget.test.ts`, `HttpError.test.ts` | 19 failed, 134 passed | `quoteService` stub rejected with "not implemented" where a typed answer was planned (3); the `QuoteForm` stub rendered nothing, so the planned first assertion (the form has Your name) failed (11 of 12; the at-rest axe test passes vacuously on the toast layer); the budget report had no `Quote form` row (4); `replacementTicket` was not read (1) |
| 2 | `quoteSchemas.test.ts`, `QuoteForm.test.tsx` | 23 failed of 82, and 11 failed of 25 | The schema stub had the fields and no rules, so the length, email, product and quantity cases and `toCreateQuoteRequest` failed on the planned messages and values; the form had two fields, so the fields, product choices, honeypot, notice and timing cases failed |
| 3 | `ContactPage.test.tsx`, `contact.test.tsx`, `ShellPageTests` | 10 of 19, 7 of the new `ContactBigButtons` cases, and 1 of 34 | The stub rendered nothing for the buttons; the page still had the Message us card, the old lead, the whole-area error and no header CTA handler; the server head still had the old description (`Expected ... Ask for a quote ...`) |

Tests that passed on the first run (kept on purpose): the budget test that a public route loading the form libraries statically still fails (the existing rule already did it), and the at-rest axe test in the Task 1 file, which passed vacuously on the toast layer (its real value comes in Task 2, where the form has all its fields).

## Decisions Made

- **zod/mini.** The first two-field form measured 49.36 KB with classic zod, over its own 45 KB row. The classic bundle is shared with the admin forms, and a shared chunk counts whole. With `zod/mini` (the same package, named imports) the piece is 40.61 KB, and 43.89 KB with the complete text form. Not a new package.
- **Plain state for the ticket**, as the public side never loads TanStack Query (PERF-02). The plan said TanStack Query; this keeps its goal ("no cache reuse between mounts") and the budget.
- **UTF-16 length.** zod 4 counts code points for `max`, so 99 letters and an emoji (101 units) passed. Name, team, email and message use a refinement on `.length`, the server's measure, with the emoji cases tested.
- **The form copy stays in `copy.ts`** (the plan's acceptance grep needs it there). The price is about 0.7 KB on every public row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The ticket hook does not use TanStack Query**
- **Found during:** Task 1
- **Issue:** `PUBLIC_FORBIDDEN_MODULE_PREFIXES` and PERF-02 keep `@tanstack/` out of the public side; the plan named TanStack Query for `useQuoteTicket`.
- **Fix:** `createQuoteTicketHolder` (plain promises, testable alone) and a thin hook. It also gives the form what it needs: wait for the ticket, adopt a replacement, refresh on Send Another.
- **Files modified:** web/src/modules/public/hooks/useQuoteTicket.ts
- **Commit:** a406460a

**2. [Rule 3 - Blocking] zod/mini instead of classic zod**
- **Found during:** Task 1 (`build:budget` failed: Quote form 49.36 KB over 45.00 KB)
- **Fix:** named imports from `zod/mini` in quoteSchemas.ts; `config({ jitless: true })` is kept. See Decisions.
- **Commit:** a406460a

**3. [Rule 1 - Bug] zod counts code points, the server counts UTF-16 units**
- **Found during:** Task 2 (the emoji cases)
- **Fix:** `atMost()` refinement for the four length rules.
- **Commit:** 73788147

**4. [Rule 2 - Missing critical] The expired-ticket resend and the minimum wait are in this plan**
- **Issue:** the plan lists the resend under 13-12, but the owner ruling D-38, the plan's own `owner_rulings_after_planning` and the review fix note say the form must use the replacement ticket and must wait out the minimum time. Without them a visitor who leaves the tab open gets a failure, and a fast send is silently dropped.
- **Fix:** `ProblemDetails.replacementTicket` (core/api, with a test), the wait and the one resend in `QuoteForm.send`. Plan 13-12 can build the error boxes on top and should not add a second resend.
- **Commit:** a406460a

**5. [Rule 2 - Missing critical] A basic send-failed line**
- **Issue:** the error states belong to 13-12, but a form that fails with no message loses the visitor.
- **Fix:** one `role="alert"` box with the UI-SPEC send-failed words for any failure; values stay (prohibition D-26, tested). 13-12 replaces it with the full set (rate limit, maybe sent, field errors).
- **Commit:** a406460a

**6. [Rule 3 - Blocking] Files the plan did not list**
- `ContactBigButtons.tsx` (the two buttons move to the aside, with their tests in `contact.test.tsx`), `quoteFormEvent.ts` and `quoteFormTarget.ts` (the header CTA, split so the layout carries a few bytes only), `web/src/test/quoteFixtures.ts` and a default ticket answer in `setup.ts` (every test that renders Contact now needs one), `scripts/owner-review.mjs` and its test (they must mirror the e2e host's lifted limits, a pinned test), `web/e2e/contact.spec.ts` (the old Message us heading), small comment edits in `BigContactButton.tsx` and `CallHoursNote.tsx`, and cleanups in `contact.recipe.ts` and `copy.ts` for the removed card.
- **Commits:** a406460a, 93fba432

**7. Commit trailer and branch.** The plan text names `Claude Opus 5.5` and `gsd/phase-13-quote-inquiries`. This run was dispatched into a parallel worktree with its own branch and the orchestrator's attribution (`Claude Sonnet 5.5`), so those were used. No branch was created, switched or merged.

**8. The tracer e2e shows a 200 with an id, not a stored row.** The API has no staff read yet (13-13 and later), so the e2e cannot read the request back. The saved row is proven by the server integration tests of 13-01 and 13-06; the e2e proves the browser journey against the real host with the real ticket guard (a too-fast send would also be a 200, which is why the client waits and the e2e host's minimum is 1 second).

**Total deviations:** 3 blocking (Rule 3), 1 bug (Rule 1), 2 missing critical (Rule 2), plus the file list and trailer notes.

## Issues Encountered

- **Budget.** The first two-field form was over its own 45 KB row (see zod/mini). The finished text form has 1.11 KB left in that row.
- **Flakes, recorded:** `GalleryPage.test.tsx` (shows all 16 demo items) failed once in a wide vitest run while an e2e build ran in parallel; alone it passed (28 of 28). `LegalPages.test.tsx` (old Cookie Policy address) failed once in the full suite and passed alone. Neither file is touched by this plan.
- **Pre-existing, not mine:** `scripts/license-policy.test.ts` ("exits 1 on a stricter policy given through --exceptions") fails in this worktree with "No packages found in this path" from the license checker, which reads the folder layout; none of its inputs changed here.
- The Playwright host, `build:budget` and the dotnet tests ran only against `CSPS_E2E` and `CSPS_Test_*` databases and the e2e port 5199, after the preflight check showed the ports free. No dev server was started on the project ports.

## Verification Results

- `npm run test` for the touched areas: the three form test files (quoteService, QuoteForm, quoteSchemas), `ContactPage.test.tsx`, `contact.test.tsx`, `budget.test.ts`, `vite-budget-plugin.test.ts`, `owner-review.test.ts`, `HttpError.test.ts`, `src/test` and `src/layouts`: all passed in the final runs (for example `src/modules/public src/layouts src/test src/components/navigation`: 1477 passed before the last two fixes, then the ContactPage file 19 of 19).
- Whole web suite (`npm run test -- --run`, after the last code commit except the test speed fix): 429 files, 11,531 tests: 11,528 passed and 3 failed. The three, each re-run alone: `scripts/license-policy.test.ts` fails the same way alone ("No packages found in this path", pre-existing in this worktree, see Issues); `QuoteForm.test.tsx` "checks every field on send" timed out at 5 seconds under the full load, fixed by pasting the long text (now 694 ms, 25 of 25 alone); `LegalPages.test.tsx` "the old Cookie Policy address" read the title "Privacy Policy · CSPS" once under load and passes alone (45 of 45 with the form file), a flake in a file I did not touch.
- `npm run lint` (`--max-warnings 0`): clean. `npm run typecheck`: clean. `node scripts/class-gate.mjs`: exit 0. `npx prettier --check` on `web/src`, `web/scripts`, `web/e2e` and the Playwright config: clean.
- `npm run build:budget`: all rows ok. Contact 147.20 KB (limit 150), **Quote form 43.89 KB (limit 45)**, Privacy 148.97 KB (the tightest public row), Admin JS 223.15 KB, CSS 20.48 KB.
- `npm run e2e -- --grep "@quote|@contact" --project chromium`: 14 passed (including the two Phase 13 layout tests, the header CTA test, the bad number test, the 320px and 1440px layout and axe at page level, and the existing contact tests, with the CSP and console listener on).
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ShellPageTests"`: 34 of 34 passed.
- Acceptance greps: `quoteFormJs` in `budget.ts` = 4; `LazyQuoteForm` in `ContactPage.tsx` = 2; `ContactNowCard.tsx` is gone; `Ask for a quote, message us on Messenger or call the shop.` in `PublicPageHeads.cs` = 1; the D-27 sentence in `copy.ts` = 1; `jitless` in `quoteSchemas.ts` = 1.
- The OpenAPI snapshot is unchanged (no API comment or endpoint changed).

## Review items (13-REVIEW-W1)

- **IN-03: applied** in the schema (30 typed characters on the trimmed text, mobile only, tests pinned to the server cases).
- **IN-05: not touched.** The picker (`QuotePhotoPicker.tsx`) is not wired into this form; plan 13-12 puts it in the photo slot and should fix IN-05 there (serialize picks, show the "not added" notice, guard the late preview).

## Known Stubs

None. The form carries a comment where the photo picker joins (plan 13-12); nothing is rendered for it.

## Threat Flags

None beyond the plan's threat model. T-13-26 (strict CSP, jitless zod): `config({ jitless: true })` is set and the e2e CSP listener saw no violation. T-13-27 (honeypot): neutral name, `autocomplete="off"`, `tabIndex=-1`, aria-hidden hidden wrapper, and an expired ticket is resent, never shown as success. T-13-28 (bundle growth): the lazy piece has its own 45 KB row and the Contact route is 147.20 KB. T-13-SC: no package added or bumped.

## Next Phase Readiness (for the owner and plan 13-12)

1. **The Quote form row has 1.11 KB left, and the photo picker is next.** The picker, its image helpers and their copy will not fit in 1.11 KB if they ship in the form's piece. Options for the owner, recommendation first: (a) load the picker as its own lazy piece the first time a visitor chooses photos (no limit raised, a small wait on the first tap); (b) raise the Quote form row (the plan and D-35 say never to raise a limit, so this needs your ruling); (c) drop `react-hook-form` for a small hand-written form state (about 14 KB less; D-35 says to keep the admin tools, so also your ruling). Plan 13-12 should decide with this number in view.
2. **The Privacy row has 1.03 KB left** (148.97 of 150). The form's strings in `copy.ts` added about 0.7 KB to every public row. If a later plan (for example the Privacy Policy text change, D-28) needs the room, the form's copy can move into a form-only module; the plan's acceptance grep names `copy.ts`, so that needs a plan edit.
3. **The minimum wait is a client constant (3 seconds)** that mirrors `QuoteRequests:MinimumSeconds`. If the owner raises the server setting above 3, the constant must follow (or the ticket answer should carry the number; that is an API change and not in this plan).
4. **Plan 13-12** gets the resend and the wait already done, `answerQuote()` for tests, and a basic send-failed box to replace with the full set.
5. **`?product=` preselect (UI-SPEC Q4)** is not in this plan; the form has no preselect yet.
6. **Owner UI review:** the placeholder height was measured at 320px (1036px) and 1440px (696px); it is 1000px on phones and 696px otherwise. Check the swap on a real phone for any jump.

## Self-Check: PASSED

- All 10 created source, test and e2e files named in `key-files.created` were found on disk, and `ContactNowCard.tsx` is gone.
- Commits `ba4aecc8`, `a406460a`, `f24b1f37`, `73788147`, `8a15fbbd` and `93fba432` (and `97fbf004`) are ancestors of HEAD.
- The measured commit count from the plan base is 7 (`rev-list --count`), before this summary's own commit.
- Gate order holds: each `test(13-09)` commit precedes its `feat(13-09)` commit.
