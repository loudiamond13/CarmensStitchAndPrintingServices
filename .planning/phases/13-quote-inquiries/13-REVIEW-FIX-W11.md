---
created: 2026-11-24T01:31:54-06:00
updated: 2026-11-24T01:31:54-06:00
phase: 13-quote-inquiries
wave: 11
review: 13-REVIEW-W11.md
fixed_at: 2026-11-24T01:31:54-06:00
iteration: 1
findings_in_scope: 14
fixed: 12
not_fixed: 2
status: partial
---

# Phase 13: Code Review Fix Report (wave 11, plan 13-23)

*Created: 2026-11-24T01:31:54-06:00 · Updated: 2026-11-24T01:31:54-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree). Plan 13-24 was running in another worktree at the same time, so I ran no Playwright, parity, e2e, dev server, LocalDB or .NET test. I used only `npx vitest run <files>`, `npm run typecheck`, `npm run lint`, `npx prettier --check .` and `npm run build:budget`. No server code changed.

In scope: all 14 findings.
- Fixed: CR-01 (option A), WR-01, WR-02, WR-03, WR-04, WR-06, IN-01, IN-02, IN-03, IN-04, IN-06 and IN-07.
- Owner items, no code change: WR-05 and IN-05. The budget rows are below.
- Also fixed: a load-sensitive wait in the quote scenario test.

Each fix is its own commit with its tests. Each new test was run red first, except where noted.

## Fixed

### CR-01: the showcase demos no longer write into the app's shared public stores (option A, built)

**Commits:** cea180de (data), 467d30e4 (links, with WR-01)

The data:
- The public stores (`publicResource.ts`) now have a `PublicDataScope`. It works like a separate QueryClient for one part of the page: a resource listed in the scope shows the scope's fixed answer there. It never loads, primes or changes the shared store.
- `QuoteFormDemo` and `PublicShell` now pass their made-up shop facts and product lines through the scope. Neither file calls `prime()` any more, and `PublicShell` no longer primes the site store when it is imported (the older plan 11-10 case).
- So the real Products and Contact pages never see "Basketball Jerseys" and "Polo Shirts" from the demo, or the demo shop facts.

The links:
- Every showcase case frame now stops a press on a link (click and middle click), so nothing navigates away. Buttons work as before (Send, Send Another, Show this example, the dialogs and toasts).
- This covers the header links (`site-header-home`), View Products (`buttonlink-primary-md`), the quote form's Privacy Policy link and every other link in a case.

Tests:
- `quote.test.tsx`: after a quote case shows and unmounts, the real Products page shows "Volleyball Jerseys" from its own data. It failed on the old code (the page showed the two demo lines).
- `quote.test.tsx`: after a quote case and the public shell show and unmount, the shared stores are still unloaded. It failed on the old code ("site success, lines success").
- `quote.test.tsx`: no preview file calls `.prime(`. It failed on the old code (`PublicShell.tsx`, `QuoteFormDemo.tsx`).
- `publicResource.test.tsx`: two unit tests for the scope (fixed answer with no load, the shared store untouched; an unlisted resource loads as usual). Their first run was an import failure, because the scope did not exist yet. The three tests above are the assertion reds.
- `ComponentShowcasePage.test.tsx`: pressing View Products, the header Products link and Privacy Policy stays on `/admin/components`. All three failed on the old code (the address became `/products` and `/privacy`).

Status: fixed. Needs a human check of the showcase in a browser (the parity and e2e runs below).

### WR-01: no demo link leaves the showcase, and Messenger points nowhere outside

**Commit:** 467d30e4
- The link guard above covers the quote cases.
- The quote demo's Messenger link is now `#` (an in-page link). The showcase no longer points at `https://m.me/cspsdemo`, an account the shop does not own.
- `PublicShell` keeps its parity hrefs (`cspsdemo`), because the reference fragment draws the same footer. The guard stops a press on them.

Test (`ComponentShowcasePage.test.tsx`): the rate-limited case's Messenger link has `href="#"`, and pressing it leaves the address and hash unchanged. It failed on the old code (`https://m.me/cspsdemo`).

Status: fixed.

### WR-02: the record now says where the showcase previews ship

**Commits:** f294c554 (code), 606744ad (docs, with IN-06)
- The header comments of `QuoteFormDemo.tsx`, `PublicShell.tsx` and `dev/kit.ts` no longer say "never shipped". They say these ship in the Manager showcase chunks, so they hold made-up data only.
- `13-23-SUMMARY.md`: the provides line, the file list and the T-13-66 threat flag are corrected. The showcase imports the kit and every preview, so the quote demo is in the production showcase chunks, which can be downloaded without signing in (T-05-96). They hold made-up data only, and never sit in a public page's chunks.
- `13-23-PLAN.md`: must-have 4 and the T-13-66 row are corrected the same way.
- New build-output check: the quote demo's `demo-ticket` text appears only in the showcase chunks.
  - On the existing production build (from 22:44, before 13-23) it fails: "expected 0 to be greater than 0". That build has no quote demo.
  - I could not run `npm run build` here. I ran the same logic on the new budget build: one carrier, `ComponentShowcasePage-DjZs7trR.js`, and none outside the 117 showcase chunks.

Status: fixed. The build-output test needs a run on a fresh production build (see "Still to run").

### WR-03: the demo uses the UI-SPEC sample number

**Commit:** a02be6f9
- The demo now types `0917 123 4567` (the UI-SPEC sample). The "555 01xx" wording is gone.

Test (`quote.test.tsx`): the sending case's Contact number is `0917 123 4567`. It failed on the old code ("0917 555 0123").

Follow-up, as asked: `web/src/test/quoteRequestFixtures.ts` (lines 28 and 118) still uses `0917 555 0101`. It is test data only and is not shipped.

Status: fixed.

### WR-04: QuoteForm reads its service once

**Commit:** 6c885cc8
- `QuoteForm` keeps the service of its first render (`useState`). The ticket hook, the create, the resend after an expired ticket and the photo uploads all use that one. The prop comment says so.
- Visitors are not affected: the Contact page passes no service.

Test (`QuoteFormPhotos.test.tsx`): render with service A, re-render with service B, then send with a photo. The create (with A's ticket) and the upload go to A, and B is never called. It failed on the old code (the create went to B).

Status: fixed.

### WR-06: the tests now prove the focus claim

**Commit:** 3b8fdf15
- The on-request test now waits for each state's own text ("Enter your name.", the "Inquiry sent" heading, "didn't upload"), not the form title. Then it checks that focus moved into the case.
- New test: every quote case shown on load reaches its state, and focus stays on the page body.
- Proof: for one run I took `quote-form-sent` off the on-request list. The new test failed ("expected <h2> to be <body>"). Then I restored the file (`git checkout`).

Status: fixed (tests only).

### IN-01: the three alert cases show on request

**Commit:** 6756276e
- `quote-form-photos-refused`, `quote-form-rate-limited` and `quote-form-send-failed` now show behind "Show this example", like the cases that move focus. A screen reader no longer hears three alerts when the showcase opens.
- On load the quote section now shows `quote-form-empty` and `quote-form-sending`.

Test: each of the three has no alert and a Show this example button on load, and shows its alert after the press. All three failed on the old code (no button).

Status: fixed. Owner item 3 below.

### IN-02: the MSW listener is always removed

**Commit:** 2c7e9f1a
- `server.events.removeAllListeners()` moved into the file's `afterEach`, so a failed assertion cannot leave the listener behind.
- The service test also checks that `fetch` never reached `/quote-requests`.

This is test hygiene, so there is no red run.

Status: fixed (test only).

### IN-03: the no-request checks wait a moment

**Commit:** c0a7c1ba
- The "sends no request" checks now run 50 ms after each state shows (inside `act`).

I tried a red run: I made the demo send a request 20 ms, then 45 ms, after its steps. The test failed both with and without the new wait, because the state finds already take longer than that. So I have no clean red run for this one.

Status: fixed (test only).

### IN-04: a form that fails to load takes down its own case only

**Commit:** 59cd1c29
- `QuoteFormDemo` wraps its lazy form in a small error boundary. A failed form piece shows the Contact page's own message, "Couldn't load the inquiry form.", in that case. The rest of the showcase stays.
- I reused the Contact page copy, so there is no new copy.
- The Phase 10, 11 and 13 on-request chunks have the same gap. They are not changed (follow-up).

Test (`quote.test.tsx`): with a failing load, the case shows the alert and the rest of the page stays. It failed on the old code (no alert).

Status: fixed.

### IN-06: the plan's acceptance greps match the code

**Commit:** 606744ad
- Task 1 now greps `Phase13` in `ShowcaseDemos.tsx` (5 matches) and `id: 'quotes'` in `showcaseSections.ts` (1 match).
- Task 2 now greps "registers the quote group" in `index.test.ts` (1 match).

Status: fixed (docs).

### IN-07: the sidebar demos are inert

**Commit:** e4d9ae58
- The four NavCount cases are now `inert`. They are pictures, and `Still` already blocks their clicks. So they add no Admin nav landmark and no second current page for screen readers, and they take no focus.
- The earlier Sidebar scenarios share the pattern and are not changed (follow-up).

Test (`Phase13Demos.test.tsx`): each of the four sidebar navs sits inside an `[inert]` element. It failed on the old code.

Status: fixed. Owner item 4 below.

### The quote scenario test waits

**Commit:** b12c92e6
- In a 39-file run, "shows the empty form" failed once at the 1 second default wait. Alone it passed. Each case loads the form's pieces first.
- Every find and the photo-list wait in `quote.test.tsx` now allow 10 seconds. The checks are the same.

Status: fixed.

## Not fixed (owner items)

### WR-05: the public bundle cost of the showcase

No new code for this finding. The CR-01 fix moved bytes, so here are the rows. No limit was changed and no row is over.

| Row | Before (at 1d96c15e) | After |
| --- | --- | --- |
| public JS (home) | 146.63 KB | 146.72 KB of 150.00 |
| public JS (products) | 143.53 KB | 143.62 KB of 150.00 |
| public JS (gallery) | 144.67 KB | 144.76 KB of 150.00 |
| public JS (contact) | 148.32 KB | 148.42 KB of 150.00 |
| public JS (privacy) | 149.10 KB | 149.19 KB of 150.00 |
| public JS (terms) | 147.32 KB | 147.41 KB of 150.00 |
| public JS (accessibility) | 146.87 KB | 146.97 KB of 150.00 |
| public JS (notFound) | 139.39 KB | 139.49 KB of 150.00 |
| admin JS | 226.10 KB | 226.10 KB of 250.00 |
| Quote form | 44.39 KB | 44.40 KB of 45.00 |
| CSS | 20.55 KB | 20.55 KB of 35.00 |

- The scope adds about 0.09 to 0.10 KB to every public row, because every public page loads the shared store. Privacy now has 0.81 KB left.
- The build still prints its standing note: public JS in the admin-included build is past the 135 KB trigger for the Phase 4 barrel split.

### IN-05: the UI-SPEC "dev public page"

No code change. This is owner item P13-23-2 from the 13-23 summary.

## Owner items

1. **How the showcase demos get their shop data (CR-01).**
   - A, built: the demos show fixed, made-up data through a `PublicDataScope`, and every link in a case is blocked. Nothing is sent and the real pages never see the demo data. Cost: about +0.09 KB on each public row.
   - B, alternative: the showcase reads the real shop facts and product lines (two harmless GET requests), and only the parity page uses fixed data. This drops the "no request" rule for the showcase and needs your ruling. The scope could then go, which would remove its public cost.
2. **P13-23-3, the public bundle cost of showing the real form (WR-05).** Still open. A (built): the showcase renders the real QuoteForm. B: keep the form states on the parity page only, which removes the shared-chunk cost. The review asks for a ruling before ship, and, if A stays, a note in `DECISIONS.md` and the budget report. I did not edit `DECISIONS.md`.
3. **Which quote cases show on load (IN-01).** A, built: only the empty and sending cases show on load, and the six others are behind Show this example. B: keep the three alert cases on load and accept that a screen reader reads three alerts when the page opens.
4. **The sidebar demos (IN-07).** A, built: the four Phase 13 NavCount cases are inert. B: leave them readable and record five Admin navs as a showcase pattern. The older Sidebar scenarios have the same issue either way.
5. **P13-23-2, the dev public page (IN-05).** Still open, as recorded in the 13-23 summary.

## Still to run (for the orchestrator, after the merge)

- `npm run parity -- --grep "@quote "`: the quote cases now use the scope, the `#` Messenger link and the load boundary.
- `npm run parity -- --grep "public-shell"`: the public shell now reads its shop facts from the scope. It should look the same.
- `npm run e2e -- --grep "@quote" --project chromium`: WR-04 touched `QuoteForm`.
- Any `@showcase` e2e, including one 13-24 may add for the Quote requests section. It must expect the photos-refused, rate-limited and send-failed cases behind Show this example, and links that do not navigate.
- `src/test/build-output.node.test.ts` after a fresh `npm run build`, for the new T-13-66 check.

## Flakes and other findings

- `OrderFormPage.test.tsx` (12 tests) and `ProfilePage.test.tsx` (1 test) timed out at the 5 s default in a 240-file run while 13-24 was busy on the same machine. Alone: "Test Files 2 passed (2)", "Tests 188 passed (188)". These files were not changed.
- `QuoteFormPhotos.test.tsx` "starts no upload before the text is saved" failed once in a 111-file run: the form had already reached "Inquiry sent" before the test found the Sending button. The Sending state lasts only the 1 second ticket wait, so a slow machine can miss it. Alone the file passed 3 times out of 3 ("Tests 25 passed (25)"). It is not caused by these fixes. It needs an entry in `deferred-items.md`.
- "shows the empty form" in `quote.test.tsx` failed once and is fixed above.
- Follow-ups: the phone in `quoteRequestFixtures.ts` (WR-03); the error boundary for the Phase 10, 11 and 13 on-request chunks (IN-04); the older Sidebar scenarios (IN-07).
- The 13-23 summary keeps its record of what was built (for example "primed stores" and the old demo phone). Only the WR-02 wording was corrected. This report records the later changes.

## Checks

- Affected web tests: `npx vitest run src/modules/public src/dev src/lib src/layouts src/modules/admin/components/showcase src/modules/admin/pages/ComponentShowcasePage.test.tsx src/modules/admin/pages/ComponentShowcasePage.lazy.test.tsx src/components/navigation` plus every `src/test/*.node.test.ts` except build-output: "Test Files 1 failed | 110 passed (111)", "Tests 1 failed | 2539 passed (2540)". The one failure is the flake above. That file alone passed 3 times out of 3.
- Earlier run of `src/modules/admin` and `src/dev`: "Test Files 2 failed | 238 passed (240)". The 13 failures were the timeouts above, and both files pass alone.
- Last targeted runs after the final change: `quote.test.tsx` and `index.test.ts` "Tests 45 passed (45)"; the showcase page, lazy and photo tests "Tests 73 passed (73)"; `Phase13Demos.test.tsx` "Tests 15 passed (15)".
- `npm run typecheck`: exit 0.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0.
- `npx prettier --check .` (in `web/`): "All matched files use Prettier code style!"
- `npm run build:budget`: exit 0, every row ok. The rows are under WR-05.
- No em or en dash was added in `web/` (a check of the added lines found 0).
- gitleaks (pre-commit hook) said "no leaks found" on every commit. No real names, emails, server names or local paths were staged. The demo data is made up (the UI-SPEC sample name and number, an `example.test` address).
- No package was added or bumped. No server file changed. No schema, migration, SQL, trigger or JSON column change.
- No dev server, e2e host, browser or background shell is left running. I started none of the first three.

---

_Fixed: 2026-11-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
