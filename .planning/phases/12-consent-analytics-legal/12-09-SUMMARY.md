---
phase: 12-consent-analytics-legal
plan: 09
subsystem: public-web-consent
tags: [consent, cookie-bar, gpc, external-store, bundle-budget, playwright-fixture, tdd]
created: "2026-11-17T02:45:00-06:00"
updated: "2026-11-17T02:45:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-03 consent cookie codec; 12-05 Cookie Policy version; 12-08 POST /api/v1/analytics/consent; 12-31 D-43 date rule and the entry room"
provides:
  - "useConsent / consentStore: one consent state for the public layout (state, actions, settings-window flag, saved line)"
  - "ConsentSlot (first download) and ConsentBar CB1 (its own lazy chunk), mounted after the skip link"
  - "consentService.record: the typed consent call (OR-5)"
  - "consentRules, consentSave, consentJar, consentPolicy: the lazy rules, the save path, the cookie reader and the policy version alone"
  - "--spacing-consent-bar token, bar scroll padding, and the phone ContactBar rule on /contact (D-30)"
  - "web/e2e/fixtures.ts: consent option (default decided Reject All cookie) and addDecidedConsent"
affects: [12-13, 12-14, 12-15, 12-16, 12-17, 12-20, 12-24]

actuals:
  tokens: 18100
  tasks: 3
  commits: 8
plan_head_before: f7b99813f91e7c276154ef3b323fb163c82816f1
plan_head_after: 90904ae1a5ba24e1503ae61a2fbd2f672f3ff83b
commits: 8

tech-stack:
  added: []
  patterns:
    - "A small external store (useSyncExternalStore) whose first-download part is only the state shell and the cookie reader; rules, save path and service load on demand"
    - "The save path never writes the confirmed cookie: it writes a provisional pending cookie, then the server sets the real one"
    - "In-memory held choice, so a browser that refuses the cookie still closes the bar for the page"

key-files:
  created:
    - web/src/modules/public/hooks/useConsent.ts
    - web/src/modules/public/consentRules.ts
    - web/src/modules/public/consentSave.ts
    - web/src/modules/public/consentJar.ts
    - web/src/modules/public/consentPolicy.ts
    - web/src/modules/public/consentCopy.ts
    - web/src/modules/public/services/consentService.ts
    - web/src/modules/public/components/ConsentSlot.tsx
    - web/src/modules/public/components/ConsentBar.tsx
    - web/src/modules/public/components/consent.recipe.ts
    - web/src/test/consentFixtures.ts
    - web/src/test/consent-look.node.test.ts
  modified:
    - web/src/layouts/PublicLayout.tsx
    - web/src/modules/public/consentCookie.ts
    - web/src/modules/public/legalPages.ts
    - web/src/ui/app.css
    - web/src/test/setup.ts
    - web/e2e/fixtures.ts
    - web/e2e/fixture-selftest.spec.ts
    - docs/web/budgets.md

key-decisions:
  - "today comes from the Asia/Manila business day, never the device date (D-43, 12-31 note); stats and map permission come from isCurrentChoice through deriveConsent"
  - "A first visit needs no rules: no cookie means ask (unless GPC). With a cookie, the saved choice is trusted until the rules chunk arrives, so a returning visitor sees no flash; a stale choice shows the bar once it loads"
  - "A first decision is sent without a chain id (the contract says null on a first decision); a resend sends the provisional cookie's id"
  - "The saved line is an always-present aria-live polite region (data-consent-status), not role=status, because page tests and pages find their own status lines by that role"
  - "The 204px phone value of --spacing-consent-bar is set by PublicLayout, because the stylesheet contract (D-33) allows no media rule in app.css"

requirements-completed: [ANL-01, ANL-07]

metrics:
  duration: 4h50m
  completed: 2026-11-17
---

# Phase 12 Plan 09: First-time visitors get a fair cookie choice in a bar at the bottom of the page Summary

**A first visit shows a bottom cookie bar (Cookie Settings, Reject All, Accept All, the last two identical); a choice is applied at once through a provisional cookie, sent to `POST /api/v1/analytics/consent`, kept and resent once if the send fails, and asked again only for a new Cookie Policy version, a choice over 12 months old, or a 409. The public first download grew by 1.4 KB (Contact 147.71 to 149.11 KB, limit 150).**

## What was built

- **Store** `hooks/useConsent.ts`: `createConsentStore`, `consentStore`, `resetConsentStore` (tests only), `useConsent`. State is `ConsentState` as the plan fixed it. Actions: `acceptAll`, `rejectAll`, `save`, `allowMaps`, `openSettings(opener)`, `closeSettings` (returns focus to the opener), `resendPending`.
- **Lazy parts.** `consentRules.ts` (cookie rules, Manila day), `consentSave.ts` (provisional cookie write, send, 409, resend), `consentService.ts` (the call). The bar starts loading the save path with itself, so a click applies at once.
- **Bar** `ConsentBar.tsx` + `consent.recipe.ts`: a `section` named "Cookie choices", text with a Cookie Policy link, DOM order Cookie Settings, Reject All, Accept All. Reject All and Accept All share one class string. The phone grid puts them in equal halves with Cookie Settings full width under them. Focus goes to `main` (preventScroll) after a choice. No primary button.
- **Slot** `ConsentSlot.tsx`: loads the bar only while a choice is needed, and holds the visually hidden polite line "Your cookie choice is saved."
- **Layout** `PublicLayout.tsx`: slot after the skip link, `resendPending` on each page view, bar scroll padding (token + 24px + safe area) and root bottom padding while the bar shows, and no phone ContactBar and no contact padding on `/contact` while it shows (D-30).
- **Token** `--spacing-consent-bar: 92px` in `app.css`; 204px at 767px and below set in the layout. `consent-look.node.test.ts` pins both numbers to the bar's own parts.
- **E2E** `fixtures.ts`: `consent` option (`'decided'` default, `'none'` opt-out) and `addDecidedConsent`; the default cookie is Reject All with the version from `tests/fixtures/legal-pages.json` and the Manila business day. Self-tests prove both modes and the bar on the bottom edge within its token.

## TDD gate sequence

| Step | Commit | Evidence |
|------|--------|----------|
| Task 1 RED | f21392e5 | `Test Files 4 failed (4)`, `Tests 17 failed \| 39 passed (56)`; stubs compile and return wrong answers (no bar, no save) |
| Task 1 GREEN | 7016a476 | 55 of 56 passed; the one failure was a test mistake (the fake fetch records the body as JSON text), fixed; `consentService.test.ts` 2 passed |
| Task 2 RED | 544c9c53 | `Tests 4 failed \| 80 passed (84)`: the resend (store and layout), the 409, the server's GPC answer |
| Task 2 GREEN | 6a0304ca | `Test Files 4 passed (4)`, `Tests 85 passed (85)` (store, bar, layout, no-long-dash) |
| Task 3 RED | eec411cb | `Tests 5 failed \| 50 passed (55)`: bar scroll padding, root padding, no phone Contact bar, the 92px and 204px token |
| Task 3 GREEN | 3d263319 | `Test Files 5 passed (5)`, `Tests 110 passed (110)`; Chromium self-test 4 passed |
| Hardening | c2315172 | RED `1 failed \| 29 passed` (blocked cookie), GREEN `Tests 92 passed (92)` |

Tests that pass on arrival (recorded, not hidden): in Task 2 the new Reject All, equal-choice, phone-grid, GPC, map-only and settings-state cases passed when added, because Task 1 already built those parts. The machine classifier (`tdd-red-evidence`) was not run; the RED evidence is quoted from the console output, and each RED failed on the planned assertion, not on a load error.

## Verification (real output)

- Web subset after the last change (`src/modules/public src/layouts src/test src/ui src/core src/components`): `Test Files 119 passed (119)`, `Tests 2844 passed (2844)`.
- Typecheck (`tsc` on the three projects), lint (`eslint . --max-warnings 0`) and `format:check`, run on the final tree: all exit 0; prettier says "All matched files use Prettier code style!".
- Full web suite on the Task 3 tree (run while tsc and eslint shared the machine): `Tests 6 failed | 10955 passed (10961)`. Of the six: two were this plan's (ContactPage and GalleryPage read `role="status"` by name and found the new always-present line; fixed in c2315172, both pass now); three admin tests (OrderRefundModal, TestimonialsTab, admin routes) timed out under load and pass alone (237 passed across those files and the layout tests); `scripts/license-policy.test.ts` fails in this worktree before and after this plan (the license checker finds no packages here, as 12-31 also recorded).
- Production build (`npm --prefix web run build`): Home 149.15 KB, Products 145.84, Gallery 147.14, **Contact 149.11**, Privacy 147.93, Cookies 147.93, Terms 147.93, Accessibility 148.67, Not found 141.81, Admin JS 221.11, CSS 20.39. Budget build (`build:budget`, run before the last small additions): Home 149.15, Contact 149.10. Limit 150.00 KB, unchanged. Baseline in this worktree without the slot (build:budget): Home 147.75, Contact 147.71.
- E2E after the preflight (ports free, no other dev or test process): `npm --prefix web run e2e -- --grep "@public|default consent cookie"`: **127 passed (9.2m)** across chromium, firefox, webkit, pixel and iphone. That includes the new fixture self-tests in all three engines (decided mode, `consent: 'none'`, bar on the bottom edge at 1280px and 320px, within the token, no sideways scroll). No server was left running afterwards.

## Bundle budget: how it was kept (PERF-01)

The first build put Contact at 150.43 KB (over). Three steps brought it back, each measured:

1. The Cookie Policy version alone moved to `consentPolicy.ts`, so `legalPages.ts` stays out of the first download.
2. The save path (`consentSave.ts`) and the service load on demand. 149.89 to 149.57 KB.
3. The cookie rules (parse, version, day and 12-month checks, Manila day) moved to a lazy chunk, and the cookie reader moved to `consentJar.ts` (re-exported by `consentCookie.ts`). 148.81 KB. The Task 3 padding classes and the resend effect then brought Contact to 149.11 KB.

**Room left for plan 12-13 (footer row): about 0.9 KB on Contact and Home (149.11 and 149.15 of 150.00).** Not Contact and Home alone: every public row grew by about 1.4 KB. If 12-13 needs more, the next lever is to load the footer's Cookie Settings button logic lazily, or to move the `ConsentSlot` loader into the route table; the limit must not move.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The consent date is the Manila business day, not the device date**
- **Found during:** Task 1 (orchestrator note, D-43)
- **Issue:** the plan says `today` comes "from the device date"; a device zone behind Manila would read a cookie the server set today as future-dated and ask again.
- **Fix:** the store uses `manilaBusinessDay(new Date())` and derives stats and map permission through `isCurrentChoice`. A test with the device date a day behind proves it. The E2E default cookie uses the same day.
- **Commits:** 7016a476, 544c9c53

**2. [Rule 3 - Blocking] The first build put Contact over the 150 KB limit**
- **Found during:** Task 1 (`build:budget`: Home 150.48, Contact 150.43)
- **Fix:** the lazy split above (new files `consentJar.ts`, `consentRules.ts`, `consentSave.ts`, `consentPolicy.ts`; `legalPages.ts` reads the policy version from `consentPolicy.ts`; `consentCookie.ts` re-exports the cookie name and reader from `consentJar.ts`). This changed the store's contract in one way: with a saved cookie, `cookie` is null and the saved choice is trusted until the rules chunk loads (a few milliseconds from cache). A first visit needs no rules.
- **Consequence for the plan's grep:** `import('../services/consentService')` is now in `consentSave.ts` (`import('./services/consentService')`), not in `useConsent.ts`; the intent (the service and HTTP client load lazily) holds. `useConsent.ts` holds `import('../consentRules')` and `import('../consentSave')`.
- **Commits:** 544c9c53 and the figures above.

**3. [Rule 3 - Blocking] The stylesheet contract allows no media rule in `app.css`**
- **Issue:** the plan wants `--spacing-consent-bar` to be 204px at 767px and below and 92px above, inside `app.css`. `stylesheet-contract.node.test.ts` allows only at-rules, never a selector or media block, there.
- **Fix:** the token is 92px in `app.css`; `PublicLayout` sets it to 204px at 767px and below with the existing `vp-lt-md:[:root:has(&)]` pattern. The consumer sees one token that is 204 or 92, as the UI-SPEC says. `consent-look.node.test.ts` pins both numbers to the bar's parts (16 + 3 lines of 20 + 16, and the phone sum).

**4. [Rule 2 - Missing critical] A browser that refuses the cookie must not be nagged**
- **Found during:** review of the "MUST NOT nag" prohibition
- **Issue:** if the browser will not store the provisional cookie (cookies blocked), the store re-read an empty jar and the bar stayed open after the click.
- **Fix:** the choice is also held in memory for the page. Test: RED `1 failed`, GREEN `92 passed`. Commit c2315172.

**5. [Rule 1 - Bug] The always-present saved line broke two page tests**
- **Found during:** the full web run
- **Issue:** a `role="status"` line on every public page made `getByRole('status')` in ContactPage and GalleryPage tests find two.
- **Fix:** the line is `aria-live="polite"` with `data-consent-status`. Same behavior for a screen reader, no role clash. Commit c2315172.

**6. [Rule 2 - Missing critical] Bottom padding on the page root**
- **Issue:** the UI-SPEC asks only for a scroll padding. A fixed bar still covers the last footer row when the page is scrolled to the end, and scroll padding cannot add scroll room.
- **Fix:** while the bar shows, the page root gets the same height as real bottom padding (`pb-[calc(var(--spacing-consent-bar)+env(safe-area-inset-bottom))]`). Tested.

**7. [Rule 3 - Blocking] Smaller items**
- `web/src/test/consentFixtures.ts` and `web/src/test/consent-look.node.test.ts` are new files not in the plan's list (the in-memory cookie jar, MSW probe and the token pin); `web/src/test/setup.ts` resets the shared store before each test with a decided Reject All and waits for the rules chunk, so the first test of a file sees the same state as the last.
- `web/node_modules` was missing in the worktree: `npm ci` against the lockfile (no package added or bumped; `git status` shows no package file change).
- The commit trailer is `Co-Authored-By: Claude Sonnet 5.5`, as in plans 12-08 and 12-31 (the plan text says Opus 5.5; the session attribution rule names this model).
- The per-plan HEAD ledger could not be written under the git dir from this worktree; the base `f7b99813` was recorded from the spawn-time assertion and `commits: 8` was measured with `git rev-list --count f7b99813..HEAD` before the summary commit.
- `npm --prefix web exec prettier` cannot find its plugin from the repo root; prettier was run from `web/` with `node node_modules/prettier/bin/prettier.cjs`. A `prettier --write` on `docs/web/budgets.md` reformatted the whole table block, so it was reverted and only the new section was added.
- A first full-web run overlapped with `tsc` and `eslint` and took 16 minutes; one `no-long-dash.node.test.ts` run timed out at 5.3 s under that load and passed alone.

## Decisions for the owner or later plans (none block this plan)

- **Specs that open a second browser context** (`browser.newContext`, about ten admin and link-preview specs) do not get the default consent cookie; only the test's own context does. They are admin flows, so the bar does not show there. A public-page spec that opens its own context should call `addDecidedConsent(context, baseURL)`.
- **Plan 12-13** (footer Cookie Settings, settings window): use `openSettings(opener)` and `closeSettings()` from the store; `closeSettings` returns focus to the opener if it is still on the page. When a save closes the bar, focus goes to `main`, as in the bar. `ConsentSlot` is where the window mounts, lazily.
- **Plan 12-24 backstop:** the real bar height is at most `--spacing-consent-bar` at 1280px and 320px (self-tested here in Chromium, Firefox and WebKit); the token is read from the document element and is 204px only while the layout's `main` is rendered.
- **Resend source:** a resend after a page reload uses source `bar`, because the cookie does not hold where the choice was made.

## Known Stubs

None.

## Threat Flags

None new. T-12-25 is mitigated: no cookie or storage write and no request before a choice (tested in the layout and store), the bar, save path, rules and service load only when needed. T-12-26 (page script edits the provisional cookie): the client sends only what the cookie says and the server never issues a visitor id from a cookie alone (12-08); no new surface here. T-12-27 is mitigated: a 409 removes the provisional cookie and the bar returns (tested). T-12-SC: no package added or bumped. The only `document.cookie` write is the provisional consent cookie (Path=/, Secure, SameSite=Lax, 12-month Max-Age, pending marker), written only after a choice.

## Self-Check: PASSED

- Files found: `useConsent.ts`, `consentRules.ts`, `consentSave.ts`, `consentJar.ts`, `consentPolicy.ts`, `consentCopy.ts`, `consentService.ts`, `ConsentSlot.tsx`, `ConsentBar.tsx`, `consent.recipe.ts`, `consentFixtures.ts`, `consent-look.node.test.ts`, `web/e2e/fixtures.ts`.
- All 8 plan commits are on the branch (`git log f7b99813..HEAD`): f21392e5, 7016a476, 544c9c53, 6a0304ca, eec411cb, 3d263319, c2315172, 90904ae1. The SUMMARY commit follows them.
- Acceptance greps: consent sentence in `consentCopy.ts` 1; `ConsentSlot` in `PublicLayout.tsx` 3; `SPEC-GAP` in `ConsentBar.tsx` 1; `resendPending` in `PublicLayout.tsx` 3; `globalPrivacyControl` in `useConsent.ts` 1; `spacing-consent-bar` in `app.css` 3 lines (the comment names it at both widths); `legal-pages.json` in `fixtures.ts` 2; `SPEC-DEVIATION: D-30` in `PublicLayout.tsx` 1. The one that differs: `import('../services/consentService')` in `useConsent.ts` is 0, because the dynamic import moved to `consentSave.ts` (1) for the bundle budget (Deviation 2).
- STATE.md and ROADMAP.md untouched.
