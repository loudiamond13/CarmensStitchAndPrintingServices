---
phase: 12-consent-analytics-legal
plan: 24
subsystem: testing
tags: [playwright, e2e, consent, gpc, cookies, lighthouse, a11y, wcag-2.4.11]
created: "2026-11-17T21:20:00-06:00"
updated: "2026-11-17T21:20:00-06:00"

requires:
  - phase: 12-consent-analytics-legal
    provides: "consent bar and Cookie Settings (12-09, 12-13, 12-15), page view beacon and speed reader (12-16), Clear my cookies & data (12-17), Cookie Policy (12-19), map card consent (12-20), the e2e consent fixture option (12-09)"
provides:
  - "@consent journeys (consent.spec.ts): first visit, Accept All, Reject All, Cookie Settings from bar and footer, Clear, 320px Clear dialog, D-30, D-18"
  - "@gpc journeys (gpc.spec.ts): Sec-GPC header plus navigator.globalPrivacyControl"
  - "@consent focus walk and bar height check (consent-focus.spec.ts)"
  - "@public-sweep covers /privacy, /cookies, /terms and /accessibility"
  - "Lighthouse first-visit record with a bar on/off comparison in docs/web/budgets.md"
affects: [12-22 owner review, 12 verify, 12 ship, Lighthouse gate, docs/web/e2e.md]

actuals:
  tokens: 11014
  tasks: 3
  commits: 3
plan_head_before: e081aaa2bf1eeea25a391ba713fff5f63e42ef8d
plan_head_after: 70266a656819578324372303751eb4952aff6db5

tech-stack:
  added: []
  patterns:
    - "Map frame checks scroll the loading=lazy iframe into view first (WebKit loads it only near the window)"
    - "Dialog geometry is measured after finite animations finish (the rise starts at scale 0.98)"
    - "GPC in e2e: test.use extraHTTPHeaders Sec-GPC plus an init script defining navigator.globalPrivacyControl"

key-files:
  created:
    - web/e2e/consent.spec.ts
    - web/e2e/gpc.spec.ts
    - web/e2e/consent-focus.spec.ts
  modified:
    - web/e2e/public-sweep.spec.ts
    - docs/web/budgets.md
    - docs/web/e2e.md

key-decisions:
  - "No app code changed. The two WebKit failures and the 320px height miss were test problems (lazy iframe, click does not focus in Safari, entry animation), fixed in the specs."
  - "Legal pages in the sweep may show only the shop's own email and its mailto link (12 D-29); every other page keeps the no-email checks."
  - "Firefox focus walk records a partly covered control as an annotation and fails only when it is entirely hidden, the same rule as @public-sweep (D-70 to D-72)."
  - "The Lighthouse gate was not changed. It is not green because /gallery misses 0.95 on the dev database; this is recorded for the owner, not worked around."

patterns-established:
  - "Consent e2e specs start with test.use({ consent: 'none' }) and wait for the consent POST before reading the cookie jar"

requirements-completed: [ANL-01, ANL-02, ANL-03, ANL-04, ANL-07, LEGAL-05]

coverage:
  - id: D1
    description: "First visit sets no cookie, calls no Google, loads no speed reader and holds the page view until a choice; then the view leaves once with the path only"
    requirement: ANL-01
    verification:
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent a first visit sets no cookie, calls no Google, loads no speed reader and holds the page view until a choice"
        status: pass
    human_judgment: false
  - id: D2
    description: "Accept All sets the readable consent cookie and the HttpOnly visitor id on /api/v1/analytics and loads the speed reader; Reject All sets no visitor id and loads no speed reader"
    requirement: ANL-01
    verification:
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent Accept All saves both, sets the visitor id with its attributes, loads the speed reader and the bar stays away"
        status: pass
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent Reject All saves both off, sets no visitor id and never loads the speed reader"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cookie Settings from the bar opens unticked and saves Visitor stats alone; from the footer it shows the saved choice"
    requirement: ANL-03
    verification:
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent Cookie Settings from the bar opens unticked and saves Visitor stats alone; from the footer it shows that choice"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clear my cookies & data removes the visitor id and local and session storage, leaves a stats 0 map 0 choice, and the bar stays away; at 320px the dialog fits and its buttons stack at 44px"
    requirement: ANL-04
    verification:
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent Clear my cookies & data removes the visitor id and storage, leaves both off, and the bar stays away"
        status: pass
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent at 320px the Clear dialog text wraps, its two buttons stack at 44px each and nothing scrolls sideways"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-30 Contact bar waits for the choice at 390px; D-18 Always show maps? saves the map part and a reload shows the map with no tap"
    requirement: ANL-07
    verification:
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent D-30 on Contact at 390px the Messenger and Call bar waits while the cookie bar shows and returns after a choice"
        status: pass
      - kind: e2e
        ref: "web/e2e/consent.spec.ts#@consent D-18 Show Map then \"Always show maps?\" saves map consent, and a reload shows the map at once"
        status: pass
    human_judgment: false
  - id: D6
    description: "GPC browser: no bar, no cookie, no speed reader; Cookie Settings shows the GPC note with Visitor stats locked off; allowing the map works and keeps stats 0"
    requirement: ANL-02
    verification:
      - kind: e2e
        ref: "web/e2e/gpc.spec.ts#@gpc a GPC browser sees no cookie bar, gets no cookie and loads no speed reader"
        status: pass
      - kind: e2e
        ref: "web/e2e/gpc.spec.ts#@gpc Cookie Settings shows the GPC note with Visitor stats locked off, and allowing the map works with stats kept off"
        status: pass
    human_judgment: false
  - id: D7
    description: "Focus is never hidden under the bar (Home, Gallery, Contact at 390 and 1440px) and the real bar fits --spacing-consent-bar at 320, 390, 820 and 1440px"
    verification:
      - kind: e2e
        ref: "web/e2e/consent-focus.spec.ts (7 tests per project)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The four legal pages pass the public sweep (one h1, no sideways scroll, zero axe, no console or CSP finding, only the shop email, base footer) in all five projects"
    requirement: LEGAL-05
    verification:
      - kind: e2e
        ref: "web/e2e/public-sweep.spec.ts#@public-sweep Privacy Policy / Cookie Policy / Terms of Use / Accessibility Statement ..."
        status: pass
    human_judgment: false
  - id: D9
    description: "Lighthouse first visit with the bar showing: every category at least 0.95 on all four pages"
    verification:
      - kind: other
        ref: "npm --prefix web run lighthouse (3 runs)"
        status: fail
    human_judgment: true
    rationale: "The gate failed in all three runs on /gallery (0.91, 0.94, 0.93) with the dev database, whose Gallery LCP is a real Cloudinary photo; the bar is not the cause (A/B in docs/web/budgets.md). The owner must choose how the gate measures Gallery."

duration: 2h 5m
completed: 2026-11-17
status: complete
---

# Phase 12 Plan 24: End-to-end proof that consent, GPC and Clear behave as promised in real browsers Summary

**Playwright journeys in Chromium, Firefox, WebKit, Pixel and iPhone prove the cookie bar, Cookie Settings, Clear, GPC and the map consent do what the code promises, the legal pages pass the public sweep, and Lighthouse shows the bar is never the LCP element. The Lighthouse gate is still not green, because `/gallery` misses 0.95 on its real dev photos.**

*Created: 2026-11-17T21:20:00-06:00 · Updated: 2026-11-17T21:20:00-06:00*

## Performance

- **Duration:** about 2 h 5 min (most of it Playwright and Lighthouse runs)
- **Started:** 2026-11-18T01:15:00Z
- **Completed:** 2026-11-18T03:20:00Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (3 new specs, 1 spec changed, 2 docs)

## Accomplishments

- `consent.spec.ts` (@consent, 8 tests): first visit, Accept All, Reject All, Cookie Settings from the bar and the footer, Clear my cookies & data, the 320px Clear dialog, D-30 on Contact and D-18 "Always show maps?".
- `gpc.spec.ts` (@gpc, 2 tests): `Sec-GPC: 1` plus `navigator.globalPrivacyControl` true; no bar, no cookie, no speed reader; Visitor stats locked off; the map can still be allowed.
- `consent-focus.spec.ts` (@consent, 7 tests): a Tab walk through Home, Gallery and Contact at 390 and 1440px with the bar showing, and the real bar height against `--spacing-consent-bar` at 320, 390, 820 and 1440px.
- `public-sweep.spec.ts`: the four legal pages join the sweep in all five projects.
- `docs/web/budgets.md`: three Lighthouse gate runs, a bar on/off comparison, the LCP element of each page. `docs/web/e2e.md`: rows for @consent and @gpc, and the wider @public-sweep.

## Task Commits

1. **Task 1: consent journeys** - `4cd98a39` (test)
2. **Task 2: GPC and focus under the bar** - `257434fb` (test)
3. **Task 3: legal pages in the sweep and the Lighthouse record** - `70266a65` (test)

## Evidence (commands and results, quoted)

Every run was started after `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` showed the four ports free and no other project's test processes.

| Command | Result |
|---|---|
| `npm --prefix web run e2e -- --grep "@consent\|@gpc"` (final run, all five projects) | `85 passed (9.7m)`, exit 0 |
| `npm --prefix web run e2e -- --grep @public-sweep` (all five projects) | `75 passed (17.4m)`, exit 0 (20 of them are the new legal page tests) |
| `npm --prefix web run e2e -- e2e/consent-focus.spec.ts --project firefox --reporter=list,json` | `7 passed (1.7m)`, used to read the Firefox annotations |
| `npm --prefix web run lighthouse` run 1 | exit 1: `/` 0.92, `/gallery` 0.91, `/contact` 0.93 performance (after another executor's coverage run) |
| `npm --prefix web run lighthouse` run 2 | exit 1: only `/gallery: category performance: 0.94 (needs >= 0.95) FAIL` |
| `npm --prefix web run lighthouse` run 3 | exit 1: only `/gallery: category performance: 0.93 (needs >= 0.95) FAIL` |
| `npm --prefix web run lint` / `typecheck` / `format:check` | `eslint . --max-warnings 0` clean, three `tsc` projects clean, `All matched files use Prettier code style!` |
| `gitleaks git --pre-commit --staged --redact --config .gitleaks.toml --no-banner` before each commit | `no leaks found` (3 times) |

Acceptance criteria: `grep -c "@consent" web/e2e/consent.spec.ts` = 8; `grep -c "Sec-GPC" web/e2e/gpc.spec.ts` = 2; `grep -c "spacing-consent-bar" web/e2e/consent-focus.spec.ts` = 4; `grep -c "/accessibility" web/e2e/public-sweep.spec.ts` = 1; `grep -c "consent bar" docs/web/budgets.md` = 3. `grep -c "from './fixtures'" web/e2e/consent.spec.ts` = 0, see deviation 4.

**TDD note.** These are end-to-end tests of shipped behavior, so they were shown to pass against it, not written red first. Three runs did go red, each for a reason in the test (deviations 1 and 2); each was traced (trace files, error context) before the fix, and the fixed tests then passed in every project.

## Files Created/Modified

- `web/e2e/consent.spec.ts` - the @consent journeys (cookie jar, storage and request checks).
- `web/e2e/gpc.spec.ts` - the @gpc journeys.
- `web/e2e/consent-focus.spec.ts` - focus never hidden under the bar, and the bar height check.
- `web/e2e/public-sweep.spec.ts` - Privacy, Cookies, Terms and Accessibility in `PAGES`, the shop-email allowance and the base footer check for them.
- `docs/web/budgets.md` - the section "Lighthouse first visit with the consent bar (Phase 12, plan 12-24)".
- `docs/web/e2e.md` - tag rows.

## Decisions Made

See `key-decisions` above. None changes behavior, wording or limits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - test bug] The 320px Clear dialog measured during its entry animation**
- **Found during:** Task 1, first Chromium run.
- **Issue:** `Keep My Data` read 43.74px tall, under 44. The dialog rises in from `scale(0.98)` (`csp-rise`), and 44 x 0.994 is 43.74, so the button was measured mid-animation.
- **Fix:** wait for finite animations to finish before measuring (the same wait `expectNoAxeViolations` uses).
- **Files modified:** `web/e2e/consent.spec.ts`
- **Verification:** passes in all five projects.
- **Committed in:** `4cd98a39`

**2. [Rule 1 - test bug] Two WebKit-only failures (webkit and iphone)**
- **Found during:** the first all-project run (13 failed: 4 real, 9 waiting for the site content lock that the hung tests held).
- **Issue A:** the D-18 and GPC map checks hung for the full 8 minutes. The trace showed the first frame fulfilled and no second Google request after the reload. The frame is `loading="lazy"`, and WebKit loads a lazy frame only when it is close to the window; Chromium and Firefox load it from further away.
- **Fix A:** check that the frame is present with its Google `src` and no Show Map, then scroll it into view before reading the stub inside it.
- **Issue B:** at 320px, focus did not go back to "Clear My Cookies & Data" after Keep My Data. Safari does not focus a button on a click, so the dialog had no opener focus to give back.
- **Fix B:** open the dialog from the keyboard with the project's `press` helper (as the other dialog specs do).
- **Files modified:** `web/e2e/consent.spec.ts`, `web/e2e/gpc.spec.ts`
- **Verification:** the next all-project run: `85 passed`.
- **Committed in:** `4cd98a39`, `257434fb`

**3. [Rule 2 - docs] `docs/web/e2e.md` updated**
- Not in the plan's file list. The guide lists every tag, so @consent and @gpc were added and the @public-sweep row now names the legal pages. Committed in `70266a65`.

**4. [Criterion wording] `grep -c "from './fixtures'"` returns 0**
- Every spec in the repo imports `from './fixtures.ts'` (with the extension), and so does this one. The criterion's literal text does not match that form; its intent (import `test` and `expect` from the fixture, never from `@playwright/test`) is met. Nothing changed.

**Total deviations:** 2 test fixes, 1 doc addition, 1 criterion wording note. **Impact:** no app code, no package and no limit changed.

## Issues Encountered

- **The Lighthouse gate is not green (plan truth "PERF" not met).** Three runs; `/gallery` missed 0.95 in all three (0.91, 0.94, 0.93), and run 1 also missed on `/` and `/contact` right after another executor's heavy test run. On the Development database (`CSPS_Dev`) the Gallery's LCP element is a real gallery photo fetched from Cloudinary over the internet. A bar on/off comparison on the seeded `CSPS_E2E` data (same build and host, two rounds) gave every page 0.95 to 0.97 with the bar showing; the bar adds 0 to about 160ms of simulated LCP, inside the 200 to 400ms run noise. So the bar is not the cause, and no UI change within the UI-SPEC would fix Gallery. Recorded in `.planning/WINDOWS.md` (unmet-truth) and as owner question 1.
- **Bar text and LCP on phones:** never. The LCP element at Lighthouse's 412px phone width is the hero jersey's SVG name on `/`, the lead paragraph on `/products` and `/contact`, and the first photo on `/gallery` (the h1 on seeded data). Recorded in `docs/web/budgets.md`.
- **`CSPS_Dev` is one migration behind.** The Lighthouse host (Development) logs `Invalid object name 'DailyPageCounts'` and answers 500 to every page view, because plan 12-18's `AddDailyAnalyticsCounts` is not applied there. The scores are not affected (the beacon leaves after load). Not changed: it is the owner's dev database (owner question 2).
- **Firefox focus walk (FYI).** Firefox scrolls a focused control only when none of it is in view, so some tall cards stop partly under the bar there: Home 390px 9 controls, Home 1440px 7, Gallery 1440px 3, Contact 390px 1 (the Messenger card). None is entirely hidden, so WCAG 2.4.11 holds; Chromium, WebKit and the phones keep every box clear. Same rule and same record as @public-sweep (D-70 to D-72).
- **Clear wording (open 12-22 item).** The Clear test reads the done note's exact words ("Done. This site's cookies and your visit records are deleted. Visitor stats and the map are now off."). It checks what the code does: the visitor id and storage are gone and the consent cookie is set again to stats 0 and map 0. It does not check staff sign-in cookies. If the owner picks option B in that item (say "optional cookies"), this one string in `consent.spec.ts` changes with the copy.
- **No flake recorded.** Every failure was traced to a cause above and passed after the fix; nothing passed only on a re-run.

## Open questions for the owner

1. **How should the Lighthouse gate measure the Gallery?** Today it runs on `CSPS_Dev`, whose Gallery shows real photos from Cloudinary, so the page's speed depends on the internet and on the dev data.
   - **A (recommended): run the gate's host on the seeded `CSPS_E2E` data, as plan 11-36 measured.** Reason: the same pages every time, no internet in the score, and it passes today with the bar showing. It is a small tooling change in `web/scripts/lighthouse.mjs` and its unit test, in a quick task.
   - B: keep `CSPS_Dev` and plan a Gallery photo speed fix (for example load the first photo early). Reason: it measures real photos, but it is app work with a bundle cost.
   - C: leave it and treat a Gallery miss as known until font subsetting (plan 11-36 item 2) lands.
2. **Bring `CSPS_Dev` up to date?** **A (recommended): apply the pending migration with the explicit EF tool** (it only adds the daily count tables), so the dev host stops answering 500 to page views. B: leave it until the next owner review session.

## User Setup Required

None.

## Next Phase Readiness

- The consent, GPC, Clear and legal page backstops now run in every browser project; Phase 12 verify can cite them.
- Before ship: the owner's answer to question 1 (the Lighthouse gate is red on `/gallery` until then).

## Self-Check: PASSED

- FOUND: web/e2e/consent.spec.ts, web/e2e/gpc.spec.ts, web/e2e/consent-focus.spec.ts, web/e2e/public-sweep.spec.ts, docs/web/budgets.md, docs/web/e2e.md
- FOUND commits: 4cd98a39, 257434fb, 70266a65 (ancestors of HEAD)

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-17*
